import type { PropsWithChildren } from "react";
import { classNames } from "../lib/class-names";
import * as styles from "./StatusPill.css";

type StatusPillProps = PropsWithChildren<{
  tone: keyof typeof styles.tone;
}>;

export function StatusPill({ children, tone }: StatusPillProps) {
  return <span className={classNames(styles.pill, styles.tone[tone])}>{children}</span>;
}
