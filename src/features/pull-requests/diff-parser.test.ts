import { describe, expect, test } from "vite-plus/test";
import { parseDiffHunk, parsePullRequestFiles, parseUnifiedDiff } from "./diff-parser";

describe("parseUnifiedDiff", () => {
  test("parses changed files, hunks, and line numbers", () => {
    const files = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 import { app } from "./app";
-const label = "old";
+const label = "new";
+const ready = true;
 export { app };
`);

    expect(files).toEqual([
      {
        additions: 2,
        deletions: 1,
        hunks: [
          {
            id: "src/app.ts:hunk:0",
            header: "@@ -1,3 +1,4 @@",
            newStart: 1,
            oldStart: 1,
            lines: [
              {
                id: "src/app.ts:hunk:0:line:0",
                content: 'import { app } from "./app";',
                newLineNumber: 1,
                oldLineNumber: 1,
                type: "context",
              },
              {
                id: "src/app.ts:hunk:0:line:1",
                content: 'const label = "old";',
                newLineNumber: null,
                oldLineNumber: 2,
                type: "deletion",
              },
              {
                id: "src/app.ts:hunk:0:line:2",
                content: 'const label = "new";',
                newLineNumber: 2,
                oldLineNumber: null,
                type: "addition",
              },
              {
                id: "src/app.ts:hunk:0:line:3",
                content: "const ready = true;",
                newLineNumber: 3,
                oldLineNumber: null,
                type: "addition",
              },
              {
                id: "src/app.ts:hunk:0:line:4",
                content: "export { app };",
                newLineNumber: 4,
                oldLineNumber: 3,
                type: "context",
              },
            ],
          },
        ],
        oldPath: "src/app.ts",
        path: "src/app.ts",
        status: "modified",
      },
    ]);
  });

  test("detects added, deleted, and renamed files", () => {
    const files = parseUnifiedDiff(`diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1 @@
+export const added = true;
diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const removed = true;
diff --git a/before.ts b/after.ts
similarity index 100%
rename from before.ts
rename to after.ts
--- a/before.ts
+++ b/after.ts
`);

    expect(
      files.map((file) => ({ oldPath: file.oldPath, path: file.path, status: file.status })),
    ).toEqual([
      { oldPath: null, path: "new.ts", status: "added" },
      { oldPath: "old.ts", path: "old.ts", status: "deleted" },
      { oldPath: "before.ts", path: "after.ts", status: "renamed" },
    ]);
  });

  test("reads removed and added lines that look like file headers as code", () => {
    const [file] = parseUnifiedDiff(`diff --git a/schema.sql b/schema.sql
--- a/schema.sql
+++ b/schema.sql
@@ -1,2 +1,2 @@
--- legacy column
+++ counter;
 select 1;
`);

    expect(file).toMatchObject({
      additions: 1,
      deletions: 1,
      oldPath: "schema.sql",
      path: "schema.sql",
    });
    expect(file?.hunks[0]?.lines.map((line) => [line.type, line.content])).toEqual([
      ["deletion", "-- legacy column"],
      ["addition", "++ counter;"],
      ["context", "select 1;"],
    ]);
  });

  test("keeps line numbers on context lines that start with a backslash", () => {
    const [file] = parseUnifiedDiff(`diff --git a/doc.tex b/doc.tex
--- a/doc.tex
+++ b/doc.tex
@@ -4,2 +4,2 @@
 \\begin{document}
-old
+new
`);

    expect(file?.hunks[0]?.lines.map((line) => [line.oldLineNumber, line.newLineNumber])).toEqual([
      [4, 4],
      [5, null],
      [null, 5],
    ]);
  });
});

describe("parsePullRequestFiles", () => {
  test("builds diff files from GitHub's per-file patches", () => {
    const files = parsePullRequestFiles([
      {
        additions: 2,
        deletions: 1,
        filename: "src/app.ts",
        patch:
          "@@ -1,2 +1,3 @@\n const a = 1;\n-const b = 2;\n+const b = 3;\n+const c = 4;\n@@ -9 +10 @@\n-old\n+new",
        status: "modified",
      },
      {
        additions: 1,
        deletions: 0,
        filename: "src/new.ts",
        patch: "@@ -0,0 +1 @@\n+new",
        status: "added",
      },
      {
        additions: 0,
        deletions: 1,
        filename: "src/old.ts",
        patch: "@@ -1 +0,0 @@\n-old",
        status: "removed",
      },
      {
        additions: 0,
        deletions: 0,
        filename: "src/after.ts",
        previous_filename: "src/before.ts",
        status: "renamed",
      },
    ]);

    expect(files.map(({ oldPath, path, status }) => ({ oldPath, path, status }))).toEqual([
      { oldPath: "src/app.ts", path: "src/app.ts", status: "modified" },
      { oldPath: null, path: "src/new.ts", status: "added" },
      { oldPath: "src/old.ts", path: "src/old.ts", status: "deleted" },
      { oldPath: "src/before.ts", path: "src/after.ts", status: "renamed" },
    ]);
    expect(files[0]?.hunks.map((hunk) => [hunk.id, hunk.lines.length])).toEqual([
      ["src/app.ts:hunk:0", 4],
      ["src/app.ts:hunk:1", 2],
    ]);
    expect(
      files[0]?.hunks[1]?.lines.map((line) => [line.oldLineNumber, line.newLineNumber]),
    ).toEqual([
      [9, null],
      [null, 10],
    ]);
    expect(files[3]?.hunks).toEqual([]);
  });
});

describe("parseDiffHunk", () => {
  test("parses a standalone review comment diff hunk", () => {
    const hunk = parseDiffHunk(
      [
        "@@ -10,3 +10,4 @@ export function review() {",
        " const user = getUser();",
        "-return false;",
        "+const ready = Boolean(user);",
        "+return ready;",
      ].join("\n"),
      "thread-1:original",
    );

    expect(hunk?.id).toBe("thread-1:original:hunk:0");
    expect(
      hunk?.lines.map((line) => [line.type, line.oldLineNumber, line.newLineNumber, line.content]),
    ).toEqual([
      ["context", 10, 10, "const user = getUser();"],
      ["deletion", 11, null, "return false;"],
      ["addition", null, 11, "const ready = Boolean(user);"],
      ["addition", null, 12, "return ready;"],
    ]);
  });

  test("ignores text without a hunk header", () => {
    expect(parseDiffHunk("+const orphan = true;", "thread-1")).toBeNull();
  });
});
