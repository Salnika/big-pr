import { style } from "@vanilla-extract/css";
import { breakpoints, vars } from "./theme.css";

export const shell = style({
  minHeight: "100vh",
  padding: `${vars.space[32]} ${vars.space[24]}`,
  "@media": {
    [breakpoints.mobile]: {
      padding: vars.space[16],
    },
  },
});

export const frame = style({
  width: "100%",
  maxWidth: "1320px",
  margin: "0 auto",
});

export const intro = style({
  display: "grid",
  gap: vars.space[16],
  marginBottom: vars.space[24],
});

export const eyebrow = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "uppercase",
});

export const hero = style({
  margin: 0,
  fontSize: vars.fontSize.hero,
  lineHeight: 1.1,
  maxWidth: "14ch",
});

export const copy = style({
  margin: 0,
  color: vars.color.textMuted,
  maxWidth: "56ch",
  fontSize: vars.fontSize.md,
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[20],
  marginBottom: vars.space[32],
  paddingBottom: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
  "@media": {
    [breakpoints.mobile]: {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  },
});

export const headerMeta = style({
  display: "grid",
  gap: vars.space[8],
});

export const appName = style({
  margin: 0,
  fontSize: vars.fontSize.xl,
  lineHeight: 1.1,
});

export const repo = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const panel = style({
  marginBottom: vars.space[24],
});
