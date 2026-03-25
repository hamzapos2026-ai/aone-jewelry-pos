// components/layout/Sidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Warehouse,
  TrendingUp,
  Receipt,
  FileText,
  Users,
  Settings,
  Building2,
  CreditCard,
  Server,
  ChevronLeft,
  ChevronRight,
  Gem,
  X,
  Wallet,
  BookOpen,
  UserCog,
  UserCheck,
  Calculator,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { getTheme } from "../../utils/colors";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

// Menu items by role
const menuConfig = {
  superadmin: [
    { id: "dashboard", icon: LayoutDashboard, path: "/superadmin" },
    { id: "users", icon: Users, path: "/superadmin/users" },
    
    { id: "admins", icon: UserCog, path: "/superadmin/admins" },
    { id: "billers", icon: Receipt, path: "/superadmin/billers" },
    { id: "cashiers", icon: Calculator, path: "/superadmin/cashiers" },
    { id: "managers", icon: ClipboardList, path: "/superadmin/managers" },
    { id: "reports", icon: FileText, path: "/superadmin/reports" },
    { id: "subscription", icon: CreditCard, path: "/superadmin/subscription" },
    { id: "settings", icon: Settings, path: "/superadmin/settings" },
    { id: "system", icon: Server, path: "/superadmin/system" },
  ],
  admin: [
    { id: "dashboard", icon: LayoutDashboard, path: "/admin" },
    { id: "pos", icon: ShoppingCart, path: "/admin/pos" },
    { id: "products", icon: Package, path: "/admin/products" },
    { id: "categories", icon: Tags, path: "/admin/categories" },
    { id: "inventory", icon: Warehouse, path: "/admin/inventory" },
    { id: "sales", icon: TrendingUp, path: "/admin/sales" },
    { id: "bills", icon: Receipt, path: "/admin/bills" },
    { id: "cashflow", icon: Wallet, path: "/admin/cashflow" },
    { id: "khata", icon: BookOpen, path: "/admin/khata" },
    { id: "reports", icon: FileText, path: "/admin/reports" },
    { id: "users", icon: Users, path: "/admin/users" },
    { id: "settings", icon: Settings, path: "/admin/settings" },
  ],
  manager: [
    { id: "dashboard", icon: LayoutDashboard, path: "/manager" },
    { id: "inventory", icon: Warehouse, path: "/manager/inventory" },
    { id: "products", icon: Package, path: "/manager/products" },
    { id: "sales", icon: TrendingUp, path: "/manager/sales" },
    { id: "reports", icon: FileText, path: "/manager/reports" },
    { id: "settings", icon: Settings, path: "/manager/settings" },
  ],
  cashier: [
    { id: "dashboard", icon: LayoutDashboard, path: "/cashier" },
    { id: "pos", icon: ShoppingCart, path: "/cashier/pos" },
    { id: "sales", icon: TrendingUp, path: "/cashier/sales" },
    { id: "transactions", icon: Receipt, path: "/cashier/transactions" },
    { id: "settings", icon: Settings, path: "/cashier/settings" },
  ],
  biller: [
    { id: "dashboard", icon: LayoutDashboard, path: "/biller" },
    { id: "pos", icon: ShoppingCart, path: "/biller/pos" },
    { id: "sales", icon: TrendingUp, path: "/biller/sales" },
    { id: "bills", icon: Receipt, path: "/biller/bills" },
    { id: "settings", icon: Settings, path: "/biller/settings" },
  ],
};

const Sidebar = ({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  userRole = "admin",
}) => {
  const location = useLocation();
  const { isDark } = useTheme();
  const { language } = useLanguage();

  const th = getTheme(isDark);
  const t = language === "ur" ? ur : en;
  const menuItems = menuConfig[userRole] || menuConfig.admin;
  const isRTL = language === "ur";

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 z-50 h-full transition-all duration-300 ${
          isRTL ? "right-0" : "left-0"
        } ${th.sidebar} ${
          isOpen
            ? "translate-x-0"
            : isRTL
            ? "translate-x-full"
            : "-translate-x-full"
        } lg:translate-x-0 ${isCollapsed ? "w-20" : "w-64"}`}
      >
        {/* Logo Section */}
        <div
          className={`flex h-16 items-center justify-between border-b px-4 ${
            isDark ? "border-yellow-500/20" : "border-yellow-200"
          }`}
        >
          <div
            className={`flex items-center gap-3 ${
              isCollapsed ? "w-full justify-center" : ""
            }`}
          >
            <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-2 shadow-lg shadow-yellow-500/25">
              <Gem size={20} className="text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="overflow-hidden"
              >
                <h1
                  className={`text-lg font-bold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  A ONE
                </h1>
                <p className="text-xs text-yellow-500">JEWELRY</p>
              </motion.div>
            )}
          </div>

          {/* Mobile Close */}
          <button
            onClick={onClose}
            className={`rounded-lg p-1.5 lg:hidden ${
              isDark
                ? "text-gray-400 hover:bg-white/10 hover:text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                      isActive
                        ? isDark
                          ? "border border-yellow-500/30 bg-yellow-500/15 text-yellow-400"
                          : "border border-yellow-300 bg-yellow-100 text-yellow-700"
                        : isDark
                        ? "text-gray-400 hover:bg-white/5 hover:text-white"
                        : "text-gray-600 hover:bg-yellow-50 hover:text-gray-900"
                    } ${isCollapsed ? "justify-center" : ""}`}
                  >
                    <Icon
                      size={20}
                      className={`flex-shrink-0 ${
                        isActive
                          ? "text-yellow-500"
                          : "text-yellow-600/60 group-hover:text-yellow-500"
                      }`}
                    />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm font-medium"
                      >
                        {t.sidebar?.[item.id] || item.id}
                      </motion.span>
                    )}

                    {/* Active Indicator */}
                    {isActive && !isCollapsed && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-500"
                      />
                    )}

                    {/* Tooltip (collapsed) */}
                    {isCollapsed && (
                      <div
                        className={`absolute z-50 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium opacity-0 transition-all group-hover:opacity-100 ${
                          isRTL ? "right-full mr-2" : "left-full ml-2"
                        } ${
                          isDark ? "bg-gray-800 text-white" : "bg-gray-900 text-white"
                        }`}
                      >
                        {t.sidebar?.[item.id] || item.id}
                      </div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse Toggle */}
        <div
          className={`hidden border-t p-3 lg:block ${
            isDark ? "border-yellow-500/20" : "border-yellow-200"
          }`}
        >
          <button
            onClick={onToggleCollapse}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 transition-all ${
              isDark
                ? "text-gray-400 hover:bg-white/5 hover:text-white"
                : "text-gray-600 hover:bg-yellow-50 hover:text-gray-900"
            }`}
          >
            {isCollapsed ? (
              <ChevronRight size={20} className="text-yellow-500" />
            ) : (
              <>
                <ChevronLeft size={20} className="text-yellow-500" />
                <span className="text-sm">{t.sidebar?.collapse || "Collapse"}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;