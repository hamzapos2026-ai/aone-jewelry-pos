import { Routes, Route, Navigate } from "react-router-dom";
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
import ManagerDashboard from "../pages/manager/Dashboard";
import CashierDashboard from "../pages/cashier/Dashboard";
import BillerDashboard from "../pages/biller/Dashboard";
import SuperAdminDashboard from "../pages/superadmin/Dashboard";
import SuperAdminUsers from "../pages/superadmin/Users";
import SuperAdminStores from "../pages/superadmin/Stores";
import SuperAdminCreateStore from "../pages/superadmin/CreateStore";
import SuperAdminLoginLogs from "../pages/superadmin/LoginLogs";

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

  // =========================
  // OFFLINE FIRST PRIORITY
  // =========================
  if (!isOnline) {
    return (
      <Routes>
        <Route path="*" element={<Offline />} />
      </Routes>
    );
  }

  // Show loading while checking setup status
  if (loading) {
    return <LoadingScreen />;
  }

  // ============================================
  // IF SETUP NOT COMPLETE - ONLY SHOW SETUP PAGE
  // ============================================
  if (!setupComplete) {
    return (
      <Routes>
        <Route path="/" element={<SuperAdminSetup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ============================================
  // SETUP COMPLETE - NORMAL ROUTES
  // ============================================
  return (
    <Routes>
      {/* ==================== SYSTEM ROUTES ==================== */}
      <Route path="/offline" element={<Offline />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* ==================== PUBLIC ROUTES ==================== */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ==================== SUPER ADMIN ==================== */}
      <Route
        path="/superadmin"
        element={
          <RoleBasedRoute allowedRoles={["superadmin"]}>
            <SuperAdminLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="users" element={<SuperAdminUsers />} />
        <Route path="stores" element={<SuperAdminStores />} />
        <Route path="create-store" element={<SuperAdminCreateStore />} />
        <Route path="login-logs" element={<SuperAdminLoginLogs />} />
      </Route>

      {/* ==================== ADMIN ==================== */}
      <Route
        path="/admin"
        element={
          <RoleBasedRoute allowedRoles={["admin", "superadmin"]}>
            <AdminLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
      </Route>

      {/* ==================== MANAGER ==================== */}
      <Route
        path="/manager"
        element={
          <RoleBasedRoute allowedRoles={["manager"]}>
            <ManagerLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
      </Route>

      {/* ==================== CASHIER ==================== */}
      <Route
        path="/cashier"
        element={
          <RoleBasedRoute allowedRoles={["cashier"]}>
            <CashierLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CashierDashboard />} />
      </Route>

      {/* ==================== BILLER ==================== */}
      <Route
        path="/biller"
        element={
          <RoleBasedRoute allowedRoles={["biller"]}>
            <BillerLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BillerDashboard />} />
      </Route>

      {/* ==================== DEFAULT ROUTES ==================== */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;