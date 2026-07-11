import { describe, expect, test } from "vite-plus/test";
import { buildRepoSettings, parseRepoInput } from "./repo-parser";

describe("repo parser", () => {
  test("parses owner/repo input", () => {
    expect(parseRepoInput("openai/pr-status")).toEqual({
      owner: "openai",
      repo: "pr-status",
      normalized: "openai/pr-status",
    });
  });

  test("parses github.com repository urls", () => {
    expect(parseRepoInput("https://github.com/openai/pr-status/")).toEqual({
      owner: "openai",
      repo: "pr-status",
      normalized: "openai/pr-status",
    });
  });

  test("builds normalized settings", () => {
    expect(
      buildRepoSettings({
        repoInput: " https://github.com/openai/pr-status ",
      }),
    ).toEqual({
      repoInput: "https://github.com/openai/pr-status",
      owner: "openai",
      repo: "pr-status",
    });
  });
});
