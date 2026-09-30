import { useCallback, useEffect } from "react";
import {
  type DiffViewMode,
  parseDiffViewMode,
  usePreferencesStore,
} from "../settings/preferences-store";

export type { DiffViewMode };

// Like on GitHub, `?diff=split` or `?diff=unified` in the URL wins, and becomes the saved choice.
export function useDiffViewMode() {
  const savedMode = usePreferencesStore((store) => store.preferences.diffViewMode);
  const setPreference = usePreferencesStore((store) => store.setPreference);
  const modeFromUrl = parseDiffViewMode(
    new URLSearchParams(globalThis.location?.search ?? "").get("diff"),
  );

  useEffect(() => {
    if (modeFromUrl) {
      setPreference("diffViewMode", modeFromUrl);
    }
  }, [modeFromUrl, setPreference]);

  const changeMode = useCallback(
    (nextMode: DiffViewMode) => {
      replaceDiffViewParam(nextMode);
      setPreference("diffViewMode", nextMode);
    },
    [setPreference],
  );

  return [modeFromUrl ?? savedMode, changeMode] as const;
}

// Keeps a `?diff=` parameter in step, so reloading the page shows the view just picked.
function replaceDiffViewParam(mode: DiffViewMode) {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("diff")) {
    return;
  }

  url.searchParams.set("diff", mode);
  window.history.replaceState(window.history.state, "", url);
}
