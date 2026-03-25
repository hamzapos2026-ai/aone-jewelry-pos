import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "./header";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { getTheme } from "../../utils/colors";

const SuperAdminLayout = () => {
  const { userData } = useAuth();
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isRTL = language === "ur";
  const th = getTheme(isDark);

  const user = {
    name: userData?.name || "Super Admin",
    email: userData?.email || "superadmin@example.com",
    role: userData?.role || "superadmin",
    avatar: userData?.avatar || null,
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
      }`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        userRole="superadmin"
      />

      {/* Main Content Wrapper */}
      <div
        className={`flex min-h-screen flex-col transition-all duration-300 ${
          isRTL
            ? isCollapsed
              ? "lg:pr-20"
              : "lg:pr-64"
            : isCollapsed
            ? "lg:pl-20"
            : "lg:pl-64"
        }`}
      >
        {/* Header */}
        <Header
          user={user}
          onMenuClick={() => setIsSidebarOpen(true)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default SuperAdminLayout;