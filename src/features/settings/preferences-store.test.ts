import { describe, expect, test } from "vite-plus/test";
import {
  defaultPreferences,
  PREFERENCES_STORAGE_KEY,
  usePreferencesStore,
} from "./preferences-store";

describe("preferences store", () => {
  test("saves each change to localStorage", () => {
    usePreferencesStore.getState().setPreference("pullRequestViewMode", "list");
    usePreferencesStore.getState().setPreference("pullRequestFilters", {
      ...defaultPreferences.pullRequestFilters,
      drafts: true,
    });

    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}")).toEqual({
      ...defaultPreferences,
      pullRequestFilters: { ...defaultPreferences.pullRequestFilters, drafts: true },
      pullRequestViewMode: "list",
    });
  });

  test("follows another tab and falls back to defaults for values it doesn't know", () => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        diffViewMode: "split",
        pullRequestFilters: { conflicts: true, drafts: "yes" },
        pullRequestSortMode: "stars-desc",
        threadFilter: "unresolved",
      }),
    );

    notifyStorageChange(PREFERENCES_STORAGE_KEY);

    expect(usePreferencesStore.getState().preferences).toEqual({
      ...defaultPreferences,
      diffViewMode: "split",
      pullRequestFilters: { ...defaultPreferences.pullRequestFilters, conflicts: true },
      threadFilter: "unresolved",
    });

    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, "{not json");
    notifyStorageChange(PREFERENCES_STORAGE_KEY);

    expect(usePreferencesStore.getState().preferences).toEqual(defaultPreferences);
  });

  test("carries over the diff view saved before preferences were grouped", () => {
    window.localStorage.setItem("pr-status:diff-view", "split");
    notifyStorageChange(PREFERENCES_STORAGE_KEY);

    expect(usePreferencesStore.getState().preferences.diffViewMode).toBe("split");

    usePreferencesStore.getState().setPreference("threadFilter", "resolved");

    expect(window.localStorage.getItem("pr-status:diff-view")).toBeNull();
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain(
      '"diffViewMode":"split"',
    );
  });

  test("leaves storage alone when a preference doesn't change", () => {
    usePreferencesStore.getState().setPreference("pullRequestViewMode", "grid");

    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});

function notifyStorageChange(key: string) {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}
