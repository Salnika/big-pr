import { highlightTexts } from "./syntax-highlight-core";
import type { SyntaxHighlightRequest, SyntaxHighlightResponse } from "./syntax-token";

// The app's TypeScript setup describes the page, not worker globals, so type what's used here.
const workerScope = self as unknown as {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<SyntaxHighlightRequest>) => void,
  ) => void;
  postMessage: (message: SyntaxHighlightResponse) => void;
};

workerScope.addEventListener("message", (event) => {
  const { id, path, texts } = event.data;

  highlightTexts(path, texts).then(
    (tokens) => workerScope.postMessage({ id, tokens }),
    () => workerScope.postMessage({ id, tokens: null }),
  );
});
