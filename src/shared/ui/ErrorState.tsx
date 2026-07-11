import type { ReactNode } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import * as styles from "./StateBlock.css";

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
};

export function ErrorState({ action, description, onRetry, title }: ErrorStateProps) {
  return (
    <Card>
      <div className={styles.root}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        {action || onRetry ? (
          <div className={styles.actions}>
            {action}
            {onRetry ? (
              <Button onClick={onRetry} variant="primary">
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
