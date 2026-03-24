import { Languages } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";

const LanguageSwitcher = () => {
  const { isDark } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-all ${
        isDark
          ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
          : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
      }`}
    >
      <Languages size={18} />
      <span className="text-sm font-medium">{language === "en" ? "EN" : "اردو"}</span>
    </button>
  );
};

export default LanguageSwitcher;