import { create } from "zustand";
import {
  buildRepoSettings,
  emptyRepoSettings,
  isRepoSettingsComplete,
  type RepoSettings,
} from "./repo-parser";

export const SETTINGS_STORAGE_KEY = "pr-status:settings";

type SettingsStore = {
  settings: RepoSettings;
  isEditing: boolean;
  clearSettings: () => void;
  hydrateSettings: () => void;
  saveSettings: (input: { repoInput: string }) => void;
  setEditing: (value: boolean) => void;
};

function readStoredSettings(): RepoSettings {
  try {
    const rawValue = globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY);

    if (!rawValue) {
      return emptyRepoSettings;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<RepoSettings>;

    if (
      typeof parsedValue.repoInput !== "string" ||
      typeof parsedValue.owner !== "string" ||
      typeof parsedValue.repo !== "string"
    ) {
      return emptyRepoSettings;
    }

    return {
      repoInput: parsedValue.repoInput,
      owner: parsedValue.owner,
      repo: parsedValue.repo,
    };
  } catch {
    return emptyRepoSettings;
  }
}

function writeStoredSettings(settings: RepoSettings) {
  globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function clearStoredSettings() {
  globalThis.localStorage?.removeItem(SETTINGS_STORAGE_KEY);
}

function getInitialState() {
  const settings = readStoredSettings();

  return {
    settings,
    isEditing: !isRepoSettingsComplete(settings),
  };
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...getInitialState(),
  clearSettings: () => {
    clearStoredSettings();
    set({
      settings: emptyRepoSettings,
      isEditing: true,
    });
  },
  hydrateSettings: () => {
    const settings = readStoredSettings();

    set({
      settings,
      isEditing: !isRepoSettingsComplete(settings),
    });
  },
  saveSettings: (input) => {
    const nextSettings = buildRepoSettings(input);
    writeStoredSettings(nextSettings);

    set({
      settings: nextSettings,
      isEditing: false,
    });
  },
  setEditing: (value) => {
    set({ isEditing: value });
  },
}));

export function resetSettingsStore() {
  clearStoredSettings();
  useSettingsStore.setState({
    settings: emptyRepoSettings,
    isEditing: true,
  });
}
