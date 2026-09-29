import { style } from "@vanilla-extract/css";
import { vars } from "../../app/theme.css";

export const review = style({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[8],
});

export const viewerState = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "36px",
  borderRadius: vars.radius.sm,
  fontSize: vars.fontSize.sm,
  fontWeight: 600,
  padding: `0 ${vars.space[12]}`,
});

export const viewerStateApproved = style({
  border: `1px solid ${vars.color.successSoft}`,
  background: vars.color.successSoft,
  color: vars.color.success,
});

export const viewerStateChangesRequested = style({
  border: `1px solid ${vars.color.dangerSoft}`,
  background: vars.color.dangerSoft,
  color: vars.color.danger,
});

export const count = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "20px",
  height: "20px",
  marginLeft: "6px",
  borderRadius: vars.radius.pill,
  background: vars.color.warningSoft,
  color: vars.color.warning,
  fontSize: vars.fontSize.xs,
  fontWeight: 700,
  padding: "0 6px",
});

export const panel = style({
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  zIndex: 20,
  display: "grid",
  gap: vars.space[8],
  width: "min(380px, calc(100vw - 32px))",
  padding: vars.space[12],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  boxShadow: "0 12px 32px rgba(17, 20, 24, 0.16)",
});

export const title = style({
  margin: 0,
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  fontWeight: 600,
});

export const pendingNote = style({
  margin: 0,
  border: `1px solid ${vars.color.warningSoft}`,
  borderRadius: vars.radius.sm,
  background: vars.color.warningSoft,
  color: vars.color.warning,
  fontSize: vars.fontSize.xs,
  padding: `6px ${vars.space[8]}`,
});

export const textarea = style({
  minHeight: "84px",
  resize: "vertical",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  color: vars.color.textStrong,
  padding: vars.space[8],
});

export const events = style({
  display: "grid",
  gap: "2px",
});

export const event = style({
  display: "flex",
  alignItems: "flex-start",
  gap: vars.space[8],
  borderRadius: vars.radius.sm,
  cursor: "pointer",
  padding: `6px ${vars.space[4]}`,
  selectors: {
    "&:hover": {
      background: vars.color.surfaceMuted,
    },
  },
});

export const eventDisabled = style({
  cursor: "not-allowed",
  opacity: 0.6,
  selectors: {
    "&:hover": {
      background: "transparent",
    },
  },
});

export const eventInput = style({
  flexShrink: 0,
  marginTop: "3px",
});

export const eventText = style({
  display: "grid",
  gap: "2px",
});

export const eventLabel = style({
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  fontWeight: 600,
});

export const eventDescription = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
});

export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: vars.space[8],
});

export const actionsStart = style({
  marginRight: "auto",
});

export const discardButton = style({
  color: vars.color.danger,
});

export const discardConfirm = style({
  display: "grid",
  gap: vars.space[8],
  border: `1px solid ${vars.color.dangerSoft}`,
  borderRadius: vars.radius.sm,
  background: vars.color.dangerSoft,
  padding: vars.space[8],
});

export const discardText = style({
  margin: 0,
  color: vars.color.danger,
  fontSize: vars.fontSize.xs,
});
