import { Lock, Heart } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { getTheme } from "../../utils/colors";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const Footer = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const th = getTheme(isDark);
  const t = language === "ur" ? ur : en;

  return (
    <footer className={th.footer}>
      <div className="flex flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row">
        {/* Copyright */}
        <div className="text-sm text-gray-500">
          {t.footer?.copyright || "© 2024 A ONE JEWELRY"}
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-gray-500">{t.common?.online || "Online"}</span>
          </span>
          <span className="text-yellow-500/50">•</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <Lock size={10} className="text-yellow-500" />
            SSL
          </span>
          <span className="text-yellow-500/50">•</span>
          <span className="text-xs text-gray-500">{t.common?.version || "v"} 2.0</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4">
          <a href="#" className={`text-xs font-medium transition-colors text-gray-500 ${isDark ? "hover:text-yellow-500" : "hover:text-yellow-600"}`}>
            {t.footer?.support || "Support"}
          </a>
          <a href="#" className={`text-xs font-medium transition-colors text-gray-500 ${isDark ? "hover:text-yellow-500" : "hover:text-yellow-600"}`}>
            {t.footer?.documentation || "Docs"}
          </a>
          <a href="#" className={`text-xs font-medium transition-colors text-gray-500 ${isDark ? "hover:text-yellow-500" : "hover:text-yellow-600"}`}>
            {t.footer?.privacy || "Privacy"}
          </a>
        </div>
      </div>

      {/* Made with love */}
      <div className={`border-t py-2 text-center text-xs ${isDark ? "border-yellow-500/10 text-gray-600" : "border-yellow-200 text-gray-500"}`}>
        {t.footer?.madeWith || "Made with"} <Heart size={12} className="mx-1 inline text-red-500" /> A ONE JEWELRY
      </div>
    </footer>
  );
};

export default Footer;