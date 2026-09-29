import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

const focusRing = {
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: "1px",
};

export const picker = style({
  position: "relative",
  display: "inline-flex",
});

export const addButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  border: "1px solid transparent",
  borderRadius: vars.radius.pill,
  background: "transparent",
  color: vars.color.textMuted,
  cursor: "pointer",
  selectors: {
    "&:hover:not(:disabled)": {
      borderColor: vars.color.border,
      background: vars.color.surface,
      color: vars.color.textStrong,
    },
    "&[aria-expanded='true']": {
      borderColor: vars.color.accent,
      background: vars.color.accentSoft,
      color: vars.color.accent,
    },
    "&:focus-visible": focusRing,
    "&:disabled": {
      cursor: "progress",
      opacity: 0.6,
    },
  },
});

export const menu = style({
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  zIndex: 10,
  display: "flex",
  gap: "2px",
  padding: vars.space[4],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  boxShadow: "0 8px 24px rgba(17, 20, 24, 0.12)",
});

export const menuItem = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  border: 0,
  borderRadius: vars.radius.sm,
  background: "transparent",
  cursor: "pointer",
  fontSize: vars.fontSize.md,
  lineHeight: 1,
  selectors: {
    "&:hover": {
      background: vars.color.surfaceMuted,
    },
    "&[aria-pressed='true']": {
      background: vars.color.accentSoft,
    },
    "&:focus-visible": focusRing,
  },
});

export const list = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: vars.space[4],
});

export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[4],
  minHeight: "26px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.pill,
  background: vars.color.surface,
  color: vars.color.textStrong,
  cursor: "pointer",
  fontSize: vars.fontSize.xs,
  padding: `0 ${vars.space[8]}`,
  selectors: {
    "&:hover:not(:disabled)": {
      borderColor: vars.color.textMuted,
    },
    "&[aria-pressed='true']": {
      borderColor: vars.color.accent,
      background: vars.color.accentSoft,
      color: vars.color.accent,
    },
    "&:focus-visible": focusRing,
    "&:disabled": {
      cursor: "progress",
      opacity: 0.7,
    },
  },
});

export const pillCount = style({
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
});
