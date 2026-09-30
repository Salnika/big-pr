import { create } from "zustand";

export const PREFERENCES_STORAGE_KEY = "pr-status:preferences";
// Where the diff view was saved before preferences were grouped, read once to carry it over.
const legacyDiffViewStorageKey = "pr-status:diff-view";

export type DiffViewMode = "split" | "unified";
export type PullRequestFilters = {
  comments: boolean;
  conflicts: boolean;
  drafts: boolean;
  failingCi: boolean;
};
export type PullRequestSortMode = "comments-desc" | "number-desc" | "updated-asc" | "updated-desc";
export type PullRequestViewMode = "grid" | "list";
// "Pending" isn't saved: it only makes sense while a review is in progress.
export type SavedThreadFilter = "all" | "resolved" | "unresolved";

export type Preferences = {
  diffViewMode: DiffViewMode;
  pullRequestFilters: PullRequestFilters;
  pullRequestSortMode: PullRequestSortMode;
  pullRequestViewMode: PullRequestViewMode;
  threadFilter: SavedThreadFilter;
};

type PreferencesStore = {
  preferences: Preferences;
  setPreference: <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => void;
};

export const noPullRequestFilters: PullRequestFilters = {
  comments: false,
  conflicts: false,
  drafts: false,
  failingCi: false,
};

export const defaultPreferences: Preferences = {
  diffViewMode: "unified",
  pullRequestFilters: noPullRequestFilters,
  pullRequestSortMode: "updated-desc",
  pullRequestViewMode: "grid",
  threadFilter: "all",
};

const diffViewModes: readonly DiffViewMode[] = ["split", "unified"];
const pullRequestSortModes: readonly PullRequestSortMode[] = [
  "comments-desc",
  "number-desc",
  "updated-asc",
  "updated-desc",
];
const pullRequestViewModes: readonly PullRequestViewMode[] = ["grid", "list"];
const savedThreadFilters: readonly SavedThreadFilter[] = ["all", "resolved", "unresolved"];

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  preferences: readStoredPreferences(),
  setPreference: (key, value) => {
    if (Object.is(get().preferences[key], value)) {
      return;
    }

    const preferences = { ...get().preferences, [key]: value };

    writeStoredPreferences(preferences);
    set({ preferences });
  },
}));

// Follow changes made in another tab, rather than overwrite them later with stale values.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === PREFERENCES_STORAGE_KEY || event.key === null) {
      usePreferencesStore.setState({ preferences: readStoredPreferences() });
    }
  });
}

export function resetPreferencesStore() {
  usePreferencesStore.setState({ preferences: defaultPreferences });
}

export function parseDiffViewMode(value: unknown) {
  return pickAllowed(value, diffViewModes);
}

function readStoredPreferences(): Preferences {
  try {
    const rawValue = globalThis.localStorage?.getItem(PREFERENCES_STORAGE_KEY);
    const storedValue: unknown = rawValue ? JSON.parse(rawValue) : {};
    const legacyDiffViewMode = globalThis.localStorage?.getItem(legacyDiffViewStorageKey);

    return parsePreferences({
      diffViewMode: legacyDiffViewMode,
      ...(isRecord(storedValue) ? storedValue : {}),
    });
  } catch {
    return defaultPreferences;
  }
}

function writeStoredPreferences(preferences: Preferences) {
  try {
    globalThis.localStorage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    globalThis.localStorage?.removeItem(legacyDiffViewStorageKey);
  } catch {
    // Without storage (private browsing, full quota), preferences last while the page is open.
  }
}

// Anything unknown, like a value from another version, falls back to its default.
function parsePreferences(value: Record<string, unknown>): Preferences {
  const filters = isRecord(value.pullRequestFilters) ? value.pullRequestFilters : {};

  return {
    diffViewMode: parseDiffViewMode(value.diffViewMode) ?? defaultPreferences.diffViewMode,
    pullRequestFilters: {
      comments: filters.comments === true,
      conflicts: filters.conflicts === true,
      drafts: filters.drafts === true,
      failingCi: filters.failingCi === true,
    },
    pullRequestSortMode:
      pickAllowed(value.pullRequestSortMode, pullRequestSortModes) ??
      defaultPreferences.pullRequestSortMode,
    pullRequestViewMode:
      pickAllowed(value.pullRequestViewMode, pullRequestViewModes) ??
      defaultPreferences.pullRequestViewMode,
    threadFilter:
      pickAllowed(value.threadFilter, savedThreadFilters) ?? defaultPreferences.threadFilter,
  };
}

function pickAllowed<Value extends string>(value: unknown, allowed: readonly Value[]) {
  return allowed.find((item) => item === value) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
