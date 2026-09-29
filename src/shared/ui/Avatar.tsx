import { useState } from "react";
import { classNames } from "../lib/class-names";
import * as styles from "./Avatar.css";

type AvatarProps = {
  login: string;
  size?: keyof typeof styles.size;
  src: string | null;
};

const fallbackTones = Object.keys(styles.fallbackTone) as Array<keyof typeof styles.fallbackTone>;

export function Avatar({ login, size = "md", src }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden="true"
        className={classNames(
          styles.avatar,
          styles.size[size],
          styles.fallbackTone[getFallbackTone(login)],
        )}
      >
        {login.charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      alt=""
      className={classNames(styles.avatar, styles.size[size])}
      decoding="async"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}

function getFallbackTone(login: string) {
  const hash = Array.from(login).reduce((total, character) => total + character.charCodeAt(0), 0);

  return fallbackTones[hash % fallbackTones.length] ?? "neutral";
}
