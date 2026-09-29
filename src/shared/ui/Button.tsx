import type { ButtonHTMLAttributes } from "react";
import { classNames } from "../lib/class-names";
import * as styles from "./Button.css";
import { Link, type LinkProps } from "./Link";

type ButtonStyleProps = {
  variant?: keyof typeof styles.variant;
  size?: keyof typeof styles.size;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps;

export function Button({ className, size = "md", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      className={classNames(styles.button, styles.size[size], styles.variant[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  size = "md",
  variant = "secondary",
  ...props
}: LinkProps & ButtonStyleProps) {
  return (
    <Link
      className={classNames(styles.button, styles.size[size], styles.variant[variant], className)}
      {...props}
    />
  );
}
