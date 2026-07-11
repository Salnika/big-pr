import { useEffect, useState, type FormEvent } from "react";
import { buildRepoSettings, isRepoSettingsComplete } from "./repo-parser";
import { useGithubCliStatusQuery } from "./github-cli-client";
import { SettingsPanel } from "./SettingsPanel";
import { useSettingsStore } from "./settings-store";

type SettingsContainerProps = {
  mode: "edit" | "setup";
};

export function SettingsContainer({ mode }: SettingsContainerProps) {
  const settings = useSettingsStore((store) => store.settings);
  const saveSettings = useSettingsStore((store) => store.saveSettings);
  const clearSettings = useSettingsStore((store) => store.clearSettings);
  const setEditing = useSettingsStore((store) => store.setEditing);
  const statusQuery = useGithubCliStatusQuery();

  const [form, setForm] = useState({
    repoInput: settings.repoInput,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      repoInput: settings.repoInput,
    });
    setError(null);
  }, [settings.repoInput]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      buildRepoSettings(form);
      saveSettings(form);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Something went wrong while saving the settings.",
      );
    }
  }

  function handleClear() {
    clearSettings();
    setForm({
      repoInput: "",
    });
    setError(null);
  }

  function handleCancel() {
    setForm({
      repoInput: settings.repoInput,
    });
    setError(null);
    setEditing(false);
  }

  return (
    <SettingsPanel
      error={error}
      form={form}
      ghStatus={statusQuery.data ?? null}
      ghStatusError={statusQuery.isError ? "Unable to read local gh status right now." : null}
      ghStatusLoading={statusQuery.isPending}
      hasSavedSettings={isRepoSettingsComplete(settings)}
      mode={mode}
      onCancel={mode === "edit" ? handleCancel : undefined}
      onClear={handleClear}
      onRepoInputChange={(repoInput) => setForm((current) => ({ ...current, repoInput }))}
      onSubmit={handleSubmit}
    />
  );
}
