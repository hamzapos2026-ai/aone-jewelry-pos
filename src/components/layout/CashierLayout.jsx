import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Header from "./header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";

const CashierLayout = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isRTL = language === "ur";
  const user = JSON.parse(localStorage.getItem("session") || "{}");

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-900"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="cashier"
      />

      <div className={`relative flex min-h-screen flex-col transition-all duration-300 ${
        isRTL
          ? sidebarCollapsed ? "lg:mr-20" : "lg:mr-64"
          : sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      }`}>
        <Header user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} isSidebarOpen={sidebarOpen} />
        <main className="flex-1 p-4 lg:p-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Outlet />
          </motion.div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default CashierLayout;