import { keyframes, style } from "@vanilla-extract/css";
import { breakpoints, vars } from "../../app/theme.css";

export const stack = style({
  display: "grid",
  gap: vars.space[16],
});

export const toolbar = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space[16],
  "@media": {
    [breakpoints.mobile]: {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
});

const spin = keyframes({
  to: {
    transform: "rotate(360deg)",
  },
});

export const syncStatus = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[12],
  padding: `10px ${vars.space[12]}`,
  border: `1px solid ${vars.color.accentSoft}`,
  borderRadius: vars.radius.md,
  background: vars.color.accentSoft,
  color: vars.color.accent,
  fontSize: vars.fontSize.sm,
  fontWeight: 600,
});

export const syncSpinner = style({
  width: "14px",
  height: "14px",
  flexShrink: 0,
  border: `2px solid ${vars.color.accent}`,
  borderTopColor: "transparent",
  borderRadius: vars.radius.pill,
  animation: `${spin} 800ms linear infinite`,
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

export const syncLabel = style({
  flex: 1,
  minWidth: 0,
});

export const syncCount = style({
  color: vars.color.textMuted,
  fontWeight: 500,
});

export const syncTrack = style({
  width: "120px",
  height: "4px",
  flexShrink: 0,
  overflow: "hidden",
  borderRadius: vars.radius.pill,
  background: vars.color.surface,
  "@media": {
    [breakpoints.mobile]: {
      display: "none",
    },
  },
});

export const syncFill = style({
  display: "block",
  height: "100%",
  background: vars.color.accent,
  transition: "width 200ms ease",
});

export const refreshError = style({
  padding: vars.space[12],
  border: `1px solid ${vars.color.dangerSoft}`,
  borderRadius: vars.radius.sm,
  background: vars.color.dangerSoft,
  color: vars.color.danger,
  fontSize: vars.fontSize.sm,
});

export const summary = style({
  display: "grid",
  gap: vars.space[4],
});

export const summaryTitle = style({
  margin: 0,
  fontSize: vars.fontSize.lg,
  lineHeight: 1.15,
});

export const summaryBody = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  margin: 0,
});

export const grid = style({
  display: "grid",
  gap: vars.space[12],
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  "@media": {
    [breakpoints.tablet]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [breakpoints.mobile]: {
      gridTemplateColumns: "1fr",
    },
  },
});

export const controls = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[12],
  flexWrap: "wrap",
  paddingBottom: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
});

export const controlGroup = style({
  display: "inline-flex",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  overflow: "hidden",
});

export const segment = style({
  minHeight: "34px",
  border: 0,
  borderRight: `1px solid ${vars.color.border}`,
  background: "transparent",
  color: vars.color.textMuted,
  cursor: "pointer",
  fontSize: vars.fontSize.sm,
  fontWeight: 500,
  padding: `0 ${vars.space[12]}`,
  selectors: {
    "&:last-child": {
      borderRight: 0,
    },
    "&[aria-pressed='true']": {
      background: vars.color.textStrong,
      color: vars.color.surface,
    },
  },
});

export const filters = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[8],
  flexWrap: "wrap",
});

export const filterToggle = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[8],
  minHeight: "34px",
  padding: `0 ${vars.space[12]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  cursor: "pointer",
  selectors: {
    "&:has(input:checked)": {
      background: vars.color.textStrong,
      borderColor: vars.color.textStrong,
      color: vars.color.surface,
    },
  },
});

export const sortControl = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[8],
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const select = style({
  minHeight: "34px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  padding: `0 ${vars.space[8]}`,
});

export const resultMeta = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[12],
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const clearFilters = style({
  border: 0,
  background: "transparent",
  color: vars.color.textStrong,
  cursor: "pointer",
  fontSize: vars.fontSize.sm,
  fontWeight: 500,
  padding: 0,
});

export const list = style({
  display: "grid",
  gap: vars.space[8],
  listStyle: "none",
  margin: 0,
  padding: 0,
});

export const listItem = style({
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.2fr) minmax(180px, 1.2fr) auto auto auto",
  alignItems: "center",
  gap: vars.space[16],
  padding: vars.space[12],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  "@media": {
    [breakpoints.tablet]: {
      gridTemplateColumns: "1fr",
      alignItems: "start",
    },
  },
});

export const listMain = style({
  display: "grid",
  gap: vars.space[4],
  minWidth: 0,
});

export const listNumber = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  fontWeight: 500,
});

export const listTitle = style({
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: vars.fontSize.md,
  lineHeight: 1.25,
});

export const listMeta = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const listRefs = style({
  display: "grid",
  gap: vars.space[4],
  minWidth: 0,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const listRefLine = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const listSignals = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[4],
});

export const listMetrics = style({
  display: "grid",
  gap: vars.space[4],
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
  whiteSpace: "nowrap",
});

export const listActions = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[8],
  justifySelf: "end",
  "@media": {
    [breakpoints.tablet]: {
      justifySelf: "start",
    },
  },
});

export const filteredEmpty = style({
  padding: vars.space[16],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});
