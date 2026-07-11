import { createGlobalTheme } from "@vanilla-extract/css";

export const vars = createGlobalTheme(":root", {
  color: {
    canvas: "#f7f8fa",
    surface: "#ffffff",
    surfaceMuted: "#f1f3f5",
    border: "#e1e5ea",
    textStrong: "#111418",
    textMuted: "#667085",
    accent: "#2563eb",
    accentSoft: "#eff4ff",
    success: "#16803c",
    successSoft: "#eef8f1",
    warning: "#946200",
    warningSoft: "#fff7e6",
    danger: "#b42318",
    dangerSoft: "#fff1f0",
    neutral: "#5f6b7a",
    neutralSoft: "#f3f5f7",
  },
  space: {
    4: "4px",
    8: "8px",
    12: "12px",
    16: "16px",
    20: "20px",
    24: "24px",
    32: "32px",
    40: "40px",
    56: "56px",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    pill: "999px",
  },
  font: {
    sans: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  fontSize: {
    xs: "12px",
    sm: "14px",
    md: "16px",
    lg: "17px",
    xl: "24px",
    hero: "36px",
  },
});

export const breakpoints = {
  mobile: "screen and (max-width: 719px)",
  tablet: "screen and (max-width: 1023px)",
};
