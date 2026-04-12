// src/pages/biller/Dashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock3, Eye, EyeOff, Package, Printer, Send, ShoppingCart, User, Wifi, WifiOff, X, Database, Loader2, Lock, Unlock, Search, Calendar, Clock, CheckCircle, XCircle, Keyboard, Hash, Volume2, VolumeX } from "lucide-react";
import { collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import useKeyboardShortcuts from "../../hooks/useHotkeys";
import { db } from "../../services/firebase";
import { logActivity, createAuditLog, ActivityTypes } from "../../services/activityLogger";
import { saveOrder } from "../../services/orderService";
import BarcodeScanner from "../../components/BarcodeScanner";
import InvoicePrint from "../../components/InvoicePrint";
import { useAuth } from "../../context/AuthContext";
import { getStoreById } from "../../modules/stores/storeService";
import { syncOfflineOrders, getOfflineOrdersCount } from "../../services/offlineSync";
import { playSound } from "../../services/soundService";

// ==================== SERIAL NUMBER GENERATOR ====================
const getNextSerial = (prefix = "BILL") => {
  const today = new Date();
  const dateKey = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const storageKey = `serial_${prefix}_${dateKey}`;
  let current = parseInt(localStorage.getItem(storageKey) || "0", 10);
  current += 1;
  localStorage.setItem(storageKey, current.toString());
  return `${prefix}-${dateKey}-${String(current).padStart(3, "0")}`;
};

const getNextItemSerial = () => {
  const storageKey = "serial_ITEM_global";
  let current = parseInt(localStorage.getItem(storageKey) || "0", 10);
  current += 1;
  localStorage.setItem(storageKey, current.toString());
  return `ITM-${String(current).padStart(5, "0")}`;
};

const Dashboard = () => {
  const { isDark } = useTheme();
  const isOnline = useNetworkStatus();
  const { userData } = useAuth();
  const productInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // ==================== STATE ====================
  const [showRecentOrders, setShowRecentOrders] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentBillSerial, setCurrentBillSerial] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [searchSerial, setSearchSerial] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [store, setStore] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [customer, setCustomer] = useState({ name: "Walking Customer", phone: "" });
  const [form, setForm] = useState({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
  const [items, setItems] = useState([]);

  // ==================== SOUND WRAPPER ====================
  const playSoundSafe = useCallback((name) => {
    if (soundEnabled) playSound(name);
  }, [soundEnabled]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    productInputRef.current?.focus();
    const timer = setTimeout(() => setShowRecentOrders(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isOnline) {
      loadRecentOrders();
      loadStore();
    } else {
      setLoadingOrders(false);
    }
  }, [userData?.storeId, isOnline]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentBillSerial) setCurrentBillSerial(getNextSerial("BILL"));
  }, []);

  useEffect(() => {
    if (isOnline) syncOfflineData();
  }, [isOnline]);

  useEffect(() => {
    const checkOffline = async () => {
      const count = await getOfflineOrdersCount();
      setOfflineCount(count);
    };
    checkOffline();
    const interval = setInterval(checkOffline, 30000);
    return () => clearInterval(interval);
  }, []);

  // ==================== ALERT FUNCTIONS ====================
  const addAlert = useCallback((text, type = "warning") => {
    setAlerts((prev) => {
      if (prev.some((item) => item.text === text)) return prev;
      return [...prev, { id: Date.now() + Math.random(), text, type }];
    });
    try {
      if (type === "success") { toast.success(text, { duration: 4000 }); setTimeout(() => clearAlertByText(text), 5000); }
      else if (type === "error") { toast.error(text, { duration: 5000 }); }
      else { toast(text, { duration: 4000, icon: "⚠️" }); }
    } catch (e) { /* toast may fail silently */ }
  }, []);

  const removeAlert = useCallback((id) => setAlerts((prev) => prev.filter((a) => a.id !== id)), []);
  const clearAlertByText = useCallback((text) => setAlerts((prev) => prev.filter((a) => a.text !== text)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  // ==================== DATA LOADING (SAFE) ====================
  const loadRecentOrders = async () => {
    if (!isOnline) { setLoadingOrders(false); return; }
    setLoadingOrders(true);
    try {
      const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
      const ordersSnap = await getDocs(ordersQuery);
      if (!ordersSnap.empty) {
        setRecentOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } else { setRecentOrders([]); }
    } catch (error) {
      console.error("Recent orders load error:", error);
      // Don't show error alert when offline - just silently fail
    } finally { setLoadingOrders(false); }
  };

  const loadStore = async () => {
    if (!userData?.storeId || !isOnline) return;
    try {
      const storeData = await getStoreById(userData.storeId);
      if (storeData) setStore(storeData);
    } catch (error) {
      console.error("Store load error:", error);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline) return;
    try {
      const count = await getOfflineOrdersCount();
      if (count === 0) return;
      addAlert(`Syncing ${count} offline order(s)...`, "warning");
      const result = await syncOfflineOrders();
      if (result.success && result.synced > 0) {
        playSoundSafe("syncComplete");
        addAlert(`Synced ${result.synced} offline orders!`, "success");
        setOfflineCount(0);
        loadRecentOrders();
      } else if (result.failed > 0) {
        addAlert(`Failed to sync ${result.failed} orders`, "error");
      }
    } catch (error) {
      console.error("Sync error:", error);
    }
  };

  // ==================== SEARCH ====================
  const handleSearchBySerial = async () => {
    if (!searchSerial.trim()) { addAlert("Enter a serial number.", "error"); return; }
    if (!isOnline) { addAlert("Search requires internet connection.", "error"); playSoundSafe("error"); return; }
    setSearching(true); setSearchResult(null);
    try {
      const ordersQuery = query(collection(db, "orders"), where("serialNo", "==", searchSerial.trim()));
      const snapshot = await getDocs(ordersQuery);
      if (!snapshot.empty) {
        const order = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setSearchResult(order);
        addAlert(`Order ${order.serialNo} found.`, "success");
        try { await logActivity({ type: ActivityTypes.SEARCH_PERFORMED, searchTerm: searchSerial.trim(), resultFound: true, orderId: order.id }); } catch (e) {}
      } else {
        addAlert(`No order found: ${searchSerial}`, "error");
        try { await logActivity({ type: ActivityTypes.SEARCH_PERFORMED, searchTerm: searchSerial.trim(), resultFound: false }); } catch (e) {}
      }
    } catch (error) { console.error("Search error:", error); addAlert("Search failed.", "error"); }
    finally { setSearching(false); }
  };

  const clearSearch = () => { setSearchSerial(""); setSearchResult(null); };

  // ==================== BILL LOCK ====================
  const lockBill = useCallback(() => {
    if (items.length === 0) { addAlert("Cannot lock empty bill.", "error"); playSoundSafe("error"); return; }
    setIsLocked(true); playSoundSafe("lock"); addAlert("Bill locked.", "success");
    try { logActivity({ type: ActivityTypes.BILL_LOCKED, serialNo: currentBillSerial, itemsCount: items.length }); } catch (e) {}
  }, [items.length, currentBillSerial, addAlert, playSoundSafe]);

  const unlockBill = useCallback(() => {
    setIsLocked(false); playSoundSafe("unlock"); addAlert("Bill unlocked.", "success");
    try { logActivity({ type: ActivityTypes.BILL_UNLOCKED, serialNo: currentBillSerial }); } catch (e) {}
  }, [currentBillSerial, addAlert, playSoundSafe]);

  // ==================== ITEM FUNCTIONS ====================
  const handleAddItem = useCallback(() => {
    if (isLocked) { addAlert("Bill is locked.", "error"); playSoundSafe("error"); return; }
    if (!form.productName.trim()) { addAlert("Product name required.", "error"); playSoundSafe("error"); return; }
    if (!form.price || Number(form.price) <= 0) { addAlert("Valid price required.", "error"); playSoundSafe("error"); return; }
    if (Number(form.qty) < 1) { addAlert("Qty must be ≥ 1.", "error"); playSoundSafe("error"); return; }

    const newItem = {
      id: Date.now(),
      serialId: form.serialId.trim() || getNextItemSerial(),
      productName: form.productName.trim(),
      price: Number(form.price),
      qty: Number(form.qty) || 1,
      discount: Number(form.discount) || 0,
    };

    // Duplicate serial check
    if (items.some((i) => i.serialId === newItem.serialId)) {
      addAlert(`Duplicate serial: ${newItem.serialId}`, "error"); playSoundSafe("error"); return;
    }

    setItems((prev) => [...prev, newItem]);
    setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
    clearAlertByText("Product name required."); clearAlertByText("Valid price required."); clearAlertByText("Qty must be ≥ 1.");
    playSoundSafe("keyPress");
    setTimeout(() => productInputRef.current?.focus(), 50);
    try { logActivity({ type: ActivityTypes.ITEM_ADDED, serialNo: currentBillSerial, item: newItem }); } catch (e) {}
  }, [form, isLocked, items, currentBillSerial, addAlert, clearAlertByText, playSoundSafe]);

  const handleDeleteRow = useCallback((id) => {
    if (isLocked) { addAlert("Bill is locked.", "error"); playSoundSafe("error"); return; }
    const itemToDelete = items.find((item) => item.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedRowIndex(-1);
    playSoundSafe("delete");
    try { logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item: itemToDelete }); } catch (e) {}
  }, [isLocked, items, currentBillSerial, addAlert, playSoundSafe]);

  const handleDeleteSelectedRow = useCallback(() => {
    if (selectedRowIndex >= 0 && selectedRowIndex < items.length) handleDeleteRow(items[selectedRowIndex].id);
    else { addAlert("No row selected. Use ↑↓.", "warning"); playSoundSafe("error"); }
  }, [selectedRowIndex, items, handleDeleteRow, addAlert, playSoundSafe]);

  const handleQtyChange = useCallback((id, value) => {
    if (isLocked) return;
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, qty: Math.max(1, Number(value) || 1) } : item));
  }, [isLocked]);

  const handleDiscountChange = useCallback((id, value) => {
    if (isLocked) return;
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, discount: Math.max(0, Number(value) || 0) } : item));
  }, [isLocked]);

  // ==================== BILL FUNCTIONS ====================
  const handleResetBill = useCallback(() => {
    if (isLocked) { addAlert("Unlock bill first.", "error"); playSoundSafe("error"); return; }
    const oldSerial = currentBillSerial;
    setItems([]); setCustomer({ name: "Walking Customer", phone: "" });
    setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
    setSelectedRowIndex(-1); setCurrentBillSerial(getNextSerial("BILL")); clearAllAlerts();
    setTimeout(() => productInputRef.current?.focus(), 50);
    try { logActivity({ type: ActivityTypes.BILL_RESET, serialNo: oldSerial }); } catch (e) {}
  }, [isLocked, currentBillSerial, addAlert, clearAllAlerts, playSoundSafe]);

  const handleClearBill = useCallback(() => {
    if (isLocked) { addAlert("Unlock bill first.", "error"); playSoundSafe("error"); return; }
    setItems([]); setSelectedRowIndex(-1);
    playSoundSafe("delete"); addAlert("Bill cleared.", "success");
    setTimeout(() => productInputRef.current?.focus(), 50);
  }, [isLocked, addAlert, playSoundSafe]);

  const handleCancelBill = useCallback(() => {
    if (items.length === 0) { addAlert("No bill to cancel.", "warning"); return; }
    if (window.confirm("Cancel this bill?")) {
      const oldSerial = currentBillSerial;
      setIsLocked(false); handleResetBill();
      playSoundSafe("delete"); addAlert("Bill cancelled.", "success");
      try { logActivity({ type: ActivityTypes.ORDER_CANCELLED, serialNo: oldSerial }); } catch (e) {}
    }
  }, [items.length, currentBillSerial, handleResetBill, addAlert, playSoundSafe]);

  const handleNewBill = useCallback(() => {
    if (items.length > 0 && !window.confirm("Start new bill? Current will be cleared.")) return;
    setIsLocked(false); setItems([]); setCustomer({ name: "Walking Customer", phone: "" });
    setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
    setSelectedRowIndex(-1);
    const newSerial = getNextSerial("BILL");
    setCurrentBillSerial(newSerial); clearAllAlerts();
    playSoundSafe("newBill"); addAlert(`New bill ${newSerial}`, "success");
    setTimeout(() => productInputRef.current?.focus(), 50);
    try { logActivity({ type: ActivityTypes.ORDER_CREATED, serialNo: newSerial }); } catch (e) {}
  }, [items.length, addAlert, clearAllAlerts, playSoundSafe]);

  // ==================== COMPUTED ====================
  const totalQty = useMemo(() => items.reduce((s, i) => s + Number(i.qty || 0), 0), [items]);
  const totalDiscount = useMemo(() => items.reduce((s, i) => s + Number(i.discount || 0) * Number(i.qty || 0), 0), [items]);
  const grandTotal = useMemo(() => items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 0) - Number(i.discount || 0) * Number(i.qty || 0)), 0), [items]);

  // ==================== PRINT ====================
  const handlePrintBill = useCallback(() => {
    if (items.length === 0) { addAlert("Cannot print empty bill.", "error"); playSoundSafe("error"); return; }
    const tempOrder = { serialNo: getNextSerial("INV"), billSerial: currentBillSerial, customer, items, totalQty, totalAmount: grandTotal, totalDiscount, status: "pending", createdAt: new Date() };
    setPrintOrder(tempOrder); setShowPrintModal(true);
    try { logActivity({ type: ActivityTypes.BILL_PRINTED, serialNo: currentBillSerial, itemsCount: items.length, totalAmount: grandTotal }); } catch (e) {}
  }, [items, currentBillSerial, customer, totalQty, grandTotal, totalDiscount, addAlert, playSoundSafe]);

  // ==================== SUBMIT ====================
  const validateOrder = useCallback(() => {
    const errors = [];
    if (items.length === 0) errors.push("Add at least one product.");
    if (!customer.name.trim()) errors.push("Customer name required.");
    items.forEach((item, i) => {
      if (!item.productName.trim()) errors.push(`Item ${i + 1}: Name missing.`);
      if (item.price <= 0) errors.push(`Item ${i + 1}: Invalid price.`);
      if (item.qty < 1) errors.push(`Item ${i + 1}: Invalid qty.`);
    });
    const serials = items.map((i) => i.serialId);
    const dupes = serials.filter((s, i) => serials.indexOf(s) !== i);
    if (dupes.length > 0) errors.push(`Duplicate serials: ${[...new Set(dupes)].join(", ")}`);
    return errors;
  }, [items, customer.name]);

  const handleSubmitOrder = async () => {
    if (submitting) return;
    const errors = validateOrder();
    if (errors.length > 0) { errors.forEach((e) => addAlert(e, "error")); playSoundSafe("error"); return; }

    try {
      setSubmitting(true);
      const serialNo = getNextSerial("ORD");
      const preparedItems = items.map((item) => ({
        serialId: item.serialId || "", productName: item.productName || "",
        price: Number(item.price || 0), qty: Number(item.qty || 0), discount: Number(item.discount || 0),
        total: Number(item.price || 0) * Number(item.qty || 0) - Number(item.discount || 0) * Number(item.qty || 0),
      }));

      const orderData = {
        serialNo, billSerial: currentBillSerial,
        customer: { name: customer.name?.trim() || "Walking Customer", phone: customer.phone?.trim() || "" },
        items: preparedItems, totalQty, totalAmount: grandTotal, totalDiscount,
        paymentType: null, status: "pending", cashierHandover: true,
        billerSubmittedAt: new Date().toISOString(), billerName: userData?.name || "Unknown",
        storeId: userData?.storeId || null,
        ...(isOnline ? { createdAt: serverTimestamp() } : { createdAt: new Date().toISOString() }),
      };

      const saveResult = await saveOrder(orderData, isOnline);

      if (saveResult.offline) {
        playSoundSafe("offline");
        addAlert(`Order ${serialNo} saved OFFLINE. Will sync later.`, "warning");
        const count = await getOfflineOrdersCount();
        setOfflineCount(count);
      } else {
        playSoundSafe("billSaved");
        try { await createAuditLog({ ...orderData, id: saveResult.id }, "ORDER_SUBMITTED", userData?.uid); } catch (e) {}
      }

      try { await logActivity({ type: ActivityTypes.ORDER_SUBMITTED, orderId: saveResult.id, serialNo, totalAmount: grandTotal, itemsCount: items.length }); } catch (e) {}

      if (isOnline && !saveResult.offline) {
        setRecentOrders((prev) => [{ id: saveResult.id, ...orderData, createdAt: new Date() }, ...prev].slice(0, 5));
        setTimeout(() => loadRecentOrders(), 500);
      }

      setIsLocked(true); clearAllAlerts();
      addAlert(`Order ${serialNo} submitted!`, "success");

      // Auto new bill after 2s
      setTimeout(() => {
        setIsLocked(false); setItems([]); setCustomer({ name: "Walking Customer", phone: "" });
        setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
        setSelectedRowIndex(-1); setCurrentBillSerial(getNextSerial("BILL"));
        setTimeout(() => productInputRef.current?.focus(), 50);
      }, 2000);
    } catch (error) {
      console.error("Submit error:", error);
      addAlert("Submit failed.", "error"); playSoundSafe("error");
    } finally { setSubmitting(false); }
  };

  // ==================== KEYBOARD SHORTCUTS ====================
  const shortcuts = useMemo(() => ({
    "+": handleSubmitOrder, numpadAdd: handleSubmitOrder,
    "-": handleDeleteSelectedRow, numpadSubtract: handleDeleteSelectedRow,
    "*": handleClearBill, numpadMultiply: handleClearBill,
    "/": handleCancelBill, numpadDivide: handleCancelBill,
    "0": handleNewBill, numpad0: handleNewBill,
    Escape: () => { clearAllAlerts(); setSelectedRowIndex(-1); setShowSearchPanel(false); productInputRef.current?.focus(); },
    F8: handlePrintBill,
    Insert: () => { if (isLocked) unlockBill(); else lockBill(); },
    ArrowUp: () => { if (items.length > 0) setSelectedRowIndex((p) => p <= 0 ? items.length - 1 : p - 1); },
    ArrowDown: () => { if (items.length > 0) setSelectedRowIndex((p) => p >= items.length - 1 ? 0 : p + 1); },
  }), [handleSubmitOrder, handleDeleteSelectedRow, handleClearBill, handleCancelBill, handleNewBill, handlePrintBill, isLocked, lockBill, unlockBill, items.length, clearAllAlerts]);

  useKeyboardShortcuts(shortcuts, !showSearchPanel);

  // ==================== STYLING ====================
  const inputClass = `w-full rounded-xl border px-3 py-3 outline-none transition ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50" : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"} ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`;
  const cardClass = `${isDark ? "border border-yellow-500/20 bg-[#15120d]/95" : "border border-yellow-200 bg-white"} rounded-2xl`;
  const formatDate = (date) => date.toLocaleDateString("en-PK", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  const formatTime = (date) => date.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  // ==================== RENDER ====================
  return (
    <div className="space-y-4">
      <Toaster position="top-right" toastOptions={{ className: "!rounded-xl !text-sm", style: { background: isDark ? "#1a1714" : "#fff", color: isDark ? "#fff" : "#111", border: isDark ? "1px solid rgba(234,179,8,0.2)" : "1px solid #fef3c7" } }} />

      {/* Offline Banner */}
      {!isOnline && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="text-orange-400" />
            <div>
              <p className="font-semibold text-orange-400">You are offline</p>
              <p className="text-sm text-orange-300/70">Billing continues. Orders save locally and sync when back online.</p>
            </div>
          </div>
          {offlineCount > 0 && <span className="rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-bold text-orange-400">{offlineCount} pending sync</span>}
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Biller Dashboard</h1>
            {isLocked && <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1 text-sm font-medium text-red-400"><Lock size={14} />Locked</span>}
            {offlineCount > 0 && <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-medium text-orange-400"><Database size={14} />{offlineCount} offline</span>}
          </div>
          <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>Fast billing — works online & offline</p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className={`inline-flex items-center gap-2 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}><Calendar size={14} />{formatDate(currentDateTime)}</span>
            <span className={`inline-flex items-center gap-2 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}><Clock size={14} />{formatTime(currentDateTime)}</span>
            <span className={`inline-flex items-center gap-2 font-mono ${isDark ? "text-gray-400" : "text-gray-600"}`}><Hash size={14} />{currentBillSerial}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${isOnline ? (isDark ? "border border-green-500/20 bg-green-500/10 text-green-400" : "border border-green-200 bg-green-50 text-green-700") : (isDark ? "border border-red-500/20 bg-red-500/10 text-red-400" : "border border-red-200 bg-red-50 text-red-700")}`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}{isOnline ? "Online" : "Offline"}
          </div>
          <button onClick={() => setSoundEnabled((p) => !p)} className={`rounded-xl p-2 transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]" : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"}`} title={soundEnabled ? "Mute" : "Unmute"}>
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {isOnline && <button onClick={() => setShowSearchPanel((p) => !p)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]" : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"}`}><Search size={16} />Search</button>}
          {isOnline && <button onClick={loadRecentOrders} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]" : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"}`}>Refresh</button>}
          <button onClick={() => setShowRecentOrders((p) => !p)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400 hover:bg-[#1b1711]" : "border border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"}`}>
            {showRecentOrders ? <EyeOff size={16} /> : <Eye size={16} />}{showRecentOrders ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {showSearchPanel && isOnline && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`${cardClass} overflow-hidden p-4`}>
            <div className="mb-3 flex items-center gap-2"><Search size={16} className="text-yellow-500" /><h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Search Order</h2></div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1"><input ref={searchInputRef} type="text" value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearchBySerial()} placeholder="Enter serial (e.g., ORD-20250101-001)" className={inputClass} /></div>
              <div className="flex gap-2">
                <button onClick={handleSearchBySerial} disabled={searching} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-3 font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50">{searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}{searching ? "..." : "Search"}</button>
                <button onClick={clearSearch} className={`rounded-xl px-4 py-3 font-medium ${isDark ? "border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>Clear</button>
              </div>
            </div>
            {searchResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 rounded-xl border p-4 ${isDark ? "border-green-500/20 bg-green-500/10" : "border-green-200 bg-green-50"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-green-500">{searchResult.serialNo}</p>
                    <p className={`mt-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Customer: {searchResult.customer?.name || "Walking Customer"}</p>
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>Items: {searchResult.items?.length || 0} | Qty: {searchResult.totalQty || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-500">PKR {Number(searchResult.totalAmount || 0).toLocaleString()}</p>
                    <span className={`mt-2 inline-block rounded-lg px-3 py-1 text-xs font-medium capitalize ${searchResult.status === "completed" ? "bg-green-500/20 text-green-400" : searchResult.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{searchResult.status || "pending"}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Alerts */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <motion.div key={alert.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`flex items-start justify-between gap-3 rounded-2xl border p-4 ${alert.type === "error" ? (isDark ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700") : alert.type === "success" ? (isDark ? "border-green-500/20 bg-green-500/10 text-green-300" : "border-green-200 bg-green-50 text-green-700") : (isDark ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300" : "border-yellow-200 bg-yellow-50 text-yellow-800")}`}>
                <div className="flex items-start gap-3">
                  {alert.type === "error" ? <XCircle size={18} className="mt-0.5 shrink-0" /> : alert.type === "success" ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
                  <p className="text-sm">{alert.text}</p>
                </div>
                <button onClick={() => removeAlert(alert.id)} className="rounded-lg p-1 hover:bg-black/10"><X size={16} /></button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Recent Orders */}
      <AnimatePresence>
        {showRecentOrders && (
          <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`${cardClass} overflow-hidden p-4`}>
            <div className="mb-3 flex items-center gap-2"><Clock3 size={16} className="text-yellow-500" /><h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Recent Orders</h2></div>
            {!isOnline ? (
              <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center ${isDark ? "border-orange-500/20 bg-black/20 text-gray-400" : "border-orange-200 bg-orange-50/20 text-gray-600"}`}>
                <WifiOff size={34} className="mb-3 text-orange-500" /><p className="font-medium">Offline Mode</p><p className="mt-1 text-sm">Recent orders available when online</p>
              </div>
            ) : loadingOrders ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{[1,2,3,4,5].map((n) => <div key={n} className={`h-28 animate-pulse rounded-xl ${isDark ? "bg-white/5" : "bg-gray-100"}`} />)}</div>
            ) : recentOrders.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {recentOrders.map((order) => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border p-4 ${isDark ? "border-yellow-500/20 bg-black/30" : "border-yellow-200 bg-yellow-50/40"}`}>
                    <div className="flex items-start justify-between">
                      <div><p className="text-sm font-bold text-yellow-500">{order.serialNo || order.id}</p><p className={`mt-1 text-sm ${isDark ? "text-white" : "text-gray-900"}`}>{order.customer?.name || "Walking Customer"}</p></div>
                      <span className={`rounded px-2 py-0.5 text-xs capitalize ${order.status === "completed" ? "bg-green-500/20 text-green-400" : order.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>{order.status || "pending"}</span>
                    </div>
                    <p className="mt-3 text-xl font-bold text-yellow-500">PKR {Number(order.totalAmount || 0).toLocaleString()}</p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center ${isDark ? "border-yellow-500/20 bg-black/20 text-gray-400" : "border-yellow-200 bg-yellow-50/20 text-gray-600"}`}>
                <Database size={34} className="mb-3 text-yellow-500" /><p className="font-medium">No recent orders</p>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        {/* Left Panel */}
        <section className={`${cardClass} p-4`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><ShoppingCart size={18} className="text-yellow-500" /><h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Product Entry</h2></div>
            <button onClick={isLocked ? unlockBill : lockBill} className={`rounded-lg p-2 transition ${isLocked ? (isDark ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-red-100 text-red-600 hover:bg-red-200") : (isDark ? "bg-gray-700 text-gray-400 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}`} title={isLocked ? "Unlock (Insert)" : "Lock (Insert)"}>{isLocked ? <Lock size={16} /> : <Unlock size={16} />}</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Product Name *</label>
              <input ref={productInputRef} type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleAddItem()} placeholder="Enter product name..." className={inputClass} disabled={isLocked} />
            </div>
            <BarcodeScanner onProductAdd={(data) => { setForm({ ...form, productName: data.productName, serialId: data.serialId, price: data.price.toString(), qty: data.qty, discount: data.discount }); setTimeout(() => handleAddItem(), 100); }} disabled={isLocked} />
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Serial ID</label>
              <input type="text" value={form.serialId} onChange={(e) => setForm({ ...form, serialId: e.target.value })} placeholder="Auto-generated if empty" className={inputClass} disabled={isLocked} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Price (PKR) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleAddItem()} placeholder="0.00" className={inputClass} disabled={isLocked} />
              </div>
              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Qty</label>
                <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleAddItem()} className={inputClass} disabled={isLocked} />
              </div>
            </div>
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Discount/item</label>
              <input type="number" min="0" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleAddItem()} placeholder="0" className={inputClass} disabled={isLocked} />
            </div>
            <div className={`my-4 h-px ${isDark ? "bg-yellow-500/10" : "bg-yellow-200"}`} />
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Customer</label>
              <div className="relative"><User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className={`${inputClass} pl-10`} disabled={isLocked} /></div>
            </div>
            <div>
              <label className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Phone</label>
              <input type="text" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone..." className={inputClass} disabled={isLocked} />
            </div>
            <button onClick={handleAddItem} disabled={isLocked} className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-3 font-semibold text-black transition hover:from-yellow-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50">Add Product</button>
          </div>
        </section>

        {/* Right Panel */}
        <div className="space-y-4">
          <section className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={`${isDark ? "bg-yellow-500/10 text-yellow-500" : "bg-yellow-50 text-yellow-700"}`}>
                  <tr><th className="px-4 py-4 text-left">#</th><th className="px-4 py-4 text-left">Serial</th><th className="px-4 py-4 text-left">Product</th><th className="px-4 py-4 text-left">Price</th><th className="px-4 py-4 text-left">Qty</th><th className="px-4 py-4 text-left">Disc</th><th className="px-4 py-4 text-left">Total</th><th className="px-4 py-4 text-left">Action</th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan="8" className="px-4 py-14 text-center"><div className="flex flex-col items-center justify-center text-gray-500"><Package size={30} className="mb-2 text-yellow-500" /><p className="font-medium">No items</p><p className="mt-1 text-sm">Add products to bill</p></div></td></tr>
                  ) : items.map((item, index) => {
                    const lineTotal = item.price * item.qty - item.discount * item.qty;
                    const isSelected = selectedRowIndex === index;
                    return (
                      <motion.tr key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedRowIndex(index)} className={`cursor-pointer border-t transition ${isSelected ? (isDark ? "border-yellow-500/30 bg-yellow-500/10" : "border-yellow-300 bg-yellow-100/50") : (isDark ? "border-yellow-500/10 text-white hover:bg-white/5" : "border-yellow-100 text-gray-900 hover:bg-gray-50")}`}>
                        <td className="px-4 py-4"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-yellow-500 text-black" : isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>{index + 1}</span></td>
                        <td className="px-4 py-4 font-mono text-xs text-yellow-500">{item.serialId}</td>
                        <td className="px-4 py-4 font-medium">{item.productName}</td>
                        <td className="px-4 py-4">PKR {item.price.toLocaleString()}</td>
                        <td className="px-4 py-4"><input type="number" min="1" value={item.qty} onChange={(e) => handleQtyChange(item.id, e.target.value)} disabled={isLocked} className={`w-20 rounded-lg border px-2 py-1 outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50" : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"}`} /></td>
                        <td className="px-4 py-4"><input type="number" min="0" value={item.discount} onChange={(e) => handleDiscountChange(item.id, e.target.value)} disabled={isLocked} className={`w-24 rounded-lg border px-2 py-1 outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50" : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"}`} /></td>
                        <td className="px-4 py-4 font-bold text-yellow-500">PKR {lineTotal.toLocaleString()}</td>
                        <td className="px-4 py-4"><button onClick={(e) => { e.stopPropagation(); handleDeleteRow(item.id); }} disabled={isLocked} className={`rounded-lg px-3 py-1 text-xs font-medium ${isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50" : "bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"}`}>Delete</button></td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Summary */}
          <section className={`${cardClass} p-5`}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Grand Total</p>
                <h3 className="mt-3 text-4xl font-extrabold text-yellow-500">PKR {grandTotal.toLocaleString()}</h3>
                <div className="mt-4 grid max-w-xl grid-cols-3 gap-3">
                  {[{ label: "Items", value: items.length }, { label: "Total Qty", value: totalQty }, { label: "Discount", value: `PKR ${totalDiscount.toLocaleString()}` }].map((s) => (
                    <div key={s.label} className={`${isDark ? "border-yellow-500/10 bg-black/25" : "border-yellow-100 bg-yellow-50/30"} rounded-xl border px-4 py-3`}>
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{s.label}</p>
                      <p className={`mt-1 text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handlePrintBill} className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium ${isDark ? "border border-yellow-500/20 bg-slate-800/80 text-white hover:bg-slate-700" : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"}`}><Printer size={18} />Print (F8)</button>
                <button onClick={handleResetBill} disabled={isLocked} className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium ${isDark ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50" : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"}`}>Reset</button>
                <button onClick={handleSubmitOrder} disabled={submitting || isLocked} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-3 font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}{submitting ? "Submitting..." : "Submit (+)"}</button>
              </div>
            </div>
          </section>

          {/* Shortcuts */}
          <section className={`${cardClass} p-4`}>
            <div className="mb-3 flex items-center gap-2"><Keyboard size={16} className="text-yellow-500" /><h3 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Shortcuts</h3></div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[{ key: "F8", action: "Print" }, { key: "Insert", action: "Lock/Unlock" }, { key: "+", action: "Submit" }, { key: "-", action: "Delete Row" }, { key: "*", action: "Clear" }, { key: "/", action: "Cancel" }, { key: "0", action: "New Bill" }, { key: "Esc", action: "Reset" }, { key: "↑↓", action: "Navigate" }, { key: "Enter", action: "Add" }].map((h) => (
                <div key={h.key} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isDark ? "bg-yellow-500/10 text-yellow-300" : "bg-yellow-50 text-yellow-700"}`}>
                  <span className="font-mono text-xs font-bold">{h.key}</span><span className="text-xs">{h.action}</span>
                </div>
              ))}
            </div>
            {selectedRowIndex >= 0 && items.length > 0 && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-700"}`}>Selected: <strong>{selectedRowIndex + 1}</strong> — {items[selectedRowIndex]?.productName}</div>
            )}
          </section>
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && printOrder && (
        <InvoicePrint order={printOrder} store={store || { name: "AONE JEWELRY", address: "Store Address", phone: "Phone" }} onClose={() => { setShowPrintModal(false); setPrintOrder(null); }} />
      )}
    </div>
  );
};

export default Dashboard;