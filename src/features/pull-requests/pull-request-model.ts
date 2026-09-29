import type { GithubCliErrorPayload } from "../../shared/lib/github-cli";
import type { ReactionContent } from "./reactions";

export type CiStatus = "failure" | "pending" | "success" | "unknown";

export interface PullRequestCardModel {
  id: string;
  number: number;
  title: string;
  url: string;
  authorAvatarUrl: string | null;
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

export interface PullRequestsSyncProgress {
  expectedCount: number;
  overview: PullRequestsOverview;
}

export type PullRequestsSyncEvent =
  | ({ type: "progress" } & PullRequestsSyncProgress)
  | { overview: PullRequestsOverview; type: "done" }
  | { error: GithubCliErrorPayload; type: "error" };

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

export interface PullRequestReviewReaction {
  content: ReactionContent;
  count: number;
  viewerHasReacted: boolean;
}

export interface PullRequestReviewComment {
  id: string;
  authorAvatarUrl: string | null;
  authorLogin: string;
  body: string;
  createdAt: string;
  /** Part of the viewer's pending review: only they can see it until the review is submitted. */
  isPending: boolean;
  line: number | null;
  originalLine: number | null;
  path: string;
  reactions: PullRequestReviewReaction[];
  replyToId: string | null;
  url: string;
}

export interface CreatePullRequestReviewThreadInput {
  body: string;
  line: number;
  path: string;
  /** Publish right away instead of keeping the thread in the pending review. */
  publish: boolean;
  pullRequestId: string;
  side: PullRequestDiffSide;
}

export interface PullRequestReviewThread {
  id: string;
  comments: PullRequestReviewComment[];
  /** Diff hunk of the first comment, truncated at the commented line. */
  diffHunk: string | null;
  diffSide: "LEFT" | "RIGHT" | null;
  isOutdated: boolean;
  isResolved: boolean;
  line: number | null;
  /** Commit the thread was started on; `originalLine` points into this version of the file. */
  originalCommitOid: string | null;
  originalLine: number | null;
  originalStartLine: number | null;
  path: string;
  resolvedByLogin: string | null;
  startDiffSide: "LEFT" | "RIGHT" | null;
  startLine: number | null;
}

export type FileViewedState = "dismissed" | "unviewed" | "viewed";
export type PullRequestReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED";
export type PullRequestReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export interface PullRequestReviewModel {
  additions: number;
  changedFiles: number;
  commentsCount: number;
  deletions: number;
  /** The viewer's "Viewed" checkboxes on GitHub, by file path. */
  fileViewedStates: Record<string, FileViewedState>;
  files: PullRequestDiffFile[];
  headRefOid: string | null;
  pendingReviewId: string | null;
  pullRequest: PullRequestCardModel;
  reviewDecision: PullRequestReviewDecision | null;
  threads: PullRequestReviewThread[];
  unresolvedThreads: number;
  viewerDidAuthor: boolean;
  viewerLatestReviewState: PullRequestReviewState | null;
}

export type ReviewEvent = "APPROVE" | "COMMENT" | "REQUEST_CHANGES";

export interface SubmitReviewInput {
  body: string;
  event: ReviewEvent;
  pullRequestId: string;
}

export interface SubmitReviewResult {
  reviewDecision: PullRequestReviewDecision | null;
  viewerLatestReviewState: PullRequestReviewState | null;
}

export interface DiscardPendingReviewInput {
  pullRequestReviewId: string;
}

export interface DeletePendingCommentInput {
  commentId: string;
}

export interface DeletePendingCommentResult {
  commentId: string;
}

export interface ReplyToReviewThreadInput {
  body: string;
  /** Adds the reply to this pending review instead of publishing it. */
  pullRequestReviewId: string | null;
  threadId: string;
}

export interface ReplyToReviewThreadResult {
  comment: PullRequestReviewComment;
  pendingReviewId: string | null;
  threadId: string;
}

export interface CreateReviewThreadResult {
  pendingReviewId: string | null;
  thread: PullRequestReviewThread;
}

export interface SetReviewThreadResolvedResult {
  isResolved: boolean;
  resolvedByLogin: string | null;
  threadId: string;
}

export interface SetFileViewedInput {
  path: string;
  pullRequestId: string;
  viewed: boolean;
}

export interface SetFileViewedResult {
  path: string;
  viewedState: FileViewedState;
}

export interface SetCommentReactionInput {
  commentId: string;
  content: ReactionContent;
  hasReacted: boolean;
}

export interface SetCommentReactionResult {
  commentId: string;
  reactions: PullRequestReviewReaction[];
}

export interface RepositoryFileContent {
  content: string;
}
