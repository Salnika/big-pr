import { describe, expect, test, vi } from "vite-plus/test";
import type { SyntaxHighlightRequest } from "./syntax-token";

describe("background syntax highlighting", () => {
  test("stays plain where workers aren't available", async () => {
    const { highlightInBackground } = await importFreshHighlighter();

    expect(await highlightInBackground("src/app.ts", ["const a = 1;"])).toBeNull();
  });

  test("hands each answer from the worker to its own request", async () => {
    class EchoWorker extends EventTarget {
      postMessage(request: SyntaxHighlightRequest) {
        queueMicrotask(() => {
          this.dispatchEvent(
            new MessageEvent("message", {
              data: { id: request.id, tokens: [[[{ content: request.path }]]] },
            }),
          );
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", EchoWorker);

    const { highlightInBackground } = await importFreshHighlighter();
    const [first, second] = await Promise.all([
      highlightInBackground("a.ts", ["a"]),
      highlightInBackground("b.ts", ["b"]),
    ]);

    expect(first).toEqual([[[{ content: "a.ts" }]]]);
    expect(second).toEqual([[[{ content: "b.ts" }]]]);
  });

  test("gives up on a worker that fails, leaving the code plain", async () => {
    class BrokenWorker extends EventTarget {
      postMessage() {
        queueMicrotask(() => this.dispatchEvent(new Event("error")));
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", BrokenWorker);

    const { highlightInBackground } = await importFreshHighlighter();

    expect(await highlightInBackground("a.ts", ["a"])).toBeNull();
    expect(await highlightInBackground("a.ts", ["a"])).toBeNull();
  });
});

async function importFreshHighlighter() {
  vi.resetModules();

  return import("./syntax-highlighter");
}
