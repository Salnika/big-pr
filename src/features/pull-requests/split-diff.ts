import type { PullRequestDiffLine } from "./pull-request-model";

export type SplitDiffRow = {
  id: string;
  left: PullRequestDiffLine | null;
  right: PullRequestDiffLine | null;
};

// Like GitHub's split view: unchanged lines sit on both sides, and each run of deleted lines
// faces the added lines that follow it, row by row.
export function buildSplitRows(lines: PullRequestDiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let deletions: PullRequestDiffLine[] = [];
  let additions: PullRequestDiffLine[] = [];
  let previousType: PullRequestDiffLine["type"] | null = null;
  const flushChanges = () => {
    const rowCount = Math.max(deletions.length, additions.length);

    for (let index = 0; index < rowCount; index += 1) {
      rows.push(createRow(deletions[index] ?? null, additions[index] ?? null));
    }

    deletions = [];
    additions = [];
  };

  for (const line of lines) {
    // "\ No newline at end of file" belongs to the side of the line it follows.
    const type: PullRequestDiffLine["type"] =
      isMetadataLine(line) && previousType ? previousType : line.type;

    if (type === "deletion") {
      if (additions.length) {
        flushChanges();
      }

      deletions.push(line);
    } else if (type === "addition") {
      additions.push(line);
    } else {
      flushChanges();
      rows.push(createRow(line, line));
    }

    previousType = type;
  }

  flushChanges();

  return rows;
}

function createRow(left: PullRequestDiffLine | null, right: PullRequestDiffLine | null) {
  return {
    id: `${left?.id ?? "none"}|${right?.id ?? "none"}`,
    left,
    right,
  };
}

function isMetadataLine(line: PullRequestDiffLine) {
  return line.oldLineNumber === null && line.newLineNumber === null;
}
