import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css";

globalStyle("html, body, #app", {
  minHeight: "100%",
});

globalStyle("body", {
  margin: 0,
  background: vars.color.canvas,
  color: vars.color.textStrong,
  fontFamily: vars.font.sans,
  lineHeight: 1.5,
  letterSpacing: 0,
});

globalStyle("*, *::before, *::after", {
  boxSizing: "border-box",
});

globalStyle("button, input, textarea", {
  font: "inherit",
});

globalStyle("button:focus-visible, input:focus-visible, textarea:focus-visible", {
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: "2px",
});

globalStyle("a", {
  color: "inherit",
  textDecoration: "none",
});

// Browsers default tabs to 8 columns, which pushes indented code far right in narrow diff columns.
globalStyle("pre", {
  tabSize: 4,
});

globalStyle("img", {
  display: "block",
  maxWidth: "100%",
});

globalStyle("::selection", {
  background: vars.color.accentSoft,
});
