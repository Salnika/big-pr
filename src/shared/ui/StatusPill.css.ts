import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const pill = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "26px",
  padding: `0 ${vars.space[8]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: vars.fontSize.xs,
  fontWeight: 500,
  whiteSpace: "nowrap",
});

export const tone = styleVariants({
  accent: {
    background: vars.color.surface,
    color: vars.color.accent,
    borderColor: vars.color.accentSoft,
  },
  success: {
    background: vars.color.surface,
    color: vars.color.success,
    borderColor: vars.color.successSoft,
  },
  warning: {
    background: vars.color.surface,
    color: vars.color.warning,
    borderColor: vars.color.warningSoft,
  },
  danger: {
    background: vars.color.surface,
    color: vars.color.danger,
    borderColor: vars.color.dangerSoft,
  },
  neutral: {
    background: vars.color.surface,
    color: vars.color.neutral,
    borderColor: vars.color.neutralSoft,
  },
});
