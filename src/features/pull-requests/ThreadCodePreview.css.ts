import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

const monospace = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const preview = style({
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceMuted,
});

export const toolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[8],
  minHeight: "40px",
  padding: `${vars.space[4]} ${vars.space[12]}`,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const toolbarText = style({
  display: "flex",
  alignItems: "baseline",
  gap: vars.space[8],
  minWidth: 0,
  overflow: "hidden",
  fontSize: vars.fontSize.xs,
  whiteSpace: "nowrap",
});

export const meta = style({
  color: vars.color.textMuted,
  fontFamily: monospace,
});

export const note = style({
  overflow: "hidden",
  color: vars.color.warning,
  textOverflow: "ellipsis",
});

export const resetButton = style({
  minHeight: "28px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  cursor: "pointer",
  flexShrink: 0,
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  padding: `0 ${vars.space[8]}`,
  selectors: {
    "&:hover": {
      borderColor: vars.color.textMuted,
    },
  },
});

export const body = style({
  maxHeight: "420px",
  overflow: "auto",
});

export const status = style({
  padding: vars.space[12],
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
});

const expanderBase = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[8],
  width: "100%",
  minWidth: "560px",
  minHeight: "28px",
  border: 0,
  background: vars.color.accentSoft,
  color: vars.color.accent,
  cursor: "pointer",
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  padding: `0 ${vars.space[12]}`,
  textAlign: "left",
  selectors: {
    "&:hover:not(:disabled)": {
      background: vars.color.accent,
      color: vars.color.surface,
    },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "-2px",
    },
    "&:disabled": {
      cursor: "progress",
      opacity: 0.7,
    },
  },
});

export const expander = styleVariants({
  down: [expanderBase],
  up: [
    expanderBase,
    {
      borderBottom: `1px solid ${vars.color.border}`,
    },
  ],
});

export const expanderIcon = style({
  flexShrink: 0,
});

export const line = style({
  display: "grid",
  gridTemplateColumns: "56px 56px minmax(0, 1fr)",
  minWidth: "560px",
  minHeight: "24px",
  borderBottom: `1px solid ${vars.color.border}`,
  fontFamily: monospace,
  fontSize: vars.fontSize.xs,
});

export const lineTarget = style({
  boxShadow: `inset 3px 0 0 ${vars.color.accent}`,
});

export const lineNumber = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: `0 ${vars.space[8]}`,
  borderRight: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
});

export const code = style({
  display: "flex",
  gap: vars.space[4],
  margin: 0,
  minWidth: 0,
  overflow: "visible",
  padding: `4px ${vars.space[12]}`,
  whiteSpace: "pre",
});

export const prefix = style({
  color: vars.color.textMuted,
  userSelect: "none",
});
