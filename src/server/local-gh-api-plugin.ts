import type { PullRequestsSyncEvent } from "../features/pull-requests/pull-request-model.ts";
import {
  createReviewThread,
  deletePendingComment,
  discardPendingReview,
  getGithubCliStatus,
  getPullRequestReview,
  getPullRequestsOverview,
  getRepositoryFileContent,
  LocalGithubError,
  replyToReviewThread,
  setCommentReaction,
  setFileViewed,
  setReviewThreadResolved,
  submitReview,
} from "./local-gh-api.ts";

type LocalApiRequest = {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  on: (event: string, listener: (chunk?: Buffer) => void) => void;
  url?: string;
};

type LocalApiResponse = {
  destroyed?: boolean;
  end: (body?: string) => void;
  flush?: () => void;
  setHeader: (name: string, value: string) => void;
  statusCode: number;
  writableEnded?: boolean;
  write: (chunk: string) => boolean;
};

const eventStreamContentType = "application/x-ndjson";

export function localGhApiPlugin() {
  const middleware = async (
    req: LocalApiRequest,
    res: LocalApiResponse,
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
      const events = createEventStream(res);

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

        const overview = await getPullRequestsOverview(
          {
            owner: body.owner,
            repo: body.repo,
          },
          undefined,
          acceptsEventStream(req)
            ? (progress) => events.send({ type: "progress", ...progress })
            : undefined,
        );

        if (events.hasStarted()) {
          events.close({ overview, type: "done" });
        } else {
          respondJson(res, 200, overview);
        }
      } catch (error) {
        const payload =
          error instanceof LocalGithubError
            ? {
                message: error.message,
                status: error.status,
                type: error.type,
              }
            : null;

        // Once updates are streaming the status line is gone, so the error travels as an event.
        if (events.hasStarted()) {
          events.close({
            error: payload ?? {
              message: "gh returned an unexpected error while loading pull requests.",
              status: 500,
              type: "unknown",
            },
            type: "error",
          });
          return;
        }

        if (payload) {
          respondJson(res, payload.status ?? 500, payload);
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
          pullRequestReviewId?: string | null;
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
          pullRequestReviewId: body.pullRequestReviewId ?? null,
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
          publish?: boolean;
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
          publish: body.publish === true,
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

    if (req.url === "/api/local/github/pending-review-discards" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          pullRequestReviewId?: string;
        };

        if (!body.pullRequestReviewId) {
          respondJson(res, 400, {
            message: "A pending review id is required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await discardPendingReview({
          pullRequestReviewId: body.pullRequestReviewId,
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

    if (req.url === "/api/local/github/pending-comment-deletions" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          commentId?: string;
        };

        if (!body.commentId) {
          respondJson(res, 400, {
            message: "A comment id is required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await deletePendingComment({
          commentId: body.commentId,
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

    if (req.url === "/api/local/github/review-submissions" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          body?: string;
          event?: string;
          pullRequestId?: string;
        };

        if (!body.pullRequestId || !body.event) {
          respondJson(res, 400, {
            message: "A pull request id and a review type are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await submitReview({
          body: body.body ?? "",
          event: body.event,
          pullRequestId: body.pullRequestId,
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

    if (req.url === "/api/local/github/file-viewed-state" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          path?: string;
          pullRequestId?: string;
          viewed?: boolean;
        };

        if (!body.pullRequestId || !body.path || typeof body.viewed !== "boolean") {
          respondJson(res, 400, {
            message: "Pull request id, file path, and viewed state are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await setFileViewed({
          path: body.path,
          pullRequestId: body.pullRequestId,
          viewed: body.viewed,
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

    if (req.url === "/api/local/github/comment-reactions" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          commentId?: string;
          content?: string;
          hasReacted?: boolean;
        };

        if (!body.commentId || !body.content || typeof body.hasReacted !== "boolean") {
          respondJson(res, 400, {
            message: "Comment id, reaction, and reaction state are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await setCommentReaction({
          commentId: body.commentId,
          content: body.content,
          hasReacted: body.hasReacted,
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

    if (req.url === "/api/local/github/file-content" && req.method === "POST") {
      try {
        const body = (await readJsonBody(req)) as {
          owner?: string;
          path?: string;
          ref?: string;
          repo?: string;
        };

        if (!body.owner || !body.repo || !body.path || !body.ref) {
          respondJson(res, 400, {
            message: "Owner, repo, file path, and commit are required.",
            status: 400,
            type: "unknown",
          });
          return;
        }

        const result = await getRepositoryFileContent({
          owner: body.owner,
          path: body.path,
          ref: body.ref,
          repo: body.repo,
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

function readJsonBody(req: LocalApiRequest) {
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

function acceptsEventStream(req: LocalApiRequest) {
  const accept = req.headers?.accept;

  return (Array.isArray(accept) ? accept.join(",") : (accept ?? "")).includes(
    eventStreamContentType,
  );
}

// Streams newline-delimited JSON events; the response starts with the first event.
function createEventStream(res: LocalApiResponse) {
  let hasStarted = false;
  const send = (event: PullRequestsSyncEvent) => {
    if (res.writableEnded || res.destroyed) {
      return;
    }

    if (!hasStarted) {
      hasStarted = true;
      res.statusCode = 200;
      res.setHeader("Content-Type", `${eventStreamContentType}; charset=utf-8`);
      res.setHeader("Cache-Control", "no-cache");
    }

    res.write(`${JSON.stringify(event)}\n`);
    res.flush?.();
  };

  return {
    close: (event: PullRequestsSyncEvent) => {
      send(event);

      if (!res.writableEnded) {
        res.end();
      }
    },
    hasStarted: () => hasStarted,
    send,
  };
}

function respondJson(res: LocalApiResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
