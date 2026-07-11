export type CiStatus = "failure" | "pending" | "success" | "unknown";

export interface PullRequestCardModel {
  id: string;
  number: number;
  title: string;
  url: string;
  authorLogin: string;
  baseBranch: string;
  headBranch: string;
  repositoryName: string;
  updatedAt: string;
  isDraft: boolean;
  ciStatus: CiStatus;
  hasConflicts: boolean;
  unresolvedThreads: number;
}

export interface PullRequestsOverview {
  hasMore: boolean;
  items: PullRequestCardModel[];
  totalCount: number;
}

export type DiffLineType = "addition" | "context" | "deletion";
export type PullRequestDiffSide = "LEFT" | "RIGHT";

export interface PullRequestDiffLine {
  id: string;
  content: string;
  newLineNumber: number | null;
  oldLineNumber: number | null;
  type: DiffLineType;
}

export interface PullRequestDiffHunk {
  id: string;
  header: string;
  newStart: number;
  oldStart: number;
  lines: PullRequestDiffLine[];
}

export interface PullRequestDiffFile {
  additions: number;
  deletions: number;
  hunks: PullRequestDiffHunk[];
  oldPath: string | null;
  path: string;
  status: "added" | "deleted" | "modified" | "renamed";
}

export interface PullRequestReviewComment {
  id: string;
  authorLogin: string;
  body: string;
  createdAt: string;
  line: number | null;
  originalLine: number | null;
  path: string;
  replyToId: string | null;
  url: string;
}

export interface CreatePullRequestReviewThreadInput {
  body: string;
  line: number;
  path: string;
  pullRequestId: string;
  side: PullRequestDiffSide;
}

export interface PullRequestReviewThread {
  id: string;
  comments: PullRequestReviewComment[];
  diffSide: "LEFT" | "RIGHT" | null;
  isOutdated: boolean;
  isResolved: boolean;
  line: number | null;
  originalLine: number | null;
  originalStartLine: number | null;
  path: string;
  resolvedByLogin: string | null;
  startDiffSide: "LEFT" | "RIGHT" | null;
  startLine: number | null;
}

export interface PullRequestReviewModel {
  additions: number;
  changedFiles: number;
  commentsCount: number;
  deletions: number;
  files: PullRequestDiffFile[];
  pullRequest: PullRequestCardModel;
  threads: PullRequestReviewThread[];
  unresolvedThreads: number;
}
