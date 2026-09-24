# PR Status

A local dashboard to track the health of a GitHub repository's open pull requests at a glance: draft status, CI, merge conflicts, unresolved review threads, and latest activity. You can also open a PR to read its diff and reply to, create, or resolve review threads.

The app has no GitHub token or OAuth. It uses your local [`gh` CLI](https://cli.github.com/) session through a small API that the Vite dev server exposes. The browser only stores the selected repository (in `localStorage`).

## Requirements

- [Vite+](https://viteplus.dev) (`vp`) installed globally
- [GitHub CLI](https://cli.github.com/) signed in: `gh auth login`

## Getting started

```bash
vp install
vp dev
```

Then open http://localhost:5174 and enter a repository (`owner/repo` or a GitHub URL).

## Scripts

| Command    | Description                         |
| ---------- | ----------------------------------- |
| `vp dev`   | Start the dev server (port 5174)    |
| `vp check` | Format, lint, and type-check        |
| `vp test`  | Run the test suite (Vitest + jsdom) |
| `vp build` | Production build                    |

> The GitHub API lives in a Vite plugin (`src/server/local-gh-api-plugin.ts`), so it is only available while `vp dev` is running. A static build can't reach `gh` on its own.

## Stack

React 19, TanStack Query, Zustand, vanilla-extract, and react-markdown, built with Vite+.

## Project layout

```
src/
  app/        App shell, providers, theme
  features/
    pull-requests/  PR grid, review view, diff parser, GitHub mapping
    settings/       Repository setup and gh CLI status
  server/     Local gh-backed API (Vite plugin)
  shared/     UI primitives and helpers
  test/       Test setup and utilities
```
