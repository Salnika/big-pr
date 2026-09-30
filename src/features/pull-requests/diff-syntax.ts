import { useEffect, useState } from "react";
import type { PullRequestDiffFile, PullRequestDiffLine } from "./pull-request-model";
import { highlightInBackground } from "./syntax-highlighter";
import type { SyntaxToken } from "./syntax-token";

export type SyntaxTokensByLine = ReadonlyMap<string, SyntaxToken[]>;
type SyntaxSide = {
  keys: string[];
  lines: string[];
};

// Past this much code, a file stays plain: highlighting it would take longer than reading it.
const maxHighlightedCharacters = 300_000;
// Refreshing a review gives new file objects, so these entries go away with the old ones.
const hunkSyntaxByFile = new WeakMap<PullRequestDiffFile, Promise<SyntaxTokensByLine | null>>();

// Colors come after the diff shows, from a worker; until then (or without one) lines stay plain.
export function useDiffSyntax(
  file: PullRequestDiffFile,
  fileLines: string[] | null,
  enabled: boolean,
) {
  const [tokensByLine, setTokensByLine] = useState<SyntaxTokensByLine | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isCurrent = true;

    void getDiffSyntax(file, fileLines).then((nextTokensByLine) => {
      if (isCurrent && nextTokensByLine) {
        setTokensByLine(nextTokensByLine);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [enabled, file, fileLines]);

  return tokensByLine;
}

// Names a line by side and number, so hunk lines, revealed lines, and the whole file agree.
export function getLineSyntaxKey(line: PullRequestDiffLine) {
  if (line.type !== "deletion" && line.newLineNumber !== null) {
    return `new:${line.newLineNumber}`;
  }

  return line.oldLineNumber === null ? null : `old:${line.oldLineNumber}`;
}

// Each hunk's old and new sides are tokenized as blocks, so a line keeps the context of the lines
// around it, like an open string or comment. Once the whole file is loaded, its new side is
// tokenized from the top of the file instead, which also covers the unchanged lines revealed.
export function buildDiffSyntaxRequest(file: PullRequestDiffFile, fileLines: string[] | null) {
  const sides: SyntaxSide[] = file.hunks.flatMap((hunk) => {
    const oldSide: SyntaxSide = { keys: [], lines: [] };
    const newSide: SyntaxSide = { keys: [], lines: [] };

    for (const line of hunk.lines) {
      if (line.type !== "addition" && line.oldLineNumber !== null) {
        oldSide.keys.push(`old:${line.oldLineNumber}`);
        oldSide.lines.push(line.content);
      }

      if (line.type !== "deletion" && line.newLineNumber !== null) {
        newSide.keys.push(`new:${line.newLineNumber}`);
        newSide.lines.push(line.content);
      }
    }

    return [oldSide, newSide];
  });

  if (fileLines) {
    sides.push({ keys: fileLines.map((_, index) => `new:${index + 1}`), lines: fileLines });
  }

  const usedSides = sides.filter((side) => side.lines.length);
  const characterCount = usedSides.reduce(
    (total, side) => side.lines.reduce((sideTotal, line) => sideTotal + line.length + 1, total),
    0,
  );

  if (!usedSides.length || characterCount > maxHighlightedCharacters) {
    return null;
  }

  return {
    keys: usedSides.map((side) => side.keys),
    texts: usedSides.map((side) => side.lines.join("\n")),
  };
}

export function mapSyntaxTokens(keys: string[][], tokens: SyntaxToken[][][]) {
  const tokensByLine = new Map<string, SyntaxToken[]>();

  keys.forEach((sideKeys, sideIndex) => {
    const sideTokens = tokens[sideIndex];

    // A line break inside a line (a lone "\r") splits it differently: that side stays plain.
    if (sideTokens?.length !== sideKeys.length) {
      return;
    }

    sideKeys.forEach((key, lineIndex) => {
      tokensByLine.set(key, sideTokens[lineIndex] ?? []);
    });
  });

  return tokensByLine;
}

function getDiffSyntax(file: PullRequestDiffFile, fileLines: string[] | null) {
  if (fileLines) {
    return requestDiffSyntax(file, fileLines);
  }

  const cached = hunkSyntaxByFile.get(file);

  if (cached) {
    return cached;
  }

  const request = requestDiffSyntax(file, null);

  hunkSyntaxByFile.set(file, request);

  return request;
}

async function requestDiffSyntax(file: PullRequestDiffFile, fileLines: string[] | null) {
  const request = buildDiffSyntaxRequest(file, fileLines);

  if (!request) {
    return null;
  }

  const tokens = await highlightInBackground(file.path, request.texts);

  return tokens ? mapSyntaxTokens(request.keys, tokens) : null;
}
