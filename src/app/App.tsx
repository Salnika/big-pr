import { PrGridContainer } from "../features/pull-requests/PrGridContainer";
import { formatRepoLabel, isRepoSettingsComplete } from "../features/settings/repo-parser";
import { SettingsContainer } from "../features/settings/SettingsContainer";
import { useSettingsStore } from "../features/settings/settings-store";
import { Button } from "../shared/ui/Button";
import * as styles from "./App.css";

export function App() {
  const settings = useSettingsStore((store) => store.settings);
  const isEditing = useSettingsStore((store) => store.isEditing);
  const setEditing = useSettingsStore((store) => store.setEditing);
  const hasValidSettings = isRepoSettingsComplete(settings);

  if (!hasValidSettings) {
    return (
      <main className={styles.shell}>
        <div className={styles.frame}>
          <section className={styles.intro}>
            <span className={styles.eyebrow}>PR cockpit</span>
            <h1 className={styles.hero}>Track pull request health at a glance.</h1>
            <p className={styles.copy}>
              Use your local <code>gh</code> session plus a repository once, keep only the repo in
              your browser, and surface the signals that matter: draft status, CI, conflicts,
              unresolved threads, and the latest activity.
            </p>
          </section>
          <SettingsContainer mode="setup" />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.eyebrow}>PR cockpit</span>
            <h1 className={styles.appName}>PR Status</h1>
            <span className={styles.repo}>{formatRepoLabel(settings)}</span>
          </div>
          <Button onClick={() => setEditing(!isEditing)} variant="secondary">
            {isEditing ? "Hide settings" : "Edit settings"}
          </Button>
        </header>
        {isEditing ? (
          <div className={styles.panel}>
            <SettingsContainer mode="edit" />
          </div>
        ) : null}
        <PrGridContainer />
      </div>
    </main>
  );
}
