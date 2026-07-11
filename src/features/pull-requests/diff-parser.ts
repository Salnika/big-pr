import type {
  PullRequestDiffFile,
  PullRequestDiffHunk,
  PullRequestDiffLine,
} from "./pull-request-model";

export function parseUnifiedDiff(input: string): PullRequestDiffFile[] {
  const files: PullRequestDiffFile[] = [];
  let currentFile: PullRequestDiffFile | null = null;
  let currentHunk: PullRequestDiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  const lines = input.endsWith("\n") ? input.slice(0, -1).split("\n") : input.split("\n");

  for (const rawLine of lines) {
    if (rawLine.startsWith("diff --git ")) {
      currentFile = startDiffFile(rawLine);
      currentHunk = null;
      files.push(currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (rawLine.startsWith("--- ")) {
      currentFile.oldPath = normalizeDiffPath(rawLine.slice(4));
      currentFile.status = getFileStatus(currentFile.oldPath, currentFile.path);
      continue;
    }

    if (rawLine.startsWith("+++ ")) {
      const newPath = normalizeDiffPath(rawLine.slice(4));
      currentFile.path = newPath ?? currentFile.path;
      currentFile.status = getFileStatus(currentFile.oldPath, newPath);
      continue;
    }

    if (rawLine.startsWith("@@ ")) {
      const hunkRange = parseHunkRange(rawLine);
      oldLineNumber = hunkRange.oldStart;
      newLineNumber = hunkRange.newStart;
      currentHunk = {
        id: `${currentFile.path}:hunk:${currentFile.hunks.length}`,
        header: rawLine,
        newStart: hunkRange.newStart,
        oldStart: hunkRange.oldStart,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      currentHunk.lines.push({
        id: `${currentHunk.id}:line:${currentHunk.lines.length}`,
        content: rawLine.slice(1),
        newLineNumber,
        oldLineNumber: null,
        type: "addition",
      });
      currentFile.additions += 1;
      newLineNumber += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      currentHunk.lines.push({
        id: `${currentHunk.id}:line:${currentHunk.lines.length}`,
        content: rawLine.slice(1),
        newLineNumber: null,
        oldLineNumber,
        type: "deletion",
      });
      currentFile.deletions += 1;
      oldLineNumber += 1;
      continue;
    }

    const line = createContextLine({
      content: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine,
      hunk: currentHunk,
      newLineNumber,
      oldLineNumber,
    });
    currentHunk.lines.push(line);

    if (!rawLine.startsWith("\\")) {
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  return files;
}

function startDiffFile(line: string): PullRequestDiffFile {
  const paths = line.match(/^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/);
  const oldPath = normalizeDiffPath(paths?.[1] ? `a/${paths[1]}` : null);
  const path = normalizeDiffPath(paths?.[2] ? `b/${paths[2]}` : null) ?? "unknown";

  return {
    additions: 0,
    deletions: 0,
    hunks: [],
    oldPath,
    path,
    status: getFileStatus(oldPath, path),
  };
}

function createContextLine(input: {
  content: string;
  hunk: PullRequestDiffHunk;
  newLineNumber: number;
  oldLineNumber: number;
}): PullRequestDiffLine {
  const isMetadataLine = input.content.startsWith("\\");

  return {
    id: `${input.hunk.id}:line:${input.hunk.lines.length}`,
    content: input.content,
    newLineNumber: isMetadataLine ? null : input.newLineNumber,
    oldLineNumber: isMetadataLine ? null : input.oldLineNumber,
    type: "context",
  };
}

function parseHunkRange(line: string) {
  const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

  return {
    newStart: match?.[2] ? Number(match[2]) : 0,
    oldStart: match?.[1] ? Number(match[1]) : 0,
  };
}

function normalizeDiffPath(path: string | null | undefined) {
  if (!path || path === "/dev/null") {
    return null;
  }

  const unquoted = path.replace(/^"|"$/g, "");

  if (unquoted.startsWith("a/") || unquoted.startsWith("b/")) {
    return unquoted.slice(2);
  }

  return unquoted;
}

function getFileStatus(
  oldPath: string | null | undefined,
  newPath: string | null | undefined,
): PullRequestDiffFile["status"] {
  if (!oldPath && newPath) {
    return "added";
  }

  if (oldPath && !newPath) {
    return "deleted";
  }

  if (oldPath && newPath && oldPath !== newPath) {
    return "renamed";
  }

  return "modified";
}
