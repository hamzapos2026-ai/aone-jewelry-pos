// src/utils/roleRedirects.js

export const ROLE_REDIRECTS = {
  superadmin: "/superadmin/dashboard",
  admin: "/admin/dashboard",
  manager: "/manager/dashboard",
  cashier: "/cashier/dashboard",   // ✅ Fixed
  biller: "/biller/dashboard",      // ✅ Fixed (was /billing/pos)
};

export const getRoleRedirectPath = (role) => {
  return ROLE_REDIRECTS[role] || "/login";
};

export const ROLE_PERMISSIONS = {
  superadmin: ["all"],
  admin: ["dashboard", "inventory", "reports", "users", "settings"],
  manager: ["dashboard", "inventory", "reports"],
  cashier: ["dashboard", "pos", "sales"],
  biller: ["dashboard", "pos", "billing", "khata"],
};