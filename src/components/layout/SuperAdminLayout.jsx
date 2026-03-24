import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "./header";
import Footer from "./Footer";
import { useTheme } from "../../hooks/useTheme";

const SuperAdminLayout = () => {
  const { userData } = useAuth();
  const { isDark } = useTheme();

  const user = {
    name: userData?.name || "Super Admin",
    email: userData?.email || "superadmin@example.com",
    role: userData?.role || "superadmin",
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <Header user={user} onMenuClick={() => {}} isSidebarOpen={false} />

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default SuperAdminLayout;