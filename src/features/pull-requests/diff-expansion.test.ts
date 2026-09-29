import { describe, expect, test } from "vite-plus/test";
import { parseUnifiedDiff } from "./diff-parser";
import {
  emptyRevealedGap,
  expandDiffGap,
  getDiffGaps,
  getHiddenLineCount,
  getRevealedGapLines,
} from "./diff-expansion";
import type { PullRequestDiffFile } from "./pull-request-model";

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

describe("diff expansion", () => {
  test("finds the unchanged lines before, between, and after hunks", () => {
    expect(getDiffGaps(file.hunks)).toEqual([
      { index: 0, newEnd: 2, newStart: 1, oldOffset: 0 },
      { index: 1, newEnd: 12, newStart: 8, oldOffset: -1 },
      { index: 2, newEnd: null, newStart: 15, oldOffset: 0 },
    ]);
  });

  test("reveals lines under the previous hunk, above the next one, or all at once", () => {
    const middleGap = getDiffGaps(file.hunks)[1]!;
    const down = expandDiffGap(middleGap, emptyRevealedGap, "down", 20, 2);
    const downAndUp = expandDiffGap(middleGap, down, "up", 20, 2);

    expect(getHiddenLineCount(middleGap, downAndUp, 20)).toBe(1);

    const lines = getRevealedGapLines(middleGap, downAndUp, fileLines, "src/app.ts");

    expect(
      lines.before.map((line) => [line.oldLineNumber, line.newLineNumber, line.content]),
    ).toEqual([
      [7, 8, "new-8"],
      [8, 9, "new-9"],
    ]);
    expect(
      lines.after.map((line) => [line.oldLineNumber, line.newLineNumber, line.content]),
    ).toEqual([
      [10, 11, "new-11"],
      [11, 12, "new-12"],
    ]);
    expect(
      getHiddenLineCount(middleGap, expandDiffGap(middleGap, downAndUp, "all", 20, 2), 20),
    ).toBe(0);
  });

  test("only knows how much follows the last hunk once the file is loaded", () => {
    const lastGap = getDiffGaps(file.hunks).at(-1)!;

    expect(getHiddenLineCount(lastGap, emptyRevealedGap, null)).toBeNull();
    expect(getHiddenLineCount(lastGap, emptyRevealedGap, 20)).toBe(6);

    const revealed = expandDiffGap(lastGap, emptyRevealedGap, "down", 20, 20);

    expect(revealed).toEqual({ fromEnd: 0, fromStart: 6 });
    expect(
      getRevealedGapLines(lastGap, revealed, fileLines, "src/app.ts").before.at(-1),
    ).toMatchObject({
      content: "new-20",
      newLineNumber: 20,
      oldLineNumber: 20,
    });
  });

  test("keeps numbering right around hunks that only add or only remove lines", () => {
    const [changedFile] = parseUnifiedDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -3,0 +4,2 @@
+added-4
+added-5
@@ -10,2 +11,0 @@
-removed-10
-removed-11
`) as [PullRequestDiffFile];

    expect(getDiffGaps(changedFile.hunks)).toEqual([
      { index: 0, newEnd: 3, newStart: 1, oldOffset: 0 },
      { index: 1, newEnd: 11, newStart: 6, oldOffset: -2 },
      { index: 2, newEnd: null, newStart: 12, oldOffset: 0 },
    ]);
  });
});
