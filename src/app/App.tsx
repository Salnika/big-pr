import { useEffect, useMemo } from "react";
import { PrGridContainer } from "../features/pull-requests/PrGridContainer";
import { PullRequestReviewContainer } from "../features/pull-requests/PullRequestReviewContainer";
import {
  formatRepoLabel,
  isRepoSettingsComplete,
  type RepoSettings,
} from "../features/settings/repo-parser";
import { SettingsContainer } from "../features/settings/SettingsContainer";
import { useSettingsStore } from "../features/settings/settings-store";
import {
  navigate,
  useDocumentTitle,
  useLocationPath,
  useScrollRestoration,
} from "../shared/lib/navigation";
import { Button } from "../shared/ui/Button";
import { Link } from "../shared/ui/Link";
import * as styles from "./App.css";
import { getPullRequestPath, getPullRequestsPath, parseRoute } from "./routes";

export function App() {
  const path = useLocationPath();
  const route = useMemo(() => parseRoute(path), [path]);
  const settings = useSettingsStore((store) => store.settings);
  const isEditing = useSettingsStore((store) => store.isEditing);
  const saveSettings = useSettingsStore((store) => store.saveSettings);
  const setEditing = useSettingsStore((store) => store.setEditing);
  const hasValidSettings = isRepoSettingsComplete(settings);
  const routeOwner = route && route.name !== "home" ? route.owner : null;
  const routeRepo = route && route.name !== "home" ? route.repo : null;
  const repository = useMemo<RepoSettings | null>(
    () =>
      routeOwner && routeRepo
        ? { owner: routeOwner, repo: routeRepo, repoInput: `${routeOwner}/${routeRepo}` }
        : null,
    [routeOwner, routeRepo],
  );

  useScrollRestoration(path);

  useEffect(() => {
    if (!route) {
      navigate("/", { replace: true });
    } else if (route.name === "home" && hasValidSettings) {
      navigate(getPullRequestsPath(settings), { replace: true });
    }
  }, [hasValidSettings, route, settings]);

  // The repository in the URL wins, so links and history entries always open the right repo.
  useEffect(() => {
    if (repository && (repository.owner !== settings.owner || repository.repo !== settings.repo)) {
      saveSettings({ repoInput: repository.repoInput });
    }
  }, [repository, saveSettings, settings.owner, settings.repo]);

  if (!route || !repository) {
    return route?.name === "home" && !hasValidSettings ? <SetupScreen /> : null;
  }

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.eyebrow}>PR cockpit</span>
            <h1 className={styles.appName}>
              <Link to={getPullRequestsPath(repository)}>PR Status</Link>
            </h1>
            <span className={styles.repo}>{formatRepoLabel(repository)}</span>
          </div>
          <Button onClick={() => setEditing(!isEditing)} variant="secondary">
            {isEditing ? "Hide settings" : "Edit settings"}
          </Button>
        </header>
        {isEditing && hasValidSettings ? (
          <div className={styles.panel}>
            <SettingsContainer
              mode="edit"
              onCleared={() => navigate("/")}
              onSaved={(nextSettings) => navigate(getPullRequestsPath(nextSettings))}
            />
          </div>
        ) : null}
        {route.name === "pull-request" ? (
          <PullRequestReviewContainer
            backHref={getPullRequestsPath(repository)}
            key={`${repository.repoInput}#${route.number}`}
            onTabChange={(tab) =>
              navigate(getPullRequestPath(repository, route.number, tab), { scroll: "preserve" })
            }
            pullRequestNumber={route.number}
            repository={repository}
            tab={route.tab}
          />
        ) : (
          <PrGridContainer
            getReviewHref={(item) => getPullRequestPath(repository, item.number, "files")}
            key={repository.repoInput}
            repository={repository}
          />
        )}
      </div>
    </main>
  );
}

function SetupScreen() {
  useDocumentTitle("PR Status");

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
        <SettingsContainer
          mode="setup"
          onSaved={(nextSettings) => navigate(getPullRequestsPath(nextSettings))}
        />
      </div>
    </main>
  );
}
