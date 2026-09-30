import { describe, expect, test } from "vite-plus/test";
import { parseUnifiedDiff } from "./diff-parser";
import type { PullRequestDiffFile, PullRequestDiffLine } from "./pull-request-model";
import { buildSplitRows } from "./split-diff";

describe("split diff rows", () => {
  test("keeps unchanged lines on both sides and faces deletions with additions", () => {
    expect(
      getRows(`@@ -1,4 +1,4 @@
 keep 1
-old 2
-old 3
+new 2
+new 3
 keep 4`),
    ).toEqual([
      ["c:keep 1", "c:keep 1"],
      ["d:old 2", "a:new 2"],
      ["d:old 3", "a:new 3"],
      ["c:keep 4", "c:keep 4"],
    ]);
  });

  test("leaves a side empty when a change has more lines on the other one", () => {
    expect(
      getRows(`@@ -1,4 +1,4 @@
-gone 1
-gone 2
+added 1
 keep
-gone 3
+added 2
+added 3`),
    ).toEqual([
      ["d:gone 1", "a:added 1"],
      ["d:gone 2", null],
      ["c:keep", "c:keep"],
      ["d:gone 3", "a:added 2"],
      [null, "a:added 3"],
    ]);
  });

  test("starts a new row group when deletions follow additions", () => {
    expect(
      getRows(`@@ -1,1 +1,1 @@
+first
-second`),
    ).toEqual([
      [null, "a:first"],
      ["d:second", null],
    ]);
  });

  test("puts a missing final newline on the side of the line it follows", () => {
    expect(
      getRows(`@@ -1,1 +1,1 @@
-old last
\\ No newline at end of file
+new last`),
    ).toEqual([
      ["d:old last", "a:new last"],
      ["c:\\ No newline at end of file", null],
    ]);
    expect(
      getRows(`@@ -1,1 +1,1 @@
-old last
+new last
\\ No newline at end of file`),
    ).toEqual([
      ["d:old last", "a:new last"],
      [null, "c:\\ No newline at end of file"],
    ]);
  });

  test("gives every row its own id", () => {
    const [file] = parseDiff(`@@ -1,4 +1,4 @@
 keep 1
-old 2
+new 2
+new 3
 keep 4`);
    const rows = buildSplitRows(file.hunks[0]!.lines);

    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});

function getRows(hunk: string) {
  const [file] = parseDiff(hunk);

  return file.hunks
    .flatMap((item) => buildSplitRows(item.lines))
    .map((row) => [describeLine(row.left), describeLine(row.right)]);
}

function parseDiff(hunk: string) {
  return parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
${hunk}
`) as [PullRequestDiffFile];
}

function describeLine(line: PullRequestDiffLine | null) {
  return line ? `${line.type[0]}:${line.content}` : null;
}
