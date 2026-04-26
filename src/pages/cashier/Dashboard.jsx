// src/components/cashier/CashierDashboard.jsx
// ✅ No Paid tab | No cancelled in list | QR pending only
// ✅ 1000 bills scrollable | Cancel saves to cashierActions
// ✅ Latest bill on top | Responsive

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { useAuth }    from "../../context/AuthContext";
import { useTheme }   from "../../context/ThemeContext";
import {
  collection, query, where, onSnapshot, orderBy,
  doc, getDoc, updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import {
  FiSearch, FiRefreshCw, FiSun, FiMoon, FiLogOut,
  FiClock, FiCheckCircle, FiXCircle, FiUser, FiMapPin,
  FiPhone, FiEye, FiEdit3, FiX, FiZap, FiAlertTriangle,
  FiChevronDown, FiChevronUp,
} from "react-icons/fi";
import { MdPointOfSale, MdReceiptLong } from "react-icons/md";
import { BsUpcScan } from "react-icons/bs";
import { signOut }      from "firebase/auth";
import { useNavigate }  from "react-router-dom";
import { toast }        from "react-hot-toast";
import { db, auth }     from "../../services/firebase";

import ViewBillModal   from "./ViewBillModal";
import CancelBillModal from "./CancelBillModal";
import EditBillModal   from "./EditBillModal";
import QRScannerModal  from "./QRScannerModal";

const CashierDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser }         = useAuth();
  const navigate                = useNavigate();

  const [userData,     setUserData]     = useState(null);
  const [storeData,    setStoreData]    = useState(null);
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [currentTime,  setCurrentTime]  = useState(new Date());
  const [showStats,    setShowStats]    = useState(false);

  // Search
  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchResults,     setSearchResults]     = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchNotFound,    setSearchNotFound]    = useState(false);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  // QR buffer
  const qrBufferRef = useRef("");
  const qrTimerRef  = useRef(null);

  // Modals
  const [viewModal,   setViewModal]   = useState({ open: false, order: null });
  const [editModal,   setEditModal]   = useState({ open: false, order: null });
  const [cancelModal, setCancelModal] = useState({ open: false, order: null });
  const [qrModal,     setQrModal]     = useState(false);

  // Theme helpers
  const bg      = isDark ? "bg-[#0a0805]"     : "bg-gray-50";
  const cardBg  = isDark ? "bg-[#1a1208]"     : "bg-white";
  const border  = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text    = isDark ? "text-gray-100"     : "text-gray-900";
  const subText = isDark ? "text-gray-400"     : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100 placeholder:text-gray-600"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const accent = "text-amber-500";

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // User + store
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
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
          setUserData({ uid: currentUser.uid, name: currentUser.email || "Cashier", role: "cashier" });
        }
      } catch {
        setUserData({ uid: currentUser.uid, name: currentUser.email || "Cashier", role: "cashier" });
      }
    })();
  }, [currentUser]);

  // ✅ Real-time orders — limit 1000, latest first
  useEffect(() => {
    if (!currentUser || userData === null) {
      if (!currentUser) setLoading(false);
      return;
    }

    let q;
    try {
      q = userData?.storeId
        ? query(collection(db, "orders"), where("storeId", "==", userData.storeId), orderBy("createdAt", "desc"))
        : query(collection(db, "orders"), orderBy("createdAt", "desc"));
    } catch {
      q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    }

    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => {
      // Fallback
      onSnapshot(collection(db, "orders"), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return db2 - da;
          });
        setOrders(data);
        setLoading(false);
      });
    });
    return () => unsub();
  }, [currentUser, userData]);

  // Stats
  const stats = useMemo(() => ({
    total:     orders.length,
    pending:   orders.filter((o) => o.status === "pending").length,
    paid:      orders.filter((o) => o.status === "paid").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  // ✅ Only pending orders (for search + QR)
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "pending"),
    [orders],
  );

  // ✅ Filtered: ONLY pending shown (no paid, no cancelled in main list)
  const filteredOrders = useMemo(() => {
    return pendingOrders;
  }, [pendingOrders]);

  // ════════════════════════════════════════════════════════════════════════
  // ✅ SEARCH — Pending only
  // ════════════════════════════════════════════════════════════════════════
  const performSearch = useCallback((q) => {
    if (!q || !q.trim()) {
      setSearchResults([]); setShowSearchResults(false); setSearchNotFound(false); return;
    }
    const uq = q.trim().toUpperCase();
    const results = pendingOrders.filter((o) => {
      const serial = (o.billSerial || o.serialNo || "").toUpperCase();
      const name   = (o.customer?.name  || "").toUpperCase();
      const phone  = (o.customer?.phone || "").toUpperCase();
      return serial.includes(uq) || name.includes(uq) || phone.includes(uq);
    });
    setSearchResults(results);
    setShowSearchResults(true);
    setSearchNotFound(results.length === 0);
  }, [pendingOrders]);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(value), 80);
  }, [performSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    const uq = searchQuery.trim().toUpperCase();
    const exact = pendingOrders.find(
      (o) => (o.billSerial || o.serialNo || "").toUpperCase() === uq,
    );
    if (exact) {
      setViewModal({ open: true, order: exact });
      setSearchQuery(""); setShowSearchResults(false);
      toast.success(`Bill #${exact.billSerial || exact.serialNo} found!`, { icon: "⚡" });
      return;
    }
    performSearch(searchQuery);
  }, [searchQuery, pendingOrders, performSearch]);

  // ════════════════════════════════════════════════════════════════════════
  // ✅ QR Punch — pending only
  // ════════════════════════════════════════════════════════════════════════
  const handleQRPunch = useCallback((code) => {
    const q = (code || "").toUpperCase().trim();
    if (!q) return;

    const found = pendingOrders.find(
      (o) => (o.billSerial || "").toUpperCase() === q ||
             (o.serialNo  || "").toUpperCase() === q,
    );

    if (found) {
      handleInstantPay(found);
    } else {
      toast.error(`Bill #${code} not found in pending bills`, { icon: "❌", duration: 2500 });
    }
  }, [pendingOrders]); // eslint-disable-line

  // ════════════════════════════════════════════════════════════════════════
  // ✅ INSTANT PAY — Save to cashierActions + mark paid
  // ════════════════════════════════════════════════════════════════════════
  const handleInstantPay = useCallback(async (order) => {
    const tid = toast.loading("Processing...");
    const storeId     = userData?.storeId || order.storeId || "default";
    const cashierName = userData?.displayName || userData?.name || "Cashier";
    const now         = new Date();

    try {
      await Promise.all([
        // 1. Mark paid
        updateDoc(doc(db, "orders", order.id), {
          status:          "paid",
          paymentType:     order.paymentType || "Cash",
          paidAt:          serverTimestamp(),
          paidBy:          userData?.uid || "",
          paidByName:      cashierName,
          billEndTime:     now.toISOString(),
          amountReceived:  order.totalAmount || 0,
          changeGiven:     0,
          cashierHandover: true,
        }),

        // 2. ✅ cashierActions collection
        addDoc(collection(db, "cashierActions"), {
          actionType:    "PAID",
          orderId:       order.id,
          billSerial:    order.billSerial || order.serialNo || "—",
          serialNo:      order.serialNo  || order.billSerial || "—",
          storeId,
          cashierId:     userData?.uid || "",
          cashierName,
          reason:        "Payment received",
          totalAmount:   order.totalAmount   || 0,
          totalDiscount: order.totalDiscount || 0,
          totalQty:      order.totalQty      || 0,
          paymentType:   order.paymentType   || "Cash",
          customer:      order.customer      || {},
          items:         order.items         || [],
          billerName:    order.billerName    || "",
          billerId:      order.billerId      || "",
          date:          now.toISOString().split("T")[0],
          time:          now.toLocaleTimeString("en-PK"),
          timestamp:     serverTimestamp(),
        }),

        // 3. Audit
        addDoc(collection(db, "auditLogs"), {
          action:      "PAYMENT_RECEIVED",
          orderId:     order.id,
          billSerial:  order.billSerial || order.serialNo,
          userId:      userData?.uid || "",
          userName:    cashierName,
          storeId,
          amount:      order.totalAmount,
          paymentType: order.paymentType || "Cash",
          timestamp:   serverTimestamp(),
        }),
      ]);

      toast.success(
        `⚡ PAID! #${order.billSerial || order.serialNo} — Rs.${(order.totalAmount || 0).toLocaleString()}`,
        { id: tid, duration: 2500 },
      );
    } catch (err) {
      console.error(err);
      toast.error("Payment failed!", { id: tid });
    }
  }, [userData]);

  const handleQRResult = useCallback((code) => {
    setQrModal(false);
    handleQRPunch(code);
  }, [handleQRPunch]);

  // USB scanner global
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Enter") {
        const buf = qrBufferRef.current.trim();
        if (buf.length >= 1) { handleQRPunch(buf); qrBufferRef.current = ""; }
        return;
      }
      if (e.key.length === 1) {
        qrBufferRef.current += e.key;
        clearTimeout(qrTimerRef.current);
        qrTimerRef.current = setTimeout(() => { qrBufferRef.current = ""; }, 100);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); clearTimeout(qrTimerRef.current); };
  }, [handleQRPunch]);

  const handleLogout = useCallback(async () => {
    try { await signOut(auth); navigate("/login"); } catch { toast.error("Logout failed"); }
  }, [navigate]);

  // Formatters
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const fmtTS   = (ts) => {
    if (!ts) return "—";
    try { const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={`${text} text-lg font-bold`}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} ${text}`}>

      {/* ── NAVBAR ── */}
      <nav className={`sticky top-0 z-40 ${cardBg} border-b ${border} shadow-sm`}>
        <div className="px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <MdPointOfSale className="text-white w-5 h-5" />
              </div>
              <div>
                <h1 className={`font-extrabold text-base ${text}`}>{storeData?.name || "POS Cashier"}</h1>
                <p className={`text-xs ${subText} flex items-center gap-1`}>
                  <FiMapPin className="w-3 h-3 text-amber-500" />{storeData?.city || "Store"}
                </p>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center">
              <p className={`text-base font-bold ${accent}`}>{fmtTime(currentTime)}</p>
              <p className={`text-xs ${subText}`}>{fmtDate(currentTime)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}>
                <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center">
                  <FiUser className="text-white w-3.5 h-3.5" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${text}`}>{userData?.displayName || userData?.name || "Cashier"}</p>
                  <p className={`text-[10px] ${subText} capitalize`}>{userData?.role || "cashier"}</p>
                </div>
              </div>
              <button onClick={toggleTheme} className={`p-2 rounded-lg border ${border} ${cardBg} hover:border-amber-500`}>
                {isDark ? <FiSun className="w-4 h-4 text-amber-400" /> : <FiMoon className="w-4 h-4 text-gray-600" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20">
                <FiLogOut className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="px-4 lg:px-6 py-4 space-y-4">

        {/* ── Stats toggle ── */}
        <button onClick={() => setShowStats((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
            isDark ? "border-[#2a1f0f] text-gray-400 hover:border-amber-700" : "border-gray-200 text-gray-500 hover:border-amber-300"
          }`}>
          {showStats ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
          {showStats ? "Hide Stats" : "Show Stats"}
          <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${isDark ? "bg-amber-900/30 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
            {stats.pending} pending
          </span>
        </button>

        {showStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className={`${cardBg} border ${border} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center"><FiClock className="w-4 h-4 text-amber-500" /></div>
              <div><p className="text-xl font-extrabold text-amber-500">{stats.pending}</p><p className={`text-xs ${subText}`}>Pending</p></div>
            </div>
            <div className={`${cardBg} border ${border} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center"><FiCheckCircle className="w-4 h-4 text-emerald-500" /></div>
              <div><p className="text-xl font-extrabold text-emerald-500">{stats.paid}</p><p className={`text-xs ${subText}`}>Paid (Firebase)</p></div>
            </div>
            <div className={`${cardBg} border ${border} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center"><FiXCircle className="w-4 h-4 text-red-500" /></div>
              <div><p className="text-xl font-extrabold text-red-500">{stats.cancelled}</p><p className={`text-xs ${subText}`}>Cancelled</p></div>
            </div>
          </div>
        )}

        {/* ── SEARCH + QR ── */}
        <div className={`${cardBg} border ${border} rounded-xl p-4`}>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pending bill #, name, phone..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleSearchSubmit(); }
                  if (e.key === "Escape") { setSearchQuery(""); setShowSearchResults(false); setSearchNotFound(false); }
                }}
                onFocus={() => { if (searchQuery.length >= 1) performSearch(searchQuery); }}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-medium
                  focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30
                  transition-all ${inputBg} ${searchNotFound ? "border-red-500 ring-2 ring-red-500/20" : ""}`}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setShowSearchResults(false); setSearchNotFound(false); searchInputRef.current?.focus(); }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${subText} hover:text-red-500`}>
                  <FiX className="w-4 h-4" />
                </button>
              )}

              {/* ✅ Dropdown — pending only */}
              {showSearchResults && (
                <div className={`absolute top-full left-0 right-0 mt-2 ${cardBg} border ${border} rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto`}>
                  {searchNotFound ? (
                    <div className="px-4 py-6 text-center">
                      <FiAlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className={`text-sm font-bold ${text}`}>Not Found</p>
                      <p className={`text-xs ${subText} mt-1`}>No pending bill matches "{searchQuery}"</p>
                    </div>
                  ) : searchResults.map((bill) => (
                    <button key={bill.id}
                      onClick={() => { setViewModal({ open: true, order: bill }); setSearchQuery(""); setShowSearchResults(false); }}
                      className={`w-full text-left px-4 py-3 border-b ${border} last:border-b-0 hover:bg-amber-500/10 transition-colors flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20">
                          <FiClock className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${text}`}>#{bill.billSerial || bill.serialNo}</p>
                          <p className={`text-xs ${subText}`}>{bill.customer?.name || "Walking Customer"}{bill.customer?.phone ? ` • ${bill.customer.phone}` : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${accent}`}>Rs. {(bill.totalAmount || 0).toLocaleString()}</p>
                        <p className="text-xs font-bold text-amber-500">PENDING</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSearchSubmit}
              className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 active:scale-95">
              <FiSearch className="w-5 h-5" />
            </button>

            <button onClick={() => setQrModal(true)}
              className={`px-4 py-3 rounded-xl border-2 border-dashed font-bold active:scale-95 flex items-center gap-2 ${
                isDark ? "border-amber-700 text-amber-400 hover:border-amber-500 bg-amber-900/10"
                       : "border-amber-300 text-amber-600 hover:border-amber-500 bg-amber-50"
              }`}>
              <BsUpcScan className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">QR</span>
            </button>
          </div>

          <div className={`mt-2 flex items-center gap-2 text-xs ${subText}`}>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>USB Scanner Ready — Pending bills only</span>
            <span className="ml-auto">
              <span className="font-bold text-amber-500">{stats.pending}</span> pending
            </span>
          </div>
        </div>

        {/* ── BILLS LIST — Pending only, latest first, scrollable ── */}
        <div className={`${cardBg} border ${border} rounded-xl overflow-hidden`}>
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <MdReceiptLong className={`w-16 h-16 ${subText} mx-auto mb-4 opacity-20`} />
              <p className={`text-lg font-bold ${text}`}>No Pending Bills</p>
              <p className={`text-sm ${subText} mt-1`}>All bills have been processed</p>
              {stats.paid > 0 && (
                <p className={`text-xs ${subText} mt-3 flex items-center justify-center gap-1`}>
                  <FiCheckCircle className="w-3 h-3 text-emerald-500" />
                  {stats.paid} paid + {stats.cancelled} cancelled in Firebase
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
              {filteredOrders.map((order, index) => (
                <div key={order.id}
                  className={`border-b ${border} last:border-b-0 transition-all hover:bg-amber-500/5 border-l-4 border-l-amber-500`}>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Left */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/20">
                          <span className={`text-xs font-extrabold ${accent}`}>{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-extrabold ${accent}`}>#{order.billSerial || order.serialNo}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isDark ? "bg-amber-900/30 border-amber-700 text-amber-500" : "bg-amber-50 border-amber-200 text-amber-600"
                            }`}>PENDING</span>
                            {order.lastEditedBy && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-700"
                              }`}><FiEdit3 className="w-2.5 h-2.5" />Edited</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={`flex items-center gap-1 text-xs ${text} font-medium`}>
                              <FiUser className="w-3 h-3 text-amber-500" />{order.customer?.name || "Walking Customer"}
                            </span>
                            {order.customer?.phone && (
                              <span className={`flex items-center gap-1 text-xs ${subText}`}>
                                <FiPhone className="w-3 h-3 text-amber-500" />{order.customer.phone}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 text-xs ${subText}`}>
                              <FiClock className="w-3 h-3 text-amber-500" />{fmtTS(order.createdAt)}
                            </span>
                            {order.billerName && <span className={`text-xs ${subText}`}>by {order.billerName}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <div className="text-right mr-1 sm:mr-2">
                          <p className={`text-sm sm:text-base font-extrabold ${accent}`}>
                            Rs. {(order.totalAmount || 0).toLocaleString()}
                          </p>
                          <p className={`text-[10px] ${subText}`}>
                            {order.items?.length || 0} items
                          </p>
                        </div>

                        <button onClick={() => setViewModal({ open: true, order })}
                          className={`p-1.5 sm:p-2 rounded-lg border ${border} ${subText} hover:text-amber-500 hover:border-amber-500 active:scale-95`}
                          title="View"><FiEye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>

                        <button onClick={() => setEditModal({ open: true, order })}
                          className="p-1.5 sm:p-2 rounded-lg bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 active:scale-95"
                          title="Edit"><FiEdit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>

                        <button onClick={() => handleInstantPay(order)}
                          className="p-1.5 sm:p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-md shadow-emerald-500/20"
                          title="Pay Now"><FiZap className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>

                        <button onClick={() => setCancelModal({ open: true, order })}
                          className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 active:scale-95"
                          title="Cancel"><FiXCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {filteredOrders.length > 0 && (
            <div className={`px-4 py-3 border-t ${border} ${isDark ? "bg-[#14100a]" : "bg-gray-50"} flex items-center justify-between`}>
              <p className={`text-xs ${subText}`}>
                {filteredOrders.length} pending bills
              </p>
              <p className={`text-sm font-extrabold ${accent}`}>
                Total: Rs. {filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {viewModal.open && (
        <ViewBillModal order={viewModal.order} isDark={isDark} userData={userData} storeData={storeData}
          onClose={() => setViewModal({ open: false, order: null })}
          onPayment={(o) => { setViewModal({ open: false, order: null }); handleInstantPay(o); }}
          onEdit={(o) => { setViewModal({ open: false, order: null }); setEditModal({ open: true, order: o }); }}
          onCancel={(o) => { setViewModal({ open: false, order: null }); setCancelModal({ open: true, order: o }); }} />
      )}
      {editModal.open && (
        <EditBillModal order={editModal.order} isDark={isDark} userData={userData} storeData={storeData}
          onClose={() => setEditModal({ open: false, order: null })}
          onPayment={(o) => { setEditModal({ open: false, order: null }); handleInstantPay(o); }} />
      )}
      {cancelModal.open && (
        <CancelBillModal order={cancelModal.order} isDark={isDark} userData={userData}
          onClose={() => setCancelModal({ open: false, order: null })} />
      )}
      {qrModal && (
        <QRScannerModal isDark={isDark} onResult={handleQRResult} onClose={() => setQrModal(false)} />
      )}
    </div>
  );
};

export default CashierDashboard;