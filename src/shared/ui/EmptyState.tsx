import type { ReactNode } from "react";
import { Card } from "./Card";
import * as styles from "./StateBlock.css";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <Card>
      <div className={styles.root}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        {action ? <div className={styles.actions}>{action}</div> : null}
      </div>
    </Card>
  );
}
