import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  parsePullRequestFiles,
  parseUnifiedDiff,
  type RawPullRequestFile,
} from "../features/pull-requests/diff-parser.ts";
import {
  countUnresolvedThreads,
  getPendingReviewId,
  mapPullRequestBase,
  mapPullRequestReview,
  mapReactionGroups,
  mapReviewComment,
  mapReviewDecision,
  mapReviewState,
  mapReviewThread,
  type RawPullRequestBase,
  type RawPullRequestFiles,
  type RawPullRequestReview,
  type RawReactionGroup,
  type RawReviewComment,
  type RawReviewThread,
  type RawReviewThreads,
} from "../features/pull-requests/mapping.ts";
import type {
  CreateReviewThreadResult,
  DeletePendingCommentResult,
  PullRequestCardModel,
  PullRequestReviewModel,
  PullRequestsOverview,
  PullRequestsSyncProgress,
  ReplyToReviewThreadResult,
  RepositoryFileContent,
  SetCommentReactionResult,
  SetFileViewedResult,
  SetReviewThreadResolvedResult,
  SubmitReviewResult,
} from "../features/pull-requests/pull-request-model.ts";
import { isReactionContent } from "../features/pull-requests/reactions.ts";
import type { GithubCliErrorType, GithubCliStatus } from "../shared/lib/github-cli.ts";

const execFileAsync = promisify(execFile);
const maxPullRequests = 50;
const pullRequestsPageSize = 10;
const reviewThreadsChunkSize = 10;
const pullRequestFilesPageSize = 100;
// GitHub lists at most 3,000 files per pull request.
const maxPullRequestFilesPages = 30;
const pullRequestFilesConcurrency = 4;
const reviewEvents = new Set(["APPROVE", "COMMENT", "REQUEST_CHANGES"]);
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

type PullRequestFilesPageGraphqlResponse = {
  data?: {
    repository: {
      pullRequest: {
        files: RawPullRequestFiles;
      } | null;
    } | null;
  };
  errors?: GraphqlError[];
};

type ReviewThreadResolutionPayload = {
  thread: {
    id: string;
    isResolved: boolean;
    resolvedBy: {
      login: string;
    } | null;
  } | null;
} | null;

type ReviewSubmissionPayload = {
  pullRequestReview: {
    pullRequest: {
      reviewDecision: string | null;
    };
    state: string;
  } | null;
} | null;

type PendingReviewGraphqlResponse = {
  data?: {
    node: {
      reviews?: {
        nodes: Array<{
          id: string;
        }>;
      };
    } | null;
  };
  errors?: GraphqlError[];
};

type ReviewCommentStateGraphqlResponse = {
  data?: {
    node: {
      state?: string;
    } | null;
  };
  errors?: GraphqlError[];
};

type ReviewSubmissionGraphqlResponse = {
  data?: {
    addPullRequestReview?: ReviewSubmissionPayload;
    submitPullRequestReview?: ReviewSubmissionPayload;
  };
  errors?: GraphqlError[];
};

type CommentReactionGraphqlResponse = {
  data?: {
    addReaction?: {
      reactionGroups: RawReactionGroup[] | null;
    } | null;
    removeReaction?: {
      reactionGroups: RawReactionGroup[] | null;
    } | null;
  };
  errors?: GraphqlError[];
};

type ReviewThreadMutationGraphqlResponse = {
  data?: {
    addPullRequestReviewThread?: {
      thread:
        | (RawReviewThread & {
            firstCommentReview?: {
              nodes: Array<{
                pullRequestReview: {
                  comments: {
                    totalCount: number;
                  };
                  id: string;
                } | null;
              }>;
            };
          })
        | null;
    } | null;
    addPullRequestReviewThreadReply?: {
      comment: RawReviewComment | null;
    } | null;
    resolveReviewThread?: ReviewThreadResolutionPayload;
    unresolveReviewThread?: ReviewThreadResolutionPayload;
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
  onProgress?: (progress: PullRequestsSyncProgress) => void,
): Promise<PullRequestsOverview> {
  const pages: PullRequestCardModel[][] = [];
  const pageLoads: Promise<void>[] = [];
  let afterCursor: string | null = null;
  let isSettled = false;
  let requestedCount = 0;
  let totalCount = 0;

  try {
    while (requestedCount < maxPullRequests) {
      const connection = await getPullRequestsPage(
        input,
        Math.min(pullRequestsPageSize, maxPullRequests - requestedCount),
        afterCursor,
        runGh,
      );
      const pageIndex = pageLoads.length;

      totalCount = connection.totalCount;
      requestedCount += connection.nodes.length;

      // Thread counts for this page load while the next page is requested.
      const pageLoad = getUnresolvedThreadCounts(input, connection.nodes, runGh).then(
        (unresolvedThreadsById) => {
          pages[pageIndex] = connection.nodes.map((pullRequest) =>
            mapPullRequestBase(pullRequest, unresolvedThreadsById.get(pullRequest.id) ?? 0),
          );

          if (!isSettled) {
            onProgress?.({
              expectedCount: Math.min(totalCount, maxPullRequests),
              overview: {
                hasMore: totalCount > maxPullRequests,
                items: pages.flat(),
                totalCount,
              },
            });
          }
        },
      );

      // Awaited below; this only keeps an early failure from being reported as unhandled.
      pageLoad.catch(() => {});
      pageLoads.push(pageLoad);

      if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
        break;
      }

      afterCursor = connection.pageInfo.endCursor;
    }

    await Promise.all(pageLoads);

    const items = pages.flat();

    return {
      hasMore: totalCount > items.length,
      items,
      totalCount,
    };
  } catch (error) {
    throw normalizeGhError(error);
  } finally {
    isSettled = true;
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
    const firstPage = getPullRequestReviewFirstPage(input, runGh);
    // Each part starts as soon as what it needs is known: past 300 files, the per-file patches
    // load alongside the remaining threads and viewed states instead of after them.
    const [review, files] = await Promise.all([
      firstPage.then((pullRequest) =>
        getPullRequestReviewRemainingPages(input, pullRequest, runGh),
      ),
      getPullRequestDiff(input, runGh).then(
        async (diff) => diff ?? getPullRequestFiles(input, (await firstPage).changedFiles, runGh),
      ),
    ]);

    return mapPullRequestReview(review, files);
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function replyToReviewThread(
  input: {
    body: string;
    pullRequestReviewId?: string | null;
    threadId: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<ReplyToReviewThreadResult> {
  try {
    const variables: Record<string, string> = {
      body: input.body,
      threadId: input.threadId,
    };

    if (input.pullRequestReviewId) {
      variables.pullRequestReviewId = input.pullRequestReviewId;
    }

    const parsed = await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
      buildReplyToReviewThreadMutation(),
      variables,
      runGh,
    );
    const comment = parsed.data?.addPullRequestReviewThreadReply?.comment;

    if (!comment) {
      throw new LocalGithubError("unknown", "GitHub did not return the new reply.", 502);
    }

    return {
      comment: mapReviewComment(comment, comment.path ?? "unknown"),
      pendingReviewId: getPendingReviewId(comment),
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
    publish: boolean;
    pullRequestId: string;
    side: "LEFT" | "RIGHT";
  },
  runGh: GhRunner = runGhCommand,
): Promise<CreateReviewThreadResult> {
  try {
    const parsed = await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
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
    const thread = parsed.data?.addPullRequestReviewThread?.thread;

    if (!thread) {
      throw new LocalGithubError("unknown", "GitHub did not return the new review thread.", 502);
    }

    // New threads always join the viewer's pending review. Publishing one on its own means
    // submitting that review, which is only safe when it holds nothing but this comment.
    const pendingReviewId = getPendingReviewId(thread.comments?.nodes[0]);
    const pendingReview = thread.firstCommentReview?.nodes[0]?.pullRequestReview;

    if (input.publish && pendingReviewId && pendingReview?.comments.totalCount === 1) {
      await runGraphqlQuery(
        buildSubmitReviewMutation(),
        { event: "COMMENT", pullRequestReviewId: pendingReviewId },
        runGh,
      );

      const publishedThread = mapReviewThread(thread);

      return {
        pendingReviewId: null,
        thread: {
          ...publishedThread,
          comments: publishedThread.comments.map((comment) => ({ ...comment, isPending: false })),
        },
      };
    }

    return {
      pendingReviewId,
      thread: mapReviewThread(thread),
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
): Promise<SetReviewThreadResolvedResult> {
  try {
    const parsed = await runGraphqlQuery<ReviewThreadMutationGraphqlResponse>(
      input.isResolved ? buildResolveReviewThreadMutation() : buildUnresolveReviewThreadMutation(),
      {
        threadId: input.threadId,
      },
      runGh,
    );
    const thread = input.isResolved
      ? parsed.data?.resolveReviewThread?.thread
      : parsed.data?.unresolveReviewThread?.thread;

    return {
      isResolved: thread?.isResolved ?? input.isResolved,
      resolvedByLogin: thread?.resolvedBy?.login ?? null,
      threadId: input.threadId,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function submitReview(
  input: {
    body: string;
    event: string;
    pullRequestId: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<SubmitReviewResult> {
  if (!reviewEvents.has(input.event)) {
    throw new LocalGithubError("unknown", "This review type is not supported by GitHub.", 400);
  }

  try {
    const pending = await runGraphqlQuery<PendingReviewGraphqlResponse>(
      buildPendingReviewQuery(),
      { pullRequestId: input.pullRequestId },
      runGh,
    );
    // Like on github.com, this submits the viewer's pending review (and its comments) if any.
    const pendingReviewId = pending.data?.node?.reviews?.nodes[0]?.id;
    const variables: Record<string, string> = pendingReviewId
      ? { event: input.event, pullRequestReviewId: pendingReviewId }
      : { event: input.event, pullRequestId: input.pullRequestId };

    if (input.body.trim()) {
      variables.body = input.body.trim();
    }

    const parsed = await runGraphqlQuery<ReviewSubmissionGraphqlResponse>(
      pendingReviewId ? buildSubmitReviewMutation() : buildAddReviewMutation(),
      variables,
      runGh,
    );
    const review = (
      pendingReviewId ? parsed.data?.submitPullRequestReview : parsed.data?.addPullRequestReview
    )?.pullRequestReview;

    if (!review) {
      throw new LocalGithubError("unknown", "GitHub did not return the submitted review.", 502);
    }

    return {
      reviewDecision: mapReviewDecision(review.pullRequest.reviewDecision),
      viewerLatestReviewState: mapReviewState(review.state),
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function discardPendingReview(
  input: {
    pullRequestReviewId: string;
  },
  runGh: GhRunner = runGhCommand,
) {
  try {
    await runGraphqlQuery(
      buildDeleteReviewMutation(),
      { pullRequestReviewId: input.pullRequestReviewId },
      runGh,
    );

    return {
      pullRequestReviewId: input.pullRequestReviewId,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

// Only pending comments can go: published ones are part of the conversation others already saw.
export async function deletePendingComment(
  input: {
    commentId: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<DeletePendingCommentResult> {
  try {
    const parsed = await runGraphqlQuery<ReviewCommentStateGraphqlResponse>(
      buildReviewCommentStateQuery(),
      { commentId: input.commentId },
      runGh,
    );

    if (parsed.data?.node?.state !== "PENDING") {
      throw new LocalGithubError("unknown", "Only pending review comments can be deleted.", 409);
    }

    await runGraphqlQuery(
      buildDeleteReviewCommentMutation(),
      { commentId: input.commentId },
      runGh,
    );

    return {
      commentId: input.commentId,
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function setFileViewed(
  input: {
    path: string;
    pullRequestId: string;
    viewed: boolean;
  },
  runGh: GhRunner = runGhCommand,
): Promise<SetFileViewedResult> {
  try {
    await runGraphqlQuery(
      input.viewed ? buildMarkFileAsViewedMutation() : buildUnmarkFileAsViewedMutation(),
      {
        path: input.path,
        pullRequestId: input.pullRequestId,
      },
      runGh,
    );

    return {
      path: input.path,
      viewedState: input.viewed ? "viewed" : "unviewed",
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function setCommentReaction(
  input: {
    commentId: string;
    content: string;
    hasReacted: boolean;
  },
  runGh: GhRunner = runGhCommand,
): Promise<SetCommentReactionResult> {
  if (!isReactionContent(input.content)) {
    throw new LocalGithubError("unknown", "This reaction is not supported by GitHub.", 400);
  }

  try {
    const parsed = await runGraphqlQuery<CommentReactionGraphqlResponse>(
      input.hasReacted ? buildAddReactionMutation() : buildRemoveReactionMutation(),
      {
        content: input.content,
        subjectId: input.commentId,
      },
      runGh,
    );
    const payload = input.hasReacted ? parsed.data?.addReaction : parsed.data?.removeReaction;

    if (!payload?.reactionGroups) {
      throw new LocalGithubError("unknown", "GitHub did not return the updated reactions.", 502);
    }

    return {
      commentId: input.commentId,
      reactions: mapReactionGroups(payload.reactionGroups),
    };
  } catch (error) {
    throw normalizeGhError(error);
  }
}

export async function getRepositoryFileContent(
  input: {
    owner: string;
    path: string;
    ref: string;
    repo: string;
  },
  runGh: GhRunner = runGhCommand,
): Promise<RepositoryFileContent> {
  if (
    !isRepositoryNamePart(input.owner) ||
    !isRepositoryNamePart(input.repo) ||
    !isCommitOid(input.ref) ||
    !isRepositoryFilePath(input.path)
  ) {
    throw new LocalGithubError(
      "unknown",
      "A valid repository, file path, and commit are required.",
      400,
    );
  }

  const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");

  try {
    const { stdout } = await runGhCommandWithRetry(
      [
        "api",
        `repos/${input.owner}/${input.repo}/contents/${encodedPath}?ref=${input.ref}`,
        "-H",
        "Accept: application/vnd.github.raw+json",
      ],
      runGh,
    );

    return {
      content: stdout,
    };
  } catch (error) {
    const normalized = normalizeGhError(error);

    if (normalized.status === 404) {
      throw new LocalGithubError(
        "repo",
        `${input.path} could not be loaded at commit ${input.ref.slice(0, 7)}.`,
        404,
      );
    }

    throw normalized;
  }
}

async function getPullRequestReviewFirstPage(
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

  return parsed.data.repository.pullRequest;
}

async function getPullRequestReviewRemainingPages(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  pullRequest: RawPullRequestReview,
  runGh: GhRunner,
) {
  const [reviewThreads, files] = await Promise.all([
    getPullRequestReviewThreadsPages(input, pullRequest.reviewThreads, runGh),
    getPullRequestFilesPages(input, pullRequest.files, runGh),
  ]);

  return {
    ...pullRequest,
    files,
    reviewThreads,
  };
}

async function getPullRequestFilesPages(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  firstPage: RawPullRequestFiles | undefined,
  runGh: GhRunner,
) {
  if (!firstPage) {
    return firstPage;
  }

  const fetchPage = async (afterCursor: string) => {
    const parsed = await runGraphqlQuery<PullRequestFilesPageGraphqlResponse>(
      buildPullRequestFilesPageQuery(input.number, afterCursor),
      {
        owner: input.owner,
        repo: input.repo,
      },
      runGh,
    );
    const files = parsed.data?.repository?.pullRequest?.files;

    if (!files) {
      throw new LocalGithubError(
        "repo",
        "This pull request could not be found or is not accessible through gh.",
        404,
      );
    }

    return files;
  };
  const nodes = [...firstPage.nodes];
  let pageInfo = firstPage.pageInfo;

  // Each page is slow to compute on GitHub's side. Its cursors are the base64 offset, so when the
  // first one matches that format the remaining pages load together instead of one after another.
  if (
    pageInfo.hasNextPage &&
    firstPage.totalCount &&
    pageInfo.endCursor === encodeOffsetCursor(firstPage.nodes.length)
  ) {
    const offsets = Array.from(
      { length: Math.ceil((firstPage.totalCount - nodes.length) / pullRequestFilesPageSize) },
      (_, index) => nodes.length + index * pullRequestFilesPageSize,
    );
    const pages = await mapWithConcurrency(offsets, pullRequestFilesConcurrency, (offset) =>
      fetchPage(encodeOffsetCursor(offset)),
    );

    pages.forEach((page) => nodes.push(...page.nodes));
    pageInfo = pages.at(-1)?.pageInfo ?? pageInfo;
  }

  while (pageInfo.hasNextPage && pageInfo.endCursor) {
    const page = await fetchPage(pageInfo.endCursor);

    nodes.push(...page.nodes);
    pageInfo = page.pageInfo;
  }

  return {
    nodes,
    pageInfo,
  };
}

function encodeOffsetCursor(offset: number) {
  return btoa(String(offset));
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
  try {
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
  } catch (error) {
    // GitHub refuses a single diff past 300 files or too many lines; per-file patches still load.
    if (error instanceof LocalGithubError && /too_large|HTTP 406/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

async function getPullRequestFiles(
  input: {
    number: number;
    owner: string;
    repo: string;
  },
  changedFiles: number,
  runGh: GhRunner,
) {
  const fetchPage = async (page: number) => {
    const { stdout } = await runGhCommandWithRetry(
      [
        "api",
        `repos/${input.owner}/${input.repo}/pulls/${input.number}/files?per_page=${pullRequestFilesPageSize}&page=${page}`,
      ],
      runGh,
    );

    return JSON.parse(stdout) as RawPullRequestFile[];
  };
  const expectedPageCount = Math.min(
    Math.max(1, Math.ceil(changedFiles / pullRequestFilesPageSize)),
    maxPullRequestFilesPages,
  );
  const pages = await mapWithConcurrency(
    Array.from({ length: expectedPageCount }, (_, index) => index + 1),
    pullRequestFilesConcurrency,
    fetchPage,
  );

  // The file count can lag behind a fresh push, so keep reading while pages come back full.
  while (
    pages.length < maxPullRequestFilesPages &&
    pages.at(-1)?.length === pullRequestFilesPageSize
  ) {
    pages.push(await fetchPage(pages.length + 1));
  }

  return parsePullRequestFiles(pages.flat());
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;

        nextIndex += 1;
        results[index] = await map(items[index] as T);
      }
    }),
  );

  return results;
}

async function getPullRequestsPage(
  input: {
    owner: string;
    repo: string;
  },
  first: number,
  afterCursor: string | null,
  runGh: GhRunner,
) {
  const parsed = await runGraphqlQuery<PullRequestsPageGraphqlResponse>(
    buildPullRequestsPageQuery(first, afterCursor),
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

  return parsed.data.repository.pullRequests;
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
              avatarUrl(size: 64)
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
          headRefOid
          updatedAt
          isDraft
          mergeable
          mergeStateStatus
          reviewDecision
          viewerDidAuthor
          viewerLatestReview {
            state
          }
          reviews(states: PENDING, first: 1) {
            nodes {
              id
            }
          }
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
            avatarUrl(size: 64)
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
          files(first: 100) {
            ${buildPullRequestFileFields()}
          }
        }
      }
    }
  `;
}

function buildPullRequestFilesPageQuery(number: number, afterCursor: string) {
  return `
    query PullRequestFilesPage($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: ${number}) {
          files(first: 100, after: ${JSON.stringify(afterCursor)}) {
            ${buildPullRequestFileFields()}
          }
        }
      }
    }
  `;
}

function buildPullRequestFileFields() {
  return `
    totalCount
    pageInfo {
      endCursor
      hasNextPage
    }
    nodes {
      path
      viewerViewedState
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
        ${buildReviewCommentFields()}
      }
    }
    rootComment: comments(first: 1) {
      nodes {
        diffHunk
        originalCommit {
          oid
        }
      }
    }
  `;
}

function buildReviewCommentFields() {
  return `
    id
    body
    createdAt
    line
    originalLine
    path
    url
    author {
      login
      avatarUrl(size: 64)
    }
    state
    pullRequestReview {
      id
    }
    reactionGroups {
      ${buildReactionGroupFields()}
    }
    replyTo {
      id
    }
  `;
}

function buildReactionGroupFields() {
  return `
    content
    viewerHasReacted
    reactors {
      totalCount
    }
  `;
}

function buildAddReactionMutation() {
  return `
    mutation AddReaction($subjectId: ID!, $content: ReactionContent!) {
      addReaction(input: { subjectId: $subjectId, content: $content }) {
        reactionGroups {
          ${buildReactionGroupFields()}
        }
      }
    }
  `;
}

function buildRemoveReactionMutation() {
  return `
    mutation RemoveReaction($subjectId: ID!, $content: ReactionContent!) {
      removeReaction(input: { subjectId: $subjectId, content: $content }) {
        reactionGroups {
          ${buildReactionGroupFields()}
        }
      }
    }
  `;
}

function buildReplyToReviewThreadMutation() {
  return `
    mutation ReplyToReviewThread($threadId: ID!, $body: String!, $pullRequestReviewId: ID) {
      addPullRequestReviewThreadReply(
        input: {
          pullRequestReviewThreadId: $threadId
          body: $body
          pullRequestReviewId: $pullRequestReviewId
        }
      ) {
        comment {
          ${buildReviewCommentFields()}
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
          ${buildReviewThreadDetailFields()}
          firstCommentReview: comments(first: 1) {
            nodes {
              pullRequestReview {
                id
                comments {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  `;
}

function buildPendingReviewQuery() {
  return `
    query PendingReview($pullRequestId: ID!) {
      node(id: $pullRequestId) {
        ... on PullRequest {
          reviews(states: PENDING, first: 1) {
            nodes {
              id
            }
          }
        }
      }
    }
  `;
}

function buildAddReviewMutation() {
  return `
    mutation AddReview($pullRequestId: ID!, $event: PullRequestReviewEvent!, $body: String) {
      addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, body: $body }) {
        ${buildReviewSubmissionFields()}
      }
    }
  `;
}

function buildSubmitReviewMutation() {
  return `
    mutation SubmitReview(
      $pullRequestReviewId: ID!
      $event: PullRequestReviewEvent!
      $body: String
    ) {
      submitPullRequestReview(
        input: { pullRequestReviewId: $pullRequestReviewId, event: $event, body: $body }
      ) {
        ${buildReviewSubmissionFields()}
      }
    }
  `;
}

function buildDeleteReviewMutation() {
  return `
    mutation DeleteReview($pullRequestReviewId: ID!) {
      deletePullRequestReview(input: { pullRequestReviewId: $pullRequestReviewId }) {
        pullRequestReview {
          id
        }
      }
    }
  `;
}

function buildReviewCommentStateQuery() {
  return `
    query ReviewCommentState($commentId: ID!) {
      node(id: $commentId) {
        ... on PullRequestReviewComment {
          state
        }
      }
    }
  `;
}

function buildDeleteReviewCommentMutation() {
  return `
    mutation DeleteReviewComment($commentId: ID!) {
      deletePullRequestReviewComment(input: { id: $commentId }) {
        clientMutationId
      }
    }
  `;
}

function buildReviewSubmissionFields() {
  return `
    pullRequestReview {
      state
      pullRequest {
        reviewDecision
      }
    }
  `;
}

function buildMarkFileAsViewedMutation() {
  return `
    mutation MarkFileAsViewed($pullRequestId: ID!, $path: String!) {
      markFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
        pullRequest {
          id
        }
      }
    }
  `;
}

function buildUnmarkFileAsViewedMutation() {
  return `
    mutation UnmarkFileAsViewed($pullRequestId: ID!, $path: String!) {
      unmarkFileAsViewed(input: { pullRequestId: $pullRequestId, path: $path }) {
        pullRequest {
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
          resolvedBy {
            login
          }
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
          resolvedBy {
            login
          }
        }
      }
    }
  `;
}

function isRepositoryNamePart(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+$/.test(value) && !/^\.+$/.test(value);
}

function isCommitOid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function isRepositoryFilePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
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
