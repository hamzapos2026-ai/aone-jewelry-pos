// src/components/layouts/AdminLayout.jsx
import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { logoutUser } from "../../services/authService";
import { LayoutDashboard, Users, Package, BarChart3, Settings, LogOut, Menu, X, Bell } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/inventory", label: "Inventory", icon: Package },
    { path: "/admin/reports", label: "Reports", icon: BarChart3 },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className={`bg-gradient-to-b from-amber-800 to-amber-900 text-white transition-all duration-300 ${sidebarOpen ? "w-64" : "w-20"} min-h-screen fixed left-0 top-0 z-30`}>
        <div className="p-4 flex items-center justify-between border-b border-amber-700">
          {sidebarOpen && <span className="font-bold text-lg">Admin Panel</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-amber-700 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`flex items-center gap-3 p-3 rounded-lg transition ${isActive ? "bg-amber-600" : "hover:bg-amber-700"}`}>
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-4">
          <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full text-red-200 hover:bg-red-600 rounded-lg">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 ${sidebarOpen ? "ml-64" : "ml-20"} transition-all`}>
        <header className={`shadow-sm h-16 flex items-center justify-between px-6 sticky top-0 z-20 ${isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
          <div>
            <h2 className="text-xl font-semibold">{language === "ur" ? "ایڈمن ڈیش بورڈ" : "Admin Dashboard"}</h2>
            <p className="text-xs text-gray-500">{language === "ur" ? "خوش آمدید" : "Welcome back"}, {user?.name || "Admin"}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Bell className={`w-5 h-5 ${isDark ? "text-yellow-400" : "text-gray-600"}`} />
            <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white">{user?.name?.charAt(0) || "A"}</div>
          </div>
        </header>

        <main className="p-6 min-h-[calc(100vh-126px)] bg-slate-50 dark:bg-slate-900 transition-colors duration-300"><Outlet /></main>

        <footer className={`border-t p-4 text-center ${isDark ? "bg-slate-950 text-gray-300" : "bg-white text-gray-700"}`}>
          <p className="text-sm">
            {language === "ur" ? "© 2026 A ONE JEWELRY. تمام حقوق محفوظ ہیں۔" : "© 2026 A ONE JEWELRY. All rights reserved."}
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;