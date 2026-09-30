import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages, bundledLanguagesInfo } from "shiki/langs";
import type { SyntaxToken } from "./syntax-token";

// The theme closest to github.com's current light diff colors.
const themeName = "github-light-default";
// Past these, a line is left plain: minified code costs a lot to tokenize and reads no better.
const maxTokenizedLineLength = 1000;
const lineTimeLimitMs = 100;

const languagesByFileName: Record<string, string> = {
  appfile: "ruby",
  brewfile: "ruby",
  "cmakelists.txt": "cmake",
  dockerfile: "docker",
  fastfile: "ruby",
  gemfile: "ruby",
  gnumakefile: "make",
  jenkinsfile: "groovy",
  makefile: "make",
  podfile: "ruby",
  rakefile: "ruby",
};
const languagesByExtension: Record<string, string> = {
  cc: "cpp",
  cu: "cpp",
  cxx: "cpp",
  env: "dotenv",
  ex: "elixir",
  exs: "elixir",
  gemspec: "ruby",
  gradle: "groovy",
  h: "c",
  hh: "cpp",
  hpp: "cpp",
  htm: "html",
  hxx: "cpp",
  m: "objective-c",
  mm: "objective-cpp",
  patch: "diff",
  pl: "perl",
  plist: "xml",
  podspec: "ruby",
  props: "xml",
  csproj: "xml",
  resx: "xml",
  s: "asm",
  sol: "solidity",
  storyboard: "xml",
  svg: "xml",
  targets: "xml",
  xaml: "xml",
  xib: "xml",
  xsd: "xml",
};
const languageIdsByName = new Map(
  bundledLanguagesInfo.flatMap((language) => [
    [language.id, language.id],
    ...(language.aliases ?? []).map((alias) => [alias, language.id] as const),
  ]),
);

let highlighterPromise: Promise<HighlighterCore> | null = null;

// Picks the grammar from the file name, like GitHub does, or null to leave the file plain.
export function getSyntaxLanguage(path: string) {
  const fileName = (path.split("/").at(-1) ?? path).toLowerCase();

  if (fileName.startsWith(".env")) {
    return languageIdsByName.get("dotenv") ?? null;
  }

  const extension = fileName.includes(".") ? (fileName.split(".").at(-1) ?? "") : "";
  const name = languagesByFileName[fileName] ?? languagesByExtension[extension] ?? extension;

  return languageIdsByName.get(name) ?? null;
}

// Tokenizes each text on its own, and returns its lines of tokens, or null for unknown languages.
export async function highlightTexts(path: string, texts: string[]) {
  const language = getSyntaxLanguage(path);

  if (!language) {
    return null;
  }

  const highlighter = await getHighlighter();

  if (!highlighter.getLoadedLanguages().includes(language)) {
    await highlighter.loadLanguage(bundledLanguages[language as keyof typeof bundledLanguages]);
  }

  return texts.map((text) =>
    highlighter
      .codeToTokensBase(text, {
        lang: language,
        theme: themeName,
        tokenizeMaxLineLength: maxTokenizedLineLength,
        tokenizeTimeLimit: lineTimeLimitMs,
      })
      .map((line) =>
        line.map(
          (token): SyntaxToken => ({
            color: token.color,
            content: token.content,
            fontStyle: token.fontStyle && token.fontStyle > 0 ? token.fontStyle : undefined,
          }),
        ),
      ),
  );
}

function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    // Imported alone: the bundled theme list would ship every theme with the build.
    themes: [import("shiki/themes/github-light-default.mjs")],
  });

  return highlighterPromise;
}
