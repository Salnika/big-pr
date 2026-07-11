import { describe, expect, test } from "vite-plus/test";
import { parseUnifiedDiff } from "./diff-parser";

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
});
