import { useQuery } from "@tanstack/react-query";
import type { GithubCliErrorPayload, GithubCliStatus } from "../../shared/lib/github-cli";
import { GitHubApiError } from "../pull-requests/github-client";

const githubLocalApiBase = "/api/local/github";

export function useGithubCliStatusQuery() {
  return useQuery({
    queryKey: ["github-cli-status"],
    queryFn: fetchGithubCliStatus,
    refetchInterval: 60_000,
    retry: false,
  });
}

async function fetchGithubCliStatus(): Promise<GithubCliStatus> {
  const response = await fetch(`${githubLocalApiBase}/status`);
  const rawBody = await response.text();
  const parsed = parseJson<GithubCliStatus | GithubCliErrorPayload>(rawBody);

  if (!response.ok) {
    throw new GitHubApiError(
      "unknown",
      parsed && "message" in parsed ? parsed.message : "Unable to read the local gh CLI status.",
      response.status,
    );
  }

  if (!parsed || !("authenticated" in parsed)) {
    throw new GitHubApiError(
      "unknown",
      "The local gh CLI status endpoint returned an invalid response.",
      response.status,
    );
  }

  return parsed;
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
