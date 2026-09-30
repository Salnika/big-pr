import { getSyntaxTokenStyle, type SyntaxToken } from "./syntax-token";

// Shows a line's code, colored when its tokens spell out exactly that line. Tokens from another
// version of the line (a refreshed review, a line break shiki read differently) are ignored.
export function HighlightedCode({
  content,
  tokens,
}: {
  content: string;
  tokens?: readonly SyntaxToken[] | null;
}) {
  const tokenText = tokens?.map((token) => token.content).join("");

  if (!tokenText || (tokenText !== content && `${tokenText}\r` !== content)) {
    return content || " ";
  }

  return tokens?.map((token, index) => (
    <span key={index} style={getSyntaxTokenStyle(token)}>
      {token.content}
    </span>
  ));
}
