import { style, styleVariants } from "@vanilla-extract/css";
import { breakpoints, vars } from "../../app/theme.css";

export const panel = style({
  display: "grid",
  gap: vars.space[16],
});

export const header = style({
  display: "grid",
  gap: vars.space[8],
});

export const title = style({
  margin: 0,
  fontSize: vars.fontSize.lg,
  lineHeight: 1.15,
});

export const description = style({
  margin: 0,
  color: vars.color.textMuted,
  maxWidth: "62ch",
});

export const form = style({
  display: "grid",
  gap: vars.space[16],
});

export const fields = style({
  display: "grid",
  gap: vars.space[16],
});

export const field = style({
  display: "grid",
  gap: vars.space[8],
});

export const label = style({
  fontSize: vars.fontSize.sm,
  fontWeight: 500,
});

export const inputRow = style({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: vars.space[12],
  "@media": {
    [breakpoints.mobile]: {
      gridTemplateColumns: "1fr",
    },
  },
});

export const input = style({
  width: "100%",
  minHeight: "42px",
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
  padding: `0 ${vars.space[16]}`,
  color: vars.color.textStrong,
});

export const helper = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
});

export const status = style({
  padding: `${vars.space[8]} ${vars.space[12]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  fontSize: vars.fontSize.sm,
});

export const statusTone = styleVariants({
  danger: {
    background: vars.color.dangerSoft,
    color: vars.color.danger,
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

export const error = style({
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderRadius: vars.radius.sm,
  background: vars.color.dangerSoft,
  color: vars.color.danger,
  fontSize: vars.fontSize.sm,
});

export const actions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[12],
});
