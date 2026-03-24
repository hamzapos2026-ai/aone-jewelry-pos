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
    // Backgrounds
    bg: "bg-gray-950",
    bgSecondary: "bg-gray-900",
    bgCard: "bg-white/5 backdrop-blur-xl",
    bgHover: "hover:bg-white/10",
    
    // Borders
    border: "border-yellow-500/30",
    borderHover: "hover:border-yellow-500/50",
    borderActive: "border-yellow-500",
    
    // Text
    text: "text-white",
    textSecondary: "text-gray-400",
    textMuted: "text-gray-500",
    textAccent: "text-yellow-500",
    
    // Components
    sidebar: "bg-black/40 backdrop-blur-xl border-r border-yellow-500/20",
    header: "bg-black/40 backdrop-blur-xl border-b border-yellow-500/20",
    footer: "bg-black/40 backdrop-blur-xl border-t border-yellow-500/20",
    
    // Inputs & Dropdowns
    input: "bg-white/5 border-2 border-yellow-500/30 hover:border-yellow-500/50 focus:border-yellow-500",
    dropdown: "bg-gray-900/95 backdrop-blur-xl border-2 border-yellow-500/30",
    
    // Buttons
    btnPrimary: "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30",
    btnSecondary: "bg-white/5 border-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10",
    btnGhost: "text-gray-400 hover:text-white hover:bg-white/10",
    
    // States
    active: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    hover: "hover:bg-white/5 hover:text-white",
  },
  
  light: {
    // Backgrounds
    bg: "bg-gray-900",
    bgSecondary: "bg-gray-800",
    bgCard: "bg-white/95",
    bgHover: "hover:bg-gray-100",
    
    // Borders
    border: "border-yellow-300",
    borderHover: "hover:border-yellow-500",
    borderActive: "border-yellow-500",
    
    // Text
    text: "text-gray-900",
    textSecondary: "text-gray-600",
    textMuted: "text-gray-500",
    textAccent: "text-yellow-600",
    
    // Components
    sidebar: "bg-white border-r border-yellow-200",
    header: "bg-white/95 backdrop-blur-sm border-b border-yellow-200 shadow-sm",
    footer: "bg-white/95 backdrop-blur-sm border-t border-yellow-200",
    
    // Inputs & Dropdowns
    input: "bg-white border-2 border-yellow-400/50 hover:border-yellow-500 focus:border-yellow-500",
    dropdown: "bg-white border-2 border-yellow-400/50",
    
    // Buttons
    btnPrimary: "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/30",
    btnSecondary: "bg-white border-2 border-yellow-300 text-amber-600 hover:bg-yellow-50",
    btnGhost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
    
    // States
    active: "bg-yellow-100 text-yellow-700 border border-yellow-300",
    hover: "hover:bg-yellow-50 hover:text-yellow-600",
  },
};

// Get theme helper
export const getTheme = (isDark) => (isDark ? theme.dark : theme.light);

// Common styles
export const commonStyles = {
  goldGradient: "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500",
  goldGradientHover: "hover:from-yellow-500 hover:via-amber-500 hover:to-yellow-500",
  goldBorder: "border-2 border-yellow-500/30",
  glassEffect: "backdrop-blur-xl bg-white/5",
  goldGlow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
  goldShadow: "shadow-lg shadow-yellow-500/30",
  transition: "transition-all duration-300",
};

// Toast styles
export const toastStyle = {
  borderRadius: "12px",
  background: "#111",
  color: "#fbbf24",
  border: "1px solid rgba(251,191,36,0.3)",
};