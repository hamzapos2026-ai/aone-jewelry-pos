import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSetup } from "../context/SetupContext";
import { useEffect, useState } from "react";
import useNetworkStatus from "../hooks/useNetworkStatus";

// ==========================================
// Loading Screen
// ==========================================
const LoadingScreen = ({ text = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-yellow-900">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="mt-4 text-yellow-400 font-semibold text-lg">{text}</p>
    </div>
  </div>
);

// ==========================================
// Role Dashboard Paths
// ==========================================
const ROLE_DASHBOARD_PATHS = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  manager: "/manager/dashboard",
  cashier: "/cashier/dashboard",
  biller: "/biller/dashboard",
};

// ==========================================
// Public Route
// ==========================================
export const PublicRoute = ({ children }) => {
  const { currentUser, userData, loading } = useAuth();
  const { setupComplete, loading: setupLoading } = useSetup();
  const isOnline = useNetworkStatus();

  // Offline first
  if (!isOnline) {
    return <Navigate to="/offline" replace />;
  }

  if (loading || setupLoading) {
    return <LoadingScreen text="Checking session..." />;
  }

  if (setupComplete === false) {
    return <Navigate to="/" replace />;
  }

  // If firebase user exists but userData still loading, wait
  if (currentUser && !userData) {
    return <LoadingScreen text="Loading user profile..." />;
  }

  if (currentUser && userData?.role) {
    const redirectPath = ROLE_DASHBOARD_PATHS[userData.role] || "/login";
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

// ==========================================
// Role Based Route
// ==========================================
export const RoleBasedRoute = ({ children, allowedRoles = [] }) => {
  const { currentUser, userData, loading } = useAuth();
  const { setupComplete, loading: setupLoading } = useSetup();
  const location = useLocation();
  const isOnline = useNetworkStatus();

  const [profileWaitDone, setProfileWaitDone] = useState(false);

  useEffect(() => {
    let timer;

    if (currentUser && !userData && !loading) {
      setProfileWaitDone(false);
      timer = setTimeout(() => {
        setProfileWaitDone(true);
      }, 2000);
    } else {
      setProfileWaitDone(false);
    }

    return () => clearTimeout(timer);
  }, [currentUser, userData, loading]);

  // Offline first
  if (!isOnline) {
    return <Navigate to="/offline" replace />;
  }

  // Main loading
  if (loading || setupLoading) {
    return <LoadingScreen text="Checking access..." />;
  }

  // Setup incomplete
  if (setupComplete === false) {
    return <Navigate to="/" replace />;
  }

  // No logged-in user
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but Firestore profile still loading
  if (currentUser && !userData && !profileWaitDone) {
    return <LoadingScreen text="Loading user data..." />;
  }

  // After waiting, still no userData
  if (currentUser && !userData && profileWaitDone) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (allowedRoles.length > 0 && !allowedRoles.includes(userData.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default RoleBasedRoute;