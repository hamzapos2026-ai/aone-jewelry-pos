import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSetup } from "../context/SetupContext";
import useNetworkStatus from "../hooks/useNetworkStatus";

// ==================== SETUP ====================
import SuperAdminSetup from "../pages/setup/SetupPage";

// ==================== AUTH PAGES ====================
import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Register from "../pages/auth/Register";
import ResetPassword from "../pages/auth/ResetPassword";
import Offline from "../pages/auth/Offline";
import Unauthorized from "../pages/auth/Unauthorized";
import NotFound from "../pages/auth/NotFound";

// ==================== LAYOUTS ====================
import AdminLayout from "../components/layout/AdminLayout";
import CashierLayout from "../components/layout/CashierLayout";
import ManagerLayout from "../components/layout/ManagerLayout";
import BillerLayout from "../components/layout/BillerLayout";
import SuperAdminLayout from "../components/layout/SuperAdminLayout";

// ==================== DASHBOARDS ====================
import AdminDashboard from "../pages/admin/Dashboard";
import AdminDeletedBills from "../pages/admin/DeletedBills";
import ManagerDashboard from "../pages/manager/Dashboard";
import CashierDashboard from "../pages/cashier/Dashboard";
import BillerDashboard from "../pages/biller/Dashboard";
import BillerPOS from "../pages/biller/POS";
import BillerSalesHistory from "../pages/biller/SalesHistory";
import SuperAdminDashboard from "../pages/superadmin/Dashboard";
import SuperAdminUsers from "../pages/superadmin/Users";
import SuperAdminBillers from "../pages/superadmin/Billers";
import SuperAdminStores from "../pages/superadmin/Stores";
import SuperAdminCreateStore from "../pages/superadmin/CreateStore";
import SuperAdminLoginLogs from "../pages/superadmin/LoginLogs";
import SuperAdminSettings from "../pages/superadmin/Settings";

// ==================== ROUTE GUARDS ====================
import { RoleBasedRoute, PublicRoute } from "./RoleBasedRoute";

// ==================== LOADING SCREEN ====================
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-yellow-900">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="mt-4 text-yellow-400 font-semibold text-lg">Checking setup...</p>
    </div>
  </div>
);

// ==================== MAIN ROUTES ====================
const AppRoutes = () => {
  const { setupComplete, loading } = useSetup();
  const isOnline = useNetworkStatus();
  const location = useLocation();

  // Helper function to get offline auth state
  const getOfflineAuthState = () => {
    try {
      const user = localStorage.getItem("user");
      const userData = localStorage.getItem("userData");
      return {
        user: user ? JSON.parse(user) : null,
        userData: userData ? JSON.parse(userData) : null
      };
    } catch (error) {
      console.error("Error parsing offline auth state:", error);
      return { user: null, userData: null };
    }
  };

  // Check setup status with localStorage fallback
  const isSetupComplete = setupComplete || localStorage.getItem("setupComplete") === "true";

  // ✅ Check if current path is biller route
  const isBillerRoute = location.pathname.startsWith("/biller");

  // ✅ OFFLINE HANDLING
  if (!isOnline) {
    // If setup not complete, show offline page
    if (!isSetupComplete) {
      return (
        <Routes>
          <Route path="/" element={<Offline setupIncomplete={true} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // Setup complete, check auth state from localStorage
    const { user, userData } = getOfflineAuthState();

    // If not logged in, redirect to login
    if (!user || !userData) {
      return (
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // If logged in but not biller, show offline page for valid routes, 404 for invalid
    if (userData.role !== "biller") {
      return (
        <Routes>
          <Route path="/offline" element={<Offline />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // If biller and on biller route, allow access
    if (userData.role === "biller" && isBillerRoute) {
      return (
        <Routes>
          <Route path="/biller" element={<BillerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<BillerDashboard />} />
            <Route path="pos" element={<BillerPOS />} />
            <Route path="sales-history" element={<BillerSalesHistory />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // Biller trying to access non-biller routes, show 404 for invalid routes
    if (userData.role === "biller" && !isBillerRoute) {
      return (
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }

    // Fallback - show 404 page
    return (
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Show loading while checking setup status (ONLINE ONLY)
  if (loading) {
    return <LoadingScreen />;
  }

  // IF SETUP NOT COMPLETE - ONLY SHOW SETUP PAGE
  if (!isSetupComplete) {
    return (
      <Routes>
        <Route path="/" element={<SuperAdminSetup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // SETUP COMPLETE - NORMAL ROUTES
  return (
    <Routes>
      {/* ==================== SYSTEM ROUTES ==================== */}
      <Route path="/offline" element={<Offline />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* ==================== PUBLIC ROUTES ==================== */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ==================== SUPER ADMIN ==================== */}
      <Route path="/superadmin" element={<RoleBasedRoute allowedRoles={["superadmin"]}><SuperAdminLayout /></RoleBasedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="billers" element={<SuperAdminBillers />} />
        <Route path="stores" element={<SuperAdminStores />} />
        <Route path="create-store" element={<SuperAdminCreateStore />} />
        <Route path="login-logs" element={<SuperAdminLoginLogs />} />
        <Route path="settings" element={<SuperAdminSettings />} />
      </Route>

      {/* ==================== ADMIN ==================== */}
      <Route path="/admin" element={<RoleBasedRoute allowedRoles={["admin", "superadmin"]}><AdminLayout /></RoleBasedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="deleted-bills" element={<AdminDeletedBills />} />
      </Route>

      {/* ==================== MANAGER ==================== */}
      <Route path="/manager" element={<RoleBasedRoute allowedRoles={["manager"]}><ManagerLayout /></RoleBasedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
      </Route>

      {/* ==================== CASHIER ==================== */}
      <Route path="/cashier" element={<RoleBasedRoute allowedRoles={["cashier"]}><CashierLayout /></RoleBasedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CashierDashboard />} />
      </Route>

      {/* ==================== BILLER ==================== */}
      <Route path="/biller" element={<RoleBasedRoute allowedRoles={["biller"]}><BillerLayout /></RoleBasedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BillerDashboard />} />
        <Route path="pos" element={<BillerPOS />} />
        <Route path="sales-history" element={<BillerSalesHistory />} />
      </Route>

      {/* ==================== DEFAULT ==================== */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;