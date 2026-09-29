import type { DiffLineType, PullRequestDiffFile, PullRequestDiffHunk } from "./pull-request-model";

type HunkCursor = {
  newLineNumber: number;
  oldLineNumber: number;
};

// One entry of GitHub's "list pull request files" API.
export type RawPullRequestFile = {
  additions: number;
  deletions: number;
  filename: string;
  patch?: string;
  previous_filename?: string | null;
  status: string;
};

export function parseUnifiedDiff(input: string): PullRequestDiffFile[] {
  const files: PullRequestDiffFile[] = [];
  let currentFile: PullRequestDiffFile | null = null;
  let currentHunk: PullRequestDiffHunk | null = null;
  const cursor: HunkCursor = {
    newLineNumber: 0,
    oldLineNumber: 0,
  };

  for (const rawLine of splitDiffLines(input)) {
    if (rawLine.startsWith("diff --git ")) {
      currentFile = startDiffFile(rawLine);
      currentHunk = null;
      files.push(currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (!currentHunk && rawLine.startsWith("--- ")) {
      currentFile.oldPath = normalizeDiffPath(rawLine.slice(4));
      currentFile.status = getFileStatus(currentFile.oldPath, currentFile.path);
      continue;
    }

    if (!currentHunk && rawLine.startsWith("+++ ")) {
      const newPath = normalizeDiffPath(rawLine.slice(4));
      currentFile.path = newPath ?? currentFile.path;
      currentFile.status = getFileStatus(currentFile.oldPath, newPath);
      continue;
    }

    if (rawLine.startsWith("@@ ")) {
      currentHunk = createHunk(rawLine, `${currentFile.path}:hunk:${currentFile.hunks.length}`);
      cursor.newLineNumber = currentHunk.newStart;
      cursor.oldLineNumber = currentHunk.oldStart;
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    const lineType = appendHunkLine(currentHunk, rawLine, cursor);

    if (lineType === "addition") {
      currentFile.additions += 1;
    }

    if (lineType === "deletion") {
      currentFile.deletions += 1;
    }
  }

  return files;
}

// Builds the same files as `parseUnifiedDiff` from per-file patches, for PRs too big for one diff.
export function parsePullRequestFiles(files: RawPullRequestFile[]): PullRequestDiffFile[] {
  return files.map((file) => {
    const status = getPullRequestFileStatus(file);

    return {
      additions: file.additions,
      deletions: file.deletions,
      hunks: file.patch ? parsePatchHunks(file.patch, file.filename) : [],
      oldPath: status === "added" ? null : (file.previous_filename ?? file.filename),
      path: file.filename,
      status,
    };
  });
}

export function parseDiffHunk(input: string, idPrefix: string): PullRequestDiffHunk | null {
  const [header, ...lines] = splitDiffLines(input);

  if (!header?.startsWith("@@ ")) {
    return null;
  }

  const hunk = createHunk(header, `${idPrefix}:hunk:0`);
  const cursor: HunkCursor = {
    newLineNumber: hunk.newStart,
    oldLineNumber: hunk.oldStart,
  };

  for (const rawLine of lines) {
    appendHunkLine(hunk, rawLine, cursor);
  }

  return hunk;
}

function parsePatchHunks(patch: string, path: string) {
  const hunks: PullRequestDiffHunk[] = [];
  const cursor: HunkCursor = {
    newLineNumber: 0,
    oldLineNumber: 0,
  };
  let currentHunk: PullRequestDiffHunk | null = null;

  for (const rawLine of splitDiffLines(patch)) {
    if (rawLine.startsWith("@@ ")) {
      currentHunk = createHunk(rawLine, `${path}:hunk:${hunks.length}`);
      cursor.newLineNumber = currentHunk.newStart;
      cursor.oldLineNumber = currentHunk.oldStart;
      hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      appendHunkLine(currentHunk, rawLine, cursor);
    }
  }

  return hunks;
}

function getPullRequestFileStatus(file: RawPullRequestFile): PullRequestDiffFile["status"] {
  if (file.status === "added") {
    return "added";
  }

  if (file.status === "removed") {
    return "deleted";
  }

  return file.previous_filename && file.previous_filename !== file.filename
    ? "renamed"
    : "modified";
}

function splitDiffLines(input: string) {
  return input.endsWith("\n") ? input.slice(0, -1).split("\n") : input.split("\n");
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

function createHunk(header: string, id: string): PullRequestDiffHunk {
  const hunkRange = parseHunkRange(header);

  return {
    id,
    header,
    newStart: hunkRange.newStart,
    oldStart: hunkRange.oldStart,
    lines: [],
  };
}

function appendHunkLine(
  hunk: PullRequestDiffHunk,
  rawLine: string,
  cursor: HunkCursor,
): DiffLineType {
  const id = `${hunk.id}:line:${hunk.lines.length}`;

  if (rawLine.startsWith("+")) {
    hunk.lines.push({
      id,
      content: rawLine.slice(1),
      newLineNumber: cursor.newLineNumber,
      oldLineNumber: null,
      type: "addition",
    });
    cursor.newLineNumber += 1;
    return "addition";
  }

  if (rawLine.startsWith("-")) {
    hunk.lines.push({
      id,
      content: rawLine.slice(1),
      newLineNumber: null,
      oldLineNumber: cursor.oldLineNumber,
      type: "deletion",
    });
    cursor.oldLineNumber += 1;
    return "deletion";
  }

  const isMetadataLine = rawLine.startsWith("\\");

  hunk.lines.push({
    id,
    content: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine,
    newLineNumber: isMetadataLine ? null : cursor.newLineNumber,
    oldLineNumber: isMetadataLine ? null : cursor.oldLineNumber,
    type: "context",
  });

  if (!isMetadataLine) {
    cursor.newLineNumber += 1;
    cursor.oldLineNumber += 1;
  }

  return "context";
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
