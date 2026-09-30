import type { SyntaxHighlightRequest, SyntaxHighlightResponse, SyntaxToken } from "./syntax-token";

let worker: Worker | null | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<number, (tokens: SyntaxToken[][][] | null) => void>();

// Tokenizing runs in a worker, so large pull requests keep scrolling smoothly while it works.
// Resolves to null when highlighting isn't available: the code then simply stays plain.
export function highlightInBackground(path: string, texts: string[]) {
  const highlightWorker = getWorker();

  if (!highlightWorker) {
    return Promise.resolve(null);
  }

  const id = nextRequestId++;
  const request: SyntaxHighlightRequest = { id, path, texts };

  return new Promise<SyntaxToken[][][] | null>((resolve) => {
    pendingRequests.set(id, resolve);
    highlightWorker.postMessage(request);
  });
}

function getWorker() {
  if (worker !== undefined) {
    return worker;
  }

  try {
    worker =
      typeof Worker === "undefined"
        ? null
        : new Worker(new URL("./syntax-highlight.worker.ts", import.meta.url), { type: "module" });
  } catch {
    worker = null;
  }

  worker?.addEventListener("message", (event: MessageEvent<SyntaxHighlightResponse>) => {
    pendingRequests.get(event.data.id)?.(event.data.tokens);
    pendingRequests.delete(event.data.id);
  });
  worker?.addEventListener("error", () => {
    // A worker that can't start won't get better: settle what's waiting and stop asking it.
    pendingRequests.forEach((resolve) => resolve(null));
    pendingRequests.clear();
    worker?.terminate();
    worker = null;
  });

  return worker;
}
