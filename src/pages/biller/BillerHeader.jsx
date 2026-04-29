// src/modules/biller/BillerHeader.jsx
// ✅ RecentOrdersGrid — Serial, Customer Name, Phone — NO ITEMS LIST
// ✅ Bigger fonts throughout
// ✅ All other fixes intact

import {
  useState, useRef, useCallback, useEffect, useMemo, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, User, X, Wifi, WifiOff, Volume2, VolumeX,
  Hash, Clock, Lock, Unlock, Loader2, Phone, MapPin, Database,
  ChevronDown, ChevronUp, Sun, Moon, Languages, Bell, LogOut,
  Settings, Gem, Menu, CreditCard, ShoppingBag, RefreshCw, Eye,
  AlertCircle, Package, CheckCircle, XCircle, Timer,
} from "lucide-react";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, getDocs,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db }           from "../../services/firebase";
import { useTheme }     from "../../context/ThemeContext";
import { useLanguage }  from "../../hooks/useLanguage";
import { useAuth }      from "../../context/AuthContext";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import InvoicePrint     from "../../components/InvoicePrint";
import {
  cacheLoad, cacheSearch, isValidCustomer, normalizePhone,
} from "../../components/CustomerDialog";

// ── Helpers ──────────────────────────────────────────────────
const fmtTime = (d) => {
  if (!d || isNaN(new Date(d))) return "--:--:--";
  return new Date(d).toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit",
    second: "2-digit", hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d || isNaN(new Date(d))) return "";
  return new Date(d).toLocaleDateString("en-PK", {
    weekday: "short", month: "short", day: "numeric",
  });
};

const fmtAmt = (n) => Number(n || 0).toLocaleString("en-PK");

const toDate = (v) => {
  if (!v) return null;
  try {
    if (v?.toDate) return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  } catch { return null; }
};

const fmtOrderTime = (v) => {
  const d = toDate(v);
  if (!d) return "--";
  return d.toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const fmtOrderDate = (v) => {
  const d = toDate(v);
  if (!d) return "--";
  return d.toLocaleDateString("en-PK", {
    day: "2-digit", month: "short",
  });
};

// ✅ Customer display name
const getCustomerDisplayName = (order) => {
  const c = order?.customer;
  if (!c) return "Walk-in";
  const name = (c.name || "").trim();
  if (
    !name ||
    /^Walking\s*Customer$/i.test(name) ||
    /^Walk-in$/i.test(name) ||
    /^Customer_\d+$/i.test(name)
  ) {
    if (c.phone) return c.phone;
    return "Walk-in";
  }
  return name;
};

const getCustomerPhone = (order) => {
  return (order?.customer?.phone || "").trim() || null;
};

// ✅ Status badge config
const STATUS_CONFIG = {
  approved:  { color: "bg-green-500",  text: "text-green-400",  label: "✓ Done"    },
  completed: { color: "bg-green-500",  text: "text-green-400",  label: "✓ Done"    },
  paid:      { color: "bg-green-500",  text: "text-green-400",  label: "✓ Paid"    },
  pending:   { color: "bg-yellow-500", text: "text-yellow-400", label: "⏳ Pending" },
  cancelled: { color: "bg-red-500",    text: "text-red-400",    label: "✗ Cancel"  },
};
const getStatus = (s) =>
  STATUS_CONFIG[s] || { color: "bg-gray-400", text: "text-gray-400", label: s || "saved" };

// ════════════════════════════════════════════════════════════════
// ✅ RECENT ORDERS GRID — NO ITEMS LIST, BIGGER FONTS
// ════════════════════════════════════════════════════════════════
const RecentOrdersGrid = memo(({
  billerId, storeId, isDark, onViewInvoice, visible,
}) => {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const unsubRef   = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!billerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    const sid = storeId || "default";

    const tryWithIndex = () =>
      new Promise((resolve) => {
        let settled = false;
        const settle = (val) => {
          if (settled) return;
          settled = true;
          resolve(val);
        };

        try {
          const q = query(
            collection(db, "orders"),
            where("billerId", "==", billerId),
            where("storeId",  "==", sid),
            orderBy("createdAt", "desc"),
            limit(5),
          );

          unsubRef.current = onSnapshot(
            q,
            (snap) => {
              if (!mountedRef.current) return;
              const docs = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
              setOrders(docs);
              setLoading(false);
              settle("ok");
            },
            (err) => {
              console.warn("[RecentOrders] index query error:", err.code);
              settle(null);
            }
          );

          setTimeout(() => settle(null), 3000);
        } catch (e) {
          settle(null);
        }
      });

    const tryFallback = async () => {
      try {
        const q1 = query(
          collection(db, "orders"),
          where("billerId", "==", billerId),
          limit(20),
        );
        const snap = await getDocs(q1);
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((o) => !sid || o.storeId === sid || !o.storeId)
          .sort((a, b) => {
            const ta = toDate(a.createdAt)?.getTime() || 0;
            const tb = toDate(b.createdAt)?.getTime() || 0;
            return tb - ta;
          })
          .slice(0, 5);
        return docs;
      } catch {
        try {
          const q2 = query(
            collection(db, "orders"),
            where("storeId", "==", sid),
            limit(30),
          );
          const snap2 = await getDocs(q2);
          return snap2.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((o) => o.billerId === billerId)
            .sort((a, b) => {
              const ta = toDate(a.createdAt)?.getTime() || 0;
              const tb = toDate(b.createdAt)?.getTime() || 0;
              return tb - ta;
            })
            .slice(0, 5);
        } catch {
          return [];
        }
      }
    };

    const result = await tryWithIndex();

    if (!mountedRef.current) return;

    if (result === null) {
      const fallback = await tryFallback();
      if (mountedRef.current) {
        setOrders(fallback);
        setLoading(false);
      }
    }
  }, [billerId, storeId]);

  useEffect(() => {
    mountedRef.current = true;
    if (visible) load();
    return () => {
      mountedRef.current = false;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [load, visible]);

  useEffect(() => {
    if (visible && mountedRef.current) load();
  }, [visible]); // eslint-disable-line

  if (!visible) return null;

  return (
    <div className={`border-b ${
      isDark
        ? "border-yellow-500/10 bg-black/15"
        : "border-yellow-100 bg-yellow-50/30"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-3 lg:px-4 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600">
            <ShoppingBag size={12} className="text-white" />
          </div>
          <span className={`text-[13px] font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}>
            Recent Bills
            {orders.length > 0 && (
              <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {orders.length}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); load(); }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition active:scale-95 ${
            isDark
              ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              : "border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"
          }`}
        >
          <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Content */}
      <div className="px-3 lg:px-4 pb-2.5">

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-[88px] animate-pulse rounded-xl border ${
                  isDark
                    ? "border-yellow-500/10 bg-white/3"
                    : "border-yellow-100 bg-white"
                }`}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className={`py-4 text-center text-sm flex items-center justify-center gap-2 ${
            isDark ? "text-red-400" : "text-red-500"
          }`}>
            <AlertCircle size={14} />
            {error}
            <button onClick={load} className="underline font-semibold">
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && orders.length === 0 && (
          <div className={`py-6 text-center ${
            isDark ? "text-gray-500" : "text-gray-400"
          }`}>
            <Package size={26} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">
              {billerId ? "No recent bills found" : "Login required"}
            </p>
          </div>
        )}

        {/* ✅ ORDER CARDS — NO ITEMS, BIGGER FONTS */}
        {!loading && !error && orders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {orders.map((order) => {
              const serial   = order.serialNo ||
                               order.billSerial ||
                               order.serial    || "----";

              const custName  = getCustomerDisplayName(order);
              const custPhone = getCustomerPhone(order);

              const items    = Array.isArray(order.items) ? order.items : [];
              const totalAmt = order.totalAmount ||
                               order.grandTotal  ||
                               order.total       || 0;

              const timeVal  = order.createdAt ||
                               order.billerSubmittedAt ||
                               order.savedAt;

              const status   = getStatus(order.status);

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewInvoice(order);
                  }}
                  className={`group relative overflow-hidden rounded-xl border text-left
                    transition-all duration-150 hover:shadow-lg active:scale-[0.97] ${
                    isDark
                      ? "border-yellow-500/15 bg-white/[0.03] hover:border-yellow-500/40 hover:bg-yellow-500/8"
                      : "border-yellow-200/80 bg-white hover:border-yellow-400 hover:bg-yellow-50/80 shadow-sm"
                  }`}
                >
                  {/* Status bar top */}
                  <div className={`h-[3px] w-full ${status.color} opacity-80`} />

                  <div className="p-3 flex flex-col gap-2">

                    {/* ── ROW 1: Serial + Status ── */}
                    <div className="flex items-center justify-between gap-1">
                      <div className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 border ${
                        isDark
                          ? "bg-yellow-500/10 border-yellow-500/20"
                          : "bg-yellow-50 border-yellow-200/70"
                      }`}>
                        <Hash size={10} className="text-yellow-500 shrink-0" />
                        <span className={`font-mono text-[13px] font-black tracking-tight ${
                          isDark ? "text-yellow-400" : "text-yellow-700"
                        }`}>
                          {serial}
                        </span>
                      </div>

                      {/* Status dot + items count */}
                      <div className="flex items-center gap-1.5">
                        {items.length > 0 && (
                          <span className={`text-[10px] font-bold ${
                            isDark ? "text-gray-500" : "text-gray-400"
                          }`}>
                            {items.length} {items.length === 1 ? "item" : "items"}
                          </span>
                        )}
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${status.color}`} />
                      </div>
                    </div>

                    {/* ── ROW 2: Customer Name + Phone ── */}
                    <div>
                      <p className={`text-[13px] font-bold leading-tight truncate ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}>
                        {custName}
                      </p>

                      {custPhone && (
                        <div className={`flex items-center gap-1 mt-0.5 ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>
                          <Phone size={9} className="shrink-0" />
                          <span className="font-mono text-[11px] truncate">
                            {custPhone}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── ROW 3: Amount + Time ── */}
                    <div className={`flex items-end justify-between gap-1 pt-1.5 border-t border-dashed ${
                      isDark ? "border-yellow-500/10" : "border-gray-200/60"
                    }`}>
                      <div>
                        <p className={`text-[14px] font-extrabold leading-none ${
                          isDark ? "text-yellow-400" : "text-yellow-700"
                        }`}>
                          Rs {fmtAmt(totalAmt)}
                        </p>
                        <p className={`text-[10px] mt-0.5 font-mono ${
                          isDark ? "text-gray-600" : "text-gray-400"
                        }`}>
                          {fmtOrderDate(timeVal)} {fmtOrderTime(timeVal)}
                        </p>
                      </div>

                      {/* View button — on hover */}
                      <div className={`flex items-center gap-1 rounded-lg px-2 py-1
                        opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDark
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        <Eye size={10} />
                        <span className="text-[10px] font-bold">View</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
RecentOrdersGrid.displayName = "RecentOrdersGrid";

// ════════════════════════════════════════════════════════════════
// MAIN HEADER
// ════════════════════════════════════════════════════════════════
const BillerHeader = ({
  currentBillSerial,
  screenLocked,
  currentDateTime,
  items,
  customer,
  setCustomer,
  onOpenCustomerDialog,
  soundEnabled,
  setSoundEnabled,
  isOnline: isOnlineProp,
  offlineCount,
  billerName,
  showRecentOrders:    showRecentOrdersProp,
  toggleRecentOrders:  toggleRecentOrdersProp,
  onViewInvoice,
  canToggleCashierMode,
  cashierModeActive,
  onToggleCashierMode,
  isSuperAdmin,
  permissions,
  onTogglePermission,
  directPaid,
  onToggleDirectPaid,
  tabs,
  activeTabId,
  onSwitchTab,
  onAddTab,
  onRemoveTab,
  canAddTab,
  storeId,
  billerId,
  store,
  notifications = [],
}) => {
  const { isDark, toggleTheme }              = useTheme();
  const { language, toggleLanguage }         = useLanguage();
  const { userData, currentUser, signOut }   = useAuth();
  const isOnlineHook                         = useNetworkStatus();
  const isOnline =
    isOnlineProp !== undefined ? isOnlineProp : isOnlineHook;
  const navigate = useNavigate();

  const [localShowRecent, setLocalShowRecent] = useState(false);
  const showRecentOrders =
    showRecentOrdersProp !== undefined
      ? showRecentOrdersProp
      : localShowRecent;
  const toggleRecentOrders =
    toggleRecentOrdersProp ??
    (() => setLocalShowRecent((p) => !p));

  const searchRef   = useRef(null);
  const profileRef  = useRef(null);
  const menuRef     = useRef(null);
  const customerRef = useRef(null);
  const searchTimer = useRef(null);

  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchResults,     setSearchResults]     = useState([]);
  const [searching,         setSearching]         = useState(false);
  const [showResults,       setShowResults]       = useState(false);
  const [showSearchBox,     setShowSearchBox]     = useState(false);
  const [showCustomerInfo,  setShowCustomerInfo]  = useState(false);
  const [showProfile,       setShowProfile]       = useState(false);
  const [showControlMenu,   setShowControlMenu]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [invoiceOrder,      setInvoiceOrder]      = useState(null);

  const activeUser       = userData || currentUser || null;
  const resolvedBillerId = billerId || activeUser?.uid || null;
  const resolvedStoreId  = storeId  || userData?.storeId || "default";

  const btnBase = useMemo(() =>
    `rounded-xl border-2 transition-all ${
      isDark
        ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
        : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
    }`,
  [isDark]);

  const unreadCount = useMemo(() =>
    (notifications || []).filter((n) => n.unread).length,
  [notifications]);

  const hasCustomer = !!(
    customer?.name &&
    customer.name !== "Walking Customer" &&
    customer.name !== "Walk-in" &&
    customer.name.trim() !== ""
  );

  const isPlaceholder =
    !currentBillSerial ||
    currentBillSerial === "----" ||
    currentBillSerial === "....";

  useEffect(() => {
    if (resolvedStoreId)
      cacheLoad(resolvedStoreId, false).catch(() => {});
  }, [resolvedStoreId]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current   && !searchRef.current.contains(e.target))
        setShowResults(false);
      if (profileRef.current  && !profileRef.current.contains(e.target))
        setShowProfile(false);
      if (menuRef.current     && !menuRef.current.contains(e.target)) {
        setShowControlMenu(false);
        setShowNotifications(false);
      }
      if (customerRef.current && !customerRef.current.contains(e.target))
        setShowCustomerInfo(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setShowResults(true);
    try {
      const sid = resolvedStoreId || "default";
      let results = cacheSearch(q, sid);
      if (results.length === 0) {
        await cacheLoad(sid, false);
        results = cacheSearch(q, sid);
      }
      if (results.length === 0) {
        const digits = q.replace(/[^0-9]/g, "");
        const fbResults = [];
        if (digits.length >= 3) {
          const snap = await getDocs(query(
            collection(db, "customers"),
            where("phone", ">=", digits),
            where("phone", "<=", digits + "\uf8ff"),
            where("storeId", "==", sid),
            limit(6)
          ));
          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            if (
              isValidCustomer(data) &&
              !fbResults.find((r) => r.phone === data.phone)
            ) fbResults.push(data);
          });
        }
        const lower = q.toLowerCase();
        if (lower.length >= 2) {
          const nameSnap = await getDocs(query(
            collection(db, "customers"),
            where("nameLower", ">=", lower),
            where("nameLower", "<=", lower + "\uf8ff"),
            where("storeId", "==", sid),
            limit(6)
          ));
          nameSnap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            if (
              isValidCustomer(data) &&
              !fbResults.find((r) => r.id === data.id)
            ) fbResults.push(data);
          });
        }
        results = fbResults.slice(0, 10);
      }
      setSearchResults(results.filter(isValidCustomer));
      setShowResults(results.length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [resolvedStoreId]);

  const onSearchChange = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = setTimeout(() => doSearch(q), 150);
  }, [doSearch]);

  const handleToggleSearch = useCallback(() => {
    setShowSearchBox((p) => {
      if (p) {
        setSearchQuery("");
        setSearchResults([]);
        setShowResults(false);
      }
      return !p;
    });
  }, []);

  const selectCustomer = useCallback((c) => {
    setCustomer?.({
      name:   c.name  || "Walking Customer",
      phone:  normalizePhone(c.phone || "") || c.phone || "",
      city:   c.city   || "Karachi",
      market: c.market || "",
    });
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    toast.success(`Customer: ${c.name || "Selected"}`, { duration: 1200 });
  }, [setCustomer]);

  const clearCustomer = useCallback(() => {
    setCustomer?.({
      name: "Walking Customer", phone: "", city: "Karachi", market: "",
    });
    setShowCustomerInfo(false);
  }, [setCustomer]);

  const handleLogout = useCallback(async () => {
    try {
      if (signOut) await signOut();
      ["session", "user", "userData"].forEach(
        (k) => localStorage.removeItem(k)
      );
      toast.success("Logged out");
      setShowProfile(false);
      navigate("/login", { replace: true });
    } catch {
      toast.error("Logout failed");
    }
  }, [signOut, navigate]);

  const handleViewInvoice = useCallback((order) => {
    if (onViewInvoice) onViewInvoice(order);
    else setInvoiceOrder(order);
  }, [onViewInvoice]);

  const handleToggleRecentOrders = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleRecentOrders();
  }, [toggleRecentOrders]);

  return (
    <>
      <header className={`sticky top-0 z-40 backdrop-blur-xl transition-all flex-shrink-0 ${
        isDark
          ? "bg-[#0a0908]/95 border-b border-yellow-500/15 shadow-[0_2px_20px_rgba(0,0,0,0.3)]"
          : "bg-white/95 border-b border-yellow-200 shadow-sm"
      }`}>

        {/* ── ROW 1: Main bar ── */}
        <div className="flex items-center justify-between px-3 lg:px-4 h-11">

          {/* Left */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-1.5 shadow-lg shadow-yellow-500/25">
                <Gem size={16} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className={`text-sm font-extrabold tracking-tight leading-none ${
                  isDark ? "text-white" : "text-gray-900"
                }`}>
                  A ONE
                </h1>
                <p className={`text-[8px] font-semibold uppercase tracking-widest ${
                  isDark ? "text-yellow-500/70" : "text-yellow-600/70"
                }`}>
                  Biller
                </p>
              </div>
            </div>

            <div className={`hidden md:block h-6 w-px ${
              isDark ? "bg-yellow-500/20" : "bg-yellow-200"
            }`} />

            {/* Bill serial */}
            <div className={`hidden md:flex items-center gap-1 rounded-xl px-2 py-1 ${
              isDark
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : "bg-yellow-50 border border-yellow-200"
            }`}>
              <Hash size={11} className="text-yellow-500" />
              <span className={`font-mono text-xs font-bold ${
                isDark ? "text-yellow-400" : "text-yellow-700"
              }`}>
                {isPlaceholder
                  ? <span className="opacity-50 italic text-[10px]">loading…</span>
                  : currentBillSerial
                }
              </span>
            </div>

            {/* Lock/Active */}
            {screenLocked ? (
              <span className={`hidden sm:inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[10px] font-bold border ${
                isDark
                  ? "bg-red-500/15 text-red-400 border-red-500/20"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                <Lock size={9} />LOCKED
              </span>
            ) : (
              <span className={`hidden sm:inline-flex items-center gap-1 rounded-xl px-2 py-0.5 text-[10px] font-bold border ${
                isDark
                  ? "bg-green-500/15 text-green-400 border-green-500/20"
                  : "bg-green-50 text-green-600 border-green-200"
              }`}>
                <Unlock size={9} />ACTIVE
              </span>
            )}

            {/* Items count */}
            {items?.length > 0 && (
              <span className={`hidden lg:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isDark
                  ? "bg-yellow-500/15 text-yellow-400"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {items.length} items
              </span>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">

            {/* DateTime */}
            <div className={`hidden xl:flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium ${
              isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"
            }`}>
              <Clock size={10} />
              <span className="font-mono">
                {currentDateTime
                  ? `${fmtDate(currentDateTime)} · ${fmtTime(currentDateTime)}`
                  : "--"
                }
              </span>
            </div>

            {/* Network status */}
            <div className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold border ${
              isOnline
                ? isDark
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-green-50 text-green-700 border-green-200"
                : isDark
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span className="hidden sm:inline">
                {isOnline ? "ON" : "OFF"}
              </span>
            </div>

            {/* Offline count */}
            {offlineCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold border ${
                isDark
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                  : "bg-orange-50 text-orange-600 border-orange-200"
              }`}>
                <Database size={10} />{offlineCount}
              </span>
            )}

            {/* ✅ Recent Orders Toggle */}
            <button
              type="button"
              onClick={handleToggleRecentOrders}
              className={`inline-flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                showRecentOrders
                  ? isDark
                    ? "border-yellow-500 bg-yellow-500/20 text-yellow-300"
                    : "border-yellow-500 bg-yellow-100 text-yellow-700"
                  : isDark
                    ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
                    : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"
              }`}
            >
              <ShoppingBag size={12} />
              <span className="hidden sm:inline">
                {showRecentOrders ? "Hide" : "Orders"}
              </span>
              {showRecentOrders
                ? <ChevronUp size={10} />
                : <ChevronDown size={10} />
              }
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={handleToggleSearch}
              className={`${btnBase} p-1.5`}
            >
              {showSearchBox ? <X size={14} /> : <Search size={14} />}
            </button>

            {/* Control Menu */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowControlMenu((p) => !p);
                  setShowProfile(false);
                  setShowNotifications(false);
                }}
                className={`${btnBase} p-1.5`}
              >
                <Menu size={14} />
              </button>

              <AnimatePresence>
                {showControlMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.1 }}
                    className={`absolute right-0 top-full z-[200] mt-1.5 w-52 rounded-2xl border-2 shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d]"
                        : "border-yellow-200 bg-white"
                    }`}
                  >
                    {[
                      {
                        icon:   <Languages size={14} />,
                        label:  language === "en" ? "اردو" : "English",
                        action: () => { toggleLanguage(); setShowControlMenu(false); },
                      },
                      {
                        icon:   isDark ? <Sun size={14} /> : <Moon size={14} />,
                        label:  isDark ? "Light Mode" : "Dark Mode",
                        action: () => { toggleTheme(); setShowControlMenu(false); },
                      },
                      {
                        icon:   soundEnabled
                          ? <Volume2 size={14} />
                          : <VolumeX size={14} />,
                        label:  soundEnabled ? "Sound ON" : "Sound OFF",
                        action: () => {
                          setSoundEnabled?.((p) => !p);
                          setShowControlMenu(false);
                        },
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition ${
                          isDark
                            ? "text-white hover:bg-white/5"
                            : "text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        {item.icon}{item.label}
                      </button>
                    ))}

                    {permissions?.canDirectPay && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleDirectPaid?.();
                          setShowControlMenu(false);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition ${
                          isDark
                            ? "text-white hover:bg-white/5"
                            : "text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <CreditCard size={14} />
                        {directPaid ? "Direct Paid ON" : "Direct Paid OFF"}
                      </button>
                    )}

                    {canToggleCashierMode && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleCashierMode?.();
                          setShowControlMenu(false);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition ${
                          isDark
                            ? "text-white hover:bg-white/5"
                            : "text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <Lock size={14} />
                        {cashierModeActive ? "Exit Cashier" : "Cashier Mode"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(true);
                        setShowControlMenu(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition ${
                        isDark
                          ? "text-white hover:bg-white/5"
                          : "text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <Bell size={14} />Notifications
                      {unreadCount > 0 && (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notifications panel */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute right-0 top-full z-[200] mt-1.5 w-72 rounded-2xl border-2 shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/30 bg-[#15120d]"
                        : "border-yellow-300 bg-white"
                    }`}
                  >
                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}>
                      <h3 className={`font-bold text-sm ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}>Notifications</h3>
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="text-[10px] font-semibold text-yellow-500"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {(notifications || []).length === 0 ? (
                        <p className={`px-4 py-6 text-center text-sm ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>
                          No notifications
                        </p>
                      ) : (notifications || []).map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b last:border-0 ${
                            n.unread
                              ? isDark ? "bg-yellow-500/5" : "bg-yellow-50"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                              n.unread ? "bg-yellow-500" : "bg-gray-400"
                            }`} />
                            <div>
                              <p className={`text-sm font-medium ${
                                isDark ? "text-white" : "text-gray-900"
                              }`}>{n.title}</p>
                              <p className="mt-0.5 text-[10px] text-gray-500">
                                {n.time} ago
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfile((p) => !p);
                  setShowControlMenu(false);
                  setShowNotifications(false);
                }}
                className={`flex items-center gap-1.5 rounded-xl border-2 p-1 pr-2 transition-all ${
                  isDark
                    ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50"
                    : "border-yellow-300 bg-white hover:bg-yellow-50"
                }`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600">
                  <User size={12} className="text-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className={`text-[11px] font-semibold leading-tight ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}>
                    {billerName || activeUser?.name || "Biller"}
                  </p>
                  <p className="text-[9px] text-gray-500 leading-tight">
                    {activeUser?.role || "biller"}
                  </p>
                </div>
                <ChevronDown
                  size={11}
                  className={`transition-transform ${
                    showProfile ? "rotate-180" : ""
                  } ${isDark ? "text-gray-400" : "text-gray-500"}`}
                />
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute right-0 z-[200] mt-1.5 w-52 rounded-2xl border-2 shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/30 bg-[#15120d]"
                        : "border-yellow-300 bg-white"
                    }`}
                  >
                    <div className={`border-b px-4 py-3 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}>
                      <p className={`font-bold text-sm ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}>
                        {billerName || activeUser?.name || "Biller"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activeUser?.email || ""}
                      </p>
                    </div>
                    <div className="py-1">
                      {[
                        {
                          label: "Profile",
                          icon:  <User size={13} className="text-yellow-500" />,
                          path:  "/biller/profile",
                        },
                        {
                          label: "Settings",
                          icon:  <Settings size={13} className="text-yellow-500" />,
                          path:  "/biller/settings",
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            navigate(item.path);
                            setShowProfile(false);
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-medium transition ${
                            isDark
                              ? "text-gray-300 hover:bg-white/5"
                              : "text-gray-700 hover:bg-yellow-50"
                          }`}
                        >
                          {item.icon}{item.label}
                        </button>
                      ))}
                    </div>
                    <div className={`border-t py-1 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"
                    }`}>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-red-500 transition ${
                          isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                        }`}
                      >
                        <LogOut size={13} />Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ✅ Recent Orders Grid */}
        {resolvedBillerId && (
          <RecentOrdersGrid
            billerId={resolvedBillerId}
            storeId={resolvedStoreId}
            isDark={isDark}
            onViewInvoice={handleViewInvoice}
            visible={showRecentOrders}
          />
        )}

        {/* Tab bar */}
        {tabs && tabs.length > 0 && (
          <div
            className={`flex items-center gap-1 px-3 lg:px-4 overflow-x-auto ${
              isDark
                ? "border-b border-yellow-500/10"
                : "border-b border-yellow-100"
            }`}
            style={{ scrollbarWidth: "none" }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const hasItems = (tab.state?.items?.length || 0) > 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSwitchTab?.(tab.id)}
                  className={`relative flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
                    isActive
                      ? isDark
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-yellow-500 bg-yellow-50 text-yellow-700"
                      : isDark
                        ? "border-transparent text-gray-500 hover:text-gray-300"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {hasItems && (
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-yellow-500" : "bg-gray-400"
                    }`} />
                  )}
                  {tab.label}
                  {tabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTab?.(tab.id);
                      }}
                      className={`ml-0.5 rounded p-0.5 hover:bg-red-500/20 hover:text-red-400 transition ${
                        isDark ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      <X size={9} />
                    </button>
                  )}
                </button>
              );
            })}
            {canAddTab && (
              <button
                type="button"
                onClick={() => onAddTab?.()}
                className={`flex-shrink-0 rounded-t-xl px-2 py-1.5 text-xs font-bold transition ${
                  isDark
                    ? "text-yellow-500/60 hover:text-yellow-400 hover:bg-yellow-500/10"
                    : "text-yellow-600/60 hover:text-yellow-700 hover:bg-yellow-50"
                }`}
              >
                + Bill
              </button>
            )}
          </div>
        )}

        {/* ── ROW 2: Search + Customer ── */}
        <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5">

          {showSearchBox && (
            <div className="relative flex-1 max-w-sm" ref={searchRef}>
              <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 transition-all ${
                isDark
                  ? "border-yellow-500/25 bg-white/5 focus-within:border-yellow-500/50"
                  : "border-yellow-300 bg-white focus-within:border-yellow-500"
              }`}>
                <Search size={13} className="shrink-0 text-yellow-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={onSearchChange}
                  onFocus={() => searchResults.length && setShowResults(true)}
                  autoFocus
                  placeholder="Search phone or name…"
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    isDark
                      ? "text-white placeholder:text-gray-500"
                      : "text-gray-900 placeholder:text-gray-400"
                  }`}
                />
                {searching && (
                  <Loader2
                    size={12}
                    className="shrink-0 animate-spin text-yellow-500"
                  />
                )}
                {searchQuery && !searching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowResults(false);
                    }}
                    className="shrink-0 rounded p-0.5 hover:bg-black/10"
                  >
                    <X size={11} className="text-gray-500" />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showResults && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.08 }}
                    className={`absolute left-0 right-0 top-full z-[100] mt-1 max-h-56 overflow-y-auto rounded-2xl border-2 shadow-2xl ${
                      isDark
                        ? "border-yellow-500/25 bg-[#15120d]"
                        : "border-yellow-200 bg-white"
                    }`}
                  >
                    <div className={`sticky top-0 px-3 py-1.5 text-[10px] font-bold uppercase ${
                      isDark
                        ? "bg-[#15120d] text-gray-500 border-b border-yellow-500/10"
                        : "bg-gray-50 text-gray-500 border-b border-gray-100"
                    }`}>
                      {searchResults.length} found
                    </div>
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => selectCustomer(c)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between border-b last:border-0 transition ${
                          isDark
                            ? "border-yellow-500/10 hover:bg-yellow-500/10 text-white"
                            : "border-yellow-100 hover:bg-yellow-50 text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                            isDark
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            <User size={13} />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block leading-tight">
                              {c.name}
                            </span>
                            <span className={`text-[10px] flex items-center gap-1 ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}>
                              <Phone size={9} />{c.phone || "—"}
                            </span>
                          </div>
                        </div>
                        {c.city && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            isDark
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-blue-50 text-blue-600"
                          }`}>
                            <MapPin size={8} className="inline" /> {c.city}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showResults &&
                  searchQuery.length >= 2 &&
                  !searching &&
                  searchResults.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute left-0 right-0 top-full z-[100] mt-1 rounded-2xl border-2 px-4 py-3 text-center text-sm ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d] text-gray-400"
                        : "border-yellow-200 bg-white text-gray-500"
                    }`}
                  >
                    No match for "{searchQuery}"
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Add Customer */}
          <button
            type="button"
            onClick={onOpenCustomerDialog}
            disabled={screenLocked}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 ${
              isDark
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                : "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            }`}
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Add Customer</span>
          </button>

          {/* Customer info pill */}
          {hasCustomer && (
            <div className="relative" ref={customerRef}>
              <button
                type="button"
                onClick={() => setShowCustomerInfo((p) => !p)}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-2 py-1.5 text-xs transition-all ${
                  isDark
                    ? "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                }`}
              >
                <User size={12} />
                <div className="hidden sm:block text-left">
                  <span className="font-semibold max-w-[80px] truncate block leading-tight">
                    {customer.name}
                  </span>
                  {customer.phone && (
                    <span className={`text-[9px] leading-tight ${
                      isDark ? "text-green-300/60" : "text-green-600/60"
                    }`}>
                      {customer.phone}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={10}
                  className={`transition-transform ${
                    showCustomerInfo ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {showCustomerInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.08 }}
                    className={`absolute right-0 top-full z-[100] mt-1 w-52 rounded-2xl border-2 shadow-2xl p-3 ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d]"
                        : "border-yellow-200 bg-white"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          isDark
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          <User size={14} />
                        </div>
                        <div>
                          <span className={`font-bold text-sm block ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}>
                            {customer.name}
                          </span>
                          {customer.phone && (
                            <span className={`text-xs flex items-center gap-1 ${
                              isDark ? "text-gray-400" : "text-gray-500"
                            }`}>
                              <Phone size={9} />{customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      {customer.city && (
                        <div className={`flex items-center gap-1.5 text-xs ${
                          isDark ? "text-gray-400" : "text-gray-500"
                        }`}>
                          <MapPin size={10} />
                          {customer.city}
                          {customer.market && ` – ${customer.market}`}
                        </div>
                      )}
                      <div className={`h-px ${
                        isDark ? "bg-yellow-500/10" : "bg-gray-100"
                      }`} />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenCustomerDialog?.();
                            setShowCustomerInfo(false);
                          }}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                            isDark
                              ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                              : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={clearCustomer}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
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

      {/* Inline invoice viewer */}
      <AnimatePresence>
        {invoiceOrder && (
          <InvoicePrint
            order={invoiceOrder}
            store={store}
            onClose={() => setInvoiceOrder(null)}
            directPrint={false}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default BillerHeader;