import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const avatar = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.pill,
  background: vars.color.surfaceMuted,
  fontWeight: 700,
  lineHeight: 1,
  objectFit: "cover",
  userSelect: "none",
});

export const size = styleVariants({
  sm: {
    width: "20px",
    height: "20px",
    fontSize: "10px",
  },
  md: {
    width: "28px",
    height: "28px",
    fontSize: vars.fontSize.xs,
  },
});

export const fallbackTone = styleVariants({
  accent: {
    background: vars.color.accentSoft,
    color: vars.color.accent,
  },
  neutral: {
    background: vars.color.neutralSoft,
    color: vars.color.neutral,
  },
  success: {
    background: vars.color.successSoft,
    color: vars.color.success,
  },
  warning: {
    background: vars.color.warningSoft,
    color: vars.color.warning,
  },
});
