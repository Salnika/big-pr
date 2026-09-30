import { describe, expect, test } from "vite-plus/test";
import { getSyntaxLanguage, highlightTexts } from "./syntax-highlight-core";

describe("syntax highlighting", () => {
  test("picks the grammar from the file name", () => {
    expect(
      [
        "src/app.ts",
        "src/App.tsx",
        "scripts/build.mjs",
        "ios/App/AppDelegate.h",
        "android/app/build.gradle",
        "Dockerfile",
        "apps/web/.env.local",
        "config/settings.yml",
        "README",
        "yarn.lock",
        "assets/logo.png",
      ].map(getSyntaxLanguage),
    ).toEqual([
      "typescript",
      "tsx",
      "javascript",
      "c",
      "groovy",
      "docker",
      "dotenv",
      "yaml",
      null,
      null,
      null,
    ]);
  });

  test("colors each text on its own, keeping the context of the lines above", async () => {
    const tokens = await highlightTexts("src/app.ts", [
      "const total = 1;",
      "/* starts here\nstill a comment */",
    ]);

    expect(tokens?.[0]?.[0]?.map((token) => token.content).join("")).toBe("const total = 1;");
    expect(tokens?.[0]?.[0]?.find((token) => token.content === "const")?.color).toMatch(/^#/);

    const [firstCommentLine, secondCommentLine] = tokens?.[1] ?? [];

    expect(secondCommentLine?.[0]?.color).toBe(firstCommentLine?.[0]?.color);
    expect(secondCommentLine?.[0]?.color).not.toBe(
      tokens?.[0]?.[0]?.find((token) => token.content === "const")?.color,
    );
  });

  test("leaves files in unknown languages plain", async () => {
    expect(await highlightTexts("notes.txt", ["just text"])).toBeNull();
  });
});
