import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/auth/Login";
import SuperAdminDashboard from "../pages/superadmin/Dashboard";
import AdminDashboard from "../pages/admin/Dashboard";
import ManagerDashboard from "../pages/manager/Dashboard";
import BillerDashboard from "../pages/biller/Dashboard";
import CashierDashboard from "../pages/cashier/Dashboard";

import RoleBasedRoute from "./RoleBasedRoute";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/superadmin"
        element={
          <RoleBasedRoute allowedRoles={["superadmin"]}>
            <SuperAdminDashboard />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <RoleBasedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/manager"
        element={
          <RoleBasedRoute allowedRoles={["manager"]}>
            <ManagerDashboard />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/biller"
        element={
          <RoleBasedRoute allowedRoles={["biller"]}>
            <BillerDashboard />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/cashier"
        element={
          <RoleBasedRoute allowedRoles={["cashier"]}>
            <CashierDashboard />
          </RoleBasedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;