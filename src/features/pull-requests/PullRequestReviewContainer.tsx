import { useMutation } from "@tanstack/react-query";
import { Button } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { useSettingsStore } from "../settings/settings-store";
import {
  createPullRequestReviewThread,
  replyToPullRequestReviewThread,
  setPullRequestReviewThreadResolved,
} from "./github-client";
import { getGithubErrorMessage, getGithubErrorTitle } from "./github-error-copy";
import { PullRequestReview } from "./PullRequestReview";
import { usePullRequestReviewQuery } from "./use-pull-request-review-query";

type PullRequestReviewContainerProps = {
  onBack: () => void;
  pullRequestNumber: number;
};

export function PullRequestReviewContainer({
  onBack,
  pullRequestNumber,
}: PullRequestReviewContainerProps) {
  const settings = useSettingsStore((store) => store.settings);
  const query = usePullRequestReviewQuery(settings, pullRequestNumber);
  const replyMutation = useMutation({
    mutationFn: replyToPullRequestReviewThread,
  });
  const createThreadMutation = useMutation({
    mutationFn: createPullRequestReviewThread,
  });
  const resolutionMutation = useMutation({
    mutationFn: setPullRequestReviewThreadResolved,
  });

  if (!query.data && query.isFetching) {
    return (
      <EmptyState
        title={`Loading PR #${pullRequestNumber}`}
        description="Fetching the diff and review threads through your local gh session."
      />
    );
  }

  if (query.isError && !query.data) {
    return (
      <ErrorState
        action={
          <Button onClick={onBack} type="button" variant="secondary">
            Back to PRs
          </Button>
        }
        description={getGithubErrorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
        title={getGithubErrorTitle(query.error)}
      />
    );
  }

  if (!query.data) {
    return (
      <EmptyState
        title={`No saved review for PR #${pullRequestNumber}`}
        description="Refresh this PR to fetch the diff and review threads, then it will stay available from local storage."
        action={
          <>
            <Button onClick={onBack} type="button" variant="secondary">
              Back to PRs
            </Button>
            <Button
              disabled={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
              variant="primary"
            >
              Refresh PR
            </Button>
          </>
        }
      />
    );
  }

  return (
    <PullRequestReview
      isRefreshing={query.isFetching}
      mutationError={replyMutation.error ?? createThreadMutation.error ?? resolutionMutation.error}
      onBack={onBack}
      onCreateThread={(input) => createThreadMutation.mutateAsync(input)}
      onRefresh={() => {
        void query.refetch();
      }}
      onReply={(threadId, body) => replyMutation.mutateAsync({ body, threadId })}
      onSetResolved={(threadId, isResolved) =>
        resolutionMutation.mutateAsync({ isResolved, threadId })
      }
      pendingReplyThreadId={
        replyMutation.isPending ? (replyMutation.variables?.threadId ?? null) : null
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
      pendingResolutionThreadId={
        resolutionMutation.isPending ? (resolutionMutation.variables?.threadId ?? null) : null
      }
      review={query.data}
    />
  );
}
