import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "../lib/navigation";

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

export function Link({ onClick, target, to, ...props }: LinkProps) {
  return (
    <a
      {...props}
      href={to}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || !isPlainLeftClick(event) || (target && target !== "_self")) {
          return;
        }

        event.preventDefault();
        navigate(to);
      }}
      target={target}
    />
  );
}

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
