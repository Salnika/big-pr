import { formatDateTime } from "../../shared/lib/date";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { MetricRow } from "../../shared/ui/MetricRow";
import { StatusPill } from "../../shared/ui/StatusPill";
import type { PullRequestCardModel } from "./pull-request-model";
import * as styles from "./PrCard.css";

type PrCardProps = {
  item: PullRequestCardModel;
  reviewHref?: string;
};

export function PrCard({ item, reviewHref }: PrCardProps) {
  const ciBadge = {
    success: { label: "CI passing", tone: "success" as const },
    pending: { label: "CI pending", tone: "warning" as const },
    failure: { label: "CI failing", tone: "danger" as const },
    unknown: { label: "CI unknown", tone: "neutral" as const },
  }[item.ciStatus];

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <span className={styles.number}>PR #{item.number}</span>
        <h2 className={styles.title}>{item.title}</h2>
        <span className={styles.meta}>by @{item.authorLogin}</span>
      </div>

      <div className={styles.badges}>
        <StatusPill tone={item.isDraft ? "neutral" : "accent"}>
          {item.isDraft ? "Draft" : "Ready"}
        </StatusPill>
        <StatusPill tone={ciBadge.tone}>{ciBadge.label}</StatusPill>
        <StatusPill tone={item.hasConflicts ? "danger" : "success"}>
          {item.hasConflicts ? "Conflicts" : "No conflicts"}
        </StatusPill>
      </div>

      <dl className={styles.refs}>
        <div className={styles.refRow}>
          <dt className={styles.refLabel}>Repo</dt>
          <dd className={styles.refValue}>{item.repositoryName}</dd>
        </div>
        <div className={styles.refRow}>
          <dt className={styles.refLabel}>Source</dt>
          <dd className={styles.refValue}>{item.headBranch}</dd>
        </div>
        <div className={styles.refRow}>
          <dt className={styles.refLabel}>Target</dt>
          <dd className={styles.refValue}>{item.baseBranch}</dd>
        </div>
      </dl>

      <div className={styles.metrics}>
        <MetricRow label="Updated" value={formatDateTime(item.updatedAt)} />
        <MetricRow
          label="Unresolved comments"
          value={item.unresolvedThreads > 99 ? "99+" : String(item.unresolvedThreads)}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.meta}>Review diff, threads, and replies locally.</span>
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
    </Card>
  );
}
