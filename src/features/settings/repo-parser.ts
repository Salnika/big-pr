export interface RepoSettings {
  repoInput: string;
  owner: string;
  repo: string;
}

export interface RepoInputDetails {
  owner: string;
  repo: string;
  normalized: string;
}

export const emptyRepoSettings: RepoSettings = {
  repoInput: "",
  owner: "",
  repo: "",
};

const ownerPattern = /^[A-Za-z0-9_.-]+$/;
const repoPattern = /^[A-Za-z0-9_.-]+$/;

export function parseRepoInput(input: string): RepoInputDetails {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("A GitHub repository is required.");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);

    if (url.hostname !== "github.com") {
      throw new Error("Only github.com repositories are supported in this v1.");
    }

    return parsePathSegments(url.pathname.split("/").filter(Boolean));
  }

  return parsePathSegments(trimmed.split("/").filter(Boolean));
}

export function buildRepoSettings(input: { repoInput: string }): RepoSettings {
  const parsed = parseRepoInput(input.repoInput);

  return {
    repoInput: input.repoInput.trim(),
    owner: parsed.owner,
    repo: parsed.repo,
  };
}

export function isRepoSettingsComplete(settings: RepoSettings) {
  return Boolean(settings.owner && settings.repo);
}

export function formatRepoLabel(settings: Pick<RepoSettings, "owner" | "repo">) {
  return `${settings.owner}/${settings.repo}`;
}

function parsePathSegments(segments: string[]) {
  if (segments.length !== 2) {
    throw new Error("Use owner/repo or https://github.com/owner/repo for the repository.");
  }

  const owner = segments[0].trim();
  const repo = segments[1].trim().replace(/\.git$/, "");

  if (!ownerPattern.test(owner) || !repoPattern.test(repo)) {
    throw new Error("This repository format looks invalid for GitHub.");
  }

  return {
    owner,
    repo,
    normalized: `${owner}/${repo}`,
  };
}
