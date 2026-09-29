import { describe, expect, test } from "vite-plus/test";
import { getPullRequestPath, getPullRequestsPath, parseRoute } from "./routes";

const repository = { owner: "vercel", repo: "next.js" };

describe("routes", () => {
  test("parses GitHub-like paths", () => {
    expect(parseRoute("/")).toEqual({ name: "home" });
    expect(parseRoute("/vercel/next.js")).toEqual({ name: "pull-requests", ...repository });
    expect(parseRoute("/vercel/next.js/pulls")).toEqual({ name: "pull-requests", ...repository });
    expect(parseRoute("/vercel/next.js/pull/42")).toEqual({
      name: "pull-request",
      number: 42,
      tab: "comments",
      ...repository,
    });
    expect(parseRoute("/vercel/next.js/pull/42/files/")).toEqual({
      name: "pull-request",
      number: 42,
      tab: "files",
      ...repository,
    });
  });

  test("rejects paths the app cannot show", () => {
    expect(parseRoute("/vercel")).toBeNull();
    expect(parseRoute("/vercel/next.js/issues")).toBeNull();
    expect(parseRoute("/vercel/next.js/pull/0")).toBeNull();
    expect(parseRoute("/vercel/next.js/pull/42/commits")).toBeNull();
    expect(parseRoute("/vercel/next.js/pull/42/files/extra")).toBeNull();
    expect(parseRoute("/../next.js/pulls")).toBeNull();
  });

  test("builds paths that parse back to the same route", () => {
    expect(getPullRequestsPath(repository)).toBe("/vercel/next.js/pulls");
    expect(getPullRequestPath(repository, 42, "files")).toBe("/vercel/next.js/pull/42/files");
    expect(getPullRequestPath(repository, 42, "comments")).toBe("/vercel/next.js/pull/42");
    expect(parseRoute(getPullRequestPath(repository, 42, "files"))).toMatchObject({
      number: 42,
      tab: "files",
    });
  });
});
