import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vite-plus/test";
import { resetSettingsStore } from "../features/settings/settings-store";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetSettingsStore();
});
