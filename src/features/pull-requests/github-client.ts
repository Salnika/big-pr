import type { RepoSettings } from "../settings/repo-parser";
import type {
  CreatePullRequestReviewThreadInput,
  PullRequestReviewModel,
  PullRequestsOverview,
} from "./pull-request-model";
import type { GithubCliErrorPayload } from "../../shared/lib/github-cli";

type GitHubErrorType = GithubCliErrorPayload["type"];

const githubLocalApiEndpoint = "/api/local/github/pull-requests";
const githubLocalReviewEndpoint = "/api/local/github/pull-request-review";
const githubLocalCreateThreadEndpoint = "/api/local/github/review-threads";
const githubLocalReplyEndpoint = "/api/local/github/review-thread-replies";
const githubLocalResolutionEndpoint = "/api/local/github/review-thread-resolution";

export class GitHubApiError extends Error {
  readonly type: GitHubErrorType;
  readonly status: number | null;

  constructor(type: GitHubErrorType, message: string, status?: number | null) {
    super(message);
    this.type = type;
    this.status = status ?? null;
  }
}

export async function fetchPullRequests(settings: RepoSettings): Promise<PullRequestsOverview> {
  return postGithubLocalApi<PullRequestsOverview>(githubLocalApiEndpoint, {
    owner: settings.owner,
    repo: settings.repo,
  });
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

export async function replyToPullRequestReviewThread(input: { body: string; threadId: string }) {
  return postGithubLocalApi<{ threadId: string }>(githubLocalReplyEndpoint, input);
}

export async function createPullRequestReviewThread(input: CreatePullRequestReviewThreadInput) {
  return postGithubLocalApi<{
    line: number;
    path: string;
    side: CreatePullRequestReviewThreadInput["side"];
  }>(githubLocalCreateThreadEndpoint, input);
}

export async function setPullRequestReviewThreadResolved(input: {
  isResolved: boolean;
  threadId: string;
}) {
  return postGithubLocalApi<{ isResolved: boolean; threadId: string }>(
    githubLocalResolutionEndpoint,
    input,
  );
}

async function postGithubLocalApi<T extends object>(endpoint: string, body: unknown): Promise<T> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      body: JSON.stringify(body),
      headers: {
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
