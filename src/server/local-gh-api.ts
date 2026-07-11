import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseUnifiedDiff } from "../features/pull-requests/diff-parser.ts";
import {
  countUnresolvedThreads,
  mapPullRequestBase,
  mapPullRequestReview,
  type RawPullRequestBase,
  type RawPullRequestReview,
  type RawReviewThreads,
} from "../features/pull-requests/mapping.ts";
import type {
  PullRequestReviewModel,
  PullRequestsOverview,
} from "../features/pull-requests/pull-request-model.ts";
import type { GithubCliErrorType, GithubCliStatus } from "../shared/lib/github-cli.ts";

const execFileAsync = promisify(execFile);
const maxPullRequests = 50;
const pullRequestsPageSize = 10;
const reviewThreadsChunkSize = 10;
const maxGhAttempts = 2;

type GhRunner = (args: string[]) => Promise<{
  stderr: string;
  stdout: string;
}>;

type GhAuthStatusResponse = {
  hosts?: Record<
    string,
    Array<{
      active?: boolean;
      error?: string;
      host?: string;
      login?: string;
      state?: string;
    }>
  >;
};

type GraphqlError = {
  message: string;
};

type PullRequestsPageGraphqlResponse = {
  data?: {
    repository: {
      pullRequests: {
        nodes: RawPullRequestBase[];
        pageInfo: {
          endCursor: string | null;
          hasNextPage: boolean;
        };
        totalCount: number;
      };
    } | null;
  };
  errors?: GraphqlError[];
};

type PullRequestReviewThreadsGraphqlResponse = {
  data?: {
    repository: Record<
      string,
      {
        id: string;
        reviewThreads: RawReviewThreads;
      } | null
    > | null;
  };
  errors?: GraphqlError[];
};

type PullRequestReviewGraphqlResponse = {
  data?: {
    repository: {
      pullRequest: RawPullRequestReview | null;
    } | null;
  };
  errors?: GraphqlError[];
};

type PullRequestReviewThreadsPageGraphqlResponse = {
  data?: {
    repository: {
      pullRequest: {
        reviewThreads: RawReviewThreads;
      } | null;
    } | null;
  };
  errors?: GraphqlError[];
};

type ReviewThreadMutationGraphqlResponse = {
  data?: {
    addPullRequestReviewThread?: {
      thread: {
        id: string;
      } | null;
    } | null;
    addPullRequestReviewThreadReply?: {
      comment: {
        id: string;
      } | null;
    } | null;
    resolveReviewThread?: {
      thread: {
        id: string;
        isResolved: boolean;
      } | null;
    } | null;
    unresolveReviewThread?: {
      thread: {
        id: string;
        isResolved: boolean;
      } | null;
    } | null;
  };
  errors?: GraphqlError[];
};

export class LocalGithubError extends Error {
  readonly status: number | null;
  readonly type: GithubCliErrorType;

  constructor(type: GithubCliErrorType, message: string, status?: number | null) {
    super(message);
    this.type = type;
    this.status = status ?? null;
  }
}

export async function getGithubCliStatus(runGh: GhRunner = runGhCommand): Promise<GithubCliStatus> {
  try {
    const { stdout } = await runGh(["auth", "status", "--json", "hosts"]);
    const parsed = JSON.parse(stdout) as GhAuthStatusResponse;
    const host = "github.com";
    const accounts = parsed.hosts?.[host] ?? [];
    const activeAccount = accounts.find((account) => account.active) ?? accounts[0];

    if (!activeAccount) {
      return {
        authenticated: false,
        cliAvailable: true,
        host,
        login: null,
        message: "Run `gh auth login -h github.com` in a terminal, then reload this page.",
      };
    }

    if (activeAccount.error || activeAccount.state === "error") {
      return {
        authenticated: false,
        cliAvailable: true,
        host,
        login: activeAccount.login ?? null,
        message: activeAccount.error
          ? `${activeAccount.error}. Run \`gh auth login -h github.com\` to refresh the local session.`
          : "Run `gh auth login -h github.com` in a terminal, then reload this page.",
      };
    }

    return {
      authenticated: true,
      cliAvailable: true,
      host,
      login: activeAccount.login ?? null,
      message: activeAccount.login
        ? `Connected locally as @${activeAccount.login} through gh.`
        : "Connected locally through gh.",
    };
  } catch (error) {
    if (isGhMissingError(error)) {
      return {
        authenticated: false,
        cliAvailable: false,
        host: "github.com",
        login: null,
        message: "The `gh` CLI was not found. Install GitHub CLI locally to use this dashboard.",
      };
    }

    return {
      authenticated: false,
      cliAvailable: true,
      host: "github.com",
      login: null,
      message: extractCommandMessage(error, "Unable to read local gh authentication status."),
    };
  }
}

export async function getPullRequestsOverview(
  input: {
    owner: string;
    repo: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<PullRequestsOverview> {
  try {
    const summary = await getPullRequestSummaryPage(input, runGh);
    const unresolvedThreadsById = await getUnresolvedThreadCounts(input, summary.items, runGh);

    return {
      hasMore: summary.totalCount > summary.items.length,
      items: summary.items.map((pullRequest) =>
        mapPullRequestBase(pullRequest, unresolvedThreadsById.get(pullRequest.id) ?? 0),
      ),
      totalCount: summary.totalCount,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function getPullRequestReview(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<PullRequestReviewModel> {
  try {
    const [review, diff] = await Promise.all([
      getPullRequestReviewPayload(input, runGh),
      getPullRequestDiff(input, runGh),
    ]);

    return mapPullRequestReview(review, diff);
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function replyToReviewThread(
  input: {
    body: string;
    threadId: string;
  },
  runGh: GhRunner = runGhCommand,
) {
  try {
    await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
      buildReplyToReviewThreadMutation(),
      {
        body: input.body,
        threadId: input.threadId,
      },
      runGh,
    );

    return {
      threadId: input.threadId,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function createReviewThread(
  input: {
    body: string;
    line: number;
    path: string;
    pullRequestId: string;
    side: "LEFT" | "RIGHT";
  },
  runGh: GhRunner = runGhCommand,
) {
  try {
    await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
      buildCreateReviewThreadMutation(),
      {
        body: input.body,
        line: input.line,
        path: input.path,
        pullRequestId: input.pullRequestId,
        side: input.side,
      },
      runGh,
    );

    return {
      line: input.line,
      path: input.path,
      side: input.side,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function setReviewThreadResolved(
  input: {
    isResolved: boolean;
    threadId: string;
  },
  runGh: GhRunner = runGhCommand,
) {
  try {
    await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
      input.isResolved ? buildResolveReviewThreadMutation() : buildUnresolveReviewThreadMutation(),
      {
        threadId: input.threadId,
      },
      runGh,
    );

    return {
      isResolved: input.isResolved,
      threadId: input.threadId,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

async function getPullRequestReviewPayload(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  runGh: GhRunner,
) {
  const parsed = await runGraphqlQuery<PullRequestReviewGraphqlResponse>(
    buildPullRequestReviewQuery(input.number),
    {
      owner: input.owner,
      repo: input.repo,
    },
    runGh,
  );

  if (!parsed.data?.repository?.pullRequest) {
    throw new LocalGithubError(
      "repo",
      "This pull request could not be found or is not accessible through gh.",
      404,
    );
  }

  const pullRequest = parsed.data.repository.pullRequest;
  const reviewThreads = await getPullRequestReviewThreadsPages(
    input,
    pullRequest.reviewThreads,
    runGh,
  );

  return {
    ...pullRequest,
    reviewThreads,
  };
}

async function getPullRequestReviewThreadsPages(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  firstPage: RawReviewThreads,
  runGh: GhRunner,
) {
  const nodes = [...firstPage.nodes];
  let pageInfo = firstPage.pageInfo;

  while (pageInfo.hasNextPage && pageInfo.endCursor) {
    const parsed = await runGraphqlQuery<PullRequestReviewThreadsPageGraphqlResponse>(
      buildPullRequestReviewThreadsPageQuery(input.number, pageInfo.endCursor),
      {
        owner: input.owner,
        repo: input.repo,
      },
      runGh,
    );

    const reviewThreads = parsed.data?.repository?.pullRequest?.reviewThreads;

    if (!reviewThreads) {
      throw new LocalGithubError(
        "repo",
        "This pull request could not be found or is not accessible through gh.",
        404,
      );
    }

    nodes.push(...reviewThreads.nodes);
    pageInfo = reviewThreads.pageInfo;
  }

  return {
    nodes,
    pageInfo,
  };
}

async function getPullRequestDiff(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  runGh: GhRunner,
) {
  const { stdout } = await runGhCommandWithRetry(
    [
      "api",
      `repos/${input.owner}/${input.repo}/pulls/${input.number}`,
      "-H",
      "Accept: application/vnd.github.v3.diff",
    ],
    runGh,
  );

  return parseUnifiedDiff(stdout);
}

async function getPullRequestSummaryPage(
  input: {
    owner: string;
    repo: string;
  },
  runGh: GhRunner,
) {
  const items: RawPullRequestBase[] = [];
  let afterCursor: string | null = null;
  let totalCount = 0;

  while (items.length < maxPullRequests) {
    const remaining = maxPullRequests - items.length;
    const parsed: PullRequestsPageGraphqlResponse =
      await runGraphqlQuery<PullRequestsPageGraphqlResponse>(
        buildPullRequestsPageQuery(Math.min(pullRequestsPageSize, remaining), afterCursor),
        input,
        runGh,
      );

    if (!parsed.data?.repository) {
      throw new LocalGithubError(
        "repo",
        "This repository could not be found or is not accessible through gh.",
        404,
      );
    }

    const connection: NonNullable<
      NonNullable<PullRequestsPageGraphqlResponse["data"]>["repository"]
    >["pullRequests"] = parsed.data.repository.pullRequests;
    items.push(...connection.nodes);
    totalCount = connection.totalCount;

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break;
    }

    afterCursor = connection.pageInfo.endCursor;
  }

  return {
    items,
    totalCount,
  };
}

async function getUnresolvedThreadCounts(
  input: {
    owner: string;
    repo: string;
  },
  pullRequests: RawPullRequestBase[],
  runGh: GhRunner,
) {
  const unresolvedThreadsById = new Map<string, number>();

  for (const chunk of chunkItems(pullRequests, reviewThreadsChunkSize)) {
    const parsed: PullRequestReviewThreadsGraphqlResponse =
      await runGraphqlQuery<PullRequestReviewThreadsGraphqlResponse>(
        buildReviewThreadsQuery(chunk.map((pullRequest) => pullRequest.number)),
        input,
        runGh,
      );

    if (!parsed.data?.repository) {
      throw new LocalGithubError(
        "repo",
        "This repository could not be found or is not accessible through gh.",
        404,
      );
    }

    for (const pullRequest of chunk) {
      const result = parsed.data.repository[getPullRequestAlias(pullRequest.number)];

      if (!result) {
        unresolvedThreadsById.set(pullRequest.id, 0);
        continue;
      }

      unresolvedThreadsById.set(pullRequest.id, countUnresolvedThreads(result.reviewThreads));
    }
  }

  return unresolvedThreadsById;
}

async function runGraphqlQuery<T extends { errors?: GraphqlError[] }>(
  query: string,
  input: Record<string, number | string>,
  runGh: GhRunner,
) {
  const { stdout } = await runGhCommandWithRetry(
    [
      "api",
      "graphql",
      ...Object.entries(input).flatMap(([key, value]) => [
        typeof value === "number" ? "-F" : "-f",
        `${key}=${value}`,
      ]),
      "-f",
      `query=${query}`,
    ],
    runGh,
  );
  const parsed = JSON.parse(stdout) as T;

  if (parsed.errors?.length) {
    throw new LocalGithubError(
      "unknown",
      parsed.errors[0]?.message ?? "GitHub CLI returned an unexpected GraphQL error.",
    );
  }

  return parsed;
}

async function runGhCommandWithRetry(args: string[], runGh: GhRunner) {
  let attempt = 0;
  let lastError: LocalGithubError | null = null;

  while (attempt < maxGhAttempts) {
    try {
      return await runGh(args);
    } catch (error) {
      const normalized = normalizeGhError(error);

      if (!isRetryableGhError(normalized) || attempt === maxGhAttempts - 1) {
        throw normalized;
      }

      lastError = normalized;
      attempt += 1;
    }
  }

  throw lastError ?? new LocalGithubError("unknown", "gh returned an unexpected error.", 500);
}

function buildPullRequestsPageQuery(first: number, afterCursor: string | null) {
  const after = afterCursor ? `\n        after: ${JSON.stringify(afterCursor)}` : "";

  return `
    query PullRequestsOverview($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequests(
          first: ${first}
          states: OPEN
          orderBy: { field: UPDATED_AT, direction: DESC }${after}
        ) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            id
            number
            title
            url
            baseRefName
            headRefName
            updatedAt
            isDraft
            mergeable
            mergeStateStatus
            repository {
              nameWithOwner
            }
            statusCheckRollup {
              state
            }
            author {
              login
            }
          }
        }
      }
    }
  `;
}

function buildReviewThreadsQuery(numbers: number[]) {
  const fields = numbers
    .map(
      (number) => `
        ${getPullRequestAlias(number)}: pullRequest(number: ${number}) {
          id
          reviewThreads(first: 100) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              isResolved
              isOutdated
            }
          }
        }
      `,
    )
    .join("\n");

  return `
    query PullRequestReviewThreads($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        ${fields}
      }
    }
  `;
}

function buildPullRequestReviewQuery(number: number) {
  return `
    query PullRequestReview($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: ${number}) {
          id
          number
          title
          url
          baseRefName
          headRefName
          updatedAt
          isDraft
          mergeable
          mergeStateStatus
          additions
          deletions
          changedFiles
          repository {
            nameWithOwner
          }
          statusCheckRollup {
            state
          }
          author {
            login
          }
          reviewThreads(first: 100) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              ${buildReviewThreadDetailFields()}
            }
          }
        }
      }
    }
  `;
}

function buildPullRequestReviewThreadsPageQuery(number: number, afterCursor: string) {
  return `
    query PullRequestReviewThreadsPage($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: ${number}) {
          reviewThreads(first: 100, after: ${JSON.stringify(afterCursor)}) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              ${buildReviewThreadDetailFields()}
            }
          }
        }
      }
    }
  `;
}

function buildReviewThreadDetailFields() {
  return `
    id
    diffSide
    isOutdated
    isResolved
    line
    originalLine
    originalStartLine
    path
    startDiffSide
    startLine
    resolvedBy {
      login
    }
    comments(first: 100) {
      nodes {
        id
        body
        createdAt
        line
        originalLine
        path
        url
        author {
          login
        }
        replyTo {
          id
        }
      }
    }
  `;
}

function buildReplyToReviewThreadMutation() {
  return `
    mutation ReplyToReviewThread($threadId: ID!, $body: String!) {
      addPullRequestReviewThreadReply(
        input: { pullRequestReviewThreadId: $threadId, body: $body }
      ) {
        comment {
          id
        }
      }
    }
  `;
}

function buildCreateReviewThreadMutation() {
  return `
    mutation CreateReviewThread(
      $body: String!
      $line: Int!
      $path: String!
      $pullRequestId: ID!
      $side: DiffSide!
    ) {
      addPullRequestReviewThread(
        input: {
          body: $body
          line: $line
          path: $path
          pullRequestId: $pullRequestId
          side: $side
        }
      ) {
        thread {
          id
        }
      }
    }
  `;
}

function buildResolveReviewThreadMutation() {
  return `
    mutation ResolveReviewThread($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread {
          id
          isResolved
        }
      }
    }
  `;
}

function buildUnresolveReviewThreadMutation() {
  return `
    mutation UnresolveReviewThread($threadId: ID!) {
      unresolveReviewThread(input: { threadId: $threadId }) {
        thread {
          id
          isResolved
        }
      }
    }
  `;
}

function getPullRequestAlias(number: number) {
  return `pr_${number}`;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function runGhCommand(args: string[]) {
  const result = await execFileAsync("gh", args, {
    env: {
      ...process.env,
      GH_FORCE_TTY: "0",
      GH_PAGER: "cat",
      NO_COLOR: "1",
    },
    maxBuffer: 1024 * 1024 * 32,
  });

  return {
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function normalizeGhError(error: unknown) {
  if (error instanceof LocalGithubError) {
    return error;
  }

  if (isGhMissingError(error)) {
    return new LocalGithubError(
      "cli",
      "The `gh` CLI was not found. Install GitHub CLI locally to use this dashboard.",
      500,
    );
  }

  const combinedMessage = extractCommandMessage(
    error,
    "gh returned an unexpected error while loading pull requests.",
  );
  const normalized = combinedMessage.toLowerCase();

  if (
    normalized.includes("authentication failed") ||
    normalized.includes("token is invalid") ||
    normalized.includes("try authenticating with") ||
    normalized.includes("http 401")
  ) {
    return new LocalGithubError(
      "auth",
      "Your local gh session is not authenticated. Run `gh auth login -h github.com` and retry.",
      401,
    );
  }

  if (
    normalized.includes("could not resolve to a repository") ||
    normalized.includes("not found") ||
    normalized.includes("http 404")
  ) {
    return new LocalGithubError(
      "repo",
      "This repository could not be found or is not accessible through gh.",
      404,
    );
  }

  if (
    normalized.includes("http 502") ||
    normalized.includes("bad gateway") ||
    normalized.includes("http 503") ||
    normalized.includes("gateway timeout") ||
    normalized.includes("no such host") ||
    normalized.includes("dial tcp") ||
    normalized.includes("network is unreachable")
  ) {
    return new LocalGithubError(
      "network",
      "The local gh CLI could not reach GitHub cleanly or GitHub returned a temporary upstream error. Retry in a few seconds.",
      502,
    );
  }

  if (normalized.includes("rate limit")) {
    return new LocalGithubError(
      "unknown",
      "GitHub rate-limited the local gh session. Retry after the current limit window resets.",
      429,
    );
  }

  return new LocalGithubError("unknown", combinedMessage, 500);
}

function isRetryableGhError(error: LocalGithubError) {
  return error.type === "network" || error.status === 502;
}

function extractCommandMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const ghError = error as Error & {
    stderr?: string;
    stdout?: string;
  };

  const message = [ghError.stderr, ghError.stdout, error.message]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return message || fallback;
}

function isGhMissingError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as NodeJS.ErrnoException).code === "string" &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
