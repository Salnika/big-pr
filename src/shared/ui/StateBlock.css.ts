import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const root = style({
  display: "grid",
  gap: vars.space[8],
  justifyItems: "start",
});

export const title = style({
  margin: 0,
  fontSize: vars.fontSize.md,
});

export const description = style({
  margin: 0,
  color: vars.color.textMuted,
  maxWidth: "52ch",
});

export const actions = style({
  display: "flex",
  gap: vars.space[12],
  flexWrap: "wrap",
  marginTop: vars.space[4],
});
