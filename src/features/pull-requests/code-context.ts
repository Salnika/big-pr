import { parseDiffHunk } from "./diff-parser";
import type {
  PullRequestDiffFile,
  PullRequestDiffHunk,
  PullRequestDiffLine,
  PullRequestReviewThread,
} from "./pull-request-model";

export type CodeSide = "new" | "old";

type CodeAnchor = {
  line: number;
  side: CodeSide;
};

export type ThreadCodeSource = {
  end: CodeAnchor;
  /** Commit to load the full file from, or null when the hunks are all there is to show. */
  fileRef: string | null;
  hunks: PullRequestDiffHunk[];
  /** True when the thread is outdated and the code is shown as it was when it was written. */
  isOriginal: boolean;
  path: string;
  start: CodeAnchor;
};

export type CodeDocument = {
  mayHaveHiddenLinesAbove: boolean;
  mayHaveHiddenLinesBelow: boolean;
  rows: PullRequestDiffLine[];
  targetEnd: number;
  targetStart: number;
};

export type CodeWindow = {
  above: number;
  below: number;
};

export const defaultCodeWindow: CodeWindow = {
  above: 1,
  below: 1,
};

export function getThreadCodeSource(
  thread: PullRequestReviewThread,
  file: PullRequestDiffFile | null,
  headRefOid: string | null,
): ThreadCodeSource | null {
  const endSide = getCodeSide(thread.diffSide);
  const startSide = getCodeSide(thread.startDiffSide ?? thread.diffSide);
  const originalHunk =
    thread.diffHunk && thread.originalLine
      ? parseDiffHunk(thread.diffHunk, `${thread.id}:original`)
      : null;
  const currentSource: ThreadCodeSource | null =
    file && thread.line
      ? {
          end: { line: thread.line, side: endSide },
          fileRef: file.status === "added" || file.status === "deleted" ? null : headRefOid,
          hunks: file.hunks,
          isOriginal: false,
          path: file.path,
          start: { line: thread.startLine ?? thread.line, side: startSide },
        }
      : null;
  const originalSource: ThreadCodeSource | null =
    originalHunk && thread.originalLine
      ? {
          end: { line: thread.originalLine, side: endSide },
          fileRef: endSide === "new" ? thread.originalCommitOid : null,
          hunks: [originalHunk],
          isOriginal: true,
          path: thread.path,
          start: { line: thread.originalStartLine ?? thread.originalLine, side: startSide },
        }
      : null;
  // An outdated thread can keep a `line`, but it points into an older commit than the head.
  const candidates = thread.isOutdated
    ? [originalSource, currentSource]
    : [currentSource, originalSource];

  return (
    candidates.find((source) => source && (source.fileRef || findHunkDocument(source))) ?? null
  );
}

export function buildCodeDocument(
  source: ThreadCodeSource,
  fileLines: string[] | null,
): CodeDocument | null {
  if (!fileLines || !source.fileRef) {
    return findHunkDocument(source);
  }

  const rows = mergeHunksWithFile(source, fileLines);
  const target = findTargetRange(rows, source);

  return target
    ? {
        ...target,
        mayHaveHiddenLinesAbove: false,
        mayHaveHiddenLinesBelow: false,
        rows,
      }
    : null;
}

export function getVisibleCodeRange(document: CodeDocument, codeWindow: CodeWindow) {
  return {
    end: Math.min(document.rows.length - 1, document.targetEnd + codeWindow.below),
    start: Math.max(0, document.targetStart - codeWindow.above),
  };
}

export function expandCodeWindow(
  document: CodeDocument,
  codeWindow: CodeWindow,
  direction: "down" | "up",
  lineCount: number,
): CodeWindow {
  const range = getVisibleCodeRange(document, codeWindow);

  return direction === "up"
    ? { ...codeWindow, above: document.targetStart - range.start + lineCount }
    : { ...codeWindow, below: range.end - document.targetEnd + lineCount };
}

export function splitFileLines(content: string) {
  if (!content) {
    return [];
  }

  const lines = content.split("\n");

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

export function getDiffLinePrefix(line: PullRequestDiffLine) {
  if (line.type === "addition") {
    return "+";
  }

  if (line.type === "deletion") {
    return "-";
  }

  return line.oldLineNumber === null && line.newLineNumber === null ? "" : " ";
}

export function getCodeLineNumber(line: PullRequestDiffLine, side: CodeSide) {
  return side === "old" ? line.oldLineNumber : line.newLineNumber;
}

function getCodeSide(side: PullRequestReviewThread["diffSide"]): CodeSide {
  return side === "LEFT" ? "old" : "new";
}

function findHunkDocument(source: ThreadCodeSource): CodeDocument | null {
  for (const hunk of source.hunks) {
    const target = findTargetRange(hunk.lines, source);

    if (target) {
      const canLoadFile = source.fileRef !== null;

      return {
        ...target,
        mayHaveHiddenLinesAbove: canLoadFile && (hunk.newStart > 1 || hunk.oldStart > 1),
        mayHaveHiddenLinesBelow: canLoadFile,
        rows: hunk.lines,
      };
    }
  }

  return null;
}

function findTargetRange(rows: PullRequestDiffLine[], source: ThreadCodeSource) {
  const targetEnd = rows.findIndex((row) => isAnchorRow(row, source.end));

  if (targetEnd < 0) {
    return null;
  }

  const targetStart = rows.findIndex((row) => isAnchorRow(row, source.start));

  return {
    targetEnd,
    targetStart: targetStart >= 0 && targetStart <= targetEnd ? targetStart : targetEnd,
  };
}

function isAnchorRow(row: PullRequestDiffLine, anchor: CodeAnchor) {
  return getCodeLineNumber(row, anchor.side) === anchor.line;
}

function mergeHunksWithFile(source: ThreadCodeSource, fileLines: string[]) {
  const rows: PullRequestDiffLine[] = [];
  const isAddedFile = source.hunks.every((hunk) => hunk.oldStart === 0);
  let nextNewLine = 1;
  let nextOldLine = 1;
  const pushFileLinesUntil = (newLineNumber: number) => {
    while (nextNewLine < newLineNumber && nextNewLine <= fileLines.length) {
      rows.push({
        id: `${source.path}:file:${nextNewLine}`,
        content: fileLines[nextNewLine - 1] ?? "",
        newLineNumber: nextNewLine,
        // Outdated hunks are truncated, so old line numbers are only known inside them.
        oldLineNumber: source.isOriginal || isAddedFile ? null : nextOldLine,
        type: isAddedFile ? "addition" : "context",
      });
      nextNewLine += 1;
      nextOldLine += 1;
    }
  };

  for (const hunk of source.hunks) {
    const hasNewLines = hunk.lines.some((line) => line.newLineNumber !== null);

    // A hunk without new lines starts after `newStart` instead of at it.
    pushFileLinesUntil(hasNewLines ? hunk.newStart : hunk.newStart + 1);

    for (const line of hunk.lines) {
      rows.push(line);

      if (line.newLineNumber !== null) {
        nextNewLine = line.newLineNumber + 1;
      }

      if (line.oldLineNumber !== null) {
        nextOldLine = line.oldLineNumber + 1;
      }
    }
  }

  pushFileLinesUntil(fileLines.length + 1);

  return rows;
}
