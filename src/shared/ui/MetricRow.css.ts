import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const row = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[16],
  fontSize: vars.fontSize.sm,
});

export const label = style({
  color: vars.color.textMuted,
});

export const value = style({
  fontWeight: 500,
});
