export const colors = {
  brand: {
    pink: "#E91E63",
    pinkLight: "#FF4081",
    pinkDark: "#C2185B",
  },
  bg: {
    primary: "#FFFFFF",
    elevated: "#FFFFFF",
    subtle: "#FAFAFA",
    pressed: "#F5F5F5",
    dark: "#0A0A0A",
    darkElevated: "#1A1A1A",
    darkSubtle: "#111111",
  },
  text: {
    primary: "#111111",
    secondary: "#666666",
    muted: "#8A8A8A",
    inverse: "#FFFFFF",
    darkPrimary: "#FFFFFF",
    darkSecondary: "#AAAAAA",
    darkMuted: "#777777",
  },
  semantic: {
    success: "#4CAF50",
    warning: "#FF9800",
    error: "#F44336",
    info: "#2196F3",
  },
  border: {
    subtle: "#F0F0F0",
    default: "#E0E0E0",
    dark: "#333333",
    darkSubtle: "#222222",
  },
} as const;

export const typography = {
  fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
  display: "2.5rem",
  h1: "1.5rem",
  h2: "1.25rem",
  h3: "1.125rem",
  body: "0.9375rem",
  caption: "0.8125rem",
  small: "0.75rem",
} as const;

export const spacing = {
  1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px",
  6: "24px", 8: "32px", 10: "40px", 12: "48px", 16: "64px",
} as const;

export const radius = {
  sm: "8px", md: "12px", lg: "16px", xl: "24px", full: "9999px",
} as const;

export const shadows = {
  sm: "0 2px 8px rgba(0,0,0,0.04)",
  md: "0 4px 16px rgba(0,0,0,0.06)",
  lg: "0 8px 32px rgba(0,0,0,0.08)",
  darkSm: "0 2px 8px rgba(0,0,0,0.2)",
  darkMd: "0 4px 16px rgba(0,0,0,0.3)",
  darkLg: "0 8px 32px rgba(0,0,0,0.4)",
} as const;
