import { globalStyle, style, styleVariants } from "@vanilla-extract/css";
import { breakpoints, vars } from "../../app/theme.css";

export const stack = style({
  display: "grid",
  gap: vars.space[16],
});

export const header = style({
  display: "grid",
  gap: vars.space[16],
  paddingBottom: vars.space[16],
  borderBottom: `1px solid ${vars.color.border}`,
});

export const headerTop = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space[16],
  "@media": {
    [breakpoints.mobile]: {
      flexDirection: "column",
    },
  },
});

export const titleBlock = style({
  display: "grid",
  gap: vars.space[8],
  minWidth: 0,
});

export const eyebrow = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  textTransform: "uppercase",
});

export const title = style({
  margin: 0,
  fontSize: vars.fontSize.xl,
  lineHeight: 1.15,
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

export const stats = style({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  columnGap: vars.space[16],
  rowGap: vars.space[8],
});

export const stat = style({
  display: "inline-flex",
  alignItems: "baseline",
  gap: vars.space[4],
});

export const statLabel = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
});

export const statValue = style({
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  fontWeight: 600,
});

export const statValueDanger = style({
  color: vars.color.danger,
});

export const statValueSuccess = style({
  color: vars.color.success,
});

export const tabs = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[12],
  flexWrap: "wrap",
});

export const segmentGroup = style({
  display: "inline-flex",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  overflow: "hidden",
});

export const segment = style({
  minHeight: "34px",
  border: 0,
  borderRight: `1px solid ${vars.color.border}`,
  background: "transparent",
  color: vars.color.textMuted,
  cursor: "pointer",
  fontSize: vars.fontSize.sm,
  fontWeight: 500,
  padding: `0 ${vars.space[12]}`,
  selectors: {
    "&:last-child": {
      borderRight: 0,
    },
    "&[aria-pressed='true']": {
      background: vars.color.textStrong,
      color: vars.color.surface,
    },
  },
});

export const inlineError = style({
  padding: vars.space[12],
  border: `1px solid ${vars.color.dangerSoft}`,
  borderRadius: vars.radius.sm,
  background: vars.color.dangerSoft,
  color: vars.color.danger,
  fontSize: vars.fontSize.sm,
});

export const reviewLayout = style({
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  gap: vars.space[16],
  alignItems: "start",
  "@media": {
    [breakpoints.tablet]: {
      gridTemplateColumns: "1fr",
    },
  },
});

export const fileNav = style({
  position: "sticky",
  top: vars.space[16],
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: vars.space[8],
  maxHeight: "calc(100vh - 32px)",
  overflow: "hidden",
  padding: vars.space[8],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  "@media": {
    [breakpoints.tablet]: {
      position: "static",
      maxHeight: "240px",
    },
  },
});

export const searchLabel = style({
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
});

export const fileSearchInput = style({
  width: "100%",
  minHeight: "34px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  padding: `0 ${vars.space[8]}`,
});

export const fileTree = style({
  display: "grid",
  alignContent: "start",
  gap: "2px",
  minHeight: 0,
  overflow: "auto",
});

const fileTreeRow = {
  display: "grid",
  gridTemplateColumns: "16px 16px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: vars.space[4],
  width: "100%",
  minHeight: "28px",
  border: 0,
  borderRadius: vars.radius.sm,
  background: "transparent",
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  textAlign: "left",
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
    "&:hover": {
      background: vars.color.surfaceMuted,
    },
  },
} as const;

export const fileTreeDirectory = style({
  ...fileTreeRow,
  cursor: "pointer",
  fontWeight: 600,
  paddingRight: vars.space[8],
});

export const fileTreeFile = style({
  ...fileTreeRow,
  paddingRight: vars.space[8],
});

export const fileTreeChevron = style({
  width: 0,
  height: 0,
  marginLeft: "5px",
  borderTop: "4px solid transparent",
  borderBottom: "4px solid transparent",
  borderLeft: `5px solid ${vars.color.textMuted}`,
  transition: "transform 120ms ease",
});

export const fileTreeChevronExpanded = style({
  transform: "rotate(90deg)",
});

export const fileTreeSpacer = style({
  width: "16px",
  height: "16px",
});

export const fileTreeFolderIcon = style({
  position: "relative",
  width: "15px",
  height: "11px",
  border: `1px solid ${vars.color.textMuted}`,
  borderRadius: "2px",
  background: vars.color.neutralSoft,
  selectors: {
    "&::before": {
      position: "absolute",
      top: "-4px",
      left: "-1px",
      width: "8px",
      height: "4px",
      border: `1px solid ${vars.color.textMuted}`,
      borderBottom: 0,
      borderRadius: "2px 2px 0 0",
      background: vars.color.neutralSoft,
      content: "",
    },
  },
});

export const fileTreeFileIcon = style({
  width: "12px",
  height: "15px",
  border: `1px solid ${vars.color.textMuted}`,
  borderRadius: "2px",
  background: vars.color.surface,
});

export const fileTreeName = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const fileTreeMeta = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.xs,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

export const fileTreeEmpty = style({
  padding: vars.space[8],
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const files = style({
  display: "grid",
  gap: vars.space[16],
  minWidth: 0,
});

export const fileBlock = style({
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
});

export const fileHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[12],
  padding: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
  background: vars.color.surfaceMuted,
});

export const filePath = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.sm,
});

export const fileStats = style({
  display: "flex",
  gap: vars.space[8],
  color: vars.color.textMuted,
  flexShrink: 0,
  fontSize: vars.fontSize.xs,
});

export const diffBody = style({
  overflowX: "auto",
});

export const hunk = style({
  minWidth: "760px",
});

export const hunkHeader = style({
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  background: vars.color.accentSoft,
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const diffLine = style({
  display: "grid",
  gridTemplateColumns: "36px 64px 64px minmax(0, 1fr)",
  minHeight: "26px",
  borderBottom: `1px solid ${vars.color.border}`,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const lineCommentCell = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: `1px solid ${vars.color.border}`,
});

export const lineCommentButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "22px",
  height: "22px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  cursor: "pointer",
  fontSize: vars.fontSize.sm,
  fontWeight: 700,
  opacity: 0,
  transition: "opacity 120ms ease, border-color 120ms ease",
  selectors: {
    [`${diffLine}:hover &`]: {
      opacity: 1,
    },
    "&:focus-visible": {
      opacity: 1,
    },
    "&:hover": {
      borderColor: vars.color.textMuted,
    },
  },
});

export const diffLineTone = styleVariants({
  addition: {
    background: vars.color.successSoft,
  },
  context: {
    background: vars.color.surface,
  },
  deletion: {
    background: vars.color.dangerSoft,
  },
});

export const lineNumber = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: `0 ${vars.space[8]}`,
  borderRight: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  userSelect: "none",
});

export const codeLine = style({
  margin: 0,
  minWidth: 0,
  overflow: "visible",
  padding: `4px ${vars.space[12]}`,
  whiteSpace: "pre",
});

export const inlineThread = style({
  minWidth: "760px",
  padding: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
});

export const newThreadForm = style({
  display: "grid",
  gap: vars.space[8],
  minWidth: "760px",
  padding: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
  background: vars.color.surface,
});

export const newThreadActions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: vars.space[8],
});

export const unmatchedThreads = style({
  display: "grid",
  gap: vars.space[8],
  padding: vars.space[12],
  borderBottom: `1px solid ${vars.color.border}`,
});

export const threadCard = style({
  display: "grid",
  gap: vars.space[12],
  padding: vars.space[12],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
});

export const threadHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[12],
  flexWrap: "wrap",
});

export const threadLocation = style({
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const threadLocationGroup = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const threadCodeToggle = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  border: 0,
  borderRadius: vars.radius.sm,
  background: "transparent",
  color: vars.color.textMuted,
  cursor: "pointer",
  flexShrink: 0,
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
    "&:hover": {
      background: vars.color.accentSoft,
      color: vars.color.accent,
    },
  },
});

export const threadCodeChevron = style({
  width: "7px",
  height: "7px",
  borderRight: `2px solid currentColor`,
  borderBottom: `2px solid currentColor`,
  transform: "translateY(-1px) rotate(45deg)",
  transition: "transform 120ms ease",
});

export const threadCodeChevronOpen = style({
  transform: "translateY(2px) rotate(225deg)",
});

export const threadLocationSpacer = style({
  width: "24px",
  height: "24px",
  flexShrink: 0,
});

export const threadFileButton = style({
  minWidth: 0,
  overflow: "hidden",
  border: 0,
  borderRadius: vars.radius.sm,
  background: "transparent",
  color: vars.color.accent,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: 600,
  padding: "2px 4px",
  textAlign: "left",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
    "&:hover": {
      background: vars.color.accentSoft,
    },
  },
});

export const threadLocationLine = style({
  flexShrink: 0,
  color: vars.color.textMuted,
});

export const threadVsCodeButton = style({
  minHeight: "24px",
  marginLeft: vars.space[8],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  cursor: "pointer",
  flexShrink: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  padding: `0 ${vars.space[8]}`,
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
    "&:hover": {
      borderColor: vars.color.textMuted,
      color: vars.color.accent,
    },
  },
});

export const threadActions = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[8],
  flexWrap: "wrap",
});

export const codeDrawer = style({
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceMuted,
});

export const codeDrawerToolbar = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[8],
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const codeDrawerMeta = style({
  minWidth: 0,
  overflow: "hidden",
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const codeDrawerExpand = style({
  minHeight: "28px",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surface,
  color: vars.color.textStrong,
  cursor: "pointer",
  flexShrink: 0,
  fontSize: vars.fontSize.xs,
  fontWeight: 600,
  padding: `0 ${vars.space[8]}`,
  selectors: {
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "1px",
    },
    "&:hover": {
      borderColor: vars.color.textMuted,
    },
  },
});

export const codeDrawerBody = style({
  maxHeight: "420px",
  overflow: "auto",
});

export const codeDrawerHunkHeader = style({
  minWidth: "560px",
  padding: `${vars.space[8]} ${vars.space[12]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const codeDrawerLine = style({
  display: "grid",
  gridTemplateColumns: "56px 56px minmax(0, 1fr)",
  minWidth: "560px",
  minHeight: "24px",
  borderBottom: `1px solid ${vars.color.border}`,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: vars.fontSize.xs,
});

export const codeDrawerLineTarget = style({
  boxShadow: `inset 3px 0 0 ${vars.color.accent}`,
});

export const codeDrawerLineNumber = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: `0 ${vars.space[8]}`,
  borderRight: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
});

export const codeDrawerCode = style({
  display: "flex",
  gap: vars.space[4],
  margin: 0,
  minWidth: 0,
  overflow: "visible",
  padding: `4px ${vars.space[12]}`,
  whiteSpace: "pre",
});

export const codeDrawerPrefix = style({
  color: vars.color.textMuted,
  userSelect: "none",
});

export const comments = style({
  display: "grid",
  gap: vars.space[8],
});

export const comment = style({
  display: "grid",
  gap: vars.space[4],
  paddingLeft: vars.space[12],
  borderLeft: `2px solid ${vars.color.border}`,
});

export const commentMeta = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space[8],
  color: vars.color.textMuted,
  flexWrap: "wrap",
  fontSize: vars.fontSize.xs,
});

export const commentBody = style({
  color: vars.color.textStrong,
  fontSize: vars.fontSize.sm,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
});

globalStyle(`${commentBody} > :first-child`, {
  marginTop: 0,
});

globalStyle(`${commentBody} > :last-child`, {
  marginBottom: 0,
});

globalStyle(`${commentBody} a`, {
  color: vars.color.accent,
  fontWeight: 600,
});

globalStyle(`${commentBody} blockquote`, {
  margin: `0 0 ${vars.space[8]}`,
  paddingLeft: vars.space[12],
  borderLeft: `3px solid ${vars.color.border}`,
  color: vars.color.textMuted,
});

globalStyle(`${commentBody} code`, {
  padding: "1px 4px",
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceMuted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.92em",
});

globalStyle(`${commentBody} img`, {
  maxWidth: "100%",
  borderRadius: vars.radius.sm,
});

globalStyle(`${commentBody} li`, {
  marginBottom: vars.space[4],
});

globalStyle(`${commentBody} ol, ${commentBody} ul`, {
  margin: `0 0 ${vars.space[8]}`,
  paddingLeft: vars.space[20],
});

globalStyle(`${commentBody} p`, {
  margin: `0 0 ${vars.space[8]}`,
});

globalStyle(`${commentBody} pre`, {
  overflowX: "auto",
  margin: `0 0 ${vars.space[8]}`,
  padding: vars.space[8],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  background: vars.color.surfaceMuted,
});

globalStyle(`${commentBody} pre code`, {
  padding: 0,
  borderRadius: 0,
  background: "transparent",
  fontSize: "inherit",
});

globalStyle(`${commentBody} table`, {
  display: "block",
  maxWidth: "100%",
  overflowX: "auto",
  margin: `0 0 ${vars.space[8]}`,
  borderCollapse: "collapse",
});

globalStyle(`${commentBody} td, ${commentBody} th`, {
  padding: `${vars.space[4]} ${vars.space[8]}`,
  border: `1px solid ${vars.color.border}`,
});

globalStyle(`${commentBody} th`, {
  background: vars.color.surfaceMuted,
  fontWeight: 600,
  textAlign: "left",
});

export const replyForm = style({
  display: "grid",
  gap: vars.space[8],
});

export const textarea = style({
  minHeight: "78px",
  resize: "vertical",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  color: vars.color.textStrong,
  padding: vars.space[8],
});

export const replyActions = style({
  display: "flex",
  justifyContent: "flex-end",
});

export const commentsView = style({
  display: "grid",
  gap: vars.space[12],
});

export const commentsPager = style({
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});

export const commentsSentinel = style({
  display: "flex",
  justifyContent: "center",
  minHeight: "48px",
  padding: vars.space[8],
});

export const empty = style({
  padding: vars.space[16],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  color: vars.color.textMuted,
  fontSize: vars.fontSize.sm,
});
