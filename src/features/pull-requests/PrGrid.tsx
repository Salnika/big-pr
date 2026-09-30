import { useMemo } from "react";
import { formatDateTime } from "../../shared/lib/date";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { StatusPill } from "../../shared/ui/StatusPill";
import {
  noPullRequestFilters,
  type PullRequestFilters,
  type PullRequestSortMode,
  usePreferencesStore,
} from "../settings/preferences-store";
import { PrCard } from "./PrCard";
import type { PullRequestCardModel } from "./pull-request-model";
import * as styles from "./PrGrid.css";
import type { SyncProgress } from "./use-cached-resource";

type PrGridProps = {
  getReviewHref?: (item: PullRequestCardModel) => string;
  hasMore: boolean;
  isRefreshing: boolean;
  items: PullRequestCardModel[];
  lastRefreshedAt: string | null;
  onRefresh: () => void;
  refreshError?: Error | null;
  syncProgress?: SyncProgress | null;
  totalCount: number;
};

export function PrGrid({
  getReviewHref,
  hasMore,
  isRefreshing,
  items,
  lastRefreshedAt,
  onRefresh,
  refreshError = null,
  syncProgress = null,
  totalCount,
}: PrGridProps) {
  // The display, sort, and filters are saved preferences, kept from one visit to the next.
  const viewMode = usePreferencesStore((store) => store.preferences.pullRequestViewMode);
  const sortMode = usePreferencesStore((store) => store.preferences.pullRequestSortMode);
  const filters = usePreferencesStore((store) => store.preferences.pullRequestFilters);
  const setPreference = usePreferencesStore((store) => store.setPreference);
  const setFilter = (key: keyof PullRequestFilters, checked: boolean) =>
    setPreference("pullRequestFilters", { ...filters, [key]: checked });
  const summary = hasMore
    ? "Showing the 50 most recently updated open pull requests."
    : "Showing all currently open pull requests.";
  const refreshedCopy = lastRefreshedAt
    ? `Last synced at ${lastRefreshedAt}.`
    : "Pull requests are synced only when you refresh the list.";
  const visibleItems = useMemo(
    () => sortPullRequests(filterPullRequests(items, filters), sortMode),
    [filters, items, sortMode],
  );
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const resultCountCopy =
    visibleItems.length === items.length
      ? `${items.length} displayed`
      : `${visibleItems.length} of ${items.length} displayed`;

  return (
    <section className={styles.stack}>
      <div className={styles.toolbar}>
        <div className={styles.summary}>
          <h2 className={styles.summaryTitle}>{totalCount} open pull requests</h2>
          <p className={styles.summaryBody}>
            {summary} {refreshedCopy}
          </p>
        </div>
        <Button disabled={isRefreshing} onClick={onRefresh} variant="primary">
          {isRefreshing ? "Refreshing…" : "Refresh PR list"}
        </Button>
      </div>

      {isRefreshing ? <SyncStatus progress={syncProgress} /> : null}

      {refreshError ? (
        <div className={styles.refreshError} role="alert">
          Could not finish syncing the list. {refreshError.message}
        </div>
      ) : null}

      <div className={styles.controls}>
        <div className={styles.controlGroup} aria-label="View mode">
          <button
            aria-pressed={viewMode === "grid"}
            className={styles.segment}
            onClick={() => setPreference("pullRequestViewMode", "grid")}
            type="button"
          >
            Grid
          </button>
          <button
            aria-pressed={viewMode === "list"}
            className={styles.segment}
            onClick={() => setPreference("pullRequestViewMode", "list")}
            type="button"
          >
            List
          </button>
        </div>

        <div className={styles.filters} aria-label="Filters">
          <FilterToggle
            checked={filters.failingCi}
            label="CI failing"
            onChange={(checked) => setFilter("failingCi", checked)}
          />
          <FilterToggle
            checked={filters.conflicts}
            label="Conflicts"
            onChange={(checked) => setFilter("conflicts", checked)}
          />
          <FilterToggle
            checked={filters.comments}
            label="Comments"
            onChange={(checked) => setFilter("comments", checked)}
          />
          <FilterToggle
            checked={filters.drafts}
            label="Drafts"
            onChange={(checked) => setFilter("drafts", checked)}
          />
        </div>

        <label className={styles.sortControl}>
          <span>Sort</span>
          <select
            className={styles.select}
            onChange={(event) =>
              setPreference("pullRequestSortMode", event.target.value as PullRequestSortMode)
            }
            value={sortMode}
          >
            <option value="updated-desc">Newest updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="comments-desc">Most comments</option>
            <option value="number-desc">Highest PR number</option>
          </select>
        </label>
      </div>

      <div className={styles.resultMeta}>
        <span>{resultCountCopy}</span>
        {hasActiveFilters ? (
          <button
            className={styles.clearFilters}
            onClick={() => setPreference("pullRequestFilters", noPullRequestFilters)}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {visibleItems.length ? (
        viewMode === "grid" ? (
          <div className={styles.grid}>
            {visibleItems.map((item) => (
              <PrCard item={item} key={item.id} reviewHref={getReviewHref?.(item)} />
            ))}
          </div>
        ) : (
          <ul className={styles.list}>
            {visibleItems.map((item) => (
              <PrListItem item={item} key={item.id} reviewHref={getReviewHref?.(item)} />
            ))}
          </ul>
        )
      ) : (
        <div className={styles.filteredEmpty}>No pull requests match the current filters.</div>
      )}
    </section>
  );
}

function SyncStatus({ progress }: { progress: SyncProgress | null }) {
  return (
    <div className={styles.syncStatus} role="status">
      <span aria-hidden="true" className={styles.syncSpinner} />
      <span className={styles.syncLabel}>
        Synchronising…
        {progress ? (
          <span className={styles.syncCount}>
            {" "}
            {progress.completed} of {progress.total} pull requests updated
          </span>
        ) : null}
      </span>
      {progress?.total ? (
        <span aria-hidden="true" className={styles.syncTrack}>
          <span
            className={styles.syncFill}
            style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

function FilterToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.filterToggle}>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function PrListItem({ item, reviewHref }: { item: PullRequestCardModel; reviewHref?: string }) {
  const ciBadge = {
    success: { label: "CI passing", tone: "success" as const },
    pending: { label: "CI pending", tone: "warning" as const },
    failure: { label: "CI failing", tone: "danger" as const },
    unknown: { label: "CI unknown", tone: "neutral" as const },
  }[item.ciStatus];

  return (
    <li className={styles.listItem}>
      <div className={styles.listMain}>
        <span className={styles.listNumber}>PR #{item.number}</span>
        <h3 className={styles.listTitle}>{item.title}</h3>
        <span className={styles.listMeta}>by @{item.authorLogin}</span>
      </div>
      <div className={styles.listRefs}>
        <span className={styles.listRefLine}>{item.repositoryName}</span>
        <span className={styles.listRefLine}>
          {item.headBranch} -&gt; {item.baseBranch}
        </span>
      </div>
      <div className={styles.listSignals}>
        <StatusPill tone={item.isDraft ? "neutral" : "accent"}>
          {item.isDraft ? "Draft" : "Ready"}
        </StatusPill>
        <StatusPill tone={ciBadge.tone}>{ciBadge.label}</StatusPill>
        <StatusPill tone={item.hasConflicts ? "danger" : "success"}>
          {item.hasConflicts ? "Conflicts" : "No conflicts"}
        </StatusPill>
      </div>
      <div className={styles.listMetrics}>
        <span>{formatDateTime(item.updatedAt)}</span>
        <span>{item.unresolvedThreads > 99 ? "99+" : item.unresolvedThreads} comments</span>
      </div>
      <div className={styles.listActions}>
        {reviewHref ? (
          <ButtonLink size="sm" to={reviewHref} variant="primary">
            Review
          </ButtonLink>
        ) : null}
        <Button
          onClick={() => globalThis.open(item.url, "_blank", "noopener,noreferrer")}
          size="sm"
          type="button"
          variant="secondary"
        >
          Open
        </Button>
      </div>
    </li>
  );
}

function filterPullRequests(items: PullRequestCardModel[], filters: PullRequestFilters) {
  return items.filter((item) => {
    if (filters.failingCi && item.ciStatus !== "failure") {
      return false;
    }

    if (filters.conflicts && !item.hasConflicts) {
      return false;
    }

    if (filters.comments && item.unresolvedThreads === 0) {
      return false;
    }

    if (filters.drafts && !item.isDraft) {
      return false;
    }

    return true;
  });
}

function sortPullRequests(items: PullRequestCardModel[], sortMode: PullRequestSortMode) {
  return [...items].sort((left, right) => {
    if (sortMode === "updated-asc") {
      return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
    }

    if (sortMode === "comments-desc") {
      return right.unresolvedThreads - left.unresolvedThreads;
    }

    if (sortMode === "number-desc") {
      return right.number - left.number;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}
