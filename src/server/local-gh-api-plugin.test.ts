import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { PullRequestsOverview } from "../features/pull-requests/pull-request-model";
import { getPullRequestsOverview, LocalGithubError } from "./local-gh-api";
import { localGhApiPlugin } from "./local-gh-api-plugin";

vi.mock("./local-gh-api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./local-gh-api")>()),
  getPullRequestsOverview: vi.fn(),
}));

const getPullRequestsOverviewMock = vi.mocked(getPullRequestsOverview);

describe("local gh api plugin", () => {
  beforeEach(() => {
    getPullRequestsOverviewMock.mockReset();
  });

  test("streams pull request updates when the client accepts them", async () => {
    getPullRequestsOverviewMock.mockImplementation(async (_input, _runGh, onProgress) => {
      onProgress?.({ expectedCount: 2, overview: createOverview([42]) });
      onProgress?.({ expectedCount: 2, overview: createOverview([42, 43]) });

      return createOverview([42, 43]);
    });

    const response = await requestPullRequests({ accept: "application/x-ndjson" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("application/x-ndjson");
    expect(response.isEnded).toBe(true);
    expect(response.events().map((event) => [event.type, event.overview?.items.length])).toEqual([
      ["progress", 1],
      ["progress", 2],
      ["done", 2],
    ]);
  });

  test("answers with plain JSON when the client does not ask for a stream", async () => {
    getPullRequestsOverviewMock.mockResolvedValue(createOverview([42]));

    const response = await requestPullRequests({});

    expect(getPullRequestsOverviewMock.mock.calls[0]?.[2]).toBeUndefined();
    expect(response.headers["Content-Type"]).toContain("application/json");
    expect(JSON.parse(response.body()).items).toHaveLength(1);
  });

  test("keeps the HTTP status for errors raised before any update", async () => {
    getPullRequestsOverviewMock.mockRejectedValue(
      new LocalGithubError("auth", "Run gh auth login.", 401),
    );

    const response = await requestPullRequests({ accept: "application/x-ndjson" });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body())).toEqual({
      message: "Run gh auth login.",
      status: 401,
      type: "auth",
    });
  });

  test("sends errors raised mid-stream as an event", async () => {
    getPullRequestsOverviewMock.mockImplementation(async (_input, _runGh, onProgress) => {
      onProgress?.({ expectedCount: 20, overview: createOverview([42]) });
      throw new LocalGithubError("network", "GitHub timed out.", 502);
    });

    const response = await requestPullRequests({ accept: "application/x-ndjson" });

    expect(response.statusCode).toBe(200);
    expect(response.events().at(-1)).toEqual({
      error: { message: "GitHub timed out.", status: 502, type: "network" },
      type: "error",
    });
    expect(response.isEnded).toBe(true);
  });
});

async function requestPullRequests(headers: Record<string, string>) {
  let middleware: (
    req: unknown,
    res: unknown,
    next: (error?: unknown) => void,
  ) => Promise<void> = async () => {};

  localGhApiPlugin().configureServer({
    middlewares: {
      use: (handler: unknown) => {
        middleware = handler as typeof middleware;
      },
    },
  });

  const response = createResponse();

  await middleware(createRequest(headers), response, vi.fn());

  return response;
}

function createRequest(headers: Record<string, string>) {
  const listeners = new Map<string, (chunk?: Buffer) => void>();

  return {
    headers,
    method: "POST",
    on(event: string, listener: (chunk?: Buffer) => void) {
      listeners.set(event, listener);

      if (event === "end") {
        queueMicrotask(() => {
          listeners.get("data")?.(
            Buffer.from(JSON.stringify({ owner: "openai", repo: "pr-status" })),
          );
          listeners.get("end")?.();
        });
      }
    },
    url: "/api/local/github/pull-requests",
  };
}

function createResponse() {
  const chunks: string[] = [];
  const response = {
    body: () => chunks.join(""),
    end(body?: string) {
      if (body) {
        chunks.push(body);
      }

      response.isEnded = true;
      response.writableEnded = true;
    },
    events: () =>
      chunks
        .join("")
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as {
              error?: unknown;
              overview?: PullRequestsOverview;
              type: string;
            },
        ),
    headers: {} as Record<string, string>,
    isEnded: false,
    setHeader(name: string, value: string) {
      response.headers[name] = value;
    },
    statusCode: 200,
    writableEnded: false,
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  };

  return response;
}

function createOverview(numbers: number[]): PullRequestsOverview {
  return {
    hasMore: false,
    items: numbers.map((number) => ({
      id: `pr_${number}`,
      number,
      title: `PR ${number}`,
      url: `https://github.com/openai/pr-status/pull/${number}`,
      authorAvatarUrl: null,
      authorLogin: "alexis",
      baseBranch: "main",
      headBranch: `branch-${number}`,
      repositoryName: "openai/pr-status",
      updatedAt: "2026-04-21T09:00:00.000Z",
      isDraft: false,
      ciStatus: "success",
      hasConflicts: false,
      unresolvedThreads: 0,
    })),
    totalCount: numbers.length,
  };
}
