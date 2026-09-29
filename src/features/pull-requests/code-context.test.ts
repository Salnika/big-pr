import { describe, expect, test } from "vite-plus/test";
import {
  buildCodeDocument,
  type CodeDocument,
  defaultCodeWindow,
  expandCodeWindow,
  getThreadCodeSource,
  getVisibleCodeRange,
  splitFileLines,
} from "./code-context";
import { parseUnifiedDiff } from "./diff-parser";
import type { PullRequestDiffFile, PullRequestReviewThread } from "./pull-request-model";

const headRefOid = "a".repeat(40);
const originalCommitOid = "b".repeat(40);
const fileLines = Array.from({ length: 20 }, (_, index) => `new-${index + 1}`);
const [file] = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -3,4 +3,5 @@
 new-3
 new-4
-old-5
+new-5
+new-6
 new-7
@@ -12,3 +13,2 @@
 new-13
-old-13
 new-14
`) as [PullRequestDiffFile];

describe("code context", () => {
  test("uses the current diff and head commit for threads that still apply", () => {
    const source = getThreadCodeSource(createThread({ line: 6 }), file, headRefOid);

    expect(source).toMatchObject({
      end: { line: 6, side: "new" },
      fileRef: headRefOid,
      isOriginal: false,
      path: "src/app.ts",
      start: { line: 6, side: "new" },
    });
  });

  test("uses the original diff hunk and commit for outdated threads", () => {
    const source = getThreadCodeSource(
      createThread({
        diffHunk: "@@ -3,4 +3,5 @@\n new-3\n new-4\n-old-5\n+new-5\n+new-6",
        isOutdated: true,
        line: null,
        originalCommitOid,
        originalLine: 6,
      }),
      null,
      headRefOid,
    );

    expect(source).toMatchObject({
      end: { line: 6, side: "new" },
      fileRef: originalCommitOid,
      isOriginal: true,
    });
  });

  test("prefers the original code for outdated threads that still report a line", () => {
    const source = getThreadCodeSource(
      createThread({
        diffHunk: "@@ -3,4 +3,5 @@\n new-3\n new-4\n-old-5\n+new-5\n+new-6",
        isOutdated: true,
        line: 7,
        originalCommitOid,
        originalLine: 6,
      }),
      file,
      headRefOid,
    );

    expect(source).toMatchObject({
      end: { line: 6, side: "new" },
      fileRef: originalCommitOid,
      isOriginal: true,
    });
  });

  test("does not load a file when the diff already holds every line or no commit applies", () => {
    const addedFile = parseUnifiedDiff(`diff --git a/new.ts b/new.ts
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+export const added = true;
+export const other = true;
`)[0] as PullRequestDiffFile;
    const outdatedDeletion = createThread({
      diffHunk: "@@ -3,4 +3,5 @@\n new-3\n new-4\n-old-5",
      diffSide: "LEFT",
      line: null,
      originalCommitOid,
      originalLine: 5,
    });

    expect(getThreadCodeSource(createThread({ line: 2 }), addedFile, headRefOid)?.fileRef).toBe(
      null,
    );
    expect(getThreadCodeSource(outdatedDeletion, null, headRefOid)?.fileRef).toBe(null);
    expect(getThreadCodeSource(createThread({ line: null }), file, headRefOid)).toBeNull();
  });

  test("shows three lines around the commented line from the diff hunk first", () => {
    const source = getThreadCodeSource(createThread({ line: 6 }), file, headRefOid)!;
    const document = buildCodeDocument(source, null)!;

    expect(getVisibleContents(document, defaultCodeWindow)).toEqual(["new-5", "new-6", "new-7"]);
    expect(document.mayHaveHiddenLinesAbove).toBe(true);
    expect(document.mayHaveHiddenLinesBelow).toBe(true);
  });

  test("fills the lines between hunks from the full file with matching line numbers", () => {
    const source = getThreadCodeSource(createThread({ line: 6 }), file, headRefOid)!;
    const document = buildCodeDocument(source, fileLines)!;

    expect(document.rows).toHaveLength(22);
    expect(document.mayHaveHiddenLinesAbove).toBe(false);
    expect(document.mayHaveHiddenLinesBelow).toBe(false);
    expect(document.rows.map((row) => [row.oldLineNumber, row.newLineNumber, row.content])).toEqual(
      [
        [1, 1, "new-1"],
        [2, 2, "new-2"],
        [3, 3, "new-3"],
        [4, 4, "new-4"],
        [5, null, "old-5"],
        [null, 5, "new-5"],
        [null, 6, "new-6"],
        [6, 7, "new-7"],
        [7, 8, "new-8"],
        [8, 9, "new-9"],
        [9, 10, "new-10"],
        [10, 11, "new-11"],
        [11, 12, "new-12"],
        [12, 13, "new-13"],
        [13, null, "old-13"],
        [14, 14, "new-14"],
        [15, 15, "new-15"],
        [16, 16, "new-16"],
        [17, 17, "new-17"],
        [18, 18, "new-18"],
        [19, 19, "new-19"],
        [20, 20, "new-20"],
      ],
    );
  });

  test("expands the visible window step by step in both directions", () => {
    const source = getThreadCodeSource(createThread({ line: 6 }), file, headRefOid)!;
    const document = buildCodeDocument(source, fileLines)!;
    const expandedUp = expandCodeWindow(document, defaultCodeWindow, "up", 3);
    const expandedDown = expandCodeWindow(document, expandedUp, "down", 10);

    expect(getVisibleContents(document, expandedUp)).toEqual([
      "new-3",
      "new-4",
      "old-5",
      "new-5",
      "new-6",
      "new-7",
    ]);
    expect(getVisibleContents(document, expandedDown).at(-1)).toBe("new-16");
    expect(getVisibleContents(document, expandCodeWindow(document, expandedUp, "up", 50))[0]).toBe(
      "new-1",
    );
  });

  test("highlights every line of a multi-line comment", () => {
    const source = getThreadCodeSource(createThread({ line: 7, startLine: 4 }), file, headRefOid)!;
    const document = buildCodeDocument(source, fileLines)!;

    expect(document.rows.slice(document.targetStart, document.targetEnd + 1).length).toBe(5);
    expect(getVisibleContents(document, defaultCodeWindow)).toEqual([
      "new-3",
      "new-4",
      "old-5",
      "new-5",
      "new-6",
      "new-7",
      "new-8",
    ]);
  });

  test("leaves old line numbers empty outside an outdated hunk", () => {
    const source = getThreadCodeSource(
      createThread({
        diffHunk: "@@ -3,4 +3,5 @@\n new-3\n new-4\n-old-5\n+new-5\n+new-6",
        line: null,
        originalCommitOid,
        originalLine: 6,
      }),
      null,
      headRefOid,
    )!;
    const document = buildCodeDocument(source, fileLines)!;

    expect(document.rows[0]).toMatchObject({ newLineNumber: 1, oldLineNumber: null });
    expect(document.rows[document.targetEnd]).toMatchObject({ content: "new-6" });
    expect(document.rows[document.targetEnd + 1]).toMatchObject({
      content: "new-7",
      newLineNumber: 7,
      oldLineNumber: null,
    });
  });

  test("marks every loaded line as added when an outdated thread is on a new file", () => {
    const source = getThreadCodeSource(
      createThread({
        diffHunk: "@@ -0,0 +1,20 @@\n+new-1\n+new-2\n+new-3",
        line: null,
        originalCommitOid,
        originalLine: 3,
      }),
      null,
      headRefOid,
    )!;
    const document = buildCodeDocument(source, fileLines)!;

    expect(document.rows).toHaveLength(20);
    expect(document.rows.every((row) => row.type === "addition" && !row.oldLineNumber)).toBe(true);
  });

  test("splits file content without a phantom trailing line", () => {
    expect(splitFileLines("one\ntwo\n")).toEqual(["one", "two"]);
    expect(splitFileLines("one\ntwo")).toEqual(["one", "two"]);
    expect(splitFileLines("")).toEqual([]);
  });
});

function getVisibleContents(
  document: CodeDocument,
  codeWindow: Parameters<typeof getVisibleCodeRange>[1],
) {
  const range = getVisibleCodeRange(document, codeWindow);

  return document.rows.slice(range.start, range.end + 1).map((row) => row.content);
}

function createThread(overrides: Partial<PullRequestReviewThread>): PullRequestReviewThread {
  return {
    id: "thread-1",
    comments: [],
    diffHunk: null,
    diffSide: "RIGHT",
    isOutdated: false,
    isResolved: false,
    line: 6,
    originalCommitOid: null,
    originalLine: null,
    originalStartLine: null,
    path: "src/app.ts",
    resolvedByLogin: null,
    startDiffSide: null,
    startLine: null,
    ...overrides,
  };
}
