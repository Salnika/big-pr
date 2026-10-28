import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const filter = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
});

const field = {
  minHeight: "34px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
} as const;

export const amountInput = style({
  ...field,
  width: "56px",
  padding: `0 ${vars.space[4]} 0 ${vars.space[8]}`,
});

export const unitSelect = style({
  ...field,
  cursor: "pointer",
  padding: `0 ${vars.space[4]}`,
});

// The period stays editable while every change shows; editing it applies it.
export const fieldIdle = style({
  color: vars.color.textMuted,
});

export const summary = style({
  display: "flex",
  alignItems: "baseline",
  flexWrap: "wrap",
  columnGap: vars.space[12],
  rowGap: vars.space[8],
  padding: `${vars.space[8]} ${vars.space[12]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.accentSoft,
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
});

export const commits = style({
  flex: "1 1 320px",
  minWidth: 0,
});

export const commitsToggle = style({
  cursor: "pointer",
  fontWeight: 600,
});

export const commitList = style({
  display: "grid",
  gap: vars.space[4],
  margin: `${vars.space[8]} 0 0`,
  padding: 0,
  listStyle: "none",
});

export const commit = style({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "baseline",
  gap: vars.space[8],
});

export const commitOid = style({
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const commitHeadline = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const commitDate = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  whiteSpace: "nowrap",
});

export const changesStatus = style({
  color: vars.color.textMuted,
});

export const changesError = style({
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: vars.space[8],
  color: vars.color.danger,
});

export const hiddenNote = style({
  flexBasis: "100%",
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
});

export const truncatedNote = style({
  flexBasis: "100%",
  margin: 0,
  color: vars.color.warning,
  fontSize: vars.fontSize.xs,
});
