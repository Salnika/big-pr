import { describe, expect, test } from "vite-plus/test";
import {
  describeChangesPeriod,
  getChangesPeriodStart,
  getCommitRange,
  keepPullRequestChanges,
} from "./changes-period";
import { parseUnifiedDiff } from "./diff-parser";
import type { PullRequestCommit, PullRequestDiffFile } from "./pull-request-model";

const now = Date.parse("2026-10-28T12:00:00.000Z");

describe("changes period", () => {
  test("counts days and weeks back from now", () => {
    expect(new Date(getChangesPeriodStart({ amount: 3, unit: "days" }, now)).toISOString()).toBe(
      "2026-10-25T12:00:00.000Z",
    );
    expect(new Date(getChangesPeriodStart({ amount: 2, unit: "weeks" }, now)).toISOString()).toBe(
      "2026-10-14T12:00:00.000Z",
    );
  });

  test("starts from the last commit before the period", () => {
    const commits = [
      createCommit("1", "2026-10-01T09:00:00.000Z"),
      createCommit("2", "2026-10-20T09:00:00.000Z"),
      createCommit("3", "2026-10-27T09:00:00.000Z"),
    ];

    expect(getCommitRange(commits, Date.parse("2026-10-21T00:00:00.000Z"))).toEqual({
      baseOid: commits[1]?.oid,
      commits: [commits[2]],
    });
    expect(getCommitRange(commits, Date.parse("2026-10-20T09:00:00.000Z"))).toEqual({
      baseOid: commits[0]?.oid,
      commits: commits.slice(1),
    });
  });

  test("covers the whole pull request, or none of it", () => {
    const commits = [
      createCommit("1", "2026-10-26T09:00:00.000Z"),
      createCommit("2", "2026-10-27T09:00:00.000Z"),
    ];

    expect(getCommitRange(commits, Date.parse("2026-10-01T00:00:00.000Z"))).toEqual({
      baseOid: null,
      commits,
    });
    expect(getCommitRange(commits, Date.parse("2026-10-28T00:00:00.000Z"))).toEqual({
      baseOid: null,
      commits: [],
    });
  });

  test("keeps every commit after the first recent one, even one dated earlier", () => {
    const commits = [
      createCommit("1", "2026-10-01T09:00:00.000Z"),
      createCommit("2", "2026-10-27T09:00:00.000Z"),
      createCommit("3", "2026-10-02T09:00:00.000Z"),
    ];

    expect(getCommitRange(commits, Date.parse("2026-10-21T00:00:00.000Z"))).toEqual({
      baseOid: commits[0]?.oid,
      commits: commits.slice(1),
    });
  });

  test("leaves out what merging the base branch brought into the period", () => {
    const [pullRequestFile] = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,4 +1,5 @@
 const a = 1;
-const ready = false;
+const ready = true;
+const extra = 2;
 const b = 3;
 const c = 4;
`);
    const rangeFiles = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const ready = maybe;
+const ready = true;
 const extra = 2;
@@ -20,1 +20,1 @@
-const z = 0;
+const z = 1;
diff --git a/src/base-only.ts b/src/base-only.ts
--- a/src/base-only.ts
+++ b/src/base-only.ts
@@ -1 +1 @@
-export const base = false;
+export const base = true;
`);

    const { files, hiddenChangeCount } = keepPullRequestChanges(rangeFiles, [pullRequestFile!]);

    expect(hiddenChangeCount).toBe(2);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ additions: 1, deletions: 1, path: "src/app.ts" });
    expect(files[0]?.hunks.map((hunk) => hunk.header)).toEqual(["@@ -1,3 +1,3 @@"]);
  });

  test("keeps lines the author deleted next to the pull request's changes", () => {
    const [pullRequestFile] = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -9,2 +9,6 @@
 const before = 0;
+const one = 1;
+const two = 2;
+const three = 3;
+const four = 4;
 const after = 5;
`);
    const rangeFiles = parseUnifiedDiff(`diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,4 +10,3 @@
 const one = 1;
 const two = 2;
-console.log("debug");
 const three = 3;
@@ -40,3 +39,2 @@
 const x = 1;
-const y = 2;
 const z = 3;
`);

    const { files, hiddenChangeCount } = keepPullRequestChanges(rangeFiles, [pullRequestFile!]);

    expect(hiddenChangeCount).toBe(1);
    expect(files[0]?.hunks.map((hunk) => hunk.header)).toEqual(["@@ -10,4 +10,3 @@"]);
    expect(files[0]).toMatchObject({ additions: 0, deletions: 1 });
  });

  test("keeps every change of files whose diffs can't be compared", () => {
    const [lockFile] = parseUnifiedDiff(`diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1 +1 @@
-lockfileVersion: '8.0'
+lockfileVersion: '9.0'
`);
    const logo: PullRequestDiffFile = {
      additions: 0,
      deletions: 0,
      hunks: [],
      oldPath: "assets/logo.png",
      path: "assets/logo.png",
      status: "modified",
    };

    // GitHub sends no patch for a file whose diff is too large.
    expect(keepPullRequestChanges([lockFile!, logo], [{ ...lockFile!, hunks: [] }, logo])).toEqual({
      files: [lockFile, logo],
      hiddenChangeCount: 0,
    });
  });

  test("names the period", () => {
    expect(describeChangesPeriod({ amount: 1, unit: "days" })).toBe("last day");
    expect(describeChangesPeriod({ amount: 3, unit: "days" })).toBe("last 3 days");
    expect(describeChangesPeriod({ amount: 1, unit: "weeks" })).toBe("last week");
    expect(describeChangesPeriod({ amount: 2, unit: "weeks" })).toBe("last 2 weeks");
  });
});

function createCommit(id: string, committedDate: string): PullRequestCommit {
  return {
    committedDate,
    messageHeadline: `Commit ${id}`,
    oid: id.repeat(40),
  };
}
