import type { PropsWithChildren } from "react";
import { classNames } from "../lib/class-names";
import { card } from "./Card.css";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return <div className={classNames(card, className)}>{children}</div>;
}
