// ======================================================
// RoleBasedRoute.jsx
// ======================================================
// Ye component:
// 1. Login check karta hai
// 2. Role check karta hai
// 3. Store isolation enforce karta hai
// ======================================================

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

const RoleBasedRoute = ({ children, allowedRoles }) => {

  const { user } = useAuth();
  const { store } = useStore();

  // ✅ Not logged in
  if (!user) {
    return <Navigate to="/login" />;
  }

  // ✅ Role check
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/login" />;
  }

  // ✅ Store isolation check (except superadmin)
  if (user.role !== "superadmin" && store && user.storeId !== store.id) {
    return <Navigate to="/login" />;
  }

  return children;
};

export default RoleBasedRoute;