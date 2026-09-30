import { describe, expect, test } from "vite-plus/test";
import { buildDiffSyntaxRequest, getLineSyntaxKey, mapSyntaxTokens } from "./diff-syntax";
import { parseUnifiedDiff } from "./diff-parser";
import type { PullRequestDiffFile } from "./pull-request-model";

const [file] = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = "old";
+const b = "new";
 export { a };
`) as [PullRequestDiffFile];

describe("diff syntax", () => {
  test("tokenizes each hunk's old and new sides as blocks", () => {
    expect(buildDiffSyntaxRequest(file, null)).toEqual({
      keys: [
        ["old:1", "old:2", "old:3"],
        ["new:1", "new:2", "new:3"],
      ],
      texts: [
        'const a = 1;\nconst b = "old";\nexport { a };',
        'const a = 1;\nconst b = "new";\nexport { a };',
      ],
    });
  });

  test("adds the whole file once it's loaded, for the unchanged lines around the hunks", () => {
    const request = buildDiffSyntaxRequest(file, ["const a = 1;", 'const b = "new";', "", "x"]);

    expect(request?.keys.at(-1)).toEqual(["new:1", "new:2", "new:3", "new:4"]);
    expect(request?.texts.at(-1)).toBe('const a = 1;\nconst b = "new";\n\nx');
  });

  test("skips files too large to be worth highlighting", () => {
    expect(buildDiffSyntaxRequest(file, ["x".repeat(400_000)])).toBeNull();
  });

  test("finds a line's tokens by side and number", () => {
    const tokensByLine = mapSyntaxTokens(
      [
        ["old:1", "old:2"],
        ["new:1", "new:2"],
      ],
      [[[{ content: "a" }], [{ content: "b" }]], [[{ content: "c" }]]],
    );
    const [context, deletion, addition] = file.hunks[0]!.lines;

    expect([context, deletion, addition].map((line) => getLineSyntaxKey(line!))).toEqual([
      "new:1",
      "old:2",
      "new:2",
    ]);
    expect(tokensByLine.get("old:2")).toEqual([{ content: "b" }]);
    // Shiki split the new side into a different number of lines: it stays plain.
    expect(tokensByLine.has("new:1")).toBe(false);
  });
});
