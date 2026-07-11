import { describe, expect, test } from "vite-plus/test";
import { SETTINGS_STORAGE_KEY, useSettingsStore } from "./settings-store";

describe("settings store", () => {
  test("persists saved settings to localStorage", () => {
    useSettingsStore.getState().saveSettings({ repoInput: "openai/pr-status" });

    expect(useSettingsStore.getState().isEditing).toBe(false);
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"owner":"openai"');
  });

  test("hydrates settings from localStorage", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        repoInput: "https://github.com/openai/pr-status",
        owner: "openai",
        repo: "pr-status",
      }),
    );

    useSettingsStore.getState().hydrateSettings();

    expect(useSettingsStore.getState().settings).toEqual({
      repoInput: "https://github.com/openai/pr-status",
      owner: "openai",
      repo: "pr-status",
    });
    expect(useSettingsStore.getState().isEditing).toBe(false);
  });
});
