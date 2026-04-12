import { createContext, useContext, useEffect, useState } from "react";

// Create Context
const ThemeContext = createContext(null);

// Theme Provider Component
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("theme", theme);

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setIsDark = (value) => {
    setTheme(value ? "dark" : "light");
  };

  const value = {
    theme,
    isDark,
    setTheme,
    setIsDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// useTheme Hook
const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Exports
export { ThemeContext, ThemeProvider, useTheme };
export default ThemeContext;