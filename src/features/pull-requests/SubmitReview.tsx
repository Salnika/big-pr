import { useEffect, useId, useRef, useState } from "react";
import { classNames } from "../../shared/lib/class-names";
import { Button } from "../../shared/ui/Button";
import type { PullRequestReviewState, ReviewEvent } from "./pull-request-model";
import * as styles from "./SubmitReview.css";

const reviewEventOptions: Array<{
  authorDescription?: string;
  description: string;
  event: ReviewEvent;
  label: string;
}> = [
  {
    description: "Submit general feedback without explicit approval.",
    event: "COMMENT",
    label: "Comment",
  },
  {
    authorDescription: "You can't approve your own pull request.",
    description: "Give your approval to merge these changes.",
    event: "APPROVE",
    label: "Approve",
  },
  {
    authorDescription: "You can't request changes on your own pull request.",
    description: "Submit feedback that must be addressed before merging.",
    event: "REQUEST_CHANGES",
    label: "Request changes",
  },
];

export function SubmitReview({
  canDiscard,
  isDiscarding,
  isSubmitting,
  onDiscard,
  onSubmit,
  pendingCommentCount,
  viewerDidAuthor,
  viewerLatestReviewState,
}: {
  canDiscard: boolean;
  isDiscarding: boolean;
  isSubmitting: boolean;
  onDiscard: () => Promise<unknown>;
  onSubmit: (input: { body: string; event: ReviewEvent }) => Promise<unknown>;
  pendingCommentCount: number;
  viewerDidAuthor: boolean;
  viewerLatestReviewState: PullRequestReviewState | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [draft, setDraft] = useState("");
  const [chosenEvent, setChosenEvent] = useState<ReviewEvent | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  // Pending comments usually mean feedback, while an empty review is most often an approval.
  const event = viewerDidAuthor
    ? "COMMENT"
    : (chosenEvent ?? (pendingCommentCount ? "COMMENT" : "APPROVE"));
  // A comment or a change request needs something to say: a summary or pending comments.
  const needsBody = event !== "APPROVE" && pendingCommentCount === 0;
  const canSubmit = !isSubmitting && !isDiscarding && (!needsBody || draft.trim().length > 0);
  const pendingLabel = formatCommentCount(pendingCommentCount);
  const close = () => {
    setIsOpen(false);
    setIsConfirmingDiscard(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsConfirmingDiscard(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsConfirmingDiscard(false);
      }
    };

    containerRef.current?.querySelector("textarea")?.focus();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.review} ref={containerRef}>
      {viewerLatestReviewState === "APPROVED" ? (
        <span className={classNames(styles.viewerState, styles.viewerStateApproved)}>
          ✓ You approved
        </span>
      ) : null}
      {viewerLatestReviewState === "CHANGES_REQUESTED" ? (
        <span className={classNames(styles.viewerState, styles.viewerStateChangesRequested)}>
          You requested changes
        </span>
      ) : null}
      <Button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-label={
          pendingCommentCount ? `Review changes, ${pendingLabel} pending` : "Review changes"
        }
        onClick={() => {
          setIsOpen((current) => !current);
          setIsConfirmingDiscard(false);
        }}
        type="button"
        variant="secondary"
      >
        Review changes
        {pendingCommentCount ? (
          <span aria-hidden="true" className={styles.count}>
            {pendingCommentCount}
          </span>
        ) : null}
      </Button>
      {isOpen ? (
        <form
          aria-labelledby={`${panelId}-title`}
          className={styles.panel}
          id={panelId}
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();

            if (!canSubmit) {
              return;
            }

            void onSubmit({ body: draft.trim(), event })
              .then(() => {
                setDraft("");
                setChosenEvent(null);
                close();
              })
              .catch(() => {});
          }}
        >
          <h3 className={styles.title} id={`${panelId}-title`}>
            Finish your review
          </h3>
          {pendingCommentCount ? (
            <p className={styles.pendingNote}>
              {pendingLabel} pending: submitting publishes{" "}
              {pendingCommentCount === 1 ? "it" : "them"} with this review.
            </p>
          ) : null}
          <textarea
            aria-label="Review summary"
            className={styles.textarea}
            onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            placeholder={needsBody ? "Leave a comment" : "Leave a comment (optional)"}
            value={draft}
          />
          <div aria-label="Review type" className={styles.events} role="radiogroup">
            {reviewEventOptions.map((option) => {
              const isDisabled = viewerDidAuthor && option.event !== "COMMENT";

              return (
                <label
                  className={classNames(
                    styles.event,
                    isDisabled ? styles.eventDisabled : undefined,
                  )}
                  key={option.event}
                >
                  <input
                    checked={event === option.event}
                    className={styles.eventInput}
                    disabled={isDisabled}
                    name={`${panelId}-event`}
                    onChange={() => setChosenEvent(option.event)}
                    type="radio"
                    value={option.event}
                  />
                  <span className={styles.eventText}>
                    <span className={styles.eventLabel}>{option.label}</span>
                    <span className={styles.eventDescription}>
                      {isDisabled ? option.authorDescription : option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {isConfirmingDiscard ? (
            <div className={styles.discardConfirm}>
              <p className={styles.discardText}>
                Delete your pending review
                {pendingCommentCount ? ` and its ${pendingLabel}` : ""}? This can't be undone.
              </p>
              <div className={styles.actions}>
                <Button
                  onClick={() => setIsConfirmingDiscard(false)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Keep review
                </Button>
                <Button
                  className={styles.discardButton}
                  disabled={isDiscarding}
                  onClick={() => {
                    void onDiscard()
                      .then(() => {
                        setChosenEvent(null);
                        close();
                      })
                      .catch(() => {});
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isDiscarding ? "Discarding..." : "Discard review"}
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              {canDiscard ? (
                <Button
                  className={classNames(styles.discardButton, styles.actionsStart)}
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmingDiscard(true)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Discard review
                </Button>
              ) : null}
              <Button onClick={close} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={!canSubmit} size="sm" type="submit" variant="primary">
                {isSubmitting ? "Submitting..." : "Submit review"}
              </Button>
            </div>
          )}
        </form>
      ) : null}
    </div>
  );
}

function formatCommentCount(count: number) {
  return `${count} ${count === 1 ? "comment" : "comments"}`;
}
