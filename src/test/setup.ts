import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vite-plus/test";
import { resetSettingsStore } from "../features/settings/settings-store";
import { clearPersistentCache } from "../shared/lib/persistent-cache";

// jsdom does not implement scrolling.
window.scrollTo = () => {};

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  resetSettingsStore();
  await clearPersistentCache();
});
