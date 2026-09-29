import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

type ScrollIntent = "preserve" | "restore" | "top";
type HistoryEntryState = {
  key?: string;
};

const locationChangeEvent = "pr-status:locationchange";
const maxScrollRestoreFrames = 30;
const scrollPositions = new Map<string, number>();
let pendingScroll: ScrollIntent = "preserve";
let renderedPath: string | null = null;
let scrollRestoreToken = 0;

if (typeof window !== "undefined") {
  window.history.scrollRestoration = "manual";

  if (!getHistoryEntryKey()) {
    window.history.replaceState({ ...readHistoryState(), key: createHistoryEntryKey() }, "");
  }

  window.addEventListener("popstate", () => {
    if (window.location.pathname !== renderedPath) {
      pendingScroll = "restore";
    }
  });
  window.addEventListener(
    "scroll",
    () => {
      scrollPositions.set(getHistoryEntryKey(), window.scrollY);
    },
    { passive: true },
  );
}

export function useLocationPath() {
  return useSyncExternalStore(subscribeToLocation, getLocationPath, () => "/");
}

export function navigate(
  path: string,
  options: { replace?: boolean; scroll?: Exclude<ScrollIntent, "restore"> } = {},
) {
  if (path === getLocationPath() && !options.replace) {
    return;
  }

  scrollPositions.set(getHistoryEntryKey(), window.scrollY);

  const state: HistoryEntryState = { key: createHistoryEntryKey() };

  if (options.replace) {
    window.history.replaceState(state, "", path);
  } else {
    window.history.pushState(state, "", path);
  }

  pendingScroll = options.scroll ?? "top";
  window.dispatchEvent(new Event(locationChangeEvent));
}

export function useScrollRestoration(path: string) {
  useLayoutEffect(() => {
    const intent = renderedPath === null ? "preserve" : pendingScroll;

    renderedPath = path;
    pendingScroll = "preserve";
    scrollRestoreToken += 1;

    if (intent === "top") {
      window.scrollTo(0, 0);
    }

    if (intent === "restore") {
      restoreScrollPosition(scrollPositions.get(getHistoryEntryKey()) ?? 0, scrollRestoreToken);
    }
  }, [path]);
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(locationChangeEvent, onChange);

  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(locationChangeEvent, onChange);
  };
}

function getLocationPath() {
  return window.location.pathname;
}

// Content can arrive a few frames after a back/forward navigation, so keep trying
// until the page is tall enough or another navigation takes over.
function restoreScrollPosition(top: number, token: number, frame = 0) {
  if (token !== scrollRestoreToken) {
    return;
  }

  window.scrollTo(0, top);

  if (window.scrollY < top - 1 && frame < maxScrollRestoreFrames) {
    window.requestAnimationFrame?.(() => restoreScrollPosition(top, token, frame + 1));
  }
}

function readHistoryState(): HistoryEntryState {
  const state: unknown = window.history.state;

  return state && typeof state === "object" ? (state as HistoryEntryState) : {};
}

function getHistoryEntryKey() {
  return readHistoryState().key ?? "";
}

function createHistoryEntryKey() {
  return Math.random().toString(36).slice(2, 10);
}
