import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Gem } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";

const AuthLayout = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isRTL = language === "ur";

  return (
    <div 
      className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-900"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Outlet />
      </div>

      {/* Bottom Glow */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-yellow-500/5 to-transparent" />
    </div>
  );
};

export default AuthLayout;