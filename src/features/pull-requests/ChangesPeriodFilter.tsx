import { useState } from "react";
import { classNames } from "../../shared/lib/class-names";
import { formatDateTime } from "../../shared/lib/date";
import { Button } from "../../shared/ui/Button";
import {
  type ChangesPeriod,
  type ChangesPeriodUnit,
  maxChangesPeriodAmount,
  parseChangesPeriodAmount,
} from "../settings/preferences-store";
import { describeChangesPeriod, type PeriodChanges } from "./changes-period";
import * as styles from "./ChangesPeriodFilter.css";
import { segment, segmentGroup } from "./PullRequestReview.css";

const periodUnits: readonly ChangesPeriodUnit[] = ["days", "weeks"];

export function ChangesPeriodFilter({
  isActive,
  onApply,
  onShowAll,
  period,
}: {
  isActive: boolean;
  onApply: (period: ChangesPeriod) => void;
  onShowAll: () => void;
  period: ChangesPeriod;
}) {
  // What is typed stays in the field until it makes a period, like an empty field mid-edit.
  const [typedAmount, setTypedAmount] = useState<string | null>(null);

  return (
    <div aria-label="Changes to review" className={styles.filter} role="group">
      <div className={segmentGroup}>
        <button aria-pressed={!isActive} className={segment} onClick={onShowAll} type="button">
          All changes
        </button>
        <button
          aria-label={capitalize(describeChangesPeriod(period))}
          aria-pressed={isActive}
          className={segment}
          onClick={() => onApply(period)}
          type="button"
        >
          Last
        </button>
      </div>
      <input
        aria-label={`Number of ${period.unit}`}
        className={classNames(styles.amountInput, isActive ? undefined : styles.fieldIdle)}
        max={maxChangesPeriodAmount}
        min={1}
        onBlur={() => setTypedAmount(null)}
        onChange={(event) => {
          const amount = parseChangesPeriodAmount(event.target.value);

          setTypedAmount(event.target.value);

          if (amount !== null) {
            onApply({ ...period, amount });
          }
        }}
        type="number"
        value={typedAmount ?? period.amount}
      />
      <select
        aria-label="Period unit"
        className={classNames(styles.unitSelect, isActive ? undefined : styles.fieldIdle)}
        onChange={(event) =>
          onApply({ ...period, unit: event.target.value === "days" ? "days" : "weeks" })
        }
        value={period.unit}
      >
        {periodUnits.map((unit) => (
          <option key={unit} value={unit}>
            {period.amount === 1 ? unit.slice(0, -1) : unit}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ChangesPeriodSummary({
  baseBranch,
  changes,
  commitCount,
  period,
  since,
}: {
  baseBranch: string;
  changes: PeriodChanges;
  /** Every commit of the pull request, in or out of the period. */
  commitCount: number;
  period: ChangesPeriod;
  since: number;
}) {
  const periodLabel = describeChangesPeriod(period);
  const sinceLabel = formatDateTime(new Date(since).toISOString());

  if (changes.status === "unavailable") {
    return (
      <div className={styles.summary} role="status">
        This saved review has no commit history yet. Refresh the PR to see what changed in the{" "}
        {periodLabel}.
      </div>
    );
  }

  if (!changes.commits.length) {
    return (
      <div className={styles.summary} role="status">
        No commits in the {periodLabel} (since {sinceLabel}).
      </div>
    );
  }

  return (
    <div className={styles.summary}>
      <details className={styles.commits}>
        <summary className={styles.commitsToggle}>
          {changes.commits.length} of {commitCount} {commitCount === 1 ? "commit" : "commits"} since{" "}
          {sinceLabel}
        </summary>
        <ol className={styles.commitList}>
          {changes.commits.map((commit) => (
            <li className={styles.commit} key={commit.oid}>
              <code className={styles.commitOid}>{commit.oid.slice(0, 7)}</code>
              <span className={styles.commitHeadline} title={commit.messageHeadline}>
                {commit.messageHeadline}
              </span>
              <span className={styles.commitDate}>{formatDateTime(commit.committedDate)}</span>
            </li>
          ))}
        </ol>
      </details>
      {changes.status === "loading" ? (
        <span className={styles.changesStatus} role="status">
          Loading their changes...
        </span>
      ) : null}
      {changes.status === "error" ? (
        <span className={styles.changesError} role="alert">
          {changes.error.message}
          <Button onClick={changes.retry} size="sm" type="button" variant="secondary">
            Retry
          </Button>
        </span>
      ) : null}
      {changes.status === "ready" ? (
        <span className={styles.changesStatus} role="status">
          {formatFileChanges(changes.files)}
        </span>
      ) : null}
      {changes.status === "ready" && changes.hiddenChangeCount ? (
        <p className={styles.hiddenNote}>
          Hiding {changes.hiddenChangeCount}{" "}
          {changes.hiddenChangeCount === 1 ? "change" : "changes"} this pull request doesn't make
          itself, like ones merged in from {baseBranch}.
        </p>
      ) : null}
      {changes.status === "ready" && changes.isTruncated ? (
        <p className={styles.truncatedNote} role="note">
          GitHub lists at most 300 files when comparing commits, so some of these changes may be
          missing.
        </p>
      ) : null}
    </div>
  );
}

function formatFileChanges(files: Extract<PeriodChanges, { status: "ready" }>["files"]) {
  if (!files.length) {
    return "No changes to this pull request's diff";
  }

  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);

  return `${files.length} ${files.length === 1 ? "file" : "files"} changed, +${additions} -${deletions}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
