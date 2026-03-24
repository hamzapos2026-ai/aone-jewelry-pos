import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Sun,
  Moon,
  Languages,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  Plus,
  Gem,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../context/AuthContext";
import { getTheme, toastStyle } from "../../utils/colors";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const Header = ({ user, onMenuClick, isSidebarOpen }) => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { userData, currentUser, signOut } = useAuth();

  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const th = getTheme(isDark);
  const t = language === "ur" ? ur : en;

  const activeUser = user || userData || currentUser || null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      if (signOut) {
        await signOut();
      }

      localStorage.removeItem("session");
      localStorage.removeItem("user");
      localStorage.removeItem("userData");

      toast.success(t.messages?.logoutSuccess || "Logged out", {
        style: toastStyle,
      });

      setShowProfile(false);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(t.messages?.somethingWentWrong || "Logout failed", {
        style: toastStyle,
      });
    }
  };

  const notifications = [
    {
      id: 1,
      title: t.notifications?.newOrder || "New order",
      time: "2 min",
      unread: true,
    },
    {
      id: 2,
      title: t.notifications?.lowStock || "Low stock",
      time: "1 hr",
      unread: true,
    },
    {
      id: 3,
      title: t.notifications?.paymentConfirmed || "Payment confirmed",
      time: "3 hr",
      unread: false,
    },
  ];

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className={`sticky top-0 z-40 ${th.header}`}>
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className={`rounded-xl p-2 lg:hidden transition-all ${
              isDark
                ? "text-gray-400 hover:bg-white/10 hover:text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 p-1.5 shadow-lg shadow-yellow-500/25">
              <Gem size={18} className="text-white" />
            </div>
            <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              A ONE
            </span>
          </div>

          <div
            className={`hidden lg:flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 w-80 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 focus-within:border-yellow-500 focus-within:shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                : "border-yellow-400/50 bg-white focus-within:border-yellow-500"
            }`}
          >
            <Search size={18} className="text-yellow-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.header?.searchPlaceholder || "Search..."}
              className={`flex-1 bg-transparent text-sm font-medium outline-none ${
                isDark
                  ? "text-white placeholder:text-gray-400"
                  : "text-gray-800 placeholder:text-gray-500"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`rounded-xl p-2.5 lg:hidden transition-all ${
              isDark
                ? "text-gray-400 hover:bg-white/10"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Search size={20} />
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/biller/pos")}
            className="hidden sm:flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all"
          >
            <Plus size={18} />
            <span>{t.header?.newSale || "New Sale"}</span>
          </motion.button>

          <button
            onClick={toggleLanguage}
            className={`rounded-xl border-2 p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
          >
            <Languages size={18} />
          </button>

          <button
            onClick={toggleTheme}
            className={`rounded-xl border-2 p-2.5 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div ref={notificationRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative rounded-xl border-2 p-2.5 transition-all ${
                isDark
                  ? "border-yellow-500/30 bg-white/5 text-gray-400 hover:border-yellow-500/50 hover:bg-white/10 hover:text-white"
                  : "border-yellow-300 bg-white text-gray-600 hover:bg-yellow-50"
              }`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border-2 shadow-2xl ${
                    isDark
                      ? "border-yellow-500/30 bg-gray-900/95 backdrop-blur-xl"
                      : "border-yellow-300 bg-white"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                      {t.common?.notifications || "Notifications"}
                    </h3>
                    <button className="text-xs font-medium text-yellow-500 hover:text-yellow-400">
                      {t.common?.markAllRead || "Mark all read"}
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`cursor-pointer px-4 py-3 transition-all ${
                          notif.unread
                            ? isDark
                              ? "bg-yellow-500/5"
                              : "bg-yellow-50"
                            : ""
                        } ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1.5 h-2 w-2 rounded-full ${
                              notif.unread ? "bg-yellow-500" : "bg-gray-400"
                            }`}
                          />
                          <div className="flex-1">
                            <p
                              className={`text-sm font-medium ${
                                isDark ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">{notif.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`border-t px-4 py-3 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <button className="w-full text-center text-sm font-medium text-yellow-500 hover:text-yellow-400">
                      {t.common?.viewAll || "View All"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center gap-2 rounded-xl border-2 p-1.5 pr-3 transition-all ${
                isDark
                  ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50 hover:bg-white/10"
                  : "border-yellow-300 bg-white hover:bg-yellow-50"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600">
                <User size={16} className="text-white" />
              </div>

              <div className="hidden text-left sm:block">
                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  {activeUser?.name || "Admin"}
                </p>
                <p className="text-xs text-gray-500">
                  {activeUser?.role || "admin"}
                </p>
              </div>

              <ChevronDown
                size={16}
                className={`transition-transform ${
                  showProfile ? "rotate-180" : ""
                } ${isDark ? "text-gray-400" : "text-gray-500"}`}
              />
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border-2 shadow-2xl ${
                    isDark
                      ? "border-yellow-500/30 bg-gray-900/95 backdrop-blur-xl"
                      : "border-yellow-300 bg-white"
                  }`}
                >
                  <div
                    className={`border-b px-4 py-3 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                      {activeUser?.name || "Admin User"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activeUser?.email || "admin@aonejewelry.com"}
                    </p>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate("/profile");
                        setShowProfile(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                        isDark
                          ? "text-gray-300 hover:bg-white/5 hover:text-white"
                          : "text-gray-700 hover:bg-yellow-50"
                      }`}
                    >
                      <User size={16} className="text-yellow-500" />
                      {t.common?.profile || "Profile"}
                    </button>

                    <button
                      onClick={() => {
                        navigate("/settings");
                        setShowProfile(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                        isDark
                          ? "text-gray-300 hover:bg-white/5 hover:text-white"
                          : "text-gray-700 hover:bg-yellow-50"
                      }`}
                    >
                      <Settings size={16} className="text-yellow-500" />
                      {t.common?.settings || "Settings"}
                    </button>
                  </div>

                  <div
                    className={`border-t py-2 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <button
                      onClick={handleLogout}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-all ${
                        isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                      }`}
                    >
                      <LogOut size={16} />
                      {t.common?.logout || "Logout"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`border-t lg:hidden ${
              isDark ? "border-yellow-500/20" : "border-yellow-200"
            }`}
          >
            <div className="p-4">
              <div
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${
                  isDark
                    ? "border-yellow-500/30 bg-white/5"
                    : "border-yellow-400/50 bg-white"
                }`}
              >
                <Search size={18} className="text-yellow-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.header?.searchPlaceholder || "Search..."}
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    isDark
                      ? "text-white placeholder:text-gray-400"
                      : "text-gray-800 placeholder:text-gray-500"
                  }`}
                  autoFocus
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;