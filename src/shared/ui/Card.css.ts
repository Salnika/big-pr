import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const card = style({
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.space[16],
});
