// src/pages/biller/BillerHeader.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, User, X, Wifi, WifiOff, Volume2, VolumeX,
  Hash, Clock, Lock, Unlock, Loader2, Phone, MapPin, Database,
  ChevronDown, Sun, Moon, Languages, Bell, LogOut, Settings,
  Gem, Menu,
} from "lucide-react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../../services/firebase";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../context/AuthContext";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";

const BillerHeader = ({
  currentBillSerial,
  screenLocked,
  currentDateTime,
  customer,
  setCustomer,
  soundEnabled,
  setSoundEnabled,
  onOpenCustomerDialog,
  offlineCount,
  items,
  billerName,
  showRecentOrders,
  toggleRecentOrders,
  // Cashier mode
  canToggleCashierMode,
  cashierModeActive,
  onToggleCashierMode,
  // Super admin permission toggles
  isSuperAdmin,
  permissions,
  onTogglePermission,
  directPaid,
  onToggleDirectPaid,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { userData, currentUser, signOut } = useAuth();
  const isOnline = useNetworkStatus();
  const navigate = useNavigate();

  const t = language === "ur" ? ur : en;

  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const menuRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(true);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showControlMenu, setShowControlMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const activeUser = userData || currentUser || null;

  const fmt = {
    time: (d) =>
      d.toLocaleTimeString("en-PK", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    date: (d) =>
      d.toLocaleDateString("en-PK", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
  };

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowControlMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Customer search ──
  const handleSearch = useCallback(
    async (q) => {
      setSearchQuery(q);
      if (!q || q.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      if (!isOnline) return;

      setSearching(true);
      setShowResults(true);

      try {
        const results = [];

        // Search by phone
        if (/\d{3,}/.test(q)) {
          const phoneSnap = await getDocs(
            query(
              collection(db, "customers"),
              where("phone", ">=", q),
              where("phone", "<=", q + "\uf8ff"),
              limit(6)
            )
          );
          phoneSnap.docs.forEach((d) => {
            if (!results.find((r) => r.phone === d.data().phone)) {
              results.push({ id: d.id, ...d.data() });
            }
          });

          const orderSnap = await getDocs(
            query(
              collection(db, "orders"),
              where("customer.phone", ">=", q),
              where("customer.phone", "<=", q + "\uf8ff"),
              limit(5)
            )
          );
          orderSnap.docs.forEach((d) => {
            const c = d.data().customer;
            if (c?.phone && !results.find((r) => r.phone === c.phone)) {
              results.push({
                id: `order-${d.id}`,
                name: c.name || "Walking Customer",
                phone: c.phone,
                city: c.city || "",
                market: c.market || "",
                fromOrders: true,
              });
            }
          });
        }

        // Search by name
        const nameSnap = await getDocs(
          query(
            collection(db, "customers"),
            where("nameLower", ">=", q.toLowerCase()),
            where("nameLower", "<=", q.toLowerCase() + "\uf8ff"),
            limit(6)
          )
        );
        nameSnap.docs.forEach((d) => {
          if (!results.find((r) => r.id === d.id)) {
            results.push({ id: d.id, ...d.data() });
          }
        });

        setSearchResults(results.slice(0, 10));
      } catch (e) {
        console.error("Customer search error:", e);
      } finally {
        setSearching(false);
      }
    },
    [isOnline]
  );

  const selectCustomer = useCallback(
    (c) => {
      setCustomer({
        name: c.name || "Walking Customer",
        phone: c.phone || "",
        city: c.city || "Karachi",
        market: c.market || "",
      });
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
      toast.success(`Customer: ${c.name}`, { duration: 2000 });
    },
    [setCustomer]
  );

  const clearCustomer = useCallback(() => {
    setCustomer({
      name: "Walking Customer",
      phone: "",
      city: "Karachi",
      market: "",
    });
    setShowCustomerInfo(false);
  }, [setCustomer]);

  // ── Logout ──
  const handleLogout = async () => {
    try {
      if (signOut) await signOut();
      localStorage.removeItem("session");
      localStorage.removeItem("user");
      localStorage.removeItem("userData");
      toast.success("Logged out");
      setShowProfile(false);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed");
    }
  };

  const hasCustomer = customer.name !== "Walking Customer";

  // ── Notifications (mock) ──
  const notifications = [
    { id: 1, title: "New order received", time: "2 min", unread: true },
    { id: 2, title: "Low stock alert", time: "1 hr", unread: true },
    { id: 3, title: "Payment confirmed", time: "3 hr", unread: false },
  ];
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-xl transition-all ${
        isDark
          ? "bg-[#0a0908]/95 border-b border-yellow-500/15 shadow-[0_2px_20px_rgba(0,0,0,0.3)]"
          : "bg-white/95 border-b border-yellow-200 shadow-sm"
      }`}
    >
      {/* ══════════════ ROW 1: Brand + Controls ══════════════ */}
      <div className="flex items-center justify-between px-4 lg:px-6 h-14">
        {/* Left: Brand + Serial + Status */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-2 shadow-lg shadow-yellow-500/25">
              <Gem size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1
                className={`text-lg font-extrabold tracking-tight leading-none ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                A ONE
              </h1>
              <p
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  isDark ? "text-yellow-500/70" : "text-yellow-600/70"
                }`}
              >
                Biller
              </p>
            </div>
          </div>

          {/* Divider */}
          <div
            className={`hidden md:block h-8 w-px ${
              isDark ? "bg-yellow-500/20" : "bg-yellow-200"
            }`}
          />

          {/* Bill Serial */}
          <div
            className={`hidden md:flex items-center gap-2 rounded-xl px-3 py-1.5 ${
              isDark
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : "bg-yellow-50 border border-yellow-200"
            }`}
          >
            <Hash size={14} className="text-yellow-500" />
            <span
              className={`font-mono text-sm font-bold ${
                isDark ? "text-yellow-400" : "text-yellow-700"
              }`}
            >
              {currentBillSerial || "---"}
            </span>
          </div>

          {/* Lock Status */}
          {screenLocked ? (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold ${
                isDark
                  ? "bg-red-500/15 text-red-400 border border-red-500/20"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}
            >
              <Lock size={12} />
              LOCKED
            </span>
          ) : (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold ${
                isDark
                  ? "bg-green-500/15 text-green-400 border border-green-500/20"
                  : "bg-green-50 text-green-600 border border-green-200"
              }`}
            >
              <Unlock size={12} />
              ACTIVE
            </span>
          )}

          {/* Items Badge */}
          {items.length > 0 && (
            <span
              className={`hidden lg:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                isDark
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {items.length} items
            </span>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Date/Time */}
          <div
            className={`hidden xl:flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium ${
              isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"
            }`}
          >
            <Clock size={13} />
            <span className="font-mono">
              {fmt.date(currentDateTime)} &middot; {fmt.time(currentDateTime)}
            </span>
          </div>

          {/* Online/Offline */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold border transition ${
              isOnline
                ? isDark
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-green-50 text-green-700 border-green-200"
                : isDark
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="hidden sm:inline">
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* Offline Pending */}
          {offlineCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold border ${
                isDark
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                  : "bg-orange-50 text-orange-600 border-orange-200"
              }`}
            >
              <Database size={12} />
              {offlineCount}
            </span>
          )}

          {/* Recent Orders Toggle */}
          <button
            onClick={toggleRecentOrders}
            className={`rounded-xl border-2 px-3 py-2 text-[11px] font-semibold transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
            title={showRecentOrders ? "Hide top 5 orders" : "Show top 5 orders"}
          >
            {showRecentOrders ? "Hide Top 5" : "Show Top 5"}
          </button>

          {/* Search toggle */}
          <button
            onClick={() => setShowSearchBox((p) => !p)}
            className={`rounded-xl border-2 p-2 transition-all ${
              isDark
                ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
            }`}
            title={showSearchBox ? "Hide search" : "Show search"}
          >
            {showSearchBox ? <X size={16} /> : <Search size={16} />}
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => {
                setShowControlMenu((p) => !p);
                setShowNotifications(false);
              }}
              className={`rounded-xl border-2 p-2 transition-all ${
                isDark
                  ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:border-yellow-500/50 hover:bg-yellow-500/10"
                  : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
              }`}
              title="More settings"
            >
              <Menu size={16} />
            </button>

            <AnimatePresence>
              {showControlMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border-2 shadow-2xl ${
                    isDark ? "border-yellow-500/20 bg-[#15120d]/95" : "border-yellow-200 bg-white"
                  }`}
                >
                  <button
                    onClick={() => {
                      toggleLanguage();
                      setShowControlMenu(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                      isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Languages size={16} />
                    {language === "en" ? "اردو" : "English"}
                  </button>
                  <button
                    onClick={() => {
                      toggleTheme();
                      setShowControlMenu(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                      isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                    {isDark ? "Light mode" : "Dark mode"}
                  </button>
                  <button
                    onClick={() => {
                      setSoundEnabled((p) => !p);
                      setShowControlMenu(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                      isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    {soundEnabled ? "Sound on" : "Sound off"}
                  </button>
                  {permissions?.canDirectPay && (
                    <button
                      onClick={() => {
                        onToggleDirectPaid();
                        setShowControlMenu(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                        isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <CreditCard size={16} />
                      {directPaid ? "Direct Paid ON" : "Direct Paid OFF"}
                    </button>
                  )}
                  {canToggleCashierMode && (
                    <button
                      onClick={() => {
                        onToggleCashierMode();
                        setShowControlMenu(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                        isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      <Lock size={16} />
                      {cashierModeActive ? "Exit Cashier Mode" : "Cashier Mode"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowNotifications(true);
                      setShowControlMenu(false);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition ${
                      isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Bell size={16} />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border-2 shadow-2xl ${
                    isDark
                      ? "border-yellow-500/30 bg-[#15120d]/98 backdrop-blur-xl"
                      : "border-yellow-300 bg-white"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                      Notifications
                    </h3>
                    <button className="text-xs font-semibold text-yellow-500 hover:text-yellow-400">
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`cursor-pointer px-4 py-3 transition-all border-b last:border-0 ${
                          notif.unread
                            ? isDark
                              ? "bg-yellow-500/5 border-yellow-500/10"
                              : "bg-yellow-50 border-yellow-100"
                            : isDark
                            ? "border-yellow-500/5"
                            : "border-gray-50"
                        } ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                              notif.unread ? "bg-yellow-500" : "bg-gray-400"
                            }`}
                          />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                              {notif.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">{notif.time} ago</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Dropdown */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center gap-2 rounded-xl border-2 p-1.5 pr-3 transition-all ${
                isDark
                  ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50 hover:bg-white/10"
                  : "border-yellow-300 bg-white hover:bg-yellow-50"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 shadow-md shadow-yellow-500/20">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p
                  className={`text-sm font-semibold leading-tight ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {billerName || activeUser?.name || "Biller"}
                </p>
                <p className="text-[10px] text-gray-500 leading-tight">
                  {activeUser?.role || "biller"}
                </p>
              </div>
              <ChevronDown
                size={14}
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
                  className={`absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border-2 shadow-2xl ${
                    isDark
                      ? "border-yellow-500/30 bg-[#15120d]/98 backdrop-blur-xl"
                      : "border-yellow-300 bg-white"
                  }`}
                >
                  <div
                    className={`border-b px-4 py-3 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <p
                      className={`font-bold text-sm ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {billerName || activeUser?.name || "Biller"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeUser?.email || "biller@store.com"}
                    </p>
                  </div>

                  <div className="py-1.5">
                    <button
                      onClick={() => {
                        navigate("/biller/profile");
                        setShowProfile(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all ${
                        isDark
                          ? "text-gray-300 hover:bg-white/5 hover:text-white"
                          : "text-gray-700 hover:bg-yellow-50"
                      }`}
                    >
                      <User size={16} className="text-yellow-500" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate("/biller/settings");
                        setShowProfile(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all ${
                        isDark
                          ? "text-gray-300 hover:bg-white/5 hover:text-white"
                          : "text-gray-700 hover:bg-yellow-50"
                      }`}
                    >
                      <Settings size={16} className="text-yellow-500" />
                      Settings
                    </button>
                  </div>

                  <div
                    className={`border-t py-1.5 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}
                  >
                    <button
                      onClick={handleLogout}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 transition-all ${
                        isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                      }`}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ══════════════ ROW 2: Customer Search + Add + Info ══════════════ */}
      <div
        className={`flex items-center gap-2.5 px-4 lg:px-6 pb-2.5 pt-0.5`}
      >
        {/* Customer Search Box */}
        {showSearchBox && (
          <div className="relative flex-1 max-w-lg" ref={searchRef}>
          <div
            className={`flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 transition-all ${
              isDark
                ? "border-yellow-500/25 bg-white/5 focus-within:border-yellow-500/50 focus-within:shadow-[0_0_15px_rgba(234,179,8,0.08)]"
                : "border-yellow-300 bg-white focus-within:border-yellow-500 focus-within:shadow-sm"
            }`}
          >
            <Search size={16} className="shrink-0 text-yellow-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length && setShowResults(true)}
              placeholder="Search customer by phone or name..."
              className={`flex-1 bg-transparent text-sm font-medium outline-none ${
                isDark
                  ? "text-white placeholder:text-gray-500"
                  : "text-gray-900 placeholder:text-gray-400"
              }`}
            />
            {searching && (
              <Loader2
                size={15}
                className="shrink-0 animate-spin text-yellow-500"
              />
            )}
            {searchQuery && !searching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className="shrink-0 rounded-lg p-0.5 hover:bg-black/10"
              >
                <X size={14} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {showResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border-2 shadow-2xl ${
                  isDark
                    ? "border-yellow-500/25 bg-[#15120d]"
                    : "border-yellow-200 bg-white"
                }`}
              >
                <div
                  className={`sticky top-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${
                    isDark
                      ? "bg-[#15120d] text-gray-500 border-b border-yellow-500/10"
                      : "bg-gray-50 text-gray-500 border-b border-gray-100"
                  }`}
                >
                  {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""} found
                </div>

                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => selectCustomer(c)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between border-b last:border-0 transition-all ${
                      isDark
                        ? "border-yellow-500/10 hover:bg-yellow-500/10 text-white"
                        : "border-yellow-100 hover:bg-yellow-50 text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          isDark
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        <User size={16} />
                      </div>
                      <div>
                        <span className="font-semibold text-sm block leading-tight">
                          {c.name}
                        </span>
                        {c.phone && (
                          <span
                            className={`text-xs flex items-center gap-1 mt-0.5 ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            <Phone size={10} />
                            {c.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.city && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
                            isDark
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          <MapPin size={9} className="inline mr-0.5" />
                          {c.city}
                        </span>
                      )}
                      {c.fromOrders && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
                            isDark
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-orange-50 text-orange-600"
                          }`}
                        >
                          history
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No results */}
          <AnimatePresence>
            {showResults &&
              searchQuery.length >= 2 &&
              !searching &&
              searchResults.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border-2 px-4 py-4 text-center text-sm font-medium ${
                    isDark
                      ? "border-yellow-500/20 bg-[#15120d] text-gray-400"
                      : "border-yellow-200 bg-white text-gray-500"
                  }`}
                >
                  No customers found for &ldquo;{searchQuery}&rdquo;
                </motion.div>
              )}
          </AnimatePresence>
        </div>
        )}

        {/* Add Customer Button */}
        <button
          onClick={onOpenCustomerDialog}
          disabled={screenLocked}
          className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all whitespace-nowrap ${
            isDark
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
              : "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          <UserPlus size={16} />
          <span className="hidden sm:inline">Add Customer</span>
        </button>

        {/* Active Customer Badge */}
        {hasCustomer && (
          <div className="relative">
            <button
              onClick={() => setShowCustomerInfo((p) => !p)}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                isDark
                  ? "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15"
                  : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              }`}
            >
              <User size={14} />
              <div className="hidden sm:block text-left">
                <span className="font-semibold max-w-[100px] truncate block leading-tight text-sm">
                  {customer.name}
                </span>
                {customer.phone && (
                  <span
                    className={`text-[10px] leading-tight ${
                      isDark ? "text-green-300/60" : "text-green-600/60"
                    }`}
                  >
                    {customer.phone}
                  </span>
                )}
              </div>
              <ChevronDown
                size={12}
                className={`transition-transform ${
                  showCustomerInfo ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Customer Info Dropdown */}
            <AnimatePresence>
              {showCustomerInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  className={`absolute right-0 top-full z-50 mt-1.5 w-60 rounded-2xl border-2 shadow-2xl p-4 ${
                    isDark
                      ? "border-yellow-500/20 bg-[#15120d]"
                      : "border-yellow-200 bg-white"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isDark
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        <User size={18} />
                      </div>
                      <div>
                        <span
                          className={`font-bold text-sm block ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {customer.name}
                        </span>
                        {customer.phone && (
                          <span
                            className={`text-xs flex items-center gap-1 ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}
                          >
                            <Phone size={10} />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {customer.city && (
                      <div
                        className={`flex items-center gap-2 text-xs ${
                          isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        <MapPin size={12} />
                        <span>
                          {customer.city}
                          {customer.market && ` - ${customer.market}`}
                        </span>
                      </div>
                    )}

                    <div
                      className={`h-px ${
                        isDark ? "bg-yellow-500/10" : "bg-gray-100"
                      }`}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onOpenCustomerDialog();
                          setShowCustomerInfo(false);
                        }}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                          isDark
                            ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                            : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={clearCustomer}
                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                          isDark
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
};

export default BillerHeader;