import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { appName } from "../../shared/lib/app-name";
import { useDocumentTitle } from "../../shared/lib/navigation";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { formatRepoLabel, type RepoSettings } from "../settings/repo-parser";
import {
  createPullRequestReviewThread,
  deletePendingComment,
  discardPendingReview,
  fetchRepositoryFileContent,
  replyToPullRequestReviewThread,
  setPullRequestCommentReaction,
  setPullRequestFileViewed,
  setPullRequestReviewThreadResolved,
  submitPullRequestReview,
} from "./github-client";
import { getGithubErrorMessage, getGithubErrorTitle } from "./github-error-copy";
import type {
  PullRequestCardModel,
  PullRequestReviewModel,
  SetFileViewedInput,
} from "./pull-request-model";
import { PullRequestReview, type ReviewTab } from "./PullRequestReview";
import { readCachedRepositoryFile, writeCachedRepositoryFile } from "./pull-requests-cache";
import {
  addReviewThread,
  appendReviewThreadComment,
  discardPendingComments,
  findReviewComment,
  removeReviewComment,
  setPendingReviewId,
  setReviewCommentReactions,
  setReviewFileViewedState,
  setReviewSubmitted,
  setReviewThreadResolution,
  toggleReaction,
} from "./review-updates";
import {
  getRepositoryFilesQueryKey,
  usePullRequestReviewQuery,
} from "./use-pull-request-review-query";
import { syncPullRequestInOverview } from "./use-pull-requests-query";

type PullRequestReviewContainerProps = {
  backHref: string;
  onTabChange: (tab: ReviewTab) => void;
  pullRequestNumber: number;
  repository: RepoSettings;
  tab: ReviewTab;
};

export function PullRequestReviewContainer({
  backHref,
  onTabChange,
  pullRequestNumber,
  repository,
  tab,
}: PullRequestReviewContainerProps) {
  const queryClient = useQueryClient();
  const review = usePullRequestReviewQuery(repository, pullRequestNumber);
  const updateReview = (update: (current: PullRequestReviewModel) => PullRequestReviewModel) => {
    let previousPullRequest: PullRequestCardModel | null = null;
    const nextReview = review.update((current) => {
      previousPullRequest = current.pullRequest;
      return update(current);
    });

    if (nextReview && nextReview.pullRequest !== previousPullRequest) {
      void syncPullRequestInOverview(queryClient, repository, nextReview.pullRequest);
    }
  };
  const replyMutation = useMutation({
    mutationFn: replyToPullRequestReviewThread,
    onSuccess: (result) => {
      updateReview((current) =>
        setPendingReviewId(
          appendReviewThreadComment(current, result.threadId, result.comment),
          result.pendingReviewId,
        ),
      );
    },
  });
  const createThreadMutation = useMutation({
    mutationFn: createPullRequestReviewThread,
    onSuccess: (result) => {
      updateReview((current) =>
        setPendingReviewId(addReviewThread(current, result.thread), result.pendingReviewId),
      );
    },
  });
  const deleteCommentMutation = useMutation({
    mutationFn: deletePendingComment,
    onSuccess: (result) => {
      updateReview((current) => removeReviewComment(current, result.commentId));
    },
  });
  const resolutionMutation = useMutation({
    mutationFn: setPullRequestReviewThreadResolved,
    onSuccess: (result) => {
      updateReview((current) => setReviewThreadResolution(current, result));
    },
  });
  const submitReviewMutation = useMutation({
    mutationFn: submitPullRequestReview,
    onSuccess: (result) => {
      updateReview((current) => setReviewSubmitted(current, result));
    },
  });
  const discardReviewMutation = useMutation({
    mutationFn: discardPendingReview,
    onSuccess: () => {
      updateReview(discardPendingComments);
    },
  });
  const reactionMutation = useMutation({
    mutationFn: setPullRequestCommentReaction,
    onMutate: (input) => {
      const previousReactions = review.data
        ? (findReviewComment(review.data, input.commentId)?.reactions ?? null)
        : null;

      updateReview((current) => {
        const comment = findReviewComment(current, input.commentId);

        return comment
          ? setReviewCommentReactions(
              current,
              input.commentId,
              toggleReaction(comment.reactions, input.content, input.hasReacted),
            )
          : current;
      });

      return { previousReactions };
    },
    onError: (_error, input, onMutateResult) => {
      const previousReactions = onMutateResult?.previousReactions;

      if (previousReactions) {
        updateReview((current) =>
          setReviewCommentReactions(current, input.commentId, previousReactions),
        );
      }
    },
    onSuccess: (result) => {
      updateReview((current) =>
        setReviewCommentReactions(current, result.commentId, result.reactions),
      );
    },
  });
  const { owner, repo } = repository;
  const fileViewedMutationKey = ["file-viewed", owner, repo, pullRequestNumber];
  const fileViewedMutation = useMutation({
    mutationFn: setPullRequestFileViewed,
    mutationKey: fileViewedMutationKey,
    onMutate: (input) => {
      const previousState = review.data?.fileViewedStates[input.path] ?? "unviewed";

      updateReview((current) =>
        setReviewFileViewedState(current, input.path, input.viewed ? "viewed" : "unviewed"),
      );

      return { previousState };
    },
    onError: (_error, input, onMutateResult) => {
      if (onMutateResult) {
        updateReview((current) =>
          setReviewFileViewedState(current, input.path, onMutateResult.previousState),
        );
      }
    },
    onSuccess: (result) => {
      updateReview((current) => setReviewFileViewedState(current, result.path, result.viewedState));
    },
  });
  // Several files can be toggled at once, so track every pending path rather than the last one.
  const pendingViewedFilePaths = useMutationState({
    filters: { mutationKey: fileViewedMutationKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as SetFileViewedInput | undefined)?.path ?? "",
  });
  const loadFileContent = useCallback(
    (input: { path: string; ref: string }) =>
      queryClient.fetchQuery({
        queryKey: [
          ...getRepositoryFilesQueryKey({ owner, repo }, pullRequestNumber),
          input.ref,
          input.path,
        ],
        queryFn: async () => {
          const cachedContent = await readCachedRepositoryFile(
            { owner, repo },
            pullRequestNumber,
            input.ref,
            input.path,
          );

          if (cachedContent !== undefined) {
            return cachedContent;
          }

          const { content } = await fetchRepositoryFileContent({ owner, repo }, input);

          await writeCachedRepositoryFile(
            { owner, repo },
            pullRequestNumber,
            input.ref,
            input.path,
            content,
          );

          return content;
        },
        staleTime: Infinity,
      }),
    [owner, pullRequestNumber, queryClient, repo],
  );

  useDocumentTitle(
    [
      review.data
        ? `#${pullRequestNumber} ${review.data.pullRequest.title}`
        : `PR #${pullRequestNumber}`,
      tab === "files" ? "Files" : "Comments",
      formatRepoLabel(repository),
      appName,
    ].join(" · "),
  );

  if (review.isLoadingCache) {
    return null;
  }

  if (!review.data && review.isRefreshing) {
    return (
      <EmptyState
        title={`Loading PR #${pullRequestNumber}`}
        description="Fetching the diff and review threads through your local gh session."
      />
    );
  }

  if (review.error && !review.data) {
    return (
      <ErrorState
        action={
          <ButtonLink to={backHref} variant="secondary">
            Back to PRs
          </ButtonLink>
        }
        description={getGithubErrorMessage(review.error)}
        onRetry={review.refresh}
        title={getGithubErrorTitle(review.error)}
      />
    );
  }

  if (!review.data) {
    return (
      <EmptyState
        title={`No saved review for PR #${pullRequestNumber}`}
        description="Fetch this PR to load the diff and review threads, then it will stay available from local storage."
        action={
          <>
            <ButtonLink to={backHref} variant="secondary">
              Back to PRs
            </ButtonLink>
            <Button disabled={review.isRefreshing} onClick={review.refresh} variant="primary">
              Fetch PR
            </Button>
          </>
        }
      />
    );
  }

  const pullRequestId = review.data.pullRequest.id;
  const { pendingReviewId } = review.data;

  return (
    <PullRequestReview
      backHref={backHref}
      fetchedAt={review.fetchedAt}
      isDiscardingReview={discardReviewMutation.isPending}
      isRefreshing={review.isRefreshing}
      isSubmittingReview={submitReviewMutation.isPending}
      mutationError={
        replyMutation.error ??
        createThreadMutation.error ??
        deleteCommentMutation.error ??
        resolutionMutation.error ??
        reactionMutation.error ??
        fileViewedMutation.error ??
        submitReviewMutation.error ??
        discardReviewMutation.error ??
        review.error
      }
      onCreateThread={(input) => createThreadMutation.mutateAsync(input)}
      onDeletePendingComment={(commentId) => deleteCommentMutation.mutateAsync({ commentId })}
      onDiscardReview={() =>
        pendingReviewId
          ? discardReviewMutation.mutateAsync({ pullRequestReviewId: pendingReviewId })
          : Promise.reject(new Error("Refresh the PR to find the pending review to discard."))
      }
      onLoadFileContent={loadFileContent}
      onRefresh={review.refresh}
      onReply={(threadId, body, addToReview) =>
        replyMutation.mutateAsync({
          body,
          pullRequestReviewId: addToReview ? pendingReviewId : null,
          threadId,
        })
      }
      onSetFileViewed={(path, viewed) =>
        fileViewedMutation.mutate({
          path,
          pullRequestId,
          viewed,
        })
      }
      onSetResolved={(threadId, isResolved) =>
        resolutionMutation.mutateAsync({ isResolved, threadId })
      }
      onSubmitReview={(input) => submitReviewMutation.mutateAsync({ ...input, pullRequestId })}
      onTabChange={onTabChange}
      onToggleReaction={(commentId, content, hasReacted) =>
        reactionMutation.mutate({ commentId, content, hasReacted })
      }
      pendingCreateThread={
        createThreadMutation.isPending && createThreadMutation.variables
          ? {
              line: createThreadMutation.variables.line,
              path: createThreadMutation.variables.path,
              side: createThreadMutation.variables.side,
            }
          : null
      }
      pendingDeleteCommentId={
        deleteCommentMutation.isPending
          ? (deleteCommentMutation.variables?.commentId ?? null)
          : null
      }
      pendingReactionCommentId={
        reactionMutation.isPending ? (reactionMutation.variables?.commentId ?? null) : null
      }
      pendingReplyThreadId={
        replyMutation.isPending ? (replyMutation.variables?.threadId ?? null) : null
      }
      pendingResolutionThreadId={
        resolutionMutation.isPending ? (resolutionMutation.variables?.threadId ?? null) : null
      }
      pendingViewedFilePaths={pendingViewedFilePaths}
      review={review.data}
      tab={tab}
    />
  );
}
