// src/components/cashier/CashierDashboard.jsx
import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  collection, query, where, onSnapshot, orderBy,
  doc, getDoc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import {
  Search, Sun, Moon, LogOut,
  Clock, XCircle, User, Phone, Eye, Edit3,
  X, Zap, AlertTriangle, ChevronDown, ChevronUp, MapPin,
  Store, Receipt, Barcode, CreditCard, Hash, QrCode,
  Shield, Wifi, WifiOff, ScanLine, FileText, Package,
  CheckCircle, ArrowRight, Loader2, Info,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { db, auth } from "../../services/firebase";

import ViewBillModal from "./ViewBillModal";
import CancelBillModal from "./CancelBillModal";
import EditBillModal from "./EditBillModal";
import QRScannerModal from "./QRScannerModal";

/* ─── IndexedDB helpers ─── */
const IDB = "cashier_offline";
const IDB_S = "bills";
const openIDB = () =>
  new Promise((r, j) => {
    const q = indexedDB.open(IDB, 1);
    q.onupgradeneeded = (e) =>
      e.target.result.createObjectStore(IDB_S, { keyPath: "id" });
    q.onsuccess = (e) => r(e.target.result);
    q.onerror = (e) => j(e.target.error);
  });
const idbSave = async (b) => {
  try {
    const d = await openIDB();
    d.transaction(IDB_S, "readwrite")
      .objectStore(IDB_S)
      .put({ id: "s", bills: b, at: Date.now() });
  } catch {}
};
const idbLoad = async () => {
  try {
    const d = await openIDB();
    return new Promise((r) => {
      const q = d
        .transaction(IDB_S, "readonly")
        .objectStore(IDB_S)
        .get("s");
      q.onsuccess = (e) => r(e.target.result?.bills || []);
      q.onerror = () => r([]);
    });
  } catch {
    return [];
  }
};

const CashierDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showStats, setShowStats] = useState(false);

  // Bill search (history)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  // QR / Serial input (current bill)
  const [serialInput, setSerialInput] = useState("");
  const [serialResults, setSerialResults] = useState([]);
  const [showSerialResults, setShowSerialResults] = useState(false);
  const [serialNotFound, setSerialNotFound] = useState(false);
  const serialInputRef = useRef(null);
  const serialTimerRef = useRef(null);

  // USB scanner buffer
  const qrBufferRef = useRef("");
  const qrTimerRef = useRef(null);

  // Modals
  const [viewModal, setViewModal] = useState({ open: false, order: null });
  const [editModal, setEditModal] = useState({ open: false, order: null });
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [qrModal, setQrModal] = useState(false);

  const anyModalOpen =
    viewModal.open || editModal.open || cancelModal.open || qrModal;

  /* ─── Glass Theme Classes ─── */
  const bg = isDark
    ? "bg-gradient-to-br from-[#0a0805] via-[#0d0a04] to-[#0a0805]"
    : "bg-gradient-to-br from-gray-50 via-amber-50/20 to-gray-100";
  const glassBg = isDark
    ? "bg-[#1a1208]/60 backdrop-blur-2xl"
    : "bg-white/60 backdrop-blur-2xl";
  const glassCard = isDark
    ? "bg-[#1a1208]/40 backdrop-blur-xl"
    : "bg-white/50 backdrop-blur-xl";
  const border = isDark ? "border-[#2a1f0f]/60" : "border-gray-200/60";
  const borderSolid = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const mutedText = isDark ? "text-gray-600" : "text-gray-400";
  const inputBg = isDark
    ? "bg-[#120d06]/80 border-[#2a1f0f] text-gray-100 placeholder:text-gray-600"
    : "bg-white/80 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const accent = "text-amber-500";

  /* ─── Clock ─── */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ─── Online / Offline ─── */
  useEffect(() => {
    const u = () => setIsOnline(true);
    const d = () => {
      setIsOnline(false);
      toast("Offline mode active", {
        icon: <WifiOff className="w-4 h-4 text-red-400" />,
        duration: 3000,
      });
    };
    window.addEventListener("online", u);
    window.addEventListener("offline", d);
    return () => {
      window.removeEventListener("online", u);
      window.removeEventListener("offline", d);
    };
  }, []);

  /* ─── ESC key ─── */
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape" || anyModalOpen) return;
      if (showSearchResults || searchQuery) {
        e.preventDefault();
        setSearchQuery("");
        setShowSearchResults(false);
        setSearchNotFound(false);
      }
      if (showSerialResults || serialInput) {
        e.preventDefault();
        setSerialInput("");
        setShowSerialResults(false);
        setSerialNotFound(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [anyModalOpen, showSearchResults, searchQuery, showSerialResults, serialInput]);

  /* ─── Insert key focus ─── */
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Insert" || anyModalOpen) return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [anyModalOpen]);

  /* ─── User + Store ─── */
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists()) {
          const d = { uid: currentUser.uid, ...snap.data() };
          setUserData(d);
          if (d.storeId) {
            const ss = await getDoc(doc(db, "stores", d.storeId));
            if (ss.exists()) setStoreData({ id: ss.id, ...ss.data() });
          }
        } else {
          setUserData({
            uid: currentUser.uid,
            name: currentUser.email || "Cashier",
            role: "cashier",
          });
        }
      } catch {
        setUserData({
          uid: currentUser.uid,
          name: currentUser.email || "Cashier",
          role: "cashier",
        });
      }
    })();
  }, [currentUser]);

  /* ─── Firebase + IDB ─── */
  useEffect(() => {
    if (!currentUser || userData === null) {
      if (!currentUser) setLoading(false);
      return;
    }
    idbLoad().then((c) => {
      if (c.length > 0) setOrders((p) => (p.length === 0 ? c : p));
    });
    let q;
    try {
      q = userData?.storeId
        ? query(
            collection(db, "orders"),
            where("storeId", "==", userData.storeId),
            orderBy("createdAt", "desc")
          )
        : query(collection(db, "orders"), orderBy("createdAt", "desc"));
    } catch {
      q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        const f = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(f);
        setLoading(false);
        idbSave(f);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [currentUser, userData]);

  /* ─── Stats (no paid) ─── */
  const stats = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === "pending").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }),
    [orders]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "pending"),
    [orders]
  );

  /* ─── Bill Search (searches all orders) ─── */
  const performSearch = useCallback(
    (q) => {
      if (!q?.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        setSearchNotFound(false);
        return;
      }
      const uq = q.trim().toUpperCase();
      const r = orders.filter((o) => {
        const s = (o.billSerial || o.serialNo || "").toUpperCase();
        const n = (o.customer?.name || "").toUpperCase();
        const p = (o.customer?.phone || "").toUpperCase();
        return s.includes(uq) || n.includes(uq) || p.includes(uq);
      });
      setSearchResults(r);
      setShowSearchResults(true);
      setSearchNotFound(r.length === 0);
    },
    [orders]
  );

  const handleSearchChange = useCallback(
    (v) => {
      setSearchQuery(v);
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => performSearch(v), 300);
    },
    [performSearch]
  );

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    const uq = searchQuery.trim().toUpperCase();
    const exact = orders.find(
      (o) =>
        (o.billSerial || o.serialNo || "").toUpperCase() === uq
    );
    if (exact) {
      setViewModal({ open: true, order: exact });
      setSearchQuery("");
      setShowSearchResults(false);
      toast.success(
        `Bill #${exact.billSerial || exact.serialNo} found`,
        { icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> }
      );
      return;
    }
    performSearch(searchQuery);
  }, [searchQuery, orders, performSearch]);

  /* ─── Serial / QR live search (pending only) ─── */
  const performSerialSearch = useCallback(
    (q) => {
      if (!q?.trim()) {
        setSerialResults([]);
        setShowSerialResults(false);
        setSerialNotFound(false);
        return;
      }
      const uq = q.trim().toUpperCase();
      const r = pendingOrders.filter((o) => {
        const s = (o.billSerial || o.serialNo || "").toUpperCase();
        return s.includes(uq);
      });
      setSerialResults(r);
      setShowSerialResults(true);
      setSerialNotFound(r.length === 0);
    },
    [pendingOrders]
  );

  const handleSerialChange = useCallback(
    (v) => {
      setSerialInput(v);
      clearTimeout(serialTimerRef.current);
      serialTimerRef.current = setTimeout(() => performSerialSearch(v), 200);
    },
    [performSerialSearch]
  );

  const handleSerialSubmit = useCallback(() => {
    if (!serialInput.trim()) return;
    const uq = serialInput.trim().toUpperCase();
    const exact = pendingOrders.find(
      (o) => (o.billSerial || o.serialNo || "").toUpperCase() === uq
    );
    if (exact) {
      handleInstantPay(exact);
      setSerialInput("");
      setShowSerialResults(false);
      setSerialNotFound(false);
      return;
    }
    const found = orders.find(
      (o) => (o.billSerial || o.serialNo || "").toUpperCase() === uq
    );
    if (found) {
      if (found.status === "paid") {
        setViewModal({ open: true, order: found });
        toast(
          `Bill already paid`,
          { icon: <Eye className="w-4 h-4 text-amber-500" />, duration: 2500 }
        );
      } else if (found.status === "cancelled") {
        toast.error("Bill is cancelled", {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          duration: 2500,
        });
      }
      setSerialInput("");
      setShowSerialResults(false);
      return;
    }
    setSerialNotFound(true);
    toast.error(`Bill "${uq}" not found`, {
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      duration: 2500,
    });
  }, [serialInput, pendingOrders, orders]);

  /* ─── Instant Pay ─── */
  const handleInstantPay = useCallback(
    async (order) => {
      const tid = toast.loading("Processing payment...");
      const sid = userData?.storeId || order.storeId || "default";
      const cn = userData?.displayName || userData?.name || "Cashier";
      const now = new Date();
      try {
        await Promise.all([
          updateDoc(doc(db, "orders", order.id), {
            status: "paid",
            paymentType: order.paymentType || "Cash",
            paidAt: serverTimestamp(),
            paidBy: userData?.uid || "",
            paidByName: cn,
            billEndTime: now.toISOString(),
            amountReceived: order.totalAmount || 0,
            changeGiven: 0,
            cashierHandover: true,
          }),
          addDoc(collection(db, "cashierActions"), {
            actionType: "PAID",
            orderId: order.id,
            billSerial: order.billSerial || order.serialNo || "",
            serialNo: order.serialNo || order.billSerial || "",
            storeId: sid,
            cashierId: userData?.uid || "",
            cashierName: cn,
            totalAmount: order.totalAmount || 0,
            totalDiscount: order.totalDiscount || 0,
            totalQty: order.totalQty || 0,
            paymentType: order.paymentType || "Cash",
            customer: order.customer || {},
            items: order.items || [],
            billerName: order.billerName || "",
            billerId: order.billerId || "",
            date: now.toISOString().split("T")[0],
            time: now.toLocaleTimeString("en-PK"),
            timestamp: serverTimestamp(),
          }),
          addDoc(collection(db, "auditLogs"), {
            action: "PAYMENT_RECEIVED",
            orderId: order.id,
            billSerial: order.billSerial || order.serialNo,
            userId: userData?.uid || "",
            userName: cn,
            storeId: sid,
            amount: order.totalAmount,
            paymentType: order.paymentType || "Cash",
            timestamp: serverTimestamp(),
          }),
        ]);
        toast.success(
          `Paid #${order.billSerial || order.serialNo} — Rs.${(order.totalAmount || 0).toLocaleString()}`,
          {
            id: tid,
            duration: 2500,
            icon: <Zap className="w-4 h-4 text-emerald-500" />,
          }
        );
      } catch (err) {
        console.error(err);
        toast.error("Payment failed", {
          id: tid,
          icon: <XCircle className="w-4 h-4 text-red-500" />,
        });
      }
    },
    [userData]
  );

  /* ─── QR Camera result ─── */
  const handleQRPunch = useCallback(
    (code) => {
      const q = (code || "").toUpperCase().trim();
      if (!q) return;
      const found = orders.find(
        (o) =>
          (o.billSerial || "").toUpperCase() === q ||
          (o.serialNo || "").toUpperCase() === q
      );
      if (!found) {
        toast.error(`Bill "${q}" not found`, {
          icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
          duration: 2500,
        });
        return;
      }
      if (found.status === "paid") {
        setViewModal({ open: true, order: found });
        toast("Paid bill — view only", {
          icon: <Eye className="w-4 h-4 text-amber-500" />,
          duration: 2000,
        });
        return;
      }
      if (found.status === "cancelled") {
        toast.error("Bill cancelled", {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          duration: 2500,
        });
        return;
      }
      handleInstantPay(found);
    },
    [orders, handleInstantPay]
  );

  const handleQRResult = useCallback(
    (code) => {
      setQrModal(false);
      handleQRPunch(code);
    },
    [handleQRPunch]
  );

  /* ─── USB barcode scanner ─── */
  useEffect(() => {
    const h = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (anyModalOpen) return;
      if (e.key === "Enter") {
        const b = qrBufferRef.current.trim();
        if (b.length >= 1) {
          handleQRPunch(b);
          qrBufferRef.current = "";
        }
        return;
      }
      if (e.key.length === 1) {
        qrBufferRef.current += e.key;
        clearTimeout(qrTimerRef.current);
        qrTimerRef.current = setTimeout(() => {
          qrBufferRef.current = "";
        }, 100);
      }
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      clearTimeout(qrTimerRef.current);
    };
  }, [handleQRPunch, anyModalOpen]);

  /* ─── Logout ─── */
  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch {
      toast.error("Logout failed", {
        icon: <XCircle className="w-4 h-4 text-red-500" />,
      });
    }
  }, [navigate]);

  /* ─── Formatters ─── */
  const fmtTime = (d) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const fmtDate = (d) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  const fmtTS = (ts) => {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "paid":
        return {
          label: "PAID",
          icon: CheckCircle,
          colors: isDark
            ? "bg-emerald-900/30 border-emerald-700 text-emerald-400"
            : "bg-emerald-50 border-emerald-200 text-emerald-600",
          borderLeft: "border-l-emerald-500",
        };
      case "cancelled":
        return {
          label: "CANCELLED",
          icon: XCircle,
          colors: isDark
            ? "bg-red-900/30 border-red-700 text-red-400"
            : "bg-red-50 border-red-200 text-red-600",
          borderLeft: "border-l-red-500",
        };
      default:
        return {
          label: "PENDING",
          icon: Clock,
          colors: isDark
            ? "bg-amber-900/30 border-amber-700 text-amber-500"
            : "bg-amber-50 border-amber-200 text-amber-600",
          borderLeft: "border-l-amber-500",
        };
    }
  };

  /* ─── Loading ─── */
  if (loading)
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className={`${text} text-lg font-bold`}>Loading Dashboard</p>
          <p className={`${subText} text-sm mt-1`}>Connecting to store...</p>
        </div>
      </div>
    );

  /* ─── RENDER ─── */
  return (
    <div className={`min-h-screen ${bg} ${text}`}>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-600/90 backdrop-blur-sm text-white text-center text-xs py-2 font-bold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          Offline — Bills preserved locally. Reconnect to sync.
        </div>
      )}

      {/* ═══ NAVBAR ═══ */}
      <nav
        className={`sticky top-0 z-40 ${glassBg} border-b ${border} shadow-lg shadow-black/5`}
      >
        <div className="px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo + Store */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Store className="text-white w-5 h-5" />
              </div>
              <div>
                <h1 className={`font-extrabold text-base ${text}`}>
                  {storeData?.name || "POS Cashier"}
                </h1>
                <p className={`text-xs ${subText} flex items-center gap-1`}>
                  <MapPin className="w-3 h-3 text-amber-500" />
                  {storeData?.city || "Store"}
                </p>
              </div>
            </div>

            {/* Center: Clock */}
            <div className="hidden md:flex flex-col items-center">
              <p className={`text-base font-bold ${accent}`}>
                {fmtTime(currentTime)}
              </p>
              <p className={`text-xs ${subText}`}>{fmtDate(currentTime)}</p>
            </div>

            {/* Right: Status + User + Actions */}
            <div className="flex items-center gap-2">
              <div
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                  isOnline
                    ? isDark
                      ? "bg-emerald-900/20 text-emerald-400 border-emerald-800/50"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : isDark
                    ? "bg-red-900/20 text-red-400 border-red-800/50"
                    : "bg-red-50 text-red-600 border-red-200"
                }`}
              >
                {isOnline ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {isOnline ? "Live" : "Offline"}
              </div>

              <div
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                  isDark
                    ? "bg-amber-900/15 border-amber-800/50"
                    : "bg-amber-50/80 border-amber-200"
                }`}
              >
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-sm">
                  <User className="text-white w-3.5 h-3.5" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${text}`}>
                    {userData?.displayName || userData?.name || "Cashier"}
                  </p>
                  <p className={`text-[10px] ${subText} capitalize`}>
                    {userData?.role || "cashier"}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border ${border} ${glassCard} hover:border-amber-500/50 transition-all`}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <LogOut className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="px-4 lg:px-6 py-4 space-y-4 max-w-[1600px] mx-auto">
        {/* Stats Toggle */}
        <button
          onClick={() => setShowStats((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
            isDark
              ? `${glassCard} border-[#2a1f0f]/60 text-gray-400 hover:border-amber-700/60`
              : "bg-white/60 backdrop-blur-xl border-gray-200/60 text-gray-500 hover:border-amber-300"
          }`}
        >
          {showStats ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {showStats ? "Hide Stats" : "Show Stats"}
          <span
            className={`text-xs px-2 py-0.5 rounded-md font-bold ${
              isDark
                ? "bg-amber-900/30 text-amber-400"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {stats.pending} pending
          </span>
        </button>

        {/* Stats Cards */}
        {showStats && (
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`${glassCard} border ${border} rounded-2xl px-4 py-3 flex items-center gap-3`}
            >
              <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-amber-500">
                  {stats.pending}
                </p>
                <p className={`text-xs ${subText}`}>Pending</p>
              </div>
            </div>
            <div
              className={`${glassCard} border ${border} rounded-2xl px-4 py-3 flex items-center gap-3`}
            >
              <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-red-500">
                  {stats.cancelled}
                </p>
                <p className={`text-xs ${subText}`}>Cancelled</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ EQUAL SIZE: Search + QR/Serial ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* LEFT: Bill Search (finds any bill from history) */}
          <div
            className={`${glassCard} border ${border} rounded-2xl p-4`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center">
                <Search className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className={`text-sm font-bold ${text}`}>Search Bills</p>
                <p className={`text-[10px] ${mutedText}`}>
                  Find any bill by serial, name, phone
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FileText
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Bill #, name, phone..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchSubmit();
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.length >= 1) performSearch(searchQuery);
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowSearchResults(false), 200)
                  }
                  className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${inputBg} ${
                    searchNotFound
                      ? "border-red-500 ring-2 ring-red-500/20"
                      : ""
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                      setSearchNotFound(false);
                      searchInputRef.current?.focus();
                    }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} hover:text-red-500 transition-colors`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Search Dropdown */}
                {showSearchResults && (
                  <div
                    className={`absolute top-full left-0 right-0 mt-2 ${glassBg} border ${border} rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto`}
                  >
                    {searchNotFound ? (
                      <div className="px-4 py-6 text-center">
                        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className={`text-sm font-bold ${text}`}>
                          Not Found
                        </p>
                        <p className={`text-xs ${subText} mt-1`}>
                          No match for &quot;{searchQuery}&quot;
                        </p>
                      </div>
                    ) : (
                      searchResults.map((bill) => {
                        const sc = getStatusConfig(bill.status);
                        return (
                          <button
                            key={bill.id}
                            onClick={() => {
                              setViewModal({ open: true, order: bill });
                              setSearchQuery("");
                              setShowSearchResults(false);
                            }}
                            className={`w-full text-left px-4 py-3 border-b ${border} last:border-b-0 hover:bg-amber-500/5 transition-colors flex items-center justify-between`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${sc.colors}`}
                              >
                                <sc.icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${text}`}>
                                  #{bill.billSerial || bill.serialNo}
                                </p>
                                <p className={`text-xs ${subText}`}>
                                  {bill.customer?.name || "Walk-in"}
                                  {bill.customer?.phone
                                    ? ` | ${bill.customer.phone}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${accent}`}>
                                Rs.
                                {(bill.totalAmount || 0).toLocaleString()}
                              </p>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${sc.colors}`}
                              >
                                {sc.label}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearchSubmit}
                className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform hover:shadow-xl"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-[10px] ${mutedText} mt-2 flex items-center gap-1`}>
              <Info className="w-3 h-3" />
              Searches all bills — paid, pending, cancelled
            </p>
          </div>

          {/* RIGHT: Serial / QR Code Input (for current bill punch) */}
          <div
            className={`${glassCard} border ${border} rounded-2xl p-4`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center">
                <QrCode className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${text}`}>
                  QR / Serial Punch
                </p>
                <p className={`text-[10px] ${mutedText}`}>
                  Scan or type to instantly pay pending bill
                </p>
              </div>
              <button
                onClick={() => setQrModal(true)}
                className={`p-2 rounded-xl border-2 border-dashed transition-all flex items-center gap-1 ${
                  isDark
                    ? "border-amber-700/60 text-amber-400 hover:border-amber-500 bg-amber-900/10"
                    : "border-amber-300 text-amber-600 hover:border-amber-500 bg-amber-50/80"
                }`}
                title="Open Camera Scanner"
              >
                <ScanLine className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`}
                />
                <input
                  ref={serialInputRef}
                  type="text"
                  placeholder="Scan barcode or type serial..."
                  value={serialInput}
                  onChange={(e) => handleSerialChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSerialSubmit();
                    }
                  }}
                  onFocus={() => {
                    if (serialInput.length >= 1)
                      performSerialSearch(serialInput);
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowSerialResults(false), 200)
                  }
                  className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all ${inputBg} ${
                    serialNotFound
                      ? "border-red-500 ring-2 ring-red-500/20"
                      : ""
                  }`}
                />
                {serialInput && (
                  <button
                    onClick={() => {
                      setSerialInput("");
                      setShowSerialResults(false);
                      setSerialNotFound(false);
                      serialInputRef.current?.focus();
                    }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} hover:text-red-500 transition-colors`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Serial Dropdown */}
                {showSerialResults && (
                  <div
                    className={`absolute top-full left-0 right-0 mt-2 ${glassBg} border ${border} rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto`}
                  >
                    {serialNotFound ? (
                      <div className="px-4 py-6 text-center">
                        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className={`text-sm font-bold ${text}`}>
                          No Pending Bill
                        </p>
                        <p className={`text-xs ${subText} mt-1`}>
                          No pending bill matches &quot;{serialInput}&quot;
                        </p>
                      </div>
                    ) : (
                      serialResults.map((bill) => (
                        <button
                          key={bill.id}
                          onClick={() => {
                            handleInstantPay(bill);
                            setSerialInput("");
                            setShowSerialResults(false);
                          }}
                          className={`w-full text-left px-4 py-3 border-b ${border} last:border-b-0 hover:bg-emerald-500/5 transition-colors flex items-center justify-between group`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                              <Receipt className="w-4 h-4 text-amber-500" />
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${text}`}>
                                #{bill.billSerial || bill.serialNo}
                              </p>
                              <p className={`text-xs ${subText}`}>
                                {bill.customer?.name || "Walk-in"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${accent}`}>
                                Rs.
                                {(bill.totalAmount || 0).toLocaleString()}
                              </p>
                              <p className={`text-[10px] ${subText}`}>
                                {bill.items?.length || 0} items
                              </p>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Zap className="w-4 h-4 text-emerald-500" />
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={handleSerialSubmit}
                className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-transform hover:shadow-xl"
              >
                <Zap className="w-5 h-5" />
              </button>
            </div>
            <div className={`mt-2 flex items-center gap-2 text-[10px] ${mutedText}`}>
              <div
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span>
                {isOnline ? "Scanner ready" : "Offline"} — Pending bills
                auto-pay on Enter
              </span>
              <span className="ml-auto">
                <span className={`font-bold ${accent}`}>{stats.pending}</span>{" "}
                pending
              </span>
            </div>
          </div>
        </div>

        {/* ═══ PENDING BILLS LIST ═══ */}
        <div
          className={`${glassCard} border ${border} rounded-2xl overflow-hidden`}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 border-b ${border} flex items-center justify-between`}
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              <h2 className={`text-sm font-bold ${text}`}>Pending Bills</h2>
              <span
                className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                  isDark
                    ? "bg-amber-900/30 text-amber-400"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {pendingOrders.length}
              </span>
            </div>
            {pendingOrders.length > 0 && (
              <p className={`text-xs font-bold ${accent}`}>
                Total: Rs.
                {pendingOrders
                  .reduce((s, o) => s + (o.totalAmount || 0), 0)
                  .toLocaleString()}
              </p>
            )}
          </div>

          {pendingOrders.length === 0 ? (
            <div className="p-16 text-center">
              <div
                className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  isDark ? "bg-[#1a1208]/60" : "bg-gray-100/60"
                }`}
              >
                <Receipt
                  className={`w-10 h-10 ${mutedText}`}
                />
              </div>
              <p className={`text-lg font-bold ${text}`}>No Pending Bills</p>
              <p className={`text-sm ${subText} mt-1`}>
                All bills have been processed
              </p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
              {pendingOrders.map((order, i) => (
                <div
                  key={order.id}
                  className={`border-b ${border} last:border-b-0 hover:bg-amber-500/[0.03] transition-all border-l-4 border-l-amber-500`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Left info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isDark
                              ? "bg-amber-500/15"
                              : "bg-amber-50"
                          }`}
                        >
                          <span
                            className={`text-xs font-extrabold ${accent}`}
                          >
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-extrabold ${accent}`}
                            >
                              #{order.billSerial || order.serialNo}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isDark
                                  ? "bg-amber-900/30 border-amber-700 text-amber-500"
                                  : "bg-amber-50 border-amber-200 text-amber-600"
                              }`}
                            >
                              PENDING
                            </span>
                            {order.lastEditedBy && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                                  isDark
                                    ? "bg-purple-900/20 text-purple-400"
                                    : "bg-purple-50 text-purple-700"
                                }`}
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                Edited
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span
                              className={`flex items-center gap-1 text-xs ${text} font-medium`}
                            >
                              <User className="w-3 h-3 text-amber-500" />
                              {order.customer?.name || "Walking Customer"}
                            </span>
                            {order.customer?.phone && (
                              <span
                                className={`flex items-center gap-1 text-xs ${subText}`}
                              >
                                <Phone className="w-3 h-3 text-amber-500" />
                                {order.customer.phone}
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1 text-xs ${subText}`}
                            >
                              <Clock className="w-3 h-3 text-amber-500" />
                              {fmtTS(order.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount + Actions */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <div className="text-right mr-1 sm:mr-2">
                          <p
                            className={`text-sm sm:text-base font-extrabold ${accent}`}
                          >
                            Rs.
                            {(order.totalAmount || 0).toLocaleString()}
                          </p>
                          <p className={`text-[10px] ${subText}`}>
                            {order.items?.length || 0} items
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setViewModal({ open: true, order })
                          }
                          title="View"
                          className={`p-1.5 sm:p-2 rounded-lg border ${border} ${subText} hover:text-blue-500 hover:border-blue-500/50 active:scale-95 transition-all`}
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setEditModal({ open: true, order })
                          }
                          title="Edit"
                          className="p-1.5 sm:p-2 rounded-lg bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 active:scale-95 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() => handleInstantPay(order)}
                          title="Pay"
                          className="p-1.5 sm:p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-500/20 transition-all"
                        >
                          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setCancelModal({ open: true, order })
                          }
                          title="Cancel"
                          className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {pendingOrders.length > 0 && (
            <div
              className={`px-4 py-3 border-t ${border} flex items-center justify-between ${
                isDark ? "bg-[#14100a]/60" : "bg-gray-50/60"
              }`}
            >
              <p className={`text-xs ${subText} flex items-center gap-1`}>
                <Package className="w-3 h-3" />
                {pendingOrders.length} pending bill
                {pendingOrders.length !== 1 ? "s" : ""}
              </p>
              <p className={`text-sm font-extrabold ${accent}`}>
                Rs.
                {pendingOrders
                  .reduce((s, o) => s + (o.totalAmount || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {viewModal.open && (
        <ViewBillModal
          order={viewModal.order}
          isDark={isDark}
          userData={userData}
          storeData={storeData}
          onClose={() => setViewModal({ open: false, order: null })}
          onPayment={(o) => {
            setViewModal({ open: false, order: null });
            handleInstantPay(o);
          }}
          onEdit={(o) => {
            setViewModal({ open: false, order: null });
            setEditModal({ open: true, order: o });
          }}
          onCancel={(o) => {
            setViewModal({ open: false, order: null });
            setCancelModal({ open: true, order: o });
          }}
        />
      )}
      {editModal.open && (
        <EditBillModal
          order={editModal.order}
          isDark={isDark}
          userData={userData}
          storeData={storeData}
          onClose={() => setEditModal({ open: false, order: null })}
          onPayment={(o) => {
            setEditModal({ open: false, order: null });
            handleInstantPay(o);
          }}
        />
      )}
      {cancelModal.open && (
        <CancelBillModal
          order={cancelModal.order}
          isDark={isDark}
          userData={userData}
          onClose={() => setCancelModal({ open: false, order: null })}
        />
      )}
      {qrModal && (
        <QRScannerModal
          isDark={isDark}
          orders={orders}
          onResult={handleQRResult}
          onClose={() => setQrModal(false)}
        />
      )}
    </div>
  );
};

export default CashierDashboard;