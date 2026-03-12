// src/config/colors.js

// Primary Gold Colors
export const goldColors = {
  50: "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  300: "#fcd34d",
  400: "#fbbf24",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  900: "#78350f",
};

// Theme Configuration
export const theme = {
  dark: {
    bg: "bg-gray-950",
    bgGradient: "bg-linear-to-br from-gray-950 via-black to-gray-900",
    card: "bg-white/5 border-yellow-500/30",
    cardGlow: "shadow-yellow-500/10",
    input: "bg-white/5 border-yellow-500/30 hover:border-yellow-500/50",
    text: "text-white",
    textMuted: "text-gray-400",
    textAccent: "text-yellow-400",
    border: "border-yellow-500/30",
    accent: "yellow-500",
  },
  light: {
    bg: "bg-gray-900",
    bgGradient: "bg-linear-to-br from-gray-900 via-gray-800 to-gray-900",
    card: "bg-gray-800/90 border-yellow-500/40",
    cardGlow: "shadow-yellow-500/20",
    input: "bg-gray-700/50 border-yellow-500/40 hover:border-yellow-500/60",
    text: "text-white",
    textMuted: "text-gray-300",
    textAccent: "text-yellow-400",
    border: "border-yellow-500/40",
    accent: "yellow-400",
  },
};

// Get theme based on isDark
export const getTheme = (isDark) => isDark ? theme.dark : theme.light;

// Common styles
export const commonStyles = {
  goldButton: "bg-linear-to-r from-yellow-500 via-amber-500 to-yellow-500 text-black shadow-lg shadow-yellow-500/40",
  goldBorder: "border-2 border-yellow-500/30",
  glassEffect: "backdrop-blur-xl bg-white/5",
  goldGlow: "shadow-[0_0_20px_rgba(234,179,8,0.2)]",
};

// Toast styles
export const toastStyle = {
  borderRadius: "12px",
  background: "#1a1a1a",
  color: "#fbbf24",
  border: "1px solid rgba(234,179,8,0.3)",
};