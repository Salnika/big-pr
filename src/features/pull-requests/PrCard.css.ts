import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const card = style({
  display: "grid",
  gap: vars.space[16],
  height: "100%",
});

export const header = style({
  display: "grid",
  gap: vars.space[8],
});

export const title = style({
  margin: 0,
  fontSize: vars.fontSize.lg,
  lineHeight: 1.25,
});

export const number = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  fontWeight: 500,
  letterSpacing: 0,
});

export const meta = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const badges = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[4],
});

export const refs = style({
  display: "grid",
  gap: vars.space[4],
  margin: 0,
  padding: `${vars.space[12]} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  borderTop: `1px solid ${vars.color.border}`,
});

export const refRow = style({
  display: "grid",
  gridTemplateColumns: "64px minmax(0, 1fr)",
  gap: vars.space[12],
  fontSize: vars.fontSize.sm,
});

export const refLabel = style({
  color: vars.color.textMuted,
});

export const refValue = style({
  margin: 0,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const metrics = style({
  display: "grid",
  gap: vars.space[8],
});

export const footer = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: vars.space[12],
  marginTop: "auto",
  paddingTop: vars.space[12],
  borderTop: `1px solid ${vars.color.border}`,
  flexWrap: "wrap",
});
