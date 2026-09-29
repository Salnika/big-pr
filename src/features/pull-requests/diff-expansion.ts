import type { PullRequestDiffHunk, PullRequestDiffLine } from "./pull-request-model";

// Unchanged lines hidden before, between, or after the hunks of a file.
export type DiffGap = {
  index: number;
  /** Last new-side line of the gap, or null after the last hunk until the file is loaded. */
  newEnd: number | null;
  newStart: number;
  oldOffset: number;
};

export type RevealedGap = {
  fromEnd: number;
  fromStart: number;
};

export type ExpandDirection = "all" | "down" | "up";

export const emptyRevealedGap: RevealedGap = {
  fromEnd: 0,
  fromStart: 0,
};

export function getDiffGaps(hunks: PullRequestDiffHunk[]): DiffGap[] {
  const gaps: DiffGap[] = [];
  let nextNewLine = 1;
  let nextOldLine = 1;

  hunks.forEach((hunk, index) => {
    const hasNewLines = hunk.lines.some((line) => line.newLineNumber !== null);
    // A hunk without new lines starts after `newStart` instead of at it.
    const newEnd = (hasNewLines ? hunk.newStart : hunk.newStart + 1) - 1;
    const gapSize = Math.max(0, newEnd - nextNewLine + 1);

    gaps.push({
      index,
      newEnd,
      newStart: nextNewLine,
      oldOffset: nextOldLine - nextNewLine,
    });
    nextNewLine += gapSize;
    nextOldLine += gapSize;

    for (const line of hunk.lines) {
      if (line.newLineNumber !== null) {
        nextNewLine = line.newLineNumber + 1;
      }

      if (line.oldLineNumber !== null) {
        nextOldLine = line.oldLineNumber + 1;
      }
    }
  });

  gaps.push({
    index: hunks.length,
    newEnd: null,
    newStart: nextNewLine,
    oldOffset: nextOldLine - nextNewLine,
  });

  return gaps;
}

export function getGapSize(gap: DiffGap, fileLineCount: number | null) {
  if (gap.newEnd !== null) {
    return Math.max(0, gap.newEnd - gap.newStart + 1);
  }

  return fileLineCount === null ? null : Math.max(0, fileLineCount - gap.newStart + 1);
}

export function getHiddenLineCount(
  gap: DiffGap,
  revealed: RevealedGap,
  fileLineCount: number | null,
) {
  const size = getGapSize(gap, fileLineCount);

  return size === null ? null : Math.max(0, size - revealed.fromStart - revealed.fromEnd);
}

export function expandDiffGap(
  gap: DiffGap,
  revealed: RevealedGap,
  direction: ExpandDirection,
  fileLineCount: number,
  lineCount: number,
): RevealedGap {
  const hidden = getHiddenLineCount(gap, revealed, fileLineCount) ?? 0;

  if (direction === "all") {
    return { ...revealed, fromStart: revealed.fromStart + hidden };
  }

  const revealedCount = Math.min(lineCount, hidden);

  return direction === "down"
    ? { ...revealed, fromStart: revealed.fromStart + revealedCount }
    : { ...revealed, fromEnd: revealed.fromEnd + revealedCount };
}

export function getRevealedGapLines(
  gap: DiffGap,
  revealed: RevealedGap,
  fileLines: string[] | null,
  idPrefix: string,
) {
  const size = fileLines ? (getGapSize(gap, fileLines.length) ?? 0) : 0;
  const toLine = (newLineNumber: number): PullRequestDiffLine => ({
    id: `${idPrefix}:gap:${newLineNumber}`,
    content: fileLines?.[newLineNumber - 1] ?? "",
    newLineNumber,
    oldLineNumber: newLineNumber + gap.oldOffset,
    type: "context",
  });
  const fromStart = Math.min(revealed.fromStart, size);
  const fromEnd = Math.min(revealed.fromEnd, size - fromStart);

  return {
    after: Array.from({ length: fromEnd }, (_, index) =>
      toLine(gap.newStart + size - fromEnd + index),
    ),
    before: Array.from({ length: fromStart }, (_, index) => toLine(gap.newStart + index)),
  };
}
