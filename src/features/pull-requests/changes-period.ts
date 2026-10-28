import { useEffect, useMemo, useState } from "react";
import type { ChangesPeriod } from "../settings/preferences-store";
import type {
  CommitRangeDiff,
  PullRequestCommit,
  PullRequestDiffFile,
  PullRequestDiffHunk,
  PullRequestReviewModel,
} from "./pull-request-model";

export type { ChangesPeriod };

export type CommitRange = {
  /** Last commit before the period, or null when the period starts with the PR's first commit. */
  baseOid: string | null;
  commits: PullRequestCommit[];
};

export type LoadCommitRangeDiff = (range: {
  base: string;
  head: string;
}) => Promise<CommitRangeDiff>;

// What the files view shows for a period: the commits made in it, then the diff they add up to.
export type PeriodChanges =
  | { status: "unavailable" }
  | { commits: PullRequestCommit[]; status: "loading" }
  | { commits: PullRequestCommit[]; error: Error; retry: () => void; status: "error" }
  | {
      /** Set when the files compare a later commit than the PR's base with its head. */
      baseOid: string | null;
      commits: PullRequestCommit[];
      files: PullRequestDiffFile[];
      /** Hunks of the period left out because the PR's own diff doesn't make them. */
      hiddenChangeCount: number;
      isTruncated: boolean;
      status: "ready";
    };

type RangeDiffState =
  | { error: Error; status: "error" }
  | { diff: CommitRangeDiff; status: "ready" };

// Where a diff changes a file, by line of its latest version. Deleted lines sit after a line.
type ChangedLines = {
  additions: ReadonlySet<number>;
  deletionAnchors: ReadonlySet<number>;
};

const dayLength = 24 * 60 * 60 * 1000;

export function getChangesPeriodStart(period: ChangesPeriod, now: number) {
  return now - period.amount * (period.unit === "weeks" ? 7 : 1) * dayLength;
}

// Commits come oldest first. Every commit after the first one of the period counts, even one dated
// earlier, so no recent change hides behind an out-of-order date. A rebase dates every commit anew.
export function getCommitRange(commits: PullRequestCommit[], since: number): CommitRange {
  const firstIndex = commits.findIndex((commit) => Date.parse(commit.committedDate) >= since);

  if (firstIndex === -1) {
    return { baseOid: null, commits: [] };
  }

  return {
    baseOid: commits[firstIndex - 1]?.oid ?? null,
    commits: commits.slice(firstIndex),
  };
}

export function describeChangesPeriod(period: ChangesPeriod) {
  const unit = period.unit === "weeks" ? "week" : "day";

  return period.amount === 1 ? `last ${unit}` : `last ${period.amount} ${unit}s`;
}

// Merging the base branch into the PR brings the base's changes into a range of its commits. Both
// diffs end on the PR's latest code, so a hunk of the range stays only where the PR's own diff
// changes the same lines. Changes undone since, which the PR no longer makes, go too.
export function keepPullRequestChanges(
  rangeFiles: PullRequestDiffFile[],
  pullRequestFiles: PullRequestDiffFile[],
) {
  const pullRequestFilesByPath = new Map(pullRequestFiles.map((file) => [file.path, file]));
  let hiddenChangeCount = 0;
  const files = rangeFiles.flatMap((file) => {
    const pullRequestFile = pullRequestFilesByPath.get(file.path);

    if (!pullRequestFile) {
      hiddenChangeCount += Math.max(1, file.hunks.length);
      return [];
    }

    // Without hunks on either side (binary files, patches too large), there is nothing to match.
    if (!file.hunks.length || !pullRequestFile.hunks.length) {
      return [file];
    }

    const changedLines = getChangedLines(pullRequestFile.hunks);
    const hunks = file.hunks.filter((hunk) => touchesChangedLines(hunk, changedLines));

    hiddenChangeCount += file.hunks.length - hunks.length;

    if (hunks.length === file.hunks.length) {
      return [file];
    }

    const lines = hunks.flatMap((hunk) => hunk.lines);

    return hunks.length
      ? [
          {
            ...file,
            additions: lines.filter((line) => line.type === "addition").length,
            deletions: lines.filter((line) => line.type === "deletion").length,
            hunks,
          },
        ]
      : [];
  });

  return { files, hiddenChangeCount };
}

function getChangedLines(hunks: PullRequestDiffHunk[]): ChangedLines {
  const additions = new Set<number>();
  const deletionAnchors = new Set<number>();

  for (const hunk of hunks) {
    let previousLine = getLineBeforeHunk(hunk);

    for (const line of hunk.lines) {
      if (line.type === "deletion") {
        deletionAnchors.add(previousLine);
      } else if (line.newLineNumber !== null) {
        if (line.type === "addition") {
          additions.add(line.newLineNumber);
        }

        previousLine = line.newLineNumber;
      }
    }
  }

  return { additions, deletionAnchors };
}

// Replaced lines count by what replaces them; lines only deleted, by where they were.
function touchesChangedLines(hunk: PullRequestDiffHunk, changedLines: ChangedLines) {
  const touchesDeletion = (anchor: number) =>
    changedLines.deletionAnchors.has(anchor) ||
    changedLines.additions.has(anchor) ||
    changedLines.additions.has(anchor + 1);
  let previousLine = getLineBeforeHunk(hunk);
  let deletionAnchor: number | null = null;

  for (const line of hunk.lines) {
    if (line.type === "deletion") {
      deletionAnchor ??= previousLine;
      continue;
    }

    // "\ No newline at end of file" belongs to the line before it.
    if (line.newLineNumber === null) {
      continue;
    }

    if (line.type === "addition") {
      if (changedLines.additions.has(line.newLineNumber)) {
        return true;
      }
    } else if (deletionAnchor !== null && touchesDeletion(deletionAnchor)) {
      return true;
    }

    deletionAnchor = null;
    previousLine = line.newLineNumber;
  }

  return deletionAnchor !== null && touchesDeletion(deletionAnchor);
}

// Like `getDiffGaps`: a hunk without new lines starts after `newStart` instead of at it.
function getLineBeforeHunk(hunk: PullRequestDiffHunk) {
  return hunk.lines.some((line) => line.newLineNumber !== null) ? hunk.newStart - 1 : hunk.newStart;
}

export function usePeriodChanges(
  review: PullRequestReviewModel,
  since: number | null,
  loadRangeDiff: LoadCommitRangeDiff,
): PeriodChanges | null {
  const range = useMemo(
    () => (since === null ? null : getCommitRange(review.commits, since)),
    [review.commits, since],
  );
  const head = review.headRefOid;
  const { retry, state: rangeDiff } = useCommitRangeDiff(
    range?.baseOid && head ? range.baseOid : null,
    head,
    loadRangeDiff,
  );
  const rangeFiles = rangeDiff?.status === "ready" ? rangeDiff.diff.files : null;
  const pullRequestChanges = useMemo(
    () => (rangeFiles ? keepPullRequestChanges(rangeFiles, review.files) : null),
    [rangeFiles, review.files],
  );

  if (!range) {
    return null;
  }

  if (!review.commits.length || !head) {
    return { status: "unavailable" };
  }

  // A period that starts with the PR's first commit shows the PR's own diff.
  if (!range.baseOid) {
    return {
      baseOid: null,
      commits: range.commits,
      files: range.commits.length ? review.files : [],
      hiddenChangeCount: 0,
      isTruncated: false,
      status: "ready",
    };
  }

  if (!rangeDiff) {
    return { commits: range.commits, status: "loading" };
  }

  if (rangeDiff.status === "error") {
    return { commits: range.commits, error: rangeDiff.error, retry, status: "error" };
  }

  return {
    baseOid: range.baseOid,
    commits: range.commits,
    files: pullRequestChanges?.files ?? [],
    hiddenChangeCount: pullRequestChanges?.hiddenChangeCount ?? 0,
    isTruncated: rangeDiff.diff.isTruncated,
    status: "ready",
  };
}

function useCommitRangeDiff(base: string | null, head: string | null, load: LoadCommitRangeDiff) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: RangeDiffState } | null>(null);
  const key = base && head ? `${base}...${head}#${attempt}` : null;

  useEffect(() => {
    if (!key || !base || !head) {
      return;
    }

    let isCurrent = true;

    load({ base, head }).then(
      (diff) => {
        if (isCurrent) {
          setResult({ key, state: { diff, status: "ready" } });
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setResult({
            key,
            state: {
              error:
                error instanceof Error
                  ? error
                  : new Error("The changes of this period could not be loaded."),
              status: "error",
            },
          });
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [base, head, key, load]);

  return {
    retry: () => setAttempt((current) => current + 1),
    // Null while the diff loads, and without commits to compare.
    state: key !== null && result?.key === key ? result.state : null,
  };
}
