import type { FormEvent } from "react";
import { classNames } from "../../shared/lib/class-names";
import type { GithubCliStatus } from "../../shared/lib/github-cli";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import * as styles from "./SettingsPanel.css";

type SettingsPanelProps = {
  error: string | null;
  form: {
    repoInput: string;
  };
  ghStatus: GithubCliStatus | null;
  ghStatusError: string | null;
  ghStatusLoading: boolean;
  hasSavedSettings: boolean;
  mode: "edit" | "setup";
  onCancel?: () => void;
  onClear: () => void;
  onRepoInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const copy = {
  edit: {
    title: "Update your local GitHub settings",
    description:
      "Change the repository whenever you need. Authentication now comes directly from your local gh session.",
  },
  setup: {
    title: "Connect a GitHub repository",
    description:
      "Use your local gh authentication and a github.com repository to unlock a compact PR health dashboard with no backend.",
  },
};

export function SettingsPanel({
  error,
  form,
  ghStatus,
  ghStatusError,
  ghStatusLoading,
  hasSavedSettings,
  mode,
  onCancel,
  onClear,
  onRepoInputChange,
  onSubmit,
}: SettingsPanelProps) {
  const content = copy[mode];
  const ghStatusTone = ghStatusLoading
    ? "neutral"
    : ghStatusError
      ? "danger"
      : ghStatus?.cliAvailable
        ? ghStatus.authenticated
          ? "success"
          : "warning"
        : "danger";
  const ghStatusText = ghStatusLoading
    ? "Checking the local gh session..."
    : (ghStatusError ?? ghStatus?.message ?? "Checking the local gh session...");

  return (
    <Card>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>{content.title}</h2>
          <p className={styles.description}>{content.description}</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.fields}>
            <div className={classNames(styles.status, styles.statusTone[ghStatusTone])}>
              <strong>GitHub CLI status:</strong> {ghStatusText}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Repository</span>
              <input
                aria-label="Repository"
                autoComplete="off"
                className={styles.input}
                onChange={(event) => onRepoInputChange(event.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                type="text"
                value={form.repoInput}
              />
              <span className={styles.helper}>
                Repository is stored locally in <code>pr-status:settings</code>. Authentication
                comes from <code>gh auth login</code>.
              </span>
            </label>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.actions}>
            <Button type="submit" variant="primary">
              Save settings
            </Button>
            {onCancel ? (
              <Button onClick={onCancel} type="button" variant="secondary">
                Cancel
              </Button>
            ) : null}
            {hasSavedSettings ? (
              <Button onClick={onClear} type="button" variant="ghost">
                Clear local settings
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </Card>
  );
}
