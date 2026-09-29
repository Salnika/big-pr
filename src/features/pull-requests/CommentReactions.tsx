import { useEffect, useId, useRef, useState } from "react";
import * as styles from "./CommentReactions.css";
import type { PullRequestReviewReaction } from "./pull-request-model";
import { type ReactionContent, reactionContents, reactionEmoji, reactionLabels } from "./reactions";

type ToggleReaction = (content: ReactionContent, hasReacted: boolean) => void;

export function AddReactionButton({
  disabled,
  onToggle,
  reactions,
}: {
  disabled: boolean;
  onToggle: ToggleReaction;
  reactions: PullRequestReviewReaction[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    containerRef.current?.querySelector<HTMLButtonElement>(`.${styles.menuItem}`)?.focus();
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.picker} ref={containerRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label="Add reaction"
        className={styles.addButton}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        title="Add reaction"
        type="button"
      >
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
          <circle cx="8" cy="8" fill="none" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5.75" cy="6.5" fill="currentColor" r="1" />
          <circle cx="10.25" cy="6.5" fill="currentColor" r="1" />
          <path
            d="M5.25 9.5a3.1 3.1 0 0 0 5.5 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      {isOpen ? (
        <div aria-label="Pick a reaction" className={styles.menu} id={menuId} role="group">
          {reactionContents.map((content) => {
            const hasReacted = reactions.some(
              (reaction) => reaction.content === content && reaction.viewerHasReacted,
            );

            return (
              <button
                aria-label={`React with ${reactionLabels[content]}`}
                aria-pressed={hasReacted}
                className={styles.menuItem}
                key={content}
                onClick={() => {
                  onToggle(content, !hasReacted);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                title={reactionLabels[content]}
                type="button"
              >
                {reactionEmoji[content]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CommentReactionList({
  disabled,
  onToggle,
  reactions,
}: {
  disabled: boolean;
  onToggle: ToggleReaction;
  reactions: PullRequestReviewReaction[];
}) {
  if (!reactions.length) {
    return null;
  }

  return (
    <div aria-label="Reactions" className={styles.list} role="group">
      {reactions.map((reaction) => (
        <button
          aria-label={`${reactionLabels[reaction.content]}: ${reaction.count}`}
          aria-pressed={reaction.viewerHasReacted}
          className={styles.pill}
          disabled={disabled}
          key={reaction.content}
          onClick={() => onToggle(reaction.content, !reaction.viewerHasReacted)}
          title={formatReactionTitle(reaction)}
          type="button"
        >
          <span aria-hidden="true">{reactionEmoji[reaction.content]}</span>
          <span className={styles.pillCount}>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

function formatReactionTitle(reaction: PullRequestReviewReaction) {
  const label = `${reaction.count} ${reactionLabels[reaction.content]}`;

  return reaction.viewerHasReacted ? `${label}, including you` : label;
}
