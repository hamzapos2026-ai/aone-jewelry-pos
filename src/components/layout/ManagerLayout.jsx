import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Header from "./header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";

const ManagerLayout = () => {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isRTL = language === "ur";
  const user = JSON.parse(localStorage.getItem("session") || "{}");

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div 
      className={`min-h-screen ${isDark ? "bg-gray-950" : "bg-gray-900"}`} 
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0">
        {/* Gradient Orbs */}
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-yellow-500/3 blur-3xl" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"
          style={{
            maskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
          }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="manager"
      />

      {/* Main Content Area */}
      <div
        className={`relative flex min-h-screen flex-col transition-all duration-300 ${
          isRTL
            ? sidebarCollapsed 
              ? "lg:mr-20" 
              : "lg:mr-64"
            : sidebarCollapsed 
              ? "lg:ml-20" 
              : "lg:ml-64"
        }`}
      >
        {/* Header */}
        <Header
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default ManagerLayout;