import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`rounded-xl border-2 p-2.5 transition-all ${
        isDark
          ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
          : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
      }`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;