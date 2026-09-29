import type { RepoSettings } from "../settings/repo-parser";
import type {
  CreatePullRequestReviewThreadInput,
  CreateReviewThreadResult,
  DeletePendingCommentInput,
  DeletePendingCommentResult,
  DiscardPendingReviewInput,
  PullRequestReviewModel,
  PullRequestsOverview,
  PullRequestsSyncEvent,
  PullRequestsSyncProgress,
  ReplyToReviewThreadInput,
  ReplyToReviewThreadResult,
  RepositoryFileContent,
  SetCommentReactionInput,
  SetCommentReactionResult,
  SetFileViewedInput,
  SetFileViewedResult,
  SetReviewThreadResolvedResult,
  SubmitReviewInput,
  SubmitReviewResult,
} from "./pull-request-model";
import type { GithubCliErrorPayload } from "../../shared/lib/github-cli";

type GitHubErrorType = GithubCliErrorPayload["type"];

const githubLocalApiEndpoint = "/api/local/github/pull-requests";
const githubLocalReviewEndpoint = "/api/local/github/pull-request-review";
const githubLocalCreateThreadEndpoint = "/api/local/github/review-threads";
const githubLocalReplyEndpoint = "/api/local/github/review-thread-replies";
const githubLocalResolutionEndpoint = "/api/local/github/review-thread-resolution";
const githubLocalFileContentEndpoint = "/api/local/github/file-content";
const githubLocalReactionEndpoint = "/api/local/github/comment-reactions";
const githubLocalFileViewedEndpoint = "/api/local/github/file-viewed-state";
const githubLocalReviewSubmissionEndpoint = "/api/local/github/review-submissions";
const githubLocalPendingReviewDiscardEndpoint = "/api/local/github/pending-review-discards";
const githubLocalPendingCommentDeletionEndpoint = "/api/local/github/pending-comment-deletions";
const eventStreamContentType = "application/x-ndjson";

export class GitHubApiError extends Error {
  readonly type: GitHubErrorType;
  readonly status: number | null;

  constructor(type: GitHubErrorType, message: string, status?: number | null) {
    super(message);
    this.type = type;
    this.status = status ?? null;
  }
}

export async function fetchPullRequests(
  settings: RepoSettings,
  options: { onProgress?: (progress: PullRequestsSyncProgress) => void } = {},
): Promise<PullRequestsOverview> {
  const response = await requestGithubLocalApi(
    githubLocalApiEndpoint,
    {
      owner: settings.owner,
      repo: settings.repo,
    },
    { Accept: `${eventStreamContentType}, application/json` },
  );

  if (
    !response.ok ||
    !response.body ||
    !response.headers.get("Content-Type")?.includes(eventStreamContentType)
  ) {
    return readJsonResponse<PullRequestsOverview>(response);
  }

  try {
    for await (const event of readEventStream<PullRequestsSyncEvent>(response.body)) {
      if (event.type === "progress") {
        options.onProgress?.(event);
      }

      if (event.type === "done") {
        return event.overview;
      }

      if (event.type === "error") {
        throw new GitHubApiError(event.error.type, event.error.message, event.error.status);
      }
    }
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
  }

  throw new GitHubApiError(
    "network",
    "The local gh endpoint stopped before the pull request list was complete.",
  );
}

export async function fetchPullRequestReview(
  settings: RepoSettings,
  number: number,
): Promise<PullRequestReviewModel> {
  return postGithubLocalApi<PullRequestReviewModel>(githubLocalReviewEndpoint, {
    number,
    owner: settings.owner,
    repo: settings.repo,
  });
}

export async function fetchRepositoryFileContent(
  repository: Pick<RepoSettings, "owner" | "repo">,
  input: { path: string; ref: string },
): Promise<RepositoryFileContent> {
  return postGithubLocalApi<RepositoryFileContent>(githubLocalFileContentEndpoint, {
    owner: repository.owner,
    path: input.path,
    ref: input.ref,
    repo: repository.repo,
  });
}

export async function replyToPullRequestReviewThread(input: ReplyToReviewThreadInput) {
  return postGithubLocalApi<ReplyToReviewThreadResult>(githubLocalReplyEndpoint, input);
}

export async function createPullRequestReviewThread(input: CreatePullRequestReviewThreadInput) {
  return postGithubLocalApi<CreateReviewThreadResult>(githubLocalCreateThreadEndpoint, input);
}

export async function setPullRequestReviewThreadResolved(input: {
  isResolved: boolean;
  threadId: string;
}) {
  return postGithubLocalApi<SetReviewThreadResolvedResult>(githubLocalResolutionEndpoint, input);
}

export async function submitPullRequestReview(input: SubmitReviewInput) {
  return postGithubLocalApi<SubmitReviewResult>(githubLocalReviewSubmissionEndpoint, input);
}

export async function deletePendingComment(input: DeletePendingCommentInput) {
  return postGithubLocalApi<DeletePendingCommentResult>(
    githubLocalPendingCommentDeletionEndpoint,
    input,
  );
}

export async function discardPendingReview(input: DiscardPendingReviewInput) {
  return postGithubLocalApi<{ pullRequestReviewId: string }>(
    githubLocalPendingReviewDiscardEndpoint,
    input,
  );
}

export async function setPullRequestFileViewed(input: SetFileViewedInput) {
  return postGithubLocalApi<SetFileViewedResult>(githubLocalFileViewedEndpoint, input);
}

export async function setPullRequestCommentReaction(input: SetCommentReactionInput) {
  return postGithubLocalApi<SetCommentReactionResult>(githubLocalReactionEndpoint, input);
}

async function postGithubLocalApi<T extends object>(endpoint: string, body: unknown): Promise<T> {
  return readJsonResponse<T>(await requestGithubLocalApi(endpoint, body));
}

async function requestGithubLocalApi(
  endpoint: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  try {
    return await fetch(endpoint, {
      body: JSON.stringify(body),
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw new GitHubApiError(
      "network",
      "The local gh endpoint could not be reached. Check that the Vite dev server is running.",
    );
  }
}

async function* readEventStream<T>(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      const lines = (buffered + decoder.decode(value, { stream: !done })).split("\n");

      buffered = done ? "" : (lines.pop() ?? "");

      for (const line of lines.filter((current) => current.trim())) {
        yield parseEvent<T>(line);
      }

      if (done) {
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function parseEvent<T>(line: string) {
  const event = parseJson<T>(line);

  if (!event) {
    throw new GitHubApiError("unknown", "The local gh endpoint returned an invalid response.");
  }

  return event;
}

async function readJsonResponse<T extends object>(response: Response): Promise<T> {
  const rawBody = await response.text();
  const parsed = parseJson<T | GithubCliErrorPayload>(rawBody);

  if (!response.ok) {
    throw new GitHubApiError(
      parsed && "type" in parsed ? parsed.type : "unknown",
      parsed && "message" in parsed
        ? parsed.message
        : buildUnexpectedErrorMessage(response.status, rawBody),
      response.status,
    );
  }

  if (!parsed || "type" in parsed) {
    throw new GitHubApiError(
      "unknown",
      "The local gh endpoint returned an invalid response.",
      response.status,
    );
  }

  return parsed;
}

function buildUnexpectedErrorMessage(status: number, rawBody: string) {
  const bodyPreview = rawBody
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return bodyPreview
    ? `GitHub returned HTTP ${status}: ${bodyPreview}`
    : `GitHub returned HTTP ${status} while loading pull requests.`;
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
