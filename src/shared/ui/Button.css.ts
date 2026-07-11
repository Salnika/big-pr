import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const button = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space[8],
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  cursor: "pointer",
  fontWeight: 500,
  transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.textMuted,
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.55,
    },
  },
});

export const size = styleVariants({
  md: {
    minHeight: "36px",
    padding: `0 ${vars.space[16]}`,
    fontSize: vars.fontSize.sm,
  },
  sm: {
    minHeight: "30px",
    padding: `0 ${vars.space[12]}`,
    fontSize: vars.fontSize.xs,
  },
});

export const variant = styleVariants({
  primary: {
    background: vars.color.textStrong,
    color: vars.color.surface,
    borderColor: vars.color.textStrong,
  },
  secondary: {
    background: "transparent",
    color: vars.color.textStrong,
  },
  ghost: {
    background: "transparent",
    color: vars.color.textMuted,
    borderColor: "transparent",
  },
});
