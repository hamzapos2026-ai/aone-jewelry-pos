// components/layout/Footer.jsx
import { Lock, Heart, Gem } from "lucide-react";
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
  const isRTL = language === "ur";

  // Dynamic year
  const currentYear = new Date().getFullYear();

  return (
    <footer className={th.footer} dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex flex-col items-center justify-between gap-4 px-6 py-4 sm:flex-row">
        {/* Copyright with Logo */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 p-1.5 shadow-lg shadow-yellow-500/25">
            <Gem size={14} className="text-white" />
          </div>
          <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            © {currentYear}{" "}
            <span className="font-semibold text-yellow-500">A ONE</span>{" "}
            JEWELRY
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className={isDark ? "text-gray-400" : "text-gray-500"}>
              {t.common?.online || "Online"}
            </span>
          </span>
          <span className="text-yellow-500/50">•</span>
          <span className="flex items-center gap-1.5 text-xs">
            <Lock size={10} className="text-yellow-500" />
            <span className={isDark ? "text-gray-400" : "text-gray-500"}>
              SSL
            </span>
          </span>
          <span className="text-yellow-500/50">•</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isDark
                ? "bg-yellow-500/10 text-yellow-500"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            v2.0
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4">
          <a
            href="#"
            className={`text-xs font-medium transition-colors ${
              isDark
                ? "text-gray-400 hover:text-yellow-500"
                : "text-gray-500 hover:text-yellow-600"
            }`}
          >
            {t.footer?.support || "Support"}
          </a>
          <a
            href="#"
            className={`text-xs font-medium transition-colors ${
              isDark
                ? "text-gray-400 hover:text-yellow-500"
                : "text-gray-500 hover:text-yellow-600"
            }`}
          >
            {t.footer?.documentation || "Docs"}
          </a>
          <a
            href="#"
            className={`text-xs font-medium transition-colors ${
              isDark
                ? "text-gray-400 hover:text-yellow-500"
                : "text-gray-500 hover:text-yellow-600"
            }`}
          >
            {t.footer?.privacy || "Privacy"}
          </a>
        </div>
      </div>

      {/* Made with love */}
      <div
        className={`border-t py-2 text-center text-xs ${
          isDark
            ? "border-yellow-500/10 text-gray-500"
            : "border-yellow-200 text-gray-500"
        }`}
      >
     
      </div>
    </footer>
  );
};

export default Footer;