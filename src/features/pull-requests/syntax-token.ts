import type { CSSProperties } from "react";

export type SyntaxToken = {
  color?: string;
  content: string;
  // TextMate's bit flags: 1 italic, 2 bold, 4 underline, 8 strikethrough.
  fontStyle?: number;
};

export function getSyntaxTokenStyle(token: SyntaxToken): CSSProperties | undefined {
  if (!token.color && !token.fontStyle) {
    return undefined;
  }

  const fontStyle = token.fontStyle ?? 0;
  const decorations = [fontStyle & 4 ? "underline" : "", fontStyle & 8 ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");

  return {
    color: token.color,
    fontStyle: fontStyle & 1 ? "italic" : undefined,
    fontWeight: fontStyle & 2 ? 600 : undefined,
    textDecoration: decorations || undefined,
  };
}

export type SyntaxHighlightRequest = {
  id: number;
  path: string;
  texts: string[];
};

export type SyntaxHighlightResponse = {
  id: number;
  // Per text, its lines of tokens; null when the language is unknown or tokenizing failed.
  tokens: SyntaxToken[][][] | null;
};
