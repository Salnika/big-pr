import { type CSSProperties, Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDateTime, formatRefreshTime } from "../../shared/lib/date";
import { classNames } from "../../shared/lib/class-names";
import { Avatar } from "../../shared/ui/Avatar";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { StatusPill } from "../../shared/ui/StatusPill";
import {
  getDiffLinePrefix,
  getThreadCodeSource,
  splitFileLines,
  type ThreadCodeSource,
} from "./code-context";
import { AddReactionButton, CommentReactionList } from "./CommentReactions";
import {
  type DiffGap,
  emptyRevealedGap,
  type ExpandDirection,
  expandDiffGap,
  getDiffGaps,
  getGapSize,
  getHiddenLineCount,
  getRevealedGapLines,
  type RevealedGap,
} from "./diff-expansion";
import { getLineSyntaxKey, useDiffSyntax } from "./diff-syntax";
import { type DiffViewMode, useDiffViewMode } from "./diff-view-mode";
import { HighlightedCode } from "./HighlightedCode";
import type {
  CreatePullRequestReviewThreadInput,
  FileViewedState,
  PullRequestDiffFile,
  PullRequestDiffLine,
  PullRequestDiffSide,
  PullRequestReviewModel,
  PullRequestReviewThread,
  ReviewEvent,
} from "./pull-request-model";
import * as styles from "./PullRequestReview.css";
import type { ReactionContent } from "./reactions";
import { buildSplitRows } from "./split-diff";
import { usePreferencesStore } from "../settings/preferences-store";
import { SubmitReview } from "./SubmitReview";
import type { SyntaxToken } from "./syntax-token";
import { type LoadFileContent, ThreadCodePreview } from "./ThreadCodePreview";

export type ReviewTab = "comments" | "files";
type ThreadFilter = "all" | "pending" | "resolved" | "unresolved";
type PendingCreateThread = Pick<CreatePullRequestReviewThreadInput, "line" | "path" | "side">;
type CommentTarget = Pick<CreatePullRequestReviewThreadInput, "line" | "side">;
type ThreadFileReference = {
  file: PullRequestDiffFile;
  fileId: string;
};
type ThreadAuthor = {
  avatarUrl: string | null;
  login: string;
  threadCount: number;
};
type ThreadActions = {
  hasPendingReview: boolean;
  onDeletePendingComment: (commentId: string) => Promise<unknown>;
  onReply: (threadId: string, body: string, addToReview: boolean) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  onToggleReaction: (commentId: string, content: ReactionContent, hasReacted: boolean) => void;
  pendingDeleteCommentId: string | null;
  pendingReactionCommentId: string | null;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  pullRequestAuthorLogin: string;
};
type FileTreeEntry = {
  file: PullRequestDiffFile;
  index: number;
};
type FileTreeNode = {
  children: FileTreeNode[];
  entry: FileTreeEntry | null;
  name: string;
  path: string;
};
const commentsPageSize = 20;
const diffExpandLineCount = 20;
// Past this many files, diffs render as they approach the viewport to keep the page responsive.
const lazyDiffFileCount = 50;
const markdownPlugins = [remarkGfm];

const markdownComponents: Components = {
  a({ node: _node, ...props }) {
    return <a {...props} rel="noreferrer" target="_blank" />;
  },
};

type PullRequestReviewProps = {
  backHref: string;
  fetchedAt: number | null;
  isDiscardingReview: boolean;
  isRefreshing: boolean;
  isSubmittingReview: boolean;
  mutationError: Error | null;
  onCreateThread: (input: CreatePullRequestReviewThreadInput) => Promise<unknown>;
  onDeletePendingComment: (commentId: string) => Promise<unknown>;
  onDiscardReview: () => Promise<unknown>;
  onLoadFileContent: LoadFileContent;
  onRefresh: () => void;
  onReply: (threadId: string, body: string, addToReview: boolean) => Promise<unknown>;
  onSetFileViewed: (path: string, viewed: boolean) => void;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  onSubmitReview: (input: { body: string; event: ReviewEvent }) => Promise<unknown>;
  onTabChange: (tab: ReviewTab) => void;
  onToggleReaction: (commentId: string, content: ReactionContent, hasReacted: boolean) => void;
  pendingCreateThread: PendingCreateThread | null;
  pendingDeleteCommentId: string | null;
  pendingReactionCommentId: string | null;
  pendingViewedFilePaths: readonly string[];
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  review: PullRequestReviewModel;
  tab: ReviewTab;
};

export function PullRequestReview({
  backHref,
  fetchedAt,
  isDiscardingReview,
  isRefreshing,
  isSubmittingReview,
  mutationError,
  onCreateThread,
  onDeletePendingComment,
  onDiscardReview,
  onLoadFileContent,
  onRefresh,
  onReply,
  onSetFileViewed,
  onSetResolved,
  onSubmitReview,
  onTabChange,
  onToggleReaction,
  pendingCreateThread,
  pendingDeleteCommentId,
  pendingReactionCommentId,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  pendingViewedFilePaths,
  review,
  tab,
}: PullRequestReviewProps) {
  const [pendingFileScrollId, setPendingFileScrollId] = useState<string | null>(null);
  const savedThreadFilter = usePreferencesStore((store) => store.preferences.threadFilter);
  const setPreference = usePreferencesStore((store) => store.setPreference);
  const [isShowingPending, setIsShowingPending] = useState(false);
  const threadFilter: ThreadFilter = isShowingPending ? "pending" : savedThreadFilter;
  const setThreadFilter = (filter: ThreadFilter) => {
    setIsShowingPending(filter === "pending");

    if (filter !== "pending") {
      setPreference("threadFilter", filter);
    }
  };
  const [diffViewMode, setDiffViewMode] = useDiffViewMode();
  const [selectedAuthorLogins, setSelectedAuthorLogins] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const threadAuthors = useMemo(() => getThreadAuthors(review.threads), [review.threads]);
  const selectedAuthors = useMemo(
    () =>
      new Set(
        threadAuthors
          .map((author) => author.login)
          .filter((login) => selectedAuthorLogins.has(login)),
      ),
    [selectedAuthorLogins, threadAuthors],
  );
  const statusThreads = useMemo(
    () => filterThreads(review.threads, threadFilter),
    [review.threads, threadFilter],
  );
  const authorThreadCounts = useMemo(() => countThreadsByAuthor(statusThreads), [statusThreads]);
  const visibleThreads = useMemo(
    () => filterThreadsByAuthors(statusThreads, selectedAuthors),
    [selectedAuthors, statusThreads],
  );
  const commentsFilterKey = [threadFilter, ...[...selectedAuthors].sort()].join(":");
  const pendingCommentCount = useMemo(() => countPendingComments(review.threads), [review.threads]);
  // Pending comments from before the last refresh still belong to a review, even if its id is unknown.
  const hasPendingReview = review.pendingReviewId !== null || pendingCommentCount > 0;
  const threadActions = useMemo<ThreadActions>(
    () => ({
      hasPendingReview,
      onDeletePendingComment,
      onReply,
      onSetResolved,
      onToggleReaction,
      pendingDeleteCommentId,
      pendingReactionCommentId,
      pendingReplyThreadId,
      pendingResolutionThreadId,
      pullRequestAuthorLogin: review.pullRequest.authorLogin,
    }),
    [
      hasPendingReview,
      onDeletePendingComment,
      onReply,
      onSetResolved,
      onToggleReaction,
      pendingDeleteCommentId,
      pendingReactionCommentId,
      pendingReplyThreadId,
      pendingResolutionThreadId,
      review.pullRequest.authorLogin,
    ],
  );
  const ciBadge = getCiBadge(review.pullRequest.ciStatus);

  useEffect(() => {
    if (tab !== "files" || !pendingFileScrollId) {
      return;
    }

    const fileElement = globalThis.document?.getElementById(pendingFileScrollId);
    fileElement?.scrollIntoView?.({ block: "start" });
    setPendingFileScrollId(null);
  }, [pendingFileScrollId, tab]);

  return (
    <section className={styles.stack}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>PR review</span>
            <h2 className={styles.title}>
              #{review.pullRequest.number} {review.pullRequest.title}
            </h2>
            <span className={styles.headerMeta}>
              <Avatar
                login={review.pullRequest.authorLogin}
                size="sm"
                src={review.pullRequest.authorAvatarUrl}
              />
              <span>
                @{review.pullRequest.authorLogin} updated{" "}
                {formatDateTime(review.pullRequest.updatedAt)}
                {fetchedAt ? ` · synced ${formatRefreshTime(fetchedAt)}` : null}
              </span>
            </span>
          </div>
          <div className={styles.threadActions}>
            <ButtonLink to={backHref} variant="secondary">
              Back to PRs
            </ButtonLink>
            <SubmitReview
              canDiscard={review.pendingReviewId !== null}
              isDiscarding={isDiscardingReview}
              isSubmitting={isSubmittingReview}
              onDiscard={onDiscardReview}
              onSubmit={onSubmitReview}
              pendingCommentCount={pendingCommentCount}
              viewerDidAuthor={review.viewerDidAuthor}
              viewerLatestReviewState={review.viewerLatestReviewState}
            />
            <Button disabled={isRefreshing} onClick={onRefresh} type="button" variant="primary">
              {isRefreshing ? "Refreshing..." : "Refresh PR"}
            </Button>
          </div>
        </div>

        <div className={styles.badges}>
          <StatusPill tone={review.pullRequest.isDraft ? "neutral" : "accent"}>
            {review.pullRequest.isDraft ? "Draft" : "Ready"}
          </StatusPill>
          <StatusPill tone={ciBadge.tone}>{ciBadge.label}</StatusPill>
          <StatusPill tone={review.pullRequest.hasConflicts ? "danger" : "success"}>
            {review.pullRequest.hasConflicts ? "Conflicts" : "No conflicts"}
          </StatusPill>
          {review.reviewDecision ? (
            <StatusPill tone={reviewDecisionBadges[review.reviewDecision].tone}>
              {reviewDecisionBadges[review.reviewDecision].label}
            </StatusPill>
          ) : null}
        </div>

        <div className={styles.stats}>
          <ReviewStat label="Files" value={review.changedFiles} />
          <ReviewStat label="Comments" value={review.commentsCount} />
          <ReviewStat label="Unresolved" value={review.unresolvedThreads} />
          <ReviewStat label="Additions" tone="success" value={`+${review.additions}`} />
          <ReviewStat label="Deletions" tone="danger" value={`-${review.deletions}`} />
        </div>
      </header>

      <div className={styles.tabs}>
        <div className={styles.segmentGroup} aria-label="Review view">
          <button
            aria-pressed={tab === "files"}
            className={styles.segment}
            onClick={() => onTabChange("files")}
            type="button"
          >
            PR review
          </button>
          <button
            aria-pressed={tab === "comments"}
            className={styles.segment}
            onClick={() => onTabChange("comments")}
            type="button"
          >
            Comments
          </button>
        </div>

        {tab === "comments" ? (
          <div className={styles.segmentGroup} aria-label="Comment filter">
            <ThreadFilterButton
              filter="all"
              selected={threadFilter}
              setSelected={setThreadFilter}
            />
            <ThreadFilterButton
              filter="unresolved"
              selected={threadFilter}
              setSelected={setThreadFilter}
            />
            <ThreadFilterButton
              filter="resolved"
              selected={threadFilter}
              setSelected={setThreadFilter}
            />
            {pendingCommentCount || threadFilter === "pending" ? (
              <ThreadFilterButton
                filter="pending"
                selected={threadFilter}
                setSelected={setThreadFilter}
              />
            ) : null}
          </div>
        ) : (
          <div aria-label="Diff view" className={styles.segmentGroup} role="group">
            {diffViewModes.map(({ label, mode }) => (
              <button
                aria-pressed={diffViewMode === mode}
                className={styles.segment}
                key={mode}
                onClick={() => setDiffViewMode(mode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "comments" && threadAuthors.length ? (
        <AuthorFilter
          authors={threadAuthors}
          counts={authorThreadCounts}
          onChange={setSelectedAuthorLogins}
          selected={selectedAuthors}
        />
      ) : null}

      {mutationError ? (
        <div className={styles.inlineError} role="alert">
          {mutationError.message}
        </div>
      ) : null}

      {tab === "files" ? (
        <FilesReview
          onCreateThread={onCreateThread}
          onLoadFileContent={onLoadFileContent}
          onSetFileViewed={onSetFileViewed}
          pendingCreateThread={pendingCreateThread}
          pendingViewedFilePaths={pendingViewedFilePaths}
          review={review}
          threadActions={threadActions}
          viewMode={diffViewMode}
        />
      ) : (
        <CommentsReview
          files={review.files}
          filterKey={commentsFilterKey}
          headRefOid={review.headRefOid}
          onLoadFileContent={onLoadFileContent}
          onOpenFile={(fileId) => {
            onTabChange("files");
            setPendingFileScrollId(fileId);
          }}
          threadActions={threadActions}
          threads={visibleThreads}
        />
      )}
    </section>
  );
}

const diffViewModes: Array<{ label: string; mode: DiffViewMode }> = [
  { label: "Unified", mode: "unified" },
  { label: "Split", mode: "split" },
];

const reviewDecisionBadges = {
  APPROVED: { label: "Approved", tone: "success" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "danger" },
  REVIEW_REQUIRED: { label: "Review required", tone: "warning" },
} as const;

function ReviewStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "danger" | "success";
  value: number | string;
}) {
  const toneClass = tone === "success" ? styles.statValueSuccess : styles.statValueDanger;

  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={classNames(styles.statValue, tone ? toneClass : undefined)}>{value}</span>
    </div>
  );
}

function ThreadFilterButton({
  filter,
  selected,
  setSelected,
}: {
  filter: ThreadFilter;
  selected: ThreadFilter;
  setSelected: (filter: ThreadFilter) => void;
}) {
  const label = {
    all: "All",
    pending: "Pending",
    resolved: "Resolved",
    unresolved: "Open",
  }[filter];

  return (
    <button
      aria-pressed={selected === filter}
      className={styles.segment}
      onClick={() => setSelected(filter)}
      type="button"
    >
      {label}
    </button>
  );
}

function AuthorFilter({
  authors,
  counts,
  onChange,
  selected,
}: {
  authors: ThreadAuthor[];
  counts: Map<string, number>;
  onChange: (selected: ReadonlySet<string>) => void;
  selected: ReadonlySet<string>;
}) {
  return (
    <div aria-label="Filter comments by author" className={styles.authorFilter} role="group">
      <span className={styles.authorFilterLabel}>Authors</span>
      <button
        aria-pressed={selected.size === 0}
        className={styles.authorChip}
        onClick={() => onChange(new Set())}
        type="button"
      >
        All authors
      </button>
      {authors.map((author) => {
        const count = counts.get(author.login) ?? 0;

        return (
          <button
            aria-label={`${author.login}, ${count} ${count === 1 ? "thread" : "threads"}`}
            aria-pressed={selected.has(author.login)}
            className={classNames(styles.authorChip, styles.authorChipWithAvatar)}
            key={author.login}
            onClick={() => onChange(toggleSetValue(selected, author.login))}
            title={`Show threads with comments from @${author.login}`}
            type="button"
          >
            <Avatar login={author.login} size="sm" src={author.avatarUrl} />
            <span className={styles.authorChipLogin}>{author.login}</span>
            <span className={styles.authorChipCount}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilesReview({
  onCreateThread,
  onLoadFileContent,
  onSetFileViewed,
  pendingCreateThread,
  pendingViewedFilePaths,
  review,
  threadActions,
  viewMode,
}: {
  onCreateThread: (input: CreatePullRequestReviewThreadInput) => Promise<unknown>;
  onLoadFileContent: LoadFileContent;
  onSetFileViewed: (path: string, viewed: boolean) => void;
  pendingCreateThread: PendingCreateThread | null;
  pendingViewedFilePaths: readonly string[];
  review: PullRequestReviewModel;
  threadActions: ThreadActions;
  viewMode: DiffViewMode;
}) {
  if (!review.files.length) {
    return <div className={styles.empty}>No diff was returned for this pull request.</div>;
  }

  const rendersLazily = review.files.length > lazyDiffFileCount;

  return (
    <div className={styles.reviewLayout}>
      <FileTreeNav fileViewedStates={review.fileViewedStates} files={review.files} />

      <div className={styles.files}>
        {review.changedFiles > review.files.length ? (
          <div className={styles.filesNotice} role="note">
            Showing the first {review.files.length} of {review.changedFiles} changed files: GitHub
            lists at most 3,000 files per pull request.
          </div>
        ) : null}
        {review.files.map((file, index) => (
          <DiffFile
            file={file}
            fileId={getFileDomId(file, index)}
            fileRef={
              file.status === "added" || file.status === "deleted" ? null : review.headRefOid
            }
            isViewedPending={pendingViewedFilePaths.includes(file.path)}
            key={`${file.path}:${index}`}
            onCreateThread={(input) =>
              onCreateThread({
                ...input,
                pullRequestId: review.pullRequest.id,
              })
            }
            onLoadFileContent={onLoadFileContent}
            onSetViewed={(viewed) => onSetFileViewed(file.path, viewed)}
            pendingCreateThread={pendingCreateThread}
            rendersLazily={rendersLazily}
            threadActions={threadActions}
            threads={review.threads.filter((thread) => thread.path === file.path)}
            viewMode={viewMode}
            viewedState={review.fileViewedStates[file.path] ?? "unviewed"}
          />
        ))}
      </div>
    </div>
  );
}

function FileTreeNav({
  fileViewedStates,
  files,
}: {
  fileViewedStates: Record<string, FileViewedState>;
  files: PullRequestDiffFile[];
}) {
  const searchInputId = useId();
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const normalizedSearchQuery = fileSearchQuery.trim().toLowerCase();
  const treeEntries = useMemo(
    () =>
      files
        .map((file, index) => ({ file, index }))
        .filter(({ file }) => fileMatchesSearch(file, normalizedSearchQuery)),
    [files, normalizedSearchQuery],
  );
  const tree = useMemo(() => buildFileTree(treeEntries), [treeEntries]);
  const viewedCount = files.filter((file) => fileViewedStates[file.path] === "viewed").length;

  return (
    <nav className={styles.fileNav} aria-label="Changed files">
      <div className={styles.viewedProgress}>
        <span>
          {viewedCount} of {files.length} files viewed
        </span>
        <span aria-hidden="true" className={styles.viewedProgressTrack}>
          <span
            className={styles.viewedProgressFill}
            style={{ width: `${Math.round((viewedCount / files.length) * 100)}%` }}
          />
        </span>
      </div>
      <label className={styles.searchLabel} htmlFor={searchInputId}>
        Search files by name
      </label>
      <input
        aria-label="Search files by name"
        className={styles.fileSearchInput}
        id={searchInputId}
        onChange={(event) => setFileSearchQuery(event.target.value)}
        placeholder="Search files"
        type="search"
        value={fileSearchQuery}
      />

      {tree.length ? (
        <div className={styles.fileTree}>
          {tree.map((node) => (
            <FileTreeNodeView
              collapsedPaths={collapsedPaths}
              depth={0}
              fileViewedStates={fileViewedStates}
              forceExpanded={normalizedSearchQuery.length > 0}
              key={node.path}
              node={node}
              onToggleDirectory={(path) => {
                setCollapsedPaths((current) => {
                  const next = new Set(current);

                  if (next.has(path)) {
                    next.delete(path);
                  } else {
                    next.add(path);
                  }

                  return next;
                });
              }}
            />
          ))}
        </div>
      ) : (
        <div className={styles.fileTreeEmpty}>No files match this search.</div>
      )}
    </nav>
  );
}

function FileTreeNodeView({
  collapsedPaths,
  depth,
  fileViewedStates,
  forceExpanded,
  node,
  onToggleDirectory,
}: {
  collapsedPaths: Set<string>;
  depth: number;
  fileViewedStates: Record<string, FileViewedState>;
  forceExpanded: boolean;
  node: FileTreeNode;
  onToggleDirectory: (path: string) => void;
}) {
  const itemStyle = getTreeItemStyle(depth);

  if (node.entry) {
    const fileId = getFileDomId(node.entry.file, node.entry.index);
    const isViewed = fileViewedStates[node.entry.file.path] === "viewed";

    return (
      <a
        className={styles.fileTreeFile}
        href={`#${fileId}`}
        onClick={(event) => {
          const fileElement = globalThis.document?.getElementById(fileId);

          if (fileElement) {
            event.preventDefault();
            fileElement.scrollIntoView?.({ block: "start" });
          }
        }}
        style={itemStyle}
        title={isViewed ? `${node.entry.file.path} (viewed)` : node.entry.file.path}
      >
        <span aria-hidden="true" className={styles.fileTreeSpacer} />
        {isViewed ? (
          <span aria-hidden="true" className={styles.fileTreeViewedIcon}>
            ✓
          </span>
        ) : (
          <span aria-hidden="true" className={styles.fileTreeFileIcon} />
        )}
        <span
          className={classNames(
            styles.fileTreeName,
            isViewed ? styles.fileTreeNameViewed : undefined,
          )}
        >
          {node.name}
        </span>
        <span className={styles.fileTreeMeta}>
          +{node.entry.file.additions} -{node.entry.file.deletions}
        </span>
      </a>
    );
  }

  const isExpanded = forceExpanded || !collapsedPaths.has(node.path);

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.path}`}
        className={styles.fileTreeDirectory}
        onClick={() => onToggleDirectory(node.path)}
        style={itemStyle}
        type="button"
      >
        <span
          aria-hidden="true"
          className={classNames(
            styles.fileTreeChevron,
            isExpanded ? styles.fileTreeChevronExpanded : undefined,
          )}
        />
        <span aria-hidden="true" className={styles.fileTreeFolderIcon} />
        <span className={styles.fileTreeName}>{node.name}</span>
      </button>
      {isExpanded ? (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeView
              collapsedPaths={collapsedPaths}
              depth={depth + 1}
              fileViewedStates={fileViewedStates}
              forceExpanded={forceExpanded}
              key={child.path}
              node={child}
              onToggleDirectory={onToggleDirectory}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiffFile({
  file,
  fileId,
  fileRef,
  isViewedPending,
  onCreateThread,
  onLoadFileContent,
  onSetViewed,
  pendingCreateThread,
  rendersLazily,
  threadActions,
  threads,
  viewMode,
  viewedState,
}: {
  file: PullRequestDiffFile;
  fileId: string;
  fileRef: string | null;
  isViewedPending: boolean;
  onCreateThread: (
    input: Omit<CreatePullRequestReviewThreadInput, "pullRequestId">,
  ) => Promise<unknown>;
  onLoadFileContent: LoadFileContent;
  onSetViewed: (viewed: boolean) => void;
  pendingCreateThread: PendingCreateThread | null;
  rendersLazily: boolean;
  threadActions: ThreadActions;
  threads: PullRequestReviewThread[];
  viewMode: DiffViewMode;
  viewedState: FileViewedState;
}) {
  const [activeCommentKey, setActiveCommentKey] = useState<string | null>(null);
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const [fileLines, setFileLines] = useState<string[] | null>(null);
  const [fileLoadStatus, setFileLoadStatus] = useState<"error" | "idle" | "loading">("idle");
  const [revealedGaps, setRevealedGaps] = useState<Record<number, RevealedGap>>({});
  const articleRef = useRef<HTMLElement | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(
    () => !rendersLazily || !("IntersectionObserver" in globalThis),
  );
  const gaps = useMemo(() => getDiffGaps(file.hunks), [file.hunks]);
  const isViewed = viewedState === "viewed";
  const isCollapsed = collapsedOverride ?? isViewed;
  const syntax = useDiffSyntax(file, fileLines, isNearViewport && !isCollapsed);
  const getTokens = (line: PullRequestDiffLine | null) => {
    const key = line ? getLineSyntaxKey(line) : null;

    return key ? syntax?.get(key) : undefined;
  };
  const canExpandContext = fileRef !== null && fileLoadStatus !== "error";
  const threadsByLine = groupThreadsByLine(threads);
  const renderedThreadIds = new Set<string>();
  const expandGap = async (gap: DiffGap, direction: ExpandDirection) => {
    let lines = fileLines;

    if (!lines) {
      if (!fileRef) {
        return;
      }

      setFileLoadStatus("loading");

      try {
        lines = splitFileLines(await onLoadFileContent({ path: file.path, ref: fileRef }));
      } catch {
        setFileLoadStatus("error");
        return;
      }

      setFileLines(lines);
      setFileLoadStatus("idle");
    }

    const fileLineCount = lines.length;

    setRevealedGaps((current) => ({
      ...current,
      [gap.index]: expandDiffGap(
        gap,
        current[gap.index] ?? emptyRevealedGap,
        direction,
        fileLineCount,
        diffExpandLineCount,
      ),
    }));
  };
  useEffect(() => {
    const article = articleRef.current;

    if (isNearViewport || !article) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
        }
      },
      { rootMargin: "1500px 0px" },
    );

    observer.observe(article);

    return () => observer.disconnect();
  }, [isNearViewport]);

  const startComment = (target: CommentTarget | null) =>
    target ? () => setActiveCommentKey(getNewThreadKey({ ...target, path: file.path })) : undefined;
  // Unchanged lines revealed around the hunks can't be commented on, like on GitHub.
  const renderContextLine = (line: PullRequestDiffLine) =>
    viewMode === "split" ? (
      <SplitDiffLine
        key={line.id}
        left={line}
        leftTokens={getTokens(line)}
        path={file.path}
        right={line}
        rightTokens={getTokens(line)}
      />
    ) : (
      <DiffLine key={line.id} line={line} path={file.path} tokens={getTokens(line)} />
    );
  // What hangs under a diff row: the new comment form, then the threads on its lines.
  const renderLineExtras = (lines: PullRequestDiffLine[], targets: Array<CommentTarget | null>) => {
    const lineThreads = [
      ...new Map(
        lines
          .flatMap((line) => getThreadsForDiffLine(threadsByLine, line))
          .map((thread) => [thread.id, thread]),
      ).values(),
    ];
    const activeTarget =
      targets.find(
        (target) =>
          target !== null && getNewThreadKey({ ...target, path: file.path }) === activeCommentKey,
      ) ?? null;

    lineThreads.forEach((thread) => renderedThreadIds.add(thread.id));

    return (
      <>
        {activeTarget ? (
          <NewReviewThreadForm
            hasPendingReview={threadActions.hasPendingReview}
            isPending={
              pendingCreateThread
                ? getNewThreadKey(pendingCreateThread) === activeCommentKey
                : false
            }
            location={formatLineLocation(file.path, activeTarget)}
            onCancel={() => setActiveCommentKey(null)}
            onSubmit={(body, publish) =>
              onCreateThread({
                body,
                line: activeTarget.line,
                path: file.path,
                publish,
                side: activeTarget.side,
              }).then(() => setActiveCommentKey(null))
            }
          />
        ) : null}
        {lineThreads.map((thread) => (
          <div className={styles.inlineThread} key={thread.id}>
            <ReviewThreadCard actions={threadActions} thread={thread} />
          </div>
        ))}
      </>
    );
  };
  const renderHunkLines = (hunk: PullRequestDiffFile["hunks"][number]) => {
    if (viewMode === "unified") {
      return hunk.lines.map((line) => {
        const target = getCommentTargetForLine(line);

        return (
          <div key={line.id}>
            <DiffLine
              line={line}
              onStartComment={startComment(target)}
              path={file.path}
              tokens={getTokens(line)}
            />
            {renderLineExtras([line], [target])}
          </div>
        );
      });
    }

    return buildSplitRows(hunk.lines).map((row) => {
      const leftTarget = row.left ? getSideCommentTarget(row.left, "LEFT") : null;
      const rightTarget = row.right ? getSideCommentTarget(row.right, "RIGHT") : null;
      const lines = [row.left, row.right].filter(
        (line, index, rowLines): line is PullRequestDiffLine =>
          line !== null && rowLines.indexOf(line) === index,
      );

      return (
        <div key={row.id}>
          <SplitDiffLine
            left={row.left}
            leftTokens={getTokens(row.left)}
            onStartLeftComment={startComment(leftTarget)}
            onStartRightComment={startComment(rightTarget)}
            path={file.path}
            right={row.right}
            rightTokens={getTokens(row.right)}
          />
          {renderLineExtras(lines, [leftTarget, rightTarget])}
        </div>
      );
    });
  };
  const renderGap = (gap: DiffGap) => {
    const hunk = file.hunks[gap.index] ?? null;
    const revealed = revealedGaps[gap.index] ?? emptyRevealedGap;
    const hiddenLineCount = getHiddenLineCount(gap, revealed, fileLines?.length ?? null);
    const lines = getRevealedGapLines(gap, revealed, fileLines, file.path);
    const isFileEdge = gap.index === 0 && !hunk;
    const showExpander =
      canExpandContext && !isFileEdge && (hiddenLineCount === null || hiddenLineCount > 0);
    const showHeader = hunk && !showExpander && (!canExpandContext || getGapSize(gap, null) === 0);

    return (
      <div className={styles.hunk} key={`gap:${gap.index}`}>
        {lines.before.map(renderContextLine)}
        {showExpander ? (
          <DiffExpander
            canExpandDown={gap.index > 0}
            canExpandUp={Boolean(hunk)}
            header={hunk?.header ?? null}
            hiddenLineCount={hiddenLineCount}
            isLoading={fileLoadStatus === "loading"}
            onExpand={(direction) => {
              void expandGap(gap, direction);
            }}
          />
        ) : null}
        {lines.after.map(renderContextLine)}
        {showHeader ? <div className={styles.hunkHeader}>{hunk.header}</div> : null}
      </div>
    );
  };
  const renderedHunks = file.hunks.map((hunk, hunkIndex) => (
    <Fragment key={hunk.id}>
      {renderGap(gaps[hunkIndex] as DiffGap)}
      <div className={styles.hunk}>{renderHunkLines(hunk)}</div>
    </Fragment>
  ));
  const unmatchedThreads = threads.filter((thread) => !renderedThreadIds.has(thread.id));

  return (
    <article className={styles.fileBlock} id={fileId} ref={articleRef}>
      <header
        className={classNames(
          styles.fileHeader,
          isCollapsed ? styles.fileHeaderCollapsed : undefined,
        )}
      >
        <button
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${file.path}`}
          className={styles.fileCollapseButton}
          onClick={() => setCollapsedOverride(!isCollapsed)}
          type="button"
        >
          <span
            aria-hidden="true"
            className={classNames(
              styles.fileTreeChevron,
              isCollapsed ? undefined : styles.fileTreeChevronExpanded,
            )}
          />
        </button>
        <code className={styles.filePath}>{file.path}</code>
        <span className={styles.fileHeaderMeta}>
          {viewedState === "dismissed" ? (
            <span className={styles.fileChangedBadge}>Changed since last view</span>
          ) : null}
          <span className={styles.fileStats}>
            <span>{file.status}</span>
            <span>+{file.additions}</span>
            <span>-{file.deletions}</span>
          </span>
          <label className={styles.fileViewedToggle}>
            <input
              checked={isViewed}
              disabled={isViewedPending}
              onChange={(event) => {
                const article = articleRef.current;

                setCollapsedOverride(null);
                onSetViewed(event.target.checked);

                // The header sticks while reading, so bring the file's top back before it folds.
                if (event.target.checked && article && article.getBoundingClientRect().top < 0) {
                  article.scrollIntoView?.({ block: "start" });
                }
              }}
              type="checkbox"
            />
            Viewed
          </label>
        </span>
      </header>
      {isCollapsed ? null : (
        <>
          {unmatchedThreads.length ? (
            <div className={styles.unmatchedThreads}>
              {unmatchedThreads.map((thread) => (
                <ReviewThreadCard actions={threadActions} key={thread.id} thread={thread} />
              ))}
            </div>
          ) : null}
          {!file.hunks.length ? (
            <div className={styles.fileEmpty}>
              No diff to show for this file (binary, too large, or renamed without changes).
            </div>
          ) : isNearViewport ? (
            <div className={styles.diffBody}>
              {renderedHunks}
              {renderGap(gaps.at(-1) as DiffGap)}
            </div>
          ) : (
            <div
              aria-hidden="true"
              className={styles.diffPlaceholder}
              style={{ height: `${estimateDiffHeight(file)}px` }}
            />
          )}
        </>
      )}
    </article>
  );
}

function DiffExpander({
  canExpandDown,
  canExpandUp,
  header,
  hiddenLineCount,
  isLoading,
  onExpand,
}: {
  canExpandDown: boolean;
  canExpandUp: boolean;
  header: string | null;
  hiddenLineCount: number | null;
  isLoading: boolean;
  onExpand: (direction: ExpandDirection) => void;
}) {
  const lineCount =
    hiddenLineCount === null ? diffExpandLineCount : Math.min(diffExpandLineCount, hiddenLineCount);
  const lineLabel = `${lineCount} ${lineCount === 1 ? "line" : "lines"}`;
  const directions: Array<{ direction: ExpandDirection; label: string }> =
    canExpandDown &&
    canExpandUp &&
    hiddenLineCount !== null &&
    hiddenLineCount <= diffExpandLineCount
      ? [{ direction: "all", label: `Expand all ${lineLabel}` }]
      : [
          ...(canExpandDown
            ? [{ direction: "down" as const, label: `Expand ${lineLabel} down` }]
            : []),
          ...(canExpandUp ? [{ direction: "up" as const, label: `Expand ${lineLabel} up` }] : []),
        ];

  return (
    <div className={styles.diffExpander}>
      <span className={styles.diffExpanderButtons}>
        {directions.map(({ direction, label }) => (
          <button
            aria-label={label}
            className={styles.diffExpanderButton}
            disabled={isLoading}
            key={direction}
            onClick={() => onExpand(direction)}
            title={label}
            type="button"
          >
            <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
              <path
                d={
                  direction === "all"
                    ? "M8 1.5 4.5 5h7L8 1.5Zm0 13L4.5 11h7L8 14.5ZM3 7.25h10v1.5H3z"
                    : direction === "up"
                      ? "M8 2 3.5 7H7v6h2V7h3.5L8 2Z"
                      : "M8 14 3.5 9H7V3h2v6h3.5L8 14Z"
                }
                fill="currentColor"
              />
            </svg>
          </button>
        ))}
      </span>
      <span className={styles.diffExpanderText}>
        {isLoading
          ? "Loading the file..."
          : (header ??
            (hiddenLineCount === null
              ? "Expand to see the rest of the file"
              : `${hiddenLineCount} more ${hiddenLineCount === 1 ? "line" : "lines"}`))}
      </span>
    </div>
  );
}

function DiffLine({
  line,
  onStartComment,
  path,
  tokens,
}: {
  line: PullRequestDiffLine;
  onStartComment?: () => void;
  path: string;
  tokens?: readonly SyntaxToken[];
}) {
  const target = getCommentTargetForLine(line);

  return (
    <div className={classNames(styles.diffLine, styles.diffLineTone[line.type])}>
      <span className={styles.lineCommentCell}>
        {target && onStartComment ? (
          <button
            aria-label={`Add comment on ${formatLineLocation(path, target)}`}
            className={styles.lineCommentButton}
            onClick={onStartComment}
            type="button"
          >
            +
          </button>
        ) : null}
      </span>
      <span className={styles.lineNumber}>{line.oldLineNumber ?? ""}</span>
      <span className={styles.lineNumber}>{line.newLineNumber ?? ""}</span>
      <pre className={styles.codeLine}>
        {getDiffLinePrefix(line)}
        <HighlightedCode content={line.content} tokens={tokens} />
      </pre>
    </div>
  );
}

function SplitDiffLine({
  left,
  leftTokens,
  onStartLeftComment,
  onStartRightComment,
  path,
  right,
  rightTokens,
}: {
  left: PullRequestDiffLine | null;
  leftTokens?: readonly SyntaxToken[];
  onStartLeftComment?: () => void;
  onStartRightComment?: () => void;
  path: string;
  right: PullRequestDiffLine | null;
  rightTokens?: readonly SyntaxToken[];
}) {
  return (
    <div className={styles.splitDiffLine}>
      <SplitDiffCell
        line={left}
        onStartComment={onStartLeftComment}
        path={path}
        side="LEFT"
        tokens={leftTokens}
      />
      <SplitDiffCell
        line={right}
        onStartComment={onStartRightComment}
        path={path}
        side="RIGHT"
        tokens={rightTokens}
      />
    </div>
  );
}

function SplitDiffCell({
  line,
  onStartComment,
  path,
  side,
  tokens,
}: {
  line: PullRequestDiffLine | null;
  onStartComment?: () => void;
  path: string;
  side: PullRequestDiffSide;
  tokens?: readonly SyntaxToken[];
}) {
  if (!line) {
    return <div className={classNames(styles.splitDiffCell, styles.splitDiffCellEmpty)} />;
  }

  const target = getSideCommentTarget(line, side);

  return (
    <div className={classNames(styles.splitDiffCell, styles.diffLineTone[line.type])}>
      <span className={styles.lineCommentCell}>
        {target && onStartComment ? (
          <button
            aria-label={`Add comment on ${formatLineLocation(path, target)}`}
            className={styles.lineCommentButton}
            onClick={onStartComment}
            type="button"
          >
            +
          </button>
        ) : null}
      </span>
      <span className={styles.lineNumber}>
        {(side === "LEFT" ? line.oldLineNumber : line.newLineNumber) ?? ""}
      </span>
      <pre className={classNames(styles.codeLine, styles.codeLineWrapped)}>
        {getDiffLinePrefix(line)}
        <HighlightedCode content={line.content} tokens={tokens} />
      </pre>
    </div>
  );
}

function NewReviewThreadForm({
  hasPendingReview,
  isPending,
  location,
  onCancel,
  onSubmit,
}: {
  hasPendingReview: boolean;
  isPending: boolean;
  location: string;
  onCancel: () => void;
  onSubmit: (body: string, publish: boolean) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const canSubmit = draft.trim().length > 0 && !isPending;
  const submit = (publish: boolean) => {
    const body = draft.trim();

    if (!body || isPending) {
      return;
    }

    setIsPublishing(publish);
    void onSubmit(body, publish).catch(() => {});
  };

  return (
    <form
      className={styles.newThreadForm}
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
    >
      <textarea
        aria-label={`New comment on ${location}`}
        className={styles.textarea}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Leave a comment"
        value={draft}
      />
      <div className={styles.newThreadActions}>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        {hasPendingReview ? (
          <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
            {isPending ? "Adding..." : "Add review comment"}
          </Button>
        ) : (
          <>
            <Button
              disabled={!canSubmit}
              onClick={() => submit(true)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isPending && isPublishing ? "Commenting..." : "Add single comment"}
            </Button>
            <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
              {isPending && !isPublishing ? "Starting..." : "Start a review"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

function CommentsReview({
  files,
  filterKey,
  headRefOid,
  onLoadFileContent,
  onOpenFile,
  threadActions,
  threads,
}: {
  files: PullRequestDiffFile[];
  filterKey: string;
  headRefOid: string | null;
  onLoadFileContent: LoadFileContent;
  onOpenFile: (fileId: string) => void;
  threadActions: ThreadActions;
  threads: PullRequestReviewThread[];
}) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [loadedThreadCount, setLoadedThreadCount] = useState(commentsPageSize);
  const visibleThreads = threads.slice(0, loadedThreadCount);
  const hasMoreThreads = loadedThreadCount < threads.length;
  const fileReferencesByPath = useMemo(() => createFileReferencesByPath(files), [files]);

  useEffect(() => {
    setLoadedThreadCount(commentsPageSize);
  }, [filterKey]);

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target || !hasMoreThreads || !("IntersectionObserver" in globalThis)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      setLoadedThreadCount((current) => Math.min(current + commentsPageSize, threads.length));
    });

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMoreThreads, threads.length]);

  if (!threads.length) {
    return <div className={styles.empty}>No review threads match this view.</div>;
  }

  return (
    <div className={styles.commentsView}>
      <div className={styles.commentsPager} aria-live="polite">
        Showing {Math.min(loadedThreadCount, threads.length)} of {threads.length} threads
      </div>

      {visibleThreads.map((thread) => (
        <ReviewThreadCard
          actions={threadActions}
          headRefOid={headRefOid}
          key={thread.id}
          onLoadFileContent={onLoadFileContent}
          onOpenFile={onOpenFile}
          thread={thread}
          threadFileReference={getThreadFileReference(thread, fileReferencesByPath)}
        />
      ))}

      {hasMoreThreads ? (
        <div className={styles.commentsSentinel} ref={loadMoreRef}>
          <Button
            onClick={() =>
              setLoadedThreadCount((current) =>
                Math.min(current + commentsPageSize, threads.length),
              )
            }
            type="button"
            variant="secondary"
          >
            Load more comments
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewThreadCard({
  actions,
  headRefOid = null,
  onLoadFileContent,
  onOpenFile,
  thread,
  threadFileReference,
}: {
  actions: ThreadActions;
  headRefOid?: string | null;
  onLoadFileContent?: LoadFileContent;
  onOpenFile?: (fileId: string) => void;
  thread: PullRequestReviewThread;
  threadFileReference?: ThreadFileReference | null;
}) {
  const [draft, setDraft] = useState("");
  const [isAddingToReview, setIsAddingToReview] = useState(false);
  const [confirmingDeleteCommentId, setConfirmingDeleteCommentId] = useState<string | null>(null);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const codePreviewId = useId();
  const codeSource = useMemo(
    () =>
      onLoadFileContent
        ? getThreadCodeSource(thread, threadFileReference?.file ?? null, headRefOid)
        : null,
    [headRefOid, onLoadFileContent, thread, threadFileReference],
  );
  const threadLine = getThreadLine(thread);
  const threadPath = threadFileReference?.file.path ?? thread.path;
  const threadLocation = formatThreadLocation(thread);
  const isReplying = actions.pendingReplyThreadId === thread.id;
  const isResolving = actions.pendingResolutionThreadId === thread.id;
  // A thread started in the pending review only exists for its author until the review is submitted.
  const isThreadPending =
    thread.comments.length > 0 && thread.comments.every((comment) => comment.isPending);
  const canSubmit = draft.trim().length > 0 && !isReplying;
  const submitReply = (addToReview: boolean) => {
    const body = draft.trim();

    if (!body || isReplying) {
      return;
    }

    setIsAddingToReview(addToReview);
    void actions
      .onReply(thread.id, body, addToReview)
      .then(() => setDraft(""))
      .catch(() => {});
  };

  return (
    <article className={styles.threadCard}>
      <header className={styles.threadHeader}>
        <div className={styles.threadLocationGroup}>
          <span className={styles.threadLocationPath}>
            {threadFileReference && onOpenFile ? (
              <button
                className={styles.threadFileButton}
                onClick={() => onOpenFile(threadFileReference.fileId)}
                title={threadFileReference.file.path}
                type="button"
              >
                {threadFileReference.file.path}
              </button>
            ) : (
              <span className={styles.threadLocation}>{thread.path}</span>
            )}
            {threadLine ? <span className={styles.threadLocationLine}>:{threadLine}</span> : null}
          </span>
          {codeSource && onLoadFileContent ? (
            <button
              aria-controls={codePreviewId}
              aria-expanded={isCodeOpen}
              aria-label={`${isCodeOpen ? "Hide" : "Show"} code around ${threadLocation}`}
              className={styles.threadHeaderButton}
              onClick={() => setIsCodeOpen((current) => !current)}
              type="button"
            >
              <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
                <path
                  d="M5.5 4 1.5 8l4 4m5-8 4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
              {isCodeOpen ? "Hide code" : "Show code"}
            </button>
          ) : null}
          {threadPath !== "unknown" ? (
            <button
              aria-label={`Open ${threadLocation} in VS Code`}
              className={styles.threadHeaderButton}
              onClick={() => openVsCodeFile(threadPath, threadLine)}
              title="Open in VS Code"
              type="button"
            >
              VS Code
            </button>
          ) : null}
          {thread.resolvedByLogin ? (
            <span className={styles.threadResolvedBy}>resolved by @{thread.resolvedByLogin}</span>
          ) : null}
        </div>
        <div className={styles.threadActions}>
          {isThreadPending ? (
            <StatusPill tone="warning">Pending</StatusPill>
          ) : (
            <StatusPill tone={thread.isResolved ? "success" : "warning"}>
              {thread.isResolved ? "Resolved" : "Open"}
            </StatusPill>
          )}
          {thread.isOutdated ? <StatusPill tone="neutral">Outdated</StatusPill> : null}
          {isThreadPending ? null : (
            <Button
              disabled={isResolving}
              onClick={() => {
                void actions.onSetResolved(thread.id, !thread.isResolved).catch(() => {});
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {thread.isResolved ? "Unresolve" : "Resolve"}
            </Button>
          )}
        </div>
      </header>

      {isCodeOpen && codeSource && onLoadFileContent ? (
        <ThreadCodePreview
          id={codePreviewId}
          key={getCodeSourceKey(codeSource)}
          label={`Code around ${threadLocation}`}
          onLoadFileContent={onLoadFileContent}
          source={codeSource}
        />
      ) : null}

      <div className={styles.comments}>
        {thread.comments.map((comment, index) => {
          const isReacting = actions.pendingReactionCommentId === comment.id;
          const isDeleting = actions.pendingDeleteCommentId === comment.id;
          const toggleReaction = (content: ReactionContent, hasReacted: boolean) =>
            actions.onToggleReaction(comment.id, content, hasReacted);

          return (
            <div
              className={classNames(
                styles.comment,
                index % 2 === 1 ? styles.commentAlternate : undefined,
                comment.isPending ? styles.commentPending : undefined,
              )}
              key={comment.id}
            >
              <Avatar login={comment.authorLogin} src={comment.authorAvatarUrl} />
              <div className={styles.commentContent}>
                <div className={styles.commentMeta}>
                  <strong className={styles.commentAuthor}>@{comment.authorLogin}</strong>
                  {comment.authorLogin === actions.pullRequestAuthorLogin ? (
                    <span className={styles.authorBadge}>Author</span>
                  ) : null}
                  {comment.isPending ? (
                    <span
                      className={styles.pendingBadge}
                      title="Only you can see this comment until you submit your review"
                    >
                      Pending
                    </span>
                  ) : null}
                  <span>{formatDateTime(comment.createdAt)}</span>
                  <span className={styles.commentMetaActions}>
                    {!comment.isPending ? (
                      <AddReactionButton
                        disabled={isReacting}
                        onToggle={toggleReaction}
                        reactions={comment.reactions}
                      />
                    ) : confirmingDeleteCommentId === comment.id || isDeleting ? (
                      <span className={styles.commentDeleteConfirm}>
                        Delete this pending comment?
                        <button
                          className={styles.commentMetaButton}
                          disabled={isDeleting}
                          onClick={() => setConfirmingDeleteCommentId(null)}
                          type="button"
                        >
                          Keep
                        </button>
                        <button
                          aria-label={`Confirm deleting the pending comment by @${comment.authorLogin}`}
                          className={classNames(
                            styles.commentMetaButton,
                            styles.commentMetaButtonDanger,
                          )}
                          disabled={isDeleting}
                          onClick={() => {
                            void actions
                              .onDeletePendingComment(comment.id)
                              .then(() => setConfirmingDeleteCommentId(null))
                              .catch(() => {});
                          }}
                          type="button"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </span>
                    ) : (
                      <button
                        aria-label={`Delete the pending comment by @${comment.authorLogin}`}
                        className={styles.commentMetaButton}
                        onClick={() => setConfirmingDeleteCommentId(comment.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>
                <div className={styles.commentBody}>
                  <Markdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                    {comment.body}
                  </Markdown>
                </div>
                {comment.isPending ? null : (
                  <CommentReactionList
                    disabled={isReacting}
                    onToggle={toggleReaction}
                    reactions={comment.reactions}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className={styles.replyForm}
        onSubmit={(event) => {
          event.preventDefault();
          submitReply(isThreadPending || actions.hasPendingReview);
        }}
      >
        <textarea
          aria-label={`Reply to review thread at ${threadLocation}`}
          className={styles.textarea}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Reply to this thread"
          value={draft}
        />
        <div className={styles.replyActions}>
          {isThreadPending ? null : (
            <Button
              disabled={!canSubmit}
              // Without a pending review this is the form's submit button, handled by onSubmit.
              onClick={actions.hasPendingReview ? () => submitReply(false) : undefined}
              size="sm"
              type={actions.hasPendingReview ? "button" : "submit"}
              variant={actions.hasPendingReview ? "secondary" : "primary"}
            >
              {isReplying && !isAddingToReview ? "Replying..." : "Reply"}
            </Button>
          )}
          {isThreadPending || actions.hasPendingReview ? (
            <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
              {isReplying && isAddingToReview ? "Adding..." : "Add review comment"}
            </Button>
          ) : null}
        </div>
      </form>
    </article>
  );
}

function filterThreads(threads: PullRequestReviewThread[], filter: ThreadFilter) {
  if (filter === "pending") {
    return threads.filter((thread) => thread.comments.some((comment) => comment.isPending));
  }

  if (filter === "resolved") {
    return threads.filter((thread) => thread.isResolved);
  }

  if (filter === "unresolved") {
    return threads.filter((thread) => !thread.isResolved);
  }

  return threads;
}

function countPendingComments(threads: PullRequestReviewThread[]) {
  return threads.reduce(
    (count, thread) => count + thread.comments.filter((comment) => comment.isPending).length,
    0,
  );
}

function filterThreadsByAuthors(
  threads: PullRequestReviewThread[],
  authorLogins: ReadonlySet<string>,
) {
  if (!authorLogins.size) {
    return threads;
  }

  return threads.filter((thread) =>
    thread.comments.some((comment) => authorLogins.has(comment.authorLogin)),
  );
}

function countThreadsByAuthor(threads: PullRequestReviewThread[]) {
  const counts = new Map<string, number>();

  threads.forEach((thread) => {
    new Set(thread.comments.map((comment) => comment.authorLogin)).forEach((login) => {
      counts.set(login, (counts.get(login) ?? 0) + 1);
    });
  });

  return counts;
}

function getThreadAuthors(threads: PullRequestReviewThread[]): ThreadAuthor[] {
  const counts = countThreadsByAuthor(threads);
  const avatarUrls = new Map<string, string | null>();

  threads.forEach((thread) => {
    thread.comments.forEach((comment) => {
      if (!avatarUrls.get(comment.authorLogin)) {
        avatarUrls.set(comment.authorLogin, comment.authorAvatarUrl);
      }
    });
  });

  return [...counts.entries()]
    .map(([login, threadCount]) => ({
      avatarUrl: avatarUrls.get(login) ?? null,
      login,
      threadCount,
    }))
    .sort(
      (left, right) =>
        right.threadCount - left.threadCount || left.login.localeCompare(right.login),
    );
}

function toggleSetValue(values: ReadonlySet<string>, value: string) {
  const next = new Set(values);

  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }

  return next;
}

function createFileReferencesByPath(files: PullRequestDiffFile[]) {
  const fileReferencesByPath = new Map<string, ThreadFileReference>();

  files.forEach((file, index) => {
    const reference = {
      file,
      fileId: getFileDomId(file, index),
    };

    fileReferencesByPath.set(file.path, reference);

    if (file.oldPath) {
      fileReferencesByPath.set(file.oldPath, reference);
    }
  });

  return fileReferencesByPath;
}

function getThreadFileReference(
  thread: PullRequestReviewThread,
  fileReferencesByPath: Map<string, ThreadFileReference>,
) {
  return (
    fileReferencesByPath.get(thread.path) ??
    thread.comments.map((comment) => fileReferencesByPath.get(comment.path)).find(Boolean) ??
    null
  );
}

function getThreadLine(thread: PullRequestReviewThread) {
  return thread.line ?? thread.originalLine ?? thread.startLine ?? thread.originalStartLine;
}

function openVsCodeFile(path: string, line: number | null) {
  globalThis.open(getVsCodeFileUrl(path, line), "_blank", "noopener,noreferrer");
}

function getVsCodeFileUrl(path: string, line: number | null) {
  const encodedPath = path
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const lineSuffix = line ? `:${line}` : "";

  return `vscode://file/${encodedPath}${lineSuffix}`;
}

function getCiBadge(status: PullRequestReviewModel["pullRequest"]["ciStatus"]) {
  return {
    success: { label: "CI passing", tone: "success" as const },
    pending: { label: "CI pending", tone: "warning" as const },
    failure: { label: "CI failing", tone: "danger" as const },
    unknown: { label: "CI unknown", tone: "neutral" as const },
  }[status];
}

function groupThreadsByLine(threads: PullRequestReviewThread[]) {
  const map = new Map<string, PullRequestReviewThread[]>();

  for (const thread of threads) {
    const key = getThreadLineKey(thread);

    if (!key) {
      continue;
    }

    map.set(key, [...(map.get(key) ?? []), thread]);
  }

  return map;
}

function getThreadLineKey(thread: PullRequestReviewThread) {
  const line = thread.line ?? thread.originalLine ?? thread.startLine ?? thread.originalStartLine;

  if (!line) {
    return null;
  }

  const side = thread.diffSide === "LEFT" || thread.startDiffSide === "LEFT" ? "old" : "new";

  return `${side}:${line}`;
}

function getThreadsForDiffLine(
  threadsByLine: Map<string, PullRequestReviewThread[]>,
  line: PullRequestDiffLine,
) {
  const threads = [
    ...(line.oldLineNumber ? (threadsByLine.get(`old:${line.oldLineNumber}`) ?? []) : []),
    ...(line.newLineNumber ? (threadsByLine.get(`new:${line.newLineNumber}`) ?? []) : []),
  ];

  return [...new Map(threads.map((thread) => [thread.id, thread])).values()];
}

// In the unified view, a line takes comments on its new version when it has one.
function getCommentTargetForLine(line: PullRequestDiffLine) {
  return getSideCommentTarget(line, "RIGHT") ?? getSideCommentTarget(line, "LEFT");
}

function getSideCommentTarget(
  line: PullRequestDiffLine,
  side: PullRequestDiffSide,
): CommentTarget | null {
  const lineNumber = side === "LEFT" ? line.oldLineNumber : line.newLineNumber;

  return lineNumber ? { line: lineNumber, side } : null;
}

// The old side's numbers can match the new side's, so they're told apart.
function formatLineLocation(path: string, target: CommentTarget) {
  return `${path}:${target.line}${target.side === "LEFT" ? " (old)" : ""}`;
}

function getFileName(path: string) {
  return path.split("/").at(-1) ?? path;
}

function fileMatchesSearch(file: PullRequestDiffFile, normalizedSearchQuery: string) {
  if (!normalizedSearchQuery) {
    return true;
  }

  return (
    getFileName(file.path).toLowerCase().includes(normalizedSearchQuery) ||
    file.path.toLowerCase().includes(normalizedSearchQuery)
  );
}

function getTreeItemStyle(depth: number) {
  return { paddingLeft: `${8 + depth * 14}px` } satisfies CSSProperties;
}

function buildFileTree(entries: FileTreeEntry[]) {
  const root: FileTreeNode = {
    children: [],
    entry: null,
    name: "",
    path: "",
  };

  entries.forEach((entry) => {
    const pathParts = entry.file.path.split("/").filter(Boolean);
    let currentNode = root;

    pathParts.forEach((part, partIndex) => {
      const nodePath = currentNode.path ? `${currentNode.path}/${part}` : part;
      let nextNode = currentNode.children.find((child) => child.path === nodePath);

      if (!nextNode) {
        nextNode = {
          children: [],
          entry: null,
          name: part,
          path: nodePath,
        };
        currentNode.children.push(nextNode);
      }

      if (partIndex === pathParts.length - 1) {
        nextNode.entry = entry;
      }

      currentNode = nextNode;
    });
  });

  sortFileTree(root.children);

  return root.children;
}

function sortFileTree(nodes: FileTreeNode[]) {
  nodes.sort((left, right) => {
    if (left.entry && !right.entry) {
      return 1;
    }

    if (!left.entry && right.entry) {
      return -1;
    }

    return left.name.localeCompare(right.name);
  });

  nodes.forEach((node) => sortFileTree(node.children));
}

function getNewThreadKey(
  input: Pick<CreatePullRequestReviewThreadInput, "line" | "path" | "side">,
) {
  return `${input.path}:${input.side}:${input.line}`;
}

function formatThreadLocation(thread: PullRequestReviewThread) {
  const line = thread.line ?? thread.originalLine ?? thread.startLine ?? thread.originalStartLine;

  return line ? `${thread.path}:${line}` : thread.path;
}

// Keeps the page height close to the real one before lazily rendered diffs mount.
function estimateDiffHeight(file: PullRequestDiffFile) {
  return file.hunks.reduce((height, hunk) => height + 32 + hunk.lines.length * 27, 0);
}

function getFileDomId(file: PullRequestDiffFile, index: number) {
  return `file-${index}-${file.path.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function getCodeSourceKey(source: ThreadCodeSource) {
  return [source.path, source.fileRef, source.end.side, source.end.line, source.start.line].join(
    ":",
  );
}
