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

export const brand = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[16],
  minWidth: 0,
});

export const logoLink = style({
  display: "flex",
  borderRadius: "50%",
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "2px",
    },
  },
});

// The badge sits on an opaque square: cropping it to a circle hides the corners.
export const logo = style({
  flexShrink: 0,
  width: "64px",
  height: "64px",
  borderRadius: "50%",
});

export const introLogo = style({
  width: "96px",
  height: "96px",
  borderRadius: "50%",
});

export const appName = style({
  display: "flex",
  margin: 0,
});

export const repo = style({
  color: vars.color.textStrong,
  fontSize: vars.fontSize.md,
  fontWeight: 600,
});

export const panel = style({
  marginBottom: vars.space[24],
});
