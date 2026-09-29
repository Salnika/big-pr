import type {
  FileViewedState,
  PullRequestCardModel,
  PullRequestReviewComment,
  PullRequestReviewModel,
  PullRequestReviewReaction,
  PullRequestReviewThread,
  PullRequestsOverview,
  SetReviewThreadResolvedResult,
  SubmitReviewResult,
} from "./pull-request-model";
import { compareReactionContents, type ReactionContent } from "./reactions";

export function appendReviewThreadComment(
  review: PullRequestReviewModel,
  threadId: string,
  comment: PullRequestReviewComment,
) {
  return withThreads(
    review,
    review.threads.map((thread) =>
      thread.id === threadId && !thread.comments.some((current) => current.id === comment.id)
        ? { ...thread, comments: [...thread.comments, comment] }
        : thread,
    ),
  );
}

export function addReviewThread(review: PullRequestReviewModel, thread: PullRequestReviewThread) {
  const hasThread = review.threads.some((current) => current.id === thread.id);

  return withThreads(
    review,
    hasThread
      ? review.threads.map((current) => (current.id === thread.id ? thread : current))
      : [...review.threads, thread],
  );
}

export function setReviewThreadResolution(
  review: PullRequestReviewModel,
  resolution: SetReviewThreadResolvedResult,
) {
  return withThreads(
    review,
    review.threads.map((thread) =>
      thread.id === resolution.threadId
        ? {
            ...thread,
            isResolved: resolution.isResolved,
            resolvedByLogin: resolution.isResolved ? resolution.resolvedByLogin : null,
          }
        : thread,
    ),
  );
}

export function setPendingReviewId(
  review: PullRequestReviewModel,
  pendingReviewId: string | null,
): PullRequestReviewModel {
  return pendingReviewId && pendingReviewId !== review.pendingReviewId
    ? { ...review, pendingReviewId }
    : review;
}

// Submitting publishes every pending comment at once.
export function setReviewSubmitted(
  review: PullRequestReviewModel,
  submission: SubmitReviewResult,
): PullRequestReviewModel {
  return {
    ...review,
    pendingReviewId: null,
    reviewDecision: submission.reviewDecision,
    threads: review.threads.map((thread) =>
      thread.comments.some((comment) => comment.isPending)
        ? {
            ...thread,
            comments: thread.comments.map((comment) => ({ ...comment, isPending: false })),
          }
        : thread,
    ),
    viewerLatestReviewState: submission.viewerLatestReviewState,
  };
}

// Discarding deletes the pending comments, and the threads that only held pending comments.
export function discardPendingComments(review: PullRequestReviewModel): PullRequestReviewModel {
  return {
    ...removeReviewComments(review, (comment) => comment.isPending),
    pendingReviewId: null,
    viewerLatestReviewState:
      review.viewerLatestReviewState === "PENDING" ? null : review.viewerLatestReviewState,
  };
}

export function removeReviewComment(
  review: PullRequestReviewModel,
  commentId: string,
): PullRequestReviewModel {
  return removeReviewComments(review, (comment) => comment.id === commentId);
}

function removeReviewComments(
  review: PullRequestReviewModel,
  shouldRemove: (comment: PullRequestReviewComment) => boolean,
) {
  return withThreads(
    review,
    review.threads.flatMap((thread) => {
      const comments = thread.comments.filter((comment) => !shouldRemove(comment));

      if (!comments.length) {
        return [];
      }

      return [comments.length === thread.comments.length ? thread : { ...thread, comments }];
    }),
  );
}

export function setReviewFileViewedState(
  review: PullRequestReviewModel,
  path: string,
  viewedState: FileViewedState,
): PullRequestReviewModel {
  return {
    ...review,
    fileViewedStates: {
      ...review.fileViewedStates,
      [path]: viewedState,
    },
  };
}

export function findReviewComment(review: PullRequestReviewModel, commentId: string) {
  for (const thread of review.threads) {
    const comment = thread.comments.find((current) => current.id === commentId);

    if (comment) {
      return comment;
    }
  }

  return null;
}

export function setReviewCommentReactions(
  review: PullRequestReviewModel,
  commentId: string,
  reactions: PullRequestReviewReaction[],
): PullRequestReviewModel {
  return {
    ...review,
    threads: review.threads.map((thread) =>
      thread.comments.some((comment) => comment.id === commentId)
        ? {
            ...thread,
            comments: thread.comments.map((comment) =>
              comment.id === commentId ? { ...comment, reactions } : comment,
            ),
          }
        : thread,
    ),
  };
}

export function toggleReaction(
  reactions: PullRequestReviewReaction[],
  content: ReactionContent,
  hasReacted: boolean,
) {
  const current = reactions.find((reaction) => reaction.content === content);

  if (Boolean(current?.viewerHasReacted) === hasReacted) {
    return reactions;
  }

  const count = (current?.count ?? 0) + (hasReacted ? 1 : -1);
  const otherReactions = reactions.filter((reaction) => reaction.content !== content);

  return (
    count > 0
      ? [...otherReactions, { content, count, viewerHasReacted: hasReacted }]
      : otherReactions
  ).sort((left, right) => compareReactionContents(left.content, right.content));
}

// Fresh rows replace their saved copies as they arrive; saved rows stay until the sync completes.
export function mergeFreshPullRequests(
  saved: PullRequestsOverview | undefined,
  fresh: PullRequestsOverview,
): PullRequestsOverview {
  const freshNumbers = new Set(fresh.items.map((item) => item.number));

  return {
    ...fresh,
    items: [
      ...fresh.items,
      ...(saved?.items.filter((item) => !freshNumbers.has(item.number)) ?? []),
    ],
  };
}

export function setOverviewPullRequest(
  overview: PullRequestsOverview,
  pullRequest: PullRequestCardModel,
): PullRequestsOverview {
  return {
    ...overview,
    items: overview.items.map((item) => (item.number === pullRequest.number ? pullRequest : item)),
  };
}

function withThreads(
  review: PullRequestReviewModel,
  threads: PullRequestReviewThread[],
): PullRequestReviewModel {
  const unresolvedThreads = threads.filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  ).length;

  return {
    ...review,
    commentsCount: threads.reduce((count, thread) => count + thread.comments.length, 0),
    pullRequest: {
      ...review.pullRequest,
      unresolvedThreads,
    },
    threads,
    unresolvedThreads,
  };
}
