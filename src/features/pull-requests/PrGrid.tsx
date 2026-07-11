import { useMemo, useState } from "react";
import { formatDateTime } from "../../shared/lib/date";
import { Button } from "../../shared/ui/Button";
import { StatusPill } from "../../shared/ui/StatusPill";
import { PrCard } from "./PrCard";
import type { PullRequestCardModel } from "./pull-request-model";
import * as styles from "./PrGrid.css";

type ViewMode = "grid" | "list";
type SortMode = "updated-desc" | "updated-asc" | "comments-desc" | "number-desc";

type Filters = {
  comments: boolean;
  conflicts: boolean;
  drafts: boolean;
  failingCi: boolean;
};

type PrGridProps = {
  hasMore: boolean;
  isRefreshing: boolean;
  items: PullRequestCardModel[];
  lastRefreshedAt: string | null;
  onRefresh: () => void;
  onSelectPullRequest?: (item: PullRequestCardModel) => void;
  totalCount: number;
};

export function PrGrid({
  hasMore,
  isRefreshing,
  items,
  lastRefreshedAt,
  onRefresh,
  onSelectPullRequest,
  totalCount,
}: PrGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [filters, setFilters] = useState<Filters>({
    comments: false,
    conflicts: false,
    drafts: false,
    failingCi: false,
  });
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

      <div className={styles.controls}>
        <div className={styles.controlGroup} aria-label="View mode">
          <button
            aria-pressed={viewMode === "grid"}
            className={styles.segment}
            onClick={() => setViewMode("grid")}
            type="button"
          >
            Grid
          </button>
          <button
            aria-pressed={viewMode === "list"}
            className={styles.segment}
            onClick={() => setViewMode("list")}
            type="button"
          >
            List
          </button>
        </div>

        <div className={styles.filters} aria-label="Filters">
          <FilterToggle
            checked={filters.failingCi}
            label="CI failing"
            onChange={(checked) => setFilters((current) => ({ ...current, failingCi: checked }))}
          />
          <FilterToggle
            checked={filters.conflicts}
            label="Conflicts"
            onChange={(checked) => setFilters((current) => ({ ...current, conflicts: checked }))}
          />
          <FilterToggle
            checked={filters.comments}
            label="Comments"
            onChange={(checked) => setFilters((current) => ({ ...current, comments: checked }))}
          />
          <FilterToggle
            checked={filters.drafts}
            label="Drafts"
            onChange={(checked) => setFilters((current) => ({ ...current, drafts: checked }))}
          />
        </div>

        <label className={styles.sortControl}>
          <span>Sort</span>
          <select
            className={styles.select}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
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
            onClick={() =>
              setFilters({
                comments: false,
                conflicts: false,
                drafts: false,
                failingCi: false,
              })
            }
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
              <PrCard item={item} key={item.id} onReview={onSelectPullRequest} />
            ))}
          </div>
        ) : (
          <ul className={styles.list}>
            {visibleItems.map((item) => (
              <PrListItem item={item} key={item.id} onReview={onSelectPullRequest} />
            ))}
          </ul>
        )
      ) : (
        <div className={styles.filteredEmpty}>No pull requests match the current filters.</div>
      )}
    </section>
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

function PrListItem({
  item,
  onReview,
}: {
  item: PullRequestCardModel;
  onReview?: (item: PullRequestCardModel) => void;
}) {
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
        {onReview ? (
          <Button onClick={() => onReview(item)} size="sm" type="button" variant="primary">
            Review
          </Button>
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

function filterPullRequests(items: PullRequestCardModel[], filters: Filters) {
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

function sortPullRequests(items: PullRequestCardModel[], sortMode: SortMode) {
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
