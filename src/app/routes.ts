import type { ReviewTab } from "../features/pull-requests/PullRequestReview";

type Repository = {
  owner: string;
  repo: string;
};

export type AppRoute =
  | { name: "home" }
  | ({ name: "pull-requests" } & Repository)
  | ({ name: "pull-request"; number: number; tab: ReviewTab } & Repository);

const repositoryPartPattern = /^[A-Za-z0-9_.-]+$/;

// Paths mirror github.com, so a GitHub PR URL works here with only the host swapped.
export function parseRoute(path: string): AppRoute | null {
  const segments = path.split("/").filter(Boolean).map(decodePathSegment);

  if (!segments.length) {
    return { name: "home" };
  }

  const [owner, repo, section, number, tab, ...rest] = segments;

  if (!isRepositoryPart(owner) || !isRepositoryPart(repo) || rest.length) {
    return null;
  }

  if (section === undefined || (section === "pulls" && number === undefined)) {
    return { name: "pull-requests", owner, repo };
  }

  if (
    section === "pull" &&
    number &&
    /^[1-9]\d*$/.test(number) &&
    [undefined, "files"].includes(tab)
  ) {
    return {
      name: "pull-request",
      number: Number(number),
      owner,
      repo,
      tab: tab === "files" ? "files" : "comments",
    };
  }

  return null;
}

export function getPullRequestsPath(repository: Repository) {
  return `${getRepositoryPath(repository)}/pulls`;
}

export function getPullRequestPath(repository: Repository, number: number, tab: ReviewTab) {
  return `${getRepositoryPath(repository)}/pull/${number}${tab === "files" ? "/files" : ""}`;
}

function getRepositoryPath(repository: Repository) {
  return `/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`;
}

function isRepositoryPart(value: string | undefined): value is string {
  return Boolean(value && repositoryPartPattern.test(value) && !/^\.+$/.test(value));
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
