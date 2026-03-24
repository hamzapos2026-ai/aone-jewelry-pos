// src/hooks/useRoleRedirect.js
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleRedirectPath } from "../utils/roleRedirects";

export const useRoleRedirect = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const redirectToRoleDashboard = () => {
    if (user?.role) {
      const path = getRoleRedirectPath(user.role);
      navigate(path, { replace: true });
    }
  };

  const getRedirectPath = () => {
    return user?.role ? getRoleRedirectPath(user.role) : "/login";
  };

  return { redirectToRoleDashboard, getRedirectPath };
};

export default useRoleRedirect;