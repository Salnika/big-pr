import {
  createReviewThread,
  getGithubCliStatus,
  getPullRequestReview,
  getPullRequestsOverview,
  LocalGithubError,
  replyToReviewThread,
  setReviewThreadResolved,
} from "./local-gh-api.ts";

export function localGhApiPlugin() {
  const middleware = async (
    req: {
      method?: string;
      on: (event: string, listener: (chunk?: Buffer) => void) => void;
      url?: string;
    },
    res: {
      end: (body?: string) => void;
      setHeader: (name: string, value: string) => void;
      statusCode: number;
    },
    next: (error?: unknown) => void,
  ) => {
    if (req.url === "/api/local/github/status" && req.method === "GET") {
      try {
        const status = await getGithubCliStatus();
        respondJson(res, 200, status);
      } catch (error) {
        next(error);
      }
      return;
    }

    if (req.url === "/api/local/github/pull-requests" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          owner?: string;
          repo?: string;
        };

        if (!body.owner || !body.repo) {
          respondJson(res, 400, {
            message: "Both owner and repo are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const overview = await getPullRequestsOverview({
          owner: body.owner,
          repo: body.repo,
        });

        respondJson(res, 200, overview);
      } catch (error) {
        if (error instanceof LocalGithubError) {
          respondJson(res, error.status ?? 500, {
            message: error.message,
            status: error.status,
            type: error.type,
          });
          return;
        }

        next(error);
      }
      return;
    }

    if (req.url === "/api/local/github/pull-request-review" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          number?: number;
          owner?: string;
          repo?: string;
        };

        if (!body.owner || !body.repo || !body.number) {
          respondJson(res, 400, {
            message: "Owner, repo, and pull request number are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const review = await getPullRequestReview({
          number: body.number,
          owner: body.owner,
          repo: body.repo,
        });

        respondJson(res, 200, review);
      } catch (error) {
        if (error instanceof LocalGithubError) {
          respondJson(res, error.status ?? 500, {
            message: error.message,
            status: error.status,
            type: error.type,
          });
          return;
        }

        next(error);
      }
      return;
    }

    if (req.url === "/api/local/github/review-thread-replies" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          body?: string;
          threadId?: string;
        };

        if (!body.threadId || !body.body?.trim()) {
          respondJson(res, 400, {
            message: "Thread id and reply body are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await replyToReviewThread({
          body: body.body.trim(),
          threadId: body.threadId,
        });

        respondJson(res, 200, result);
      } catch (error) {
        if (error instanceof LocalGithubError) {
          respondJson(res, error.status ?? 500, {
            message: error.message,
            status: error.status,
            type: error.type,
          });
          return;
        }

        next(error);
      }
      return;
    }

    if (req.url === "/api/local/github/review-threads" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          body?: string;
          line?: number;
          path?: string;
          pullRequestId?: string;
          side?: "LEFT" | "RIGHT";
        };

        if (
          !body.pullRequestId ||
          !body.path ||
          !body.body?.trim() ||
          typeof body.line !== "number" ||
          (body.side !== "LEFT" && body.side !== "RIGHT")
        ) {
          respondJson(res, 400, {
            message: "Pull request id, path, side, line, and comment body are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await createReviewThread({
          body: body.body.trim(),
          line: body.line,
          path: body.path,
          pullRequestId: body.pullRequestId,
          side: body.side,
        });

        respondJson(res, 200, result);
      } catch (error) {
        if (error instanceof LocalGithubError) {
          respondJson(res, error.status ?? 500, {
            message: error.message,
            status: error.status,
            type: error.type,
          });
          return;
        }

        next(error);
      }
      return;
    }

    if (req.url === "/api/local/github/review-thread-resolution" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          isResolved?: boolean;
          threadId?: string;
        };

        if (!body.threadId || typeof body.isResolved !== "boolean") {
          respondJson(res, 400, {
            message: "Thread id and resolution state are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await setReviewThreadResolved({
          isResolved: body.isResolved,
          threadId: body.threadId,
        });

        respondJson(res, 200, result);
      } catch (error) {
        if (error instanceof LocalGithubError) {
          respondJson(res, error.status ?? 500, {
            message: error.message,
            status: error.status,
            type: error.type,
          });
          return;
        }

        next(error);
      }
      return;
    }

    next();
  };

  return {
    configurePreviewServer(server: { middlewares: { use: (...args: unknown[]) => void } }) {
      server.middlewares.use(middleware);
    },
    configureServer(server: { middlewares: { use: (...args: unknown[]) => void } }) {
      server.middlewares.use(middleware);
    },
    name: "local-gh-api",
  };
}

function readJsonBody(req: { on: (event: string, listener: (chunk?: Buffer) => void) => void }) {
  return new Promise<unknown>((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk?.toString() ?? "";
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function respondJson(
  res: {
    end: (body?: string) => void;
    setHeader: (name: string, value: string) => void;
    statusCode: number;
  },
  statusCode: number,
  payload: unknown,
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
