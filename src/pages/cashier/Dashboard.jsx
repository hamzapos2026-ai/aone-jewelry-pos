import React, { useState, useEffect, useCallback } from "react";
import { useBillSearch } from "../../hooks/useBillSearch";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  collection, query, where, onSnapshot, orderBy, doc, getDoc,
  updateDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import {
  FiSearch, FiRefreshCw, FiSun, FiMoon, FiLogOut, FiClock,
  FiCheckCircle, FiXCircle, FiAlertCircle, FiUser, FiMapPin,
  FiHash, FiCalendar, FiPhone, FiTag, FiEye, FiEdit3,
  FiDollarSign, FiMessageSquare, FiSave, FiX, FiChevronDown,
  FiChevronUp, FiFileText, FiCreditCard, FiSmartphone,
} from "react-icons/fi";
import {
  MdPointOfSale, MdReceiptLong, MdAttachMoney, MdPayment,
  MdAccountBalance,
} from "react-icons/md";
import { BsQrCode } from "react-icons/bs";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { db, auth } from "../../services/firebase";
import ViewBillModal from "./ViewBillModal";
import CancelBillModal from "./CancelBillModal";
import QRScannerModal from "./QRScannerModal";

const PAYMENT_METHODS = [
  { value: "Cash", icon: "💵", iconComp: <FiDollarSign className="w-4 h-4" /> },
  { value: "EasyPaisa", icon: "📱", iconComp: <FiSmartphone className="w-4 h-4" /> },
  { value: "JazzCash", icon: "📲", iconComp: <FiSmartphone className="w-4 h-4" /> },
  { value: "Bank Transfer", icon: "🏦", iconComp: <MdAccountBalance className="w-4 h-4" /> },
  { value: "Card", icon: "💳", iconComp: <FiCreditCard className="w-4 h-4" /> },
];

const CashierDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billSearch, setBillSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, cancelled: 0, todayRevenue: 0 });

  // Modals
  const [viewBillModal, setViewBillModal] = useState({ open: false, order: null });
  const [cancelBillModal, setCancelBillModal] = useState({ open: false, order: null });
  const [qrScannerModal, setQrScannerModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Inline Edit State
  const [editingRow, setEditingRow] = useState(null);
  const [savingRow, setSavingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [editErrors, setEditErrors] = useState({});
  
  const { suggestions, searching, searchBills, searchError, setSearchError } = useBillSearch();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch User
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = { uid: currentUser.uid, ...userDoc.data() };
          setUserData(data);
          if (data.storeId) {
            try {
              const storeDoc = await getDoc(doc(db, "stores", data.storeId));
              if (storeDoc.exists()) setStoreData({ id: storeDoc.id, ...storeDoc.data() });
            } catch (e) { console.log(e); }
          }
        } else {
          setUserData({ uid: currentUser.uid, name: currentUser.email || "Cashier", role: "cashier" });
        }
      } catch {
        setUserData({ uid: currentUser.uid, name: currentUser.email || "Cashier", role: "cashier" });
      }
    };
    fetchUser();
  }, [currentUser]);

  // Real-time Orders
  useEffect(() => {
    if (!currentUser || userData === null) { if (!currentUser) setLoading(false); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let q = userData?.storeIds && userData.storeIds.length > 0
      ? query(collection(db, "orders"), where("storeId", "in", userData.storeIds), orderBy("createdAt", "desc"))
      : query(collection(db, "orders"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(data); calcStats(data, today); setLoading(false);
      },
      () => {
        onSnapshot(query(collection(db, "orders")), (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
              const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
              return dB - dA;
            });
          setOrders(data); calcStats(data, today); setLoading(false);
        });
      }
    );
    return () => unsub();
  }, [currentUser, userData]);

  const calcStats = (data, today) => {
    const p = data.filter((o) => o.status === "pending").length;
    const pd = data.filter((o) => o.status === "paid").length;
    const c = data.filter((o) => o.status === "cancelled").length;
    const rev = data.filter((o) => {
      if (!o.createdAt || o.status !== "paid") return false;
      try { return (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) >= today; } catch { return false; }
    }).reduce((s, o) => s + (o.totalAmount || 0), 0);
    setStats({ total: data.length, pending: p, paid: pd, cancelled: c, todayRevenue: rev });
  };

  // Bill Search
  const handleBillSearch = () => {
    setSearchError("");
    if (!billSearch.trim()) { setSearchError("Enter a bill number!"); return; }
    const q = billSearch.trim().toUpperCase();
    
    // First check suggestions from Firebase search
    const foundInSuggestions = suggestions.find((o) =>
      o.billSerial?.toUpperCase() === q || o.serialNo?.toUpperCase() === q
    );
    if (foundInSuggestions) {
      setViewBillModal({ open: true, order: foundInSuggestions });
      setBillSearch("");
      toast.success(`Bill ${foundInSuggestions.billSerial || foundInSuggestions.serialNo} found!`);
      return;
    }
    
    // Fallback to local search
    const found = orders.find((o) =>
      o.billSerial?.toUpperCase() === q || o.serialNo?.toUpperCase() === q ||
      o.billSerial?.toUpperCase().includes(q) || o.serialNo?.toUpperCase().includes(q)
    );
    if (found) {
      setViewBillModal({ open: true, order: found });
      setBillSearch("");
      toast.success(`Bill ${found.billSerial || found.serialNo} found!`);
    } else {
      setSearchError(`Bill "${billSearch}" not found!`);
      toast.error("Bill not found!");
    }
  };

  // QR Result
  const handleQRResult = useCallback((result) => {
    setQrScannerModal(false);
    const found = orders.find((o) => o.billSerial === result || o.serialNo === result || o.idempotencyKey === result);
    if (found) { setViewBillModal({ open: true, order: found }); toast.success("Bill punched via QR!"); }
    else toast.error("No bill found");
  }, [orders]);

  // Filter
  useEffect(() => {
    let result = [...orders];
    
    // Hide cancelled bills from main view (show only if filter is "cancelled")
    if (activeFilter === "all") {
      result = result.filter((o) => o.status !== "cancelled");
    } else {
      result = result.filter((o) => o.status === activeFilter);
    }
    
    setFilteredOrders(result);
  }, [orders, activeFilter]);

  // ========== INLINE EDIT FUNCTIONS ==========
  const startEditing = (order) => {
    setEditingRow(order.id);
    setEditData({
      customerName: order.customer?.name || "Walking Customer",
      customerPhone: order.customer?.phone || "",
      paymentMethod: order.paymentType || "Cash",
      newDiscount: 0,
      discountReason: "",
      comments: order.comments || "",
    });
    setEditErrors({});
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditData({});
    setEditErrors({});
  };

  const handleInlineSave = async (order) => {
    const errs = {};
    const newDisc = Number(editData.newDiscount) || 0;
    if (newDisc > 0 && !editData.discountReason.trim()) errs.discountReason = "Discount reason required!";
    if (!editData.customerName.trim()) errs.name = "Name required!";
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Fix errors first!"); return; }

    setSavingRow(order.id);
    const subtotal = order.subtotal || order.totalAmount || 0;
    const prevDiscount = order.billDiscount || 0;
    const totalDiscount = prevDiscount + newDisc;
    const finalAmount = Math.max(0, subtotal - totalDiscount);

    try {
      await updateDoc(doc(db, "orders", order.id), {
        "customer.name": editData.customerName,
        "customer.phone": editData.customerPhone,
        paymentType: editData.paymentMethod,
        billDiscount: totalDiscount,
        discountReason: newDisc > 0 ? editData.discountReason : (order.discountReason || ""),
        totalAmount: finalAmount,
        comments: editData.comments,
        lastEditedBy: userData?.displayName || userData?.name || "Cashier",
        lastEditedAt: serverTimestamp(),
        lastEditedUserId: userData?.uid || "",
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "INLINE_EDIT",
        orderId: order.id,
        billSerial: order.billSerial || order.serialNo,
        userId: userData?.uid || "",
        userName: userData?.displayName || userData?.name || "Cashier",
        role: userData?.role || "cashier",
        storeId: userData?.storeId || "",
        before: {
          customerName: order.customer?.name, customerPhone: order.customer?.phone,
          paymentType: order.paymentType, billDiscount: order.billDiscount, totalAmount: order.totalAmount,
        },
        after: {
          customerName: editData.customerName, customerPhone: editData.customerPhone,
          paymentType: editData.paymentMethod, billDiscount: totalDiscount, totalAmount: finalAmount,
        },
        timestamp: serverTimestamp(),
      });

      toast.success("✅ Updated!");
      setEditingRow(null);
    } catch (err) { console.error(err); toast.error("Update failed!"); }
    finally { setSavingRow(null); }
  };

  const handlePaymentReceived = async (order) => {
    const errs = {};
    const newDisc = Number(editData.newDiscount) || 0;
    if (newDisc > 0 && !editData.discountReason.trim()) errs.discountReason = "Discount reason required!";
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Fix errors!"); return; }

    setSavingRow(order.id);
    const subtotal = order.subtotal || order.totalAmount || 0;
    const prevDiscount = order.billDiscount || 0;
    const totalDiscount = prevDiscount + newDisc;
    const finalAmount = Math.max(0, subtotal - totalDiscount);

    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "paid",
        "customer.name": editData.customerName,
        "customer.phone": editData.customerPhone,
        paymentType: editData.paymentMethod,
        billDiscount: totalDiscount,
        discountReason: newDisc > 0 ? editData.discountReason : (order.discountReason || ""),
        totalAmount: finalAmount,
        amountReceived: finalAmount,
        changeGiven: 0,
        comments: editData.comments,
        paidAt: serverTimestamp(),
        paidBy: userData?.uid || "",
        paidByName: userData?.displayName || userData?.name || "Cashier",
        billerName: userData?.displayName || userData?.name || order.billerName || "Cashier",
        billEndTime: new Date().toISOString(),
      });

      await addDoc(collection(db, "auditLogs"), {
        action: "PAYMENT_RECEIVED",
        orderId: order.id,
        billSerial: order.billSerial || order.serialNo,
        userId: userData?.uid || "",
        userName: userData?.displayName || userData?.name || "Cashier",
        role: userData?.role || "cashier",
        before: { status: "pending", totalAmount: order.totalAmount },
        after: { status: "paid", totalAmount: finalAmount, paymentType: editData.paymentMethod },
        timestamp: serverTimestamp(),
      });

      toast.success("✅ Payment received!");
      setEditingRow(null);
    } catch (err) { console.error(err); toast.error("Payment failed!"); }
    finally { setSavingRow(null); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigate("/login"); toast.success("Logged out"); } catch { toast.error("Failed"); }
  };

  // Helpers
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const fmtOD = (ts) => { if (!ts) return "N/A"; try { const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return "N/A"; } };
  const fmtOT = (ts) => { if (!ts) return ""; try { const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  const getStatusBadge = (status) => {
    const m = {
      paid: { bg: isDark ? "bg-emerald-900/40 text-emerald-400 border-emerald-700" : "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <FiCheckCircle className="w-3.5 h-3.5" />, label: "PAID" },
      pending: { bg: isDark ? "bg-amber-900/40 text-amber-400 border-amber-700" : "bg-amber-50 text-amber-700 border-amber-200", icon: <FiClock className="w-3.5 h-3.5" />, label: "PENDING" },
      cancelled: { bg: isDark ? "bg-red-900/40 text-red-400 border-red-700" : "bg-red-50 text-red-700 border-red-200", icon: <FiXCircle className="w-3.5 h-3.5" />, label: "CANCELLED" },
    };
    return m[status] || { bg: "", icon: <FiAlertCircle className="w-3.5 h-3.5" />, label: "—" };
  };

  // Theme
  const bg = isDark ? "bg-[#0a0805]" : "bg-gray-50";
  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark ? "bg-[#120d06] border-[#2a1f0f] text-gray-100 placeholder:text-gray-600" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const accent = "text-amber-500";
  const accentBg = isDark ? "bg-amber-900/20" : "bg-amber-50";
  const headerBg = isDark ? "bg-[#14100a]" : "bg-gray-100";
  const editBg = isDark ? "bg-[#1f170d]" : "bg-amber-50/30";
  const editBorder = isDark ? "border-amber-700" : "border-amber-300";

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className={`${text} text-xl font-extrabold mb-2`}>Loading Dashboard</p>
          <p className={`${subText} text-sm`}>{!currentUser ? "Checking auth..." : !userData ? "Loading user..." : "Loading orders..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} ${text}`}>
      {/* ====== NAVBAR ====== */}
      <nav className={`sticky top-0 z-40 ${cardBg} border-b ${border} shadow-sm`}>
        <div className="px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20" title="Point of Sale System">
                <MdPointOfSale className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className={`font-extrabold text-lg ${text}`}>{storeData?.name || "POS System"}</h1>
                <p className={`text-xs ${subText} flex items-center gap-1`} title="Store Location">
                  <FiMapPin className="w-3 h-3 text-amber-500" />
                  {storeData?.city || "All Branches"}
                </p>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center">
              <p className={`text-lg font-bold ${accent}`} title="Current Time">{fmtTime(currentTime)}</p>
              <p className={`text-xs ${subText}`} title="Current Date">{fmtDate(currentTime)}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`hidden sm:flex items-center gap-3 px-4 py-2 rounded-xl ${accentBg} border ${isDark ? "border-amber-800" : "border-amber-200"}`} title="Current User Information">
                <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center" title="User Avatar">
                  <FiUser className="text-white w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${text}`}>{userData?.displayName || userData?.name || "Cashier"}</p>
                  <p className={`text-xs ${subText} capitalize`}>{userData?.role || "cashier"}</p>
                </div>
              </div>
              <button onClick={toggleTheme}
                className={`p-2.5 rounded-xl border ${border} ${cardBg} hover:border-amber-500 transition-all group relative`}
                title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
                {isDark ? <FiSun className="w-5 h-5 text-amber-400" /> : <FiMoon className="w-5 h-5 text-gray-600" />}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </span>
              </button>
              <button onClick={handleLogout}
                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 group relative"
                title="Logout from the system">
                <FiLogOut className="w-5 h-5 text-red-500" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="px-4 lg:px-8 py-6 space-y-6">
        {/* ====== STATS ====== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Today's Revenue",
              value: `Rs. ${stats.todayRevenue.toLocaleString()}`,
              color: "from-amber-500 to-orange-500",
              icon: <MdAttachMoney className="text-white w-6 h-6" />,
              badge: "Today",
              desc: "Total revenue earned today from paid bills"
            },
            {
              label: "Pending Bills",
              value: stats.pending,
              color: "",
              iconComp: <FiClock className="text-amber-500 w-6 h-6" />,
              textColor: "text-amber-500",
              desc: "Bills created but not yet paid"
            },
            {
              label: "Paid Bills",
              value: stats.paid,
              color: "",
              iconComp: <FiCheckCircle className="text-emerald-500 w-6 h-6" />,
              textColor: "text-emerald-500",
              desc: "Successfully completed transactions"
            },
            {
              label: "Cancelled Bills",
              value: stats.cancelled,
              color: "",
              iconComp: <FiXCircle className="text-red-500 w-6 h-6" />,
              textColor: "text-red-500",
              desc: "Bills deleted with reasons (visible to admin only)"
            },
          ].map((s, i) => (
            <div key={i} className={`${cardBg} border ${border} rounded-2xl p-5 group relative`} title={s.desc}>
              <div className="flex items-center justify-between mb-3">
                {s.color ? (
                  <div className={`w-12 h-12 bg-gradient-to-br ${s.color} rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20`}>{s.icon}</div>
                ) : (
                  <div className={`w-12 h-12 ${s.textColor?.replace("text", "bg")}/20 rounded-2xl flex items-center justify-center`}>{s.iconComp}</div>
                )}
                {s.badge && <span className={`text-xs px-2.5 py-1 rounded-full ${accentBg} ${accent} font-bold`}>{s.badge}</span>}
              </div>
              <p className={`text-2xl font-extrabold ${s.textColor || text}`}>{s.value}</p>
              <p className={`text-sm ${subText} mt-1`}>{s.label}</p>
              <span className="absolute -top-2 -right-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{s.desc}</span>
            </div>
          ))}
        </div>

        {/* ====== SEARCH ====== */}
        <div className={`${cardBg} border ${border} rounded-2xl p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`text-sm font-bold ${text} mb-2 block flex items-center gap-2`}>
                <FiSearch className="w-4 h-4 text-amber-500" />
                Search Bill
                <span className={`text-xs ${subText} font-normal`}>(by bill number, customer name, phone)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FiHash className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${subText}`} />
                  <input type="text" placeholder="BILL-004, John Doe, +92..." value={billSearch}
                    onChange={(e) => { setBillSearch(e.target.value); searchBills(e.target.value, userData?.storeId); setSearchError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleBillSearch()}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 ${inputBg} ${searchError ? "border-red-500 ring-2 ring-red-500/30" : ""}`}
                    title="Search bills by serial number, customer name, or phone number" />
                </div>
                <button onClick={handleBillSearch}
                  className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 active:scale-95 group relative"
                  title="Search for bill - Press Enter or click to search">
                  <FiSearch className="w-5 h-5" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Search</span>
                </button>
              </div>
              {searching && <div className="mt-2 text-sm text-amber-500 flex items-center gap-2"><div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>Searching bills...</div>}
              {suggestions.length > 0 && (
                <div className={`mt-2 ${cardBg} border ${border} rounded-xl shadow-lg max-h-64 overflow-y-auto z-50`}>
                  {suggestions.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => { setViewBillModal({ open: true, order: bill }); setBillSearch(""); }}
                      className="p-3 border-b hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer last:border-b-0 group"
                      title="Click to view bill details"
                    >
                      <div className="font-medium flex items-center gap-2">
                        <FiHash className="w-4 h-4 text-amber-500" />
                        {bill.serialNo}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <FiUser className="w-3 h-3" />
                        {bill.customer?.name} - {bill.customer?.phone}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <FiDollarSign className="w-3 h-3" />
                        ₨{bill.totalAmount || bill.subtotal}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchError && <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${isDark ? "bg-red-900/30 text-red-400 border border-red-800" : "bg-red-50 text-red-600 border border-red-200"}`}><FiAlertTriangle className="w-4 h-4" />{searchError}</div>}
            </div>
            <div>
              <label className={`text-sm font-bold ${text} mb-2 block flex items-center gap-2`}>
                <BsQrCode className="w-4 h-4 text-amber-500" />
                QR Scanner
                <span className={`text-xs ${subText} font-normal`}>(scan bill QR code)</span>
              </label>
              <button onClick={() => setQrScannerModal(true)}
                className={`w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border-2 border-dashed text-base font-bold active:scale-95 group relative ${isDark ? "border-amber-700 hover:border-amber-500 bg-amber-900/10 text-amber-400" : "border-amber-300 hover:border-amber-500 bg-amber-50 text-amber-600"}`}
                title="Scan QR code to quickly find and view bill details">
                <BsQrCode className="w-6 h-6" />
                <span>Scan to Punch Bill</span>
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">QR Scanner</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {[
              { key: "all", label: "All Bills", count: stats.total, iconComp: <FiFileText className="w-3 h-3" />, desc: "Show all bills except cancelled" },
              { key: "pending", label: "Pending", count: stats.pending, iconComp: <FiClock className="w-3 h-3" />, desc: "Bills waiting for payment" },
              { key: "paid", label: "Paid", count: stats.paid, iconComp: <FiCheckCircle className="w-3 h-3" />, desc: "Completed transactions" },
              { key: "cancelled", label: "Cancelled", count: stats.cancelled, iconComp: <FiX className="w-3 h-3" />, desc: "Deleted bills with reasons" },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border active:scale-95 transition-all group relative ${
                  activeFilter === tab.key ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20" : isDark ? "border-[#2a1f0f] text-gray-400 hover:border-amber-700" : "border-gray-200 text-gray-500 hover:border-amber-300"
                }`}
                title={tab.desc}>
                {tab.iconComp}
                {tab.label}
                <span className={`px-2 py-0.5 rounded-lg text-xs ${activeFilter === tab.key ? "bg-white/20" : isDark ? "bg-gray-800" : "bg-gray-100"}`}>{tab.count}</span>
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{tab.desc}</span>
              </button>
            ))}
            <button onClick={() => { setActiveFilter("all"); setBillSearch(""); setSearchError(""); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm ${subText} border ${border} hover:border-amber-500 ml-auto active:scale-95 group relative`}
              title="Reset all filters and search">
              <FiRefreshCw className="w-4 h-4" />
              <span>Reset</span>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Reset Filters</span>
            </button>
          </div>
        </div>

        {/* ====== BILLS TABLE WITH INLINE EDIT ====== */}
        <div className={`${cardBg} border ${border} rounded-2xl overflow-hidden`}>
          {filteredOrders.length === 0 ? (
            <div className="p-16 text-center">
              <MdReceiptLong className={`w-20 h-20 ${subText} mx-auto mb-6 opacity-20`} />
              <p className={`text-xl font-extrabold ${text} mb-3`}>No Bills Found</p>
              <p className={`text-base ${subText}`}>{orders.length === 0 ? "No orders yet" : "Change filter"}</p>
            </div>
          ) : (
            <div>
              {filteredOrders.map((order, index) => {
                const st = getStatusBadge(order.status);
                const isEditing = editingRow === order.id;
                const isSaving = savingRow === order.id;
                const isPending = order.status === "pending";
                const isCancelled = order.status === "cancelled";

                const subtotal = order.subtotal || order.totalAmount || 0;
                const prevDiscount = order.billDiscount || 0;
                const newDisc = isEditing ? (Number(editData.newDiscount) || 0) : 0;
                const totalDisc = prevDiscount + newDisc;
                const finalAmt = Math.max(0, subtotal - totalDisc);

                return (
                  <div key={order.id} className={`border-b ${border} last:border-b-0 transition-all ${isEditing ? `${editBg} border-l-4 ${editBorder}` : ""}`}>

                    {/* ====== MAIN ROW ====== */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        {/* Left Info */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            order.status === "paid" ? "bg-emerald-500/20" : order.status === "pending" ? "bg-amber-500/20" : "bg-red-500/20"
                          }`}>
                            <span className={`text-sm font-extrabold ${accent}`}>{index + 1}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Row 1 - Bill No + Status */}
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-lg font-extrabold ${accent}`}>
                                #{order.billSerial || order.serialNo}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${st.bg}`}>
                                {st.icon}{st.label}
                              </span>
                              {order.lastEditedBy && (
                                <span className={`text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-50 text-purple-700"} flex items-center gap-1`}>
                                  <FiEdit3 className="w-3 h-3" />Edited
                                </span>
                              )}
                            </div>

                            {/* Row 2 - Details (View Mode) */}
                            {!isEditing && (
                              <div className="flex items-center gap-4 flex-wrap text-sm">
                                <span className={`flex items-center gap-1 ${text} font-medium`} title="Customer Name">
                                  <FiUser className="w-3.5 h-3.5 text-amber-500" />
                                  {order.customer?.name || "Walking Customer"}
                                </span>
                                {order.customer?.phone && (
                                  <span className={`flex items-center gap-1 ${subText}`} title="Customer Phone Number">
                                    <FiPhone className="w-3.5 h-3.5 text-amber-500" />
                                    {order.customer.phone}
                                  </span>
                                )}
                                <span className={`flex items-center gap-1 ${subText}`} title="Bill Creation Date">
                                  <FiCalendar className="w-3.5 h-3.5 text-amber-500" />
                                  {fmtOD(order.createdAt)}
                                </span>
                                <span className={`flex items-center gap-1 ${subText}`} title="Bill Creation Time">
                                  <FiClock className="w-3.5 h-3.5 text-amber-500" />
                                  {fmtOT(order.createdAt)}
                                </span>
                                <span className={`flex items-center gap-1 ${subText}`} title="Bill Created By">
                                  <FiUser className="w-3.5 h-3.5 text-amber-500" />
                                  {order.billerName || "—"}
                                </span>
                                {order.paymentType && (
                                  <span className={`flex items-center gap-1 ${subText}`} title="Payment Method">
                                    <MdPayment className="w-3.5 h-3.5 text-amber-500" />
                                    {order.paymentType}
                                  </span>
                                )}
                                {prevDiscount > 0 && (
                                  <span className="text-green-500 font-bold flex items-center gap-1" title={`Discount: ${order.discountReason || 'No reason provided'}`}>
                                    <FiTag className="w-3.5 h-3.5" />
                                    -Rs.{prevDiscount}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Cancelled Reason */}
                            {isCancelled && order.cancelReason && !isEditing && (
                              <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${isDark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"}`} title="Bill was cancelled with this reason">
                                <FiXCircle className="w-3 h-3" />
                                <span className="font-medium">Cancellation Reason:</span> {order.cancelReason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right - Amount + Actions */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {!isEditing && (
                            <div className="text-right">
                              <p className={`text-xl font-extrabold ${accent}`}>Rs. {(order.totalAmount || 0).toLocaleString()}</p>
                              {order.billDiscount > 0 && <p className={`text-xs ${subText} line-through`}>Rs. {(order.subtotal || 0).toLocaleString()}</p>}
                              <p className={`text-xs ${subText}`}>{order.items?.length || 0} items</p>
                            </div>
                          )}

                          {/* Action Buttons (View Mode) */}
                          {!isEditing && (
                            <div className="flex items-center gap-1.5">
                              {isPending && (
                                <button onClick={(e) => { e.stopPropagation(); startEditing(order); }}
                                  className="p-2 rounded-xl bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-all active:scale-95 group relative"
                                  title="Edit Bill - Modify customer details, payment method, and add discount">
                                  <FiEdit3 className="w-4 h-4" />
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Edit Bill</span>
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setViewBillModal({ open: true, order }); }}
                                className={`p-2 rounded-xl border ${border} ${subText} hover:text-amber-500 hover:border-amber-500 transition-all group relative`}
                                title="View Bill - See complete bill details and items">
                                <FiEye className="w-4 h-4" />
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">View Bill</span>
                              </button>
                              {isPending && (
                                <button onClick={(e) => { e.stopPropagation(); setCancelBillModal({ open: true, order }); }}
                                  className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-all group relative"
                                  title="Cancel Bill - Delete bill with reason (requires admin approval)">
                                  <FiXCircle className="w-4 h-4" />
                                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">Cancel Bill</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ====== INLINE EDIT PANEL ====== */}
                    {isEditing && (
                      <div className={`px-5 pb-5 space-y-4`}>
                        <div className={`rounded-2xl border-2 ${editBorder} p-5 space-y-4 ${editBg}`}>
                          {/* Edit Header */}
                          <div className="flex items-center justify-between">
                            <h3 className={`text-sm font-extrabold ${accent} uppercase tracking-wider flex items-center gap-2`}>
                              <FiEdit3 className="w-4 h-4" />Editing Bill #{order.billSerial || order.serialNo}
                            </h3>
                            <button onClick={cancelEditing} className={`p-1.5 rounded-lg ${subText} hover:text-red-500 hover:bg-red-500/10`}>
                              <FiX className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Editable Fields Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Customer Name */}
                            <div>
                              <label className={`text-xs font-bold ${subText} mb-1 block`}>Customer Name</label>
                              <input type="text" value={editData.customerName}
                                onChange={(e) => setEditData((p) => ({ ...p, customerName: e.target.value }))}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 ${editErrors.name ? "border-red-500" : ""}`} />
                              {editErrors.name && <p className="text-xs text-red-500 mt-1 font-bold">{editErrors.name}</p>}
                            </div>

                            {/* Phone */}
                            <div>
                              <label className={`text-xs font-bold ${subText} mb-1 block`}>Phone</label>
                              <input type="tel" value={editData.customerPhone} placeholder="03XX-XXXXXXX"
                                onChange={(e) => setEditData((p) => ({ ...p, customerPhone: e.target.value }))}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-amber-500`} />
                            </div>

                            {/* Payment Method */}
                            <div>
                              <label className={`text-xs font-bold ${subText} mb-1 block`}>Payment Method</label>
                              <select value={editData.paymentMethod}
                                onChange={(e) => setEditData((p) => ({ ...p, paymentMethod: e.target.value }))}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-amber-500`}>
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m.value} value={m.value}>{m.icon} {m.value}</option>
                                ))}
                              </select>
                            </div>

                            {/* Comment */}
                            <div>
                              <label className={`text-xs font-bold ${subText} mb-1 block`}>Comment</label>
                              <input type="text" value={editData.comments} placeholder="Notes..."
                                onChange={(e) => setEditData((p) => ({ ...p, comments: e.target.value }))}
                                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-amber-500`} />
                            </div>
                          </div>

                          {/* Discount Row */}
                          <div className={`rounded-xl p-4 border ${border} ${isDark ? "bg-[#120d06]" : "bg-white"}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                              {/* Previous Discount */}
                              <div>
                                <label className={`text-xs font-bold text-blue-500 mb-1 block`}>Biller Discount</label>
                                <div className={`px-3 py-2.5 rounded-xl border ${border} text-sm font-extrabold text-blue-500 ${isDark ? "bg-blue-900/10" : "bg-blue-50"}`}>
                                  Rs. {prevDiscount}
                                </div>
                              </div>

                              {/* New Discount */}
                              <div>
                                <label className={`text-xs font-bold text-green-500 mb-1 block`}>Your Discount</label>
                                <input type="number" value={editData.newDiscount}
                                  onChange={(e) => setEditData((p) => ({ ...p, newDiscount: Math.min(Number(e.target.value), subtotal) }))}
                                  min={0} max={subtotal} placeholder="0"
                                  className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold ${inputBg} focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/30`} />
                              </div>

                              {/* Discount Reason */}
                              {newDisc > 0 && (
                                <div>
                                  <label className={`text-xs font-bold text-red-500 mb-1 block`}>Reason *</label>
                                  <input type="text" value={editData.discountReason} placeholder="Why?"
                                    onChange={(e) => { setEditData((p) => ({ ...p, discountReason: e.target.value })); setEditErrors((p) => ({ ...p, discountReason: "" })); }}
                                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-red-500 ${editErrors.discountReason ? "border-red-500 ring-2 ring-red-500/30" : ""}`} />
                                  {editErrors.discountReason && <p className="text-xs text-red-500 mt-1 font-bold">{editErrors.discountReason}</p>}
                                </div>
                              )}

                              {/* Total */}
                              <div>
                                <label className={`text-xs font-bold ${accent} mb-1 block`}>Final Amount</label>
                                <div className={`px-3 py-2.5 rounded-xl border border-amber-500 text-lg font-extrabold ${accent} ${isDark ? "bg-amber-900/10" : "bg-amber-50"}`}>
                                  Rs. {finalAmt.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Summary Line */}
                            <div className={`mt-3 pt-3 border-t ${border} flex items-center justify-between flex-wrap gap-2 text-sm`}>
                              <span className={subText}>Subtotal: <span className={`font-bold ${text}`}>Rs. {subtotal}</span></span>
                              {totalDisc > 0 && <span className="text-orange-500 font-bold">Total Discount: -Rs. {totalDisc}</span>}
                              <span className={`font-extrabold text-lg ${accent}`}>Bill Total: Rs. {finalAmt.toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <button onClick={cancelEditing} disabled={isSaving}
                              className={`px-5 py-2.5 rounded-xl border ${border} text-sm font-bold ${subText} hover:border-red-400 hover:text-red-500 transition-all active:scale-95`}>
                              Cancel
                            </button>

                            <button onClick={() => handleInlineSave(order)} disabled={isSaving}
                              className={`px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95`}>
                              {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                              {isSaving ? "Saving..." : "Save Changes"}
                            </button>

                            {isPending && (
                              <button onClick={() => handlePaymentReceived(order)} disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-white text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95">
                                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiCheckCircle className="w-4 h-4" />}
                                {isSaving ? "Processing..." : `✅ Payment Received - Rs. ${finalAmt.toLocaleString()}`}
                              </button>
                            )}

                            <button onClick={() => setViewBillModal({ open: true, order })}
                              className={`px-5 py-2.5 rounded-xl border ${border} text-sm font-bold ${subText} hover:text-amber-500 hover:border-amber-500 transition-all flex items-center gap-2 ml-auto active:scale-95`}>
                              <FiEye className="w-4 h-4" />View Bill
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div className={`px-5 py-3.5 border-t ${border} ${headerBg} flex items-center justify-between`}>
              <p className={`text-sm ${subText}`}>Showing {filteredOrders.length} of {orders.length}</p>
              <p className={`text-sm font-extrabold ${accent}`}>Total: Rs. {filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {viewBillModal.open && <ViewBillModal order={viewBillModal.order} isDark={isDark} userData={userData} storeData={storeData}
        onClose={() => setViewBillModal({ open: false, order: null })}
        onPayment={(o) => { setViewBillModal({ open: false, order: null }); startEditing(o); }}
        onCancel={(o) => { setViewBillModal({ open: false, order: null }); setCancelBillModal({ open: true, order: o }); }} />}
      {cancelBillModal.open && <CancelBillModal order={cancelBillModal.order} isDark={isDark} userData={userData} onClose={() => setCancelBillModal({ open: false, order: null })} />}
      {qrScannerModal && <QRScannerModal isDark={isDark} onResult={handleQRResult} onClose={() => setQrScannerModal(false)} />}
    </div>
  );
};

export default CashierDashboard;