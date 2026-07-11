import { GitHubApiError } from "./github-client";

export function getGithubErrorTitle(error: unknown) {
  if (error instanceof GitHubApiError && error.type === "auth") {
    return "GitHub CLI needs login";
  }

  if (error instanceof GitHubApiError && error.type === "cli") {
    return "gh CLI unavailable";
  }

  if (error instanceof GitHubApiError && error.type === "repo") {
    return "Repository not accessible";
  }

  if (error instanceof GitHubApiError && error.type === "network") {
    return "GitHub temporarily unavailable";
  }

  return "GitHub request failed";
}

export function getGithubErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "GitHub returned an unexpected response.";
}
