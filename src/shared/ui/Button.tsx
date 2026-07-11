import type { ButtonHTMLAttributes } from "react";
import { classNames } from "../lib/class-names";
import * as styles from "./Button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles.variant;
  size?: keyof typeof styles.size;
};

export function Button({ className, size = "md", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={classNames(styles.button, styles.size[size], styles.variant[variant], className)}
      {...props}
    />
  );
}
