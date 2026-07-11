import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDateTime } from "../../shared/lib/date";
import { classNames } from "../../shared/lib/class-names";
import { Button } from "../../shared/ui/Button";
import { StatusPill } from "../../shared/ui/StatusPill";
import type {
  CreatePullRequestReviewThreadInput,
  PullRequestDiffFile,
  PullRequestDiffLine,
  PullRequestDiffSide,
  PullRequestReviewModel,
  PullRequestReviewThread,
} from "./pull-request-model";
import * as styles from "./PullRequestReview.css";

type ReviewMode = "comments" | "files";
type ThreadFilter = "all" | "resolved" | "unresolved";
type PendingCreateThread = Pick<CreatePullRequestReviewThreadInput, "line" | "path" | "side">;
type ThreadCodeSide = "new" | "old";
type ThreadCodeRow =
  | {
      content: string;
      id: string;
      type: "hunk";
    }
  | {
      id: string;
      isTarget: boolean;
      line: PullRequestDiffLine;
      type: "line";
    };
type ThreadCodeContext = {
  collapsedRows: ThreadCodeRow[];
  expandedRows: ThreadCodeRow[];
  file: PullRequestDiffFile;
  targetLine: number;
};
type ThreadFileReference = {
  file: PullRequestDiffFile;
  fileId: string;
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
const markdownPlugins = [remarkGfm];

const markdownComponents: Components = {
  a({ node: _node, ...props }) {
    return <a {...props} rel="noreferrer" target="_blank" />;
  },
};

type PullRequestReviewProps = {
  isRefreshing: boolean;
  mutationError: Error | null;
  onBack: () => void;
  onCreateThread: (input: CreatePullRequestReviewThreadInput) => Promise<unknown>;
  onRefresh: () => void;
  onReply: (threadId: string, body: string) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  pendingCreateThread: PendingCreateThread | null;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  review: PullRequestReviewModel;
};

export function PullRequestReview({
  isRefreshing,
  mutationError,
  onBack,
  onCreateThread,
  onRefresh,
  onReply,
  onSetResolved,
  pendingCreateThread,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  review,
}: PullRequestReviewProps) {
  const [mode, setMode] = useState<ReviewMode>("files");
  const [pendingFileScrollId, setPendingFileScrollId] = useState<string | null>(null);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");
  const visibleThreads = useMemo(
    () => filterThreads(review.threads, threadFilter),
    [review.threads, threadFilter],
  );
  const ciBadge = getCiBadge(review.pullRequest.ciStatus);

  useEffect(() => {
    if (mode !== "files" || !pendingFileScrollId) {
      return;
    }

    const fileElement = globalThis.document?.getElementById(pendingFileScrollId);
    fileElement?.scrollIntoView?.({ block: "start" });
    setPendingFileScrollId(null);
  }, [mode, pendingFileScrollId]);

  return (
    <section className={styles.stack}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>PR review</span>
            <h2 className={styles.title}>
              #{review.pullRequest.number} {review.pullRequest.title}
            </h2>
            <span className={styles.meta}>
              @{review.pullRequest.authorLogin} updated{" "}
              {formatDateTime(review.pullRequest.updatedAt)}
            </span>
          </div>
          <div className={styles.threadActions}>
            <Button onClick={onBack} type="button" variant="secondary">
              Back to PRs
            </Button>
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
            aria-pressed={mode === "files"}
            className={styles.segment}
            onClick={() => setMode("files")}
            type="button"
          >
            PR review
          </button>
          <button
            aria-pressed={mode === "comments"}
            className={styles.segment}
            onClick={() => setMode("comments")}
            type="button"
          >
            Comments
          </button>
        </div>

        {mode === "comments" ? (
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
          </div>
        ) : null}
      </div>

      {mutationError ? (
        <div className={styles.inlineError} role="alert">
          {mutationError.message}
        </div>
      ) : null}

      {mode === "files" ? (
        <FilesReview
          onCreateThread={onCreateThread}
          onReply={onReply}
          onSetResolved={onSetResolved}
          pendingCreateThread={pendingCreateThread}
          pendingReplyThreadId={pendingReplyThreadId}
          pendingResolutionThreadId={pendingResolutionThreadId}
          review={review}
        />
      ) : (
        <CommentsReview
          files={review.files}
          onOpenFile={(fileId) => {
            setMode("files");
            setPendingFileScrollId(fileId);
          }}
          onReply={onReply}
          onSetResolved={onSetResolved}
          pendingReplyThreadId={pendingReplyThreadId}
          pendingResolutionThreadId={pendingResolutionThreadId}
          threads={visibleThreads}
        />
      )}
    </section>
  );
}

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

function FilesReview({
  onCreateThread,
  onReply,
  onSetResolved,
  pendingCreateThread,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  review,
}: {
  onCreateThread: (input: CreatePullRequestReviewThreadInput) => Promise<unknown>;
  onReply: (threadId: string, body: string) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  pendingCreateThread: PendingCreateThread | null;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  review: PullRequestReviewModel;
}) {
  if (!review.files.length) {
    return <div className={styles.empty}>No diff was returned for this pull request.</div>;
  }

  return (
    <div className={styles.reviewLayout}>
      <FileTreeNav files={review.files} />

      <div className={styles.files}>
        {review.files.map((file, index) => (
          <DiffFile
            file={file}
            fileId={getFileDomId(file, index)}
            key={`${file.path}:${index}`}
            onCreateThread={(input) =>
              onCreateThread({
                ...input,
                pullRequestId: review.pullRequest.id,
              })
            }
            onReply={onReply}
            onSetResolved={onSetResolved}
            pendingCreateThread={pendingCreateThread}
            pendingReplyThreadId={pendingReplyThreadId}
            pendingResolutionThreadId={pendingResolutionThreadId}
            threads={review.threads.filter((thread) => thread.path === file.path)}
          />
        ))}
      </div>
    </div>
  );
}

function FileTreeNav({ files }: { files: PullRequestDiffFile[] }) {
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

  return (
    <nav className={styles.fileNav} aria-label="Changed files">
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
  forceExpanded,
  node,
  onToggleDirectory,
}: {
  collapsedPaths: Set<string>;
  depth: number;
  forceExpanded: boolean;
  node: FileTreeNode;
  onToggleDirectory: (path: string) => void;
}) {
  const itemStyle = getTreeItemStyle(depth);

  if (node.entry) {
    return (
      <a
        className={styles.fileTreeFile}
        href={`#${getFileDomId(node.entry.file, node.entry.index)}`}
        style={itemStyle}
        title={node.entry.file.path}
      >
        <span aria-hidden="true" className={styles.fileTreeSpacer} />
        <span aria-hidden="true" className={styles.fileTreeFileIcon} />
        <span className={styles.fileTreeName}>{node.name}</span>
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
  onCreateThread,
  onReply,
  onSetResolved,
  pendingCreateThread,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  threads,
}: {
  file: PullRequestDiffFile;
  fileId: string;
  onCreateThread: (
    input: Omit<CreatePullRequestReviewThreadInput, "pullRequestId">,
  ) => Promise<unknown>;
  onReply: (threadId: string, body: string) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  pendingCreateThread: PendingCreateThread | null;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  threads: PullRequestReviewThread[];
}) {
  const [activeCommentKey, setActiveCommentKey] = useState<string | null>(null);
  const threadsByLine = groupThreadsByLine(threads);
  const renderedThreadIds = new Set<string>();
  const renderedHunks = file.hunks.map((hunk) => (
    <div className={styles.hunk} key={hunk.id}>
      <div className={styles.hunkHeader}>{hunk.header}</div>
      {hunk.lines.map((line) => {
        const lineThreads = getThreadsForDiffLine(threadsByLine, line);
        const commentTarget = getCommentTargetForLine(line);
        const commentKey = commentTarget
          ? getNewThreadKey({
              line: commentTarget.line,
              path: file.path,
              side: commentTarget.side,
            })
          : null;
        lineThreads.forEach((thread) => renderedThreadIds.add(thread.id));

        return (
          <div key={line.id}>
            <DiffLine
              line={line}
              onStartComment={commentKey ? () => setActiveCommentKey(commentKey) : undefined}
              path={file.path}
            />
            {commentTarget && activeCommentKey === commentKey ? (
              <NewReviewThreadForm
                isPending={
                  pendingCreateThread ? getNewThreadKey(pendingCreateThread) === commentKey : false
                }
                line={commentTarget.line}
                onCancel={() => setActiveCommentKey(null)}
                onSubmit={(body) =>
                  onCreateThread({
                    body,
                    line: commentTarget.line,
                    path: file.path,
                    side: commentTarget.side,
                  }).then(() => setActiveCommentKey(null))
                }
                path={file.path}
              />
            ) : null}
            {lineThreads.map((thread) => (
              <div className={styles.inlineThread} key={thread.id}>
                <ReviewThreadCard
                  onReply={onReply}
                  onSetResolved={onSetResolved}
                  pendingReplyThreadId={pendingReplyThreadId}
                  pendingResolutionThreadId={pendingResolutionThreadId}
                  thread={thread}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  ));
  const unmatchedThreads = threads.filter((thread) => !renderedThreadIds.has(thread.id));

  return (
    <article className={styles.fileBlock} id={fileId}>
      <header className={styles.fileHeader}>
        <code className={styles.filePath}>{file.path}</code>
        <span className={styles.fileStats}>
          <span>{file.status}</span>
          <span>+{file.additions}</span>
          <span>-{file.deletions}</span>
        </span>
      </header>
      {unmatchedThreads.length ? (
        <div className={styles.unmatchedThreads}>
          {unmatchedThreads.map((thread) => (
            <ReviewThreadCard
              key={thread.id}
              onReply={onReply}
              onSetResolved={onSetResolved}
              pendingReplyThreadId={pendingReplyThreadId}
              pendingResolutionThreadId={pendingResolutionThreadId}
              thread={thread}
            />
          ))}
        </div>
      ) : null}
      <div className={styles.diffBody}>{renderedHunks}</div>
    </article>
  );
}

function DiffLine({
  line,
  onStartComment,
  path,
}: {
  line: PullRequestDiffLine;
  onStartComment?: () => void;
  path: string;
}) {
  const target = getCommentTargetForLine(line);
  const lineLabel = target ? `${path}:${target.line}` : path;

  return (
    <div className={classNames(styles.diffLine, styles.diffLineTone[line.type])}>
      <span className={styles.lineCommentCell}>
        {target ? (
          <button
            aria-label={`Add comment on ${lineLabel}`}
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
        {getDiffPrefix(line)}
        {line.content || " "}
      </pre>
    </div>
  );
}

function NewReviewThreadForm({
  isPending,
  line,
  onCancel,
  onSubmit,
  path,
}: {
  isPending: boolean;
  line: number;
  onCancel: () => void;
  onSubmit: (body: string) => Promise<unknown>;
  path: string;
}) {
  const [draft, setDraft] = useState("");
  const canSubmit = draft.trim().length > 0 && !isPending;

  return (
    <form
      className={styles.newThreadForm}
      onSubmit={(event) => {
        event.preventDefault();
        const body = draft.trim();

        if (!body) {
          return;
        }

        void onSubmit(body).catch(() => {});
      }}
    >
      <textarea
        aria-label={`New comment on ${path}:${line}`}
        className={styles.textarea}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Add a review comment"
        value={draft}
      />
      <div className={styles.newThreadActions}>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
          {isPending ? "Commenting..." : "Add comment"}
        </Button>
      </div>
    </form>
  );
}

function CommentsReview({
  files,
  onOpenFile,
  onReply,
  onSetResolved,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  threads,
}: {
  files: PullRequestDiffFile[];
  onOpenFile: (fileId: string) => void;
  onReply: (threadId: string, body: string) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  threads: PullRequestReviewThread[];
}) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [loadedThreadCount, setLoadedThreadCount] = useState(commentsPageSize);
  const visibleThreads = threads.slice(0, loadedThreadCount);
  const hasMoreThreads = loadedThreadCount < threads.length;
  const fileReferencesByPath = useMemo(() => createFileReferencesByPath(files), [files]);

  useEffect(() => {
    setLoadedThreadCount(commentsPageSize);
  }, [threads]);

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
          key={thread.id}
          onOpenFile={onOpenFile}
          onReply={onReply}
          onSetResolved={onSetResolved}
          pendingReplyThreadId={pendingReplyThreadId}
          pendingResolutionThreadId={pendingResolutionThreadId}
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
  onOpenFile,
  onReply,
  onSetResolved,
  pendingReplyThreadId,
  pendingResolutionThreadId,
  thread,
  threadFileReference,
}: {
  onOpenFile?: (fileId: string) => void;
  onReply: (threadId: string, body: string) => Promise<unknown>;
  onSetResolved: (threadId: string, isResolved: boolean) => Promise<unknown>;
  pendingReplyThreadId: string | null;
  pendingResolutionThreadId: string | null;
  thread: PullRequestReviewThread;
  threadFileReference?: ThreadFileReference | null;
}) {
  const [draft, setDraft] = useState("");
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const codeDrawerId = useId();
  const codeContext = useMemo(
    () => (threadFileReference ? getThreadCodeContext(thread, threadFileReference.file) : null),
    [thread, threadFileReference],
  );
  const threadLine = getThreadLine(thread);
  const threadPath = threadFileReference?.file.path ?? thread.path;
  const isReplying = pendingReplyThreadId === thread.id;
  const isResolving = pendingResolutionThreadId === thread.id;
  const canSubmit = draft.trim().length > 0 && !isReplying;

  return (
    <article className={styles.threadCard}>
      <header className={styles.threadHeader}>
        <div className={styles.threadLocationGroup}>
          {codeContext ? (
            <button
              aria-label={`${isCodeOpen ? "Hide" : "Show"} code around ${formatThreadLocation(thread)}`}
              aria-controls={codeDrawerId}
              aria-expanded={isCodeOpen}
              className={styles.threadCodeToggle}
              onClick={() => setIsCodeOpen((current) => !current)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={classNames(
                  styles.threadCodeChevron,
                  isCodeOpen ? styles.threadCodeChevronOpen : undefined,
                )}
              />
            </button>
          ) : (
            <span aria-hidden="true" className={styles.threadLocationSpacer} />
          )}
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
          {threadPath !== "unknown" ? (
            <button
              aria-label={`Open ${formatThreadLocation(thread)} in VS Code`}
              className={styles.threadVsCodeButton}
              onClick={() => openVsCodeFile(threadPath, threadLine)}
              title="Open in VS Code"
              type="button"
            >
              VS Code
            </button>
          ) : null}
          {thread.resolvedByLogin ? (
            <span className={styles.meta}> resolved by @{thread.resolvedByLogin}</span>
          ) : null}
        </div>
        <div className={styles.threadActions}>
          <StatusPill tone={thread.isResolved ? "success" : "warning"}>
            {thread.isResolved ? "Resolved" : "Open"}
          </StatusPill>
          {thread.isOutdated ? <StatusPill tone="neutral">Outdated</StatusPill> : null}
          <Button
            disabled={isResolving}
            onClick={() => {
              void onSetResolved(thread.id, !thread.isResolved).catch(() => {});
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {thread.isResolved ? "Unresolve" : "Resolve"}
          </Button>
        </div>
      </header>

      {isCodeOpen && codeContext ? (
        <ThreadCodeDrawer context={codeContext} id={codeDrawerId} />
      ) : null}

      <div className={styles.comments}>
        {thread.comments.map((comment) => (
          <div className={styles.comment} key={comment.id}>
            <div className={styles.commentMeta}>
              <strong>@{comment.authorLogin}</strong>
              <span>{formatDateTime(comment.createdAt)}</span>
            </div>
            <div className={styles.commentBody}>
              <Markdown components={markdownComponents} remarkPlugins={markdownPlugins}>
                {comment.body}
              </Markdown>
            </div>
          </div>
        ))}
      </div>

      <form
        className={styles.replyForm}
        onSubmit={(event) => {
          event.preventDefault();
          const body = draft.trim();

          if (!body) {
            return;
          }

          void onReply(thread.id, body)
            .then(() => setDraft(""))
            .catch(() => {});
        }}
      >
        <textarea
          aria-label={`Reply to review thread at ${formatThreadLocation(thread)}`}
          className={styles.textarea}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Reply to this thread"
          value={draft}
        />
        <div className={styles.replyActions}>
          <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
            {isReplying ? "Replying..." : "Reply"}
          </Button>
        </div>
      </form>
    </article>
  );
}

function ThreadCodeDrawer({ context, id }: { context: ThreadCodeContext; id: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rows = isExpanded ? context.expandedRows : context.collapsedRows;
  const canExpand = context.expandedRows.length > context.collapsedRows.length;

  return (
    <div className={styles.codeDrawer} id={id}>
      <div className={styles.codeDrawerToolbar}>
        <span className={styles.codeDrawerMeta}>
          {isExpanded ? context.file.path : `Around line ${context.targetLine}`}
        </span>
        {canExpand ? (
          <button
            aria-expanded={isExpanded}
            className={styles.codeDrawerExpand}
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      <div className={styles.codeDrawerBody}>
        {rows.map((row) =>
          row.type === "hunk" ? (
            <div className={styles.codeDrawerHunkHeader} key={row.id}>
              {row.content}
            </div>
          ) : (
            <div
              className={classNames(
                styles.codeDrawerLine,
                styles.diffLineTone[row.line.type],
                row.isTarget ? styles.codeDrawerLineTarget : undefined,
              )}
              key={row.id}
            >
              <span className={styles.codeDrawerLineNumber}>{row.line.oldLineNumber ?? ""}</span>
              <span className={styles.codeDrawerLineNumber}>{row.line.newLineNumber ?? ""}</span>
              <pre className={styles.codeDrawerCode}>
                <span aria-hidden="true" className={styles.codeDrawerPrefix}>
                  {getDiffPrefix(row.line)}
                </span>
                <span>{row.line.content || " "}</span>
              </pre>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function filterThreads(threads: PullRequestReviewThread[], filter: ThreadFilter) {
  if (filter === "resolved") {
    return threads.filter((thread) => thread.isResolved);
  }

  if (filter === "unresolved") {
    return threads.filter((thread) => !thread.isResolved);
  }

  return threads;
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

function getThreadCodeContext(
  thread: PullRequestReviewThread,
  file: PullRequestDiffFile,
): ThreadCodeContext | null {
  const target = getThreadCodeTarget(thread);

  if (!target) {
    return null;
  }

  const matchingHunk = file.hunks.find((hunk) =>
    hunk.lines.some((line) => getLineNumberForSide(line, target.side) === target.line),
  );

  if (!matchingHunk) {
    return null;
  }

  const targetIndex = matchingHunk.lines.findIndex(
    (line) => getLineNumberForSide(line, target.side) === target.line,
  );
  const firstLineIndex = Math.max(0, targetIndex - 2);
  const lastLineIndex = Math.min(matchingHunk.lines.length, targetIndex + 3);

  return {
    collapsedRows: createThreadCodeRows(
      [
        {
          header: matchingHunk.header,
          lines: matchingHunk.lines.slice(firstLineIndex, lastLineIndex),
        },
      ],
      target,
    ),
    expandedRows: createThreadCodeRows(
      file.hunks.map((hunk) => ({ header: hunk.header, lines: hunk.lines })),
      target,
    ),
    file,
    targetLine: target.line,
  };
}

function getThreadCodeTarget(thread: PullRequestReviewThread) {
  const line = getThreadLine(thread);

  if (!line) {
    return null;
  }

  return {
    line,
    side: getThreadCodeSide(thread),
  };
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

function getThreadCodeSide(thread: PullRequestReviewThread): ThreadCodeSide {
  return thread.diffSide === "LEFT" || thread.startDiffSide === "LEFT" ? "old" : "new";
}

function createThreadCodeRows(
  hunks: Array<{ header: string; lines: PullRequestDiffLine[] }>,
  target: { line: number; side: ThreadCodeSide },
) {
  return hunks.flatMap<ThreadCodeRow>((hunk, hunkIndex) => [
    {
      content: hunk.header,
      id: `hunk:${hunkIndex}:${hunk.header}`,
      type: "hunk",
    },
    ...hunk.lines.map((line) => ({
      id: line.id,
      isTarget: getLineNumberForSide(line, target.side) === target.line,
      line,
      type: "line" as const,
    })),
  ]);
}

function getLineNumberForSide(line: PullRequestDiffLine, side: ThreadCodeSide) {
  return side === "old" ? line.oldLineNumber : line.newLineNumber;
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

function getCommentTargetForLine(line: PullRequestDiffLine) {
  if (line.newLineNumber) {
    return {
      line: line.newLineNumber,
      side: "RIGHT" as PullRequestDiffSide,
    };
  }

  if (line.oldLineNumber) {
    return {
      line: line.oldLineNumber,
      side: "LEFT" as PullRequestDiffSide,
    };
  }

  return null;
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

function getDiffPrefix(line: PullRequestDiffLine) {
  if (line.type === "addition") {
    return "+";
  }

  if (line.type === "deletion") {
    return "-";
  }

  return line.content.startsWith("\\") ? "" : " ";
}

function formatThreadLocation(thread: PullRequestReviewThread) {
  const line = thread.line ?? thread.originalLine ?? thread.startLine ?? thread.originalStartLine;

  return line ? `${thread.path}:${line}` : thread.path;
}

function getFileDomId(file: PullRequestDiffFile, index: number) {
  return `file-${index}-${file.path.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}
