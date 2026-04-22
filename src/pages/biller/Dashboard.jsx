// src/modules/biller/BillerDashboard.jsx - COMPLETE FINAL FIXED
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock3, Package, Printer, Send, ShoppingCart,
  WifiOff, X, Loader2, Lock, Trash2, CreditCard,
} from "lucide-react";
import {
  collection, getDocs, limit, orderBy, query,
  serverTimestamp, addDoc, where,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useTheme }         from "../../context/ThemeContext";
import { useLanguage }      from "../../hooks/useLanguage";
import useNetworkStatus     from "../../hooks/useNetworkStatus";
import useKeyboardShortcuts from "../../hooks/useHotkeys";
import { db }               from "../../services/firebase";
import { logActivity, createAuditLog, ActivityTypes } from "../../services/activityLogger";
import { saveOrder }        from "../../services/orderService";
import { useAuth }          from "../../context/AuthContext";
import { useSettings }      from "../../context/SettingsContext";
import { getStoreById, updateStore } from "../../modules/stores/storeService";
import { syncOfflineOrders, getOfflineOrdersCount } from "../../services/offlineSync";
import { playSound }        from "../../services/soundService";
import BillerHeader         from "./BillerHeader";
import CustomerDialog       from "../../components/CustomerDialog";
import SummaryPopup         from "../../components/SummaryPopup";
import InvoicePrint         from "../../components/InvoicePrint";
import { recordBillDeletion } from "../../services/deletedBillsService";
import { getNextBillSerial, confirmBillSerial, cancelBillSerial, getNextItemSerial, resetSerialCounter } from "../../utils/serialNumberManager";

// ─── Customer Auto Counter ────────────────────────────────────────────────────
let _customerCounter = parseInt(localStorage.getItem("customerAutoCounter") || "0", 10);
const getNextCustomerNumber = () => {
  _customerCounter += 1;
  localStorage.setItem("customerAutoCounter", String(_customerCounter));
  return `Customer ${String(_customerCounter).padStart(3, "0")}`;
};

// ─── F8 Steps ─────────────────────────────────────────────────────────────────
// 0=idle, 1=customer, 2=summary, 3=print, 4=cashier payment

const Dashboard = () => {
  const { isDark }   = useTheme();
  const { language } = useLanguage();
  const isOnline     = useNetworkStatus();
  const { userData, isSuperAdmin } = useAuth();
  const { settings } = useSettings();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const priceInputRef     = useRef(null);
  const qtyInputRef       = useRef(null);
  const phoneInputRef     = useRef(null);
  const discountInputRef  = useRef(null);
  const tableContainerRef = useRef(null);
  const serialInitialized = useRef(false);
  const submittingRef     = useRef(false);
  const deleteLockedRef   = useRef(false);
  const autoSaveRef       = useRef(false);
  const f8FiringRef       = useRef(false);
  const bcRef             = useRef(null);

  const DELETE_COOLDOWN = 500;

  // ── UI State ──────────────────────────────────────────────────────────────
  const [showRecentOrders,  setShowRecentOrders]  = useState(false);
  const [recentOrders,      setRecentOrders]      = useState([]);
  const [loadingOrders,     setLoadingOrders]     = useState(false);
  const [alerts,            setAlerts]            = useState([]);
  const [submitting,        setSubmitting]        = useState(false);
  const [soundEnabled,      setSoundEnabled]      = useState(true);
  const [offlineCount,      setOfflineCount]      = useState(0);
  const [store,             setStore]             = useState(null);
  const [currentDateTime,   setCurrentDateTime]   = useState(new Date());
  const [cashierModeActive, setCashierModeActive] = useState(false);

  // ── Permissions ───────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState({
    showInvoicePreview: false,
    showRecentOrders:   true,
    showTimestamps:     true,
    allowDirectSubmit:  false,
    allowCancelBill:    true,
    allowCashierMode:   false,
  });

  const [directPaid, setDirectPaid] = useState(false);

  const [runtimeCities,  setRuntimeCities]  = useState([]);
  const [runtimeMarkets, setRuntimeMarkets] = useState([]);

  // ── Bill State ────────────────────────────────────────────────────────────
  const [screenLocked,      setScreenLocked]      = useState(true);
  const [billStartTime,     setBillStartTime]     = useState(null);
  const [billEndTime,       setBillEndTime]       = useState(null);
  const [currentBillSerial, setCurrentBillSerial] = useState("");
  const [items,             setItems]             = useState([]);
  const [selectedRowIndex,  setSelectedRowIndex]  = useState(-1);
  const [lastItemId,        setLastItemId]        = useState(null);
  const [billDiscount,      setBillDiscount]      = useState(0);
  const [billDiscountType,  setBillDiscountType]  = useState("fixed");

  // ── Form & Customer ───────────────────────────────────────────────────────
  const [form, setForm] = useState({
    productName: "", serialId: "", price: "",
    qty: 1, discount: 0, discountType: "fixed",
  });
  const [customer, setCustomer] = useState({
    name: "Walking Customer", phone: "", city: "Karachi", market: "",
  });

  // ── F8 Flow ───────────────────────────────────────────────────────────────
  const [f8Step,             setF8Step]             = useState(0);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSummaryPopup,   setShowSummaryPopup]   = useState(false);
  const [showPrintModal,     setShowPrintModal]     = useState(false);
  const [printOrder,         setPrintOrder]         = useState(null);

  // ── Cashier Payment ───────────────────────────────────────────────────────
  const [showCashierPayment, setShowCashierPayment] = useState(false);
  const [paymentType,        setPaymentType]        = useState("cash");
  const [amountReceived,     setAmountReceived]     = useState("");

  const [lastEntry, setLastEntry] = useState({
    price: "", qty: 1, discount: 0, discountType: "fixed",
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const showProductName   = isSuperAdmin && settings?.billerUI?.showProductName === true;
  const showDiscountField = settings?.billerUI?.showDiscountField === true;
  const allowBillDiscount = settings?.discount?.allowBillDiscount === true;
  const billerFontSize    = settings?.fonts?.billerFontSize || 15;
  const totalFontSize     = settings?.fonts?.totalFontSize  || 22;
  const storeId           = userData?.storeId;

  const userRoles      = userData?.roles || (userData?.role ? [userData.role] : []);
  const hasBillerRole  = userRoles.includes("biller")  || userData?.role === "biller";
  const hasCashierRole = userRoles.includes("cashier") || userData?.role === "cashier";
  const isDualRole     = hasBillerRole && hasCashierRole;

  const showInvoicePreview = true;
  const showOfflineInvoice = settings?.billFlow?.showOfflineInvoice !== false;

  const isAutoApproved =
    isDualRole || cashierModeActive ||
    settings?.autoApproval?.autoApproval === true;

  const canToggleCashierMode =
    isSuperAdmin || isDualRole || permissions.allowCashierMode === true;

  const storeInfo = useMemo(() => ({
    name:    settings?.store?.name    || store?.name    || "AONE JEWELRY",
    tagline: settings?.store?.tagline || store?.tagline || "",
    address: settings?.store?.address || store?.address || "",
    phone:   settings?.store?.phone   || store?.phone   || "",
    ntn:     settings?.store?.ntn     || store?.ntn     || "",
  }), [settings?.store, store]);

  // ── Sound ─────────────────────────────────────────────────────────────────
  const playSoundSafe = useCallback(
    (name) => { if (soundEnabled) playSound(name); },
    [soundEnabled]
  );

  // ── Alerts ────────────────────────────────────────────────────────────────
  const removeAlert    = useCallback((id) => setAlerts((p) => p.filter((a) => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  const addAlert = useCallback((text, type = "warning") => {
    setAlerts((prev) => {
      if (prev.some((a) => a.text === text)) return prev;
      return [...prev, { id: Date.now() + Math.random(), text, type }];
    });
    try {
      if (type === "success")    toast.success(text, { duration: 4000 });
      else if (type === "error") toast.error(text,   { duration: 5000 });
      else                       toast(text,          { duration: 4000, icon: "⚠️" });
    } catch (_) {}
  }, []);

  const toastOnly = useCallback((text, type = "warning") => {
    try {
      if (type === "success")    toast.success(text, { duration: 3000 });
      else if (type === "error") toast.error(text,   { duration: 4000 });
      else                       toast(text,          { duration: 3000, icon: "⚠️" });
    } catch (_) {}
  }, []);

  // ── ✅ FIXED: Serial Generator ────────────────────────────────────────────
  // forceNew = false → same draft serial (page reload safe)
  // forceNew = true  → naya serial (save/clear/cancel ke baad)
  const generateNextSerial = useCallback(
    (forceNew = false) =>
      getNextBillSerial(
        storeId || "default",
        isOnline ? db : null,
        forceNew
      ),
    [storeId, isOnline]
  );

  // ── Computed Totals ───────────────────────────────────────────────────────
  const totalQty = useMemo(
    () => items.reduce((s, i) => s + Number(i.qty || 0), 0),
    [items]
  );

  const totalDiscount = useMemo(
    () => items.reduce((s, i) => {
      const unit = Number(i.price || 0);
      const qty  = Number(i.qty   || 0);
      const disc = Number(i.discount || 0);
      return s + (i.discountType === "percent"
        ? Math.round((unit * qty * disc) / 100)
        : disc * qty);
    }, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((s, i) => {
      const unit    = Number(i.price    || 0);
      const qty     = Number(i.qty      || 0);
      const disc    = Number(i.discount || 0);
      const discAmt = i.discountType === "percent"
        ? Math.round((unit * disc) / 100) : disc;
      return s + (unit - discAmt) * qty;
    }, 0),
    [items]
  );

  const billDiscountValue = useMemo(() => {
    const val = Number(billDiscount || 0);
    if (billDiscountType === "percent")
      return Math.round((subtotal * Math.min(100, Math.max(0, val))) / 100);
    return Math.max(0, val);
  }, [billDiscount, billDiscountType, subtotal]);

  const finalTotal = useMemo(
    () => Math.max(0, subtotal - billDiscountValue),
    [subtotal, billDiscountValue]
  );

  const changeAmount = useMemo(() => {
    const r = Number(amountReceived || 0);
    return r > 0 ? Math.max(0, r - finalTotal) : 0;
  }, [amountReceived, finalTotal]);

  // ── Firebase Helpers ──────────────────────────────────────────────────────
  const saveClearedDataToFirebase = useCallback(async (clearedItems, reason = "manual_clear") => {
    if (!clearedItems?.length || !isOnline) return;
    try {
      await addDoc(collection(db, "clearedData"), {
        serialNo:      currentBillSerial,
        items:         clearedItems,
        totalAmount:   clearedItems.reduce((s, i) => s + i.price * i.qty - i.discount * i.qty, 0),
        totalDiscount: clearedItems.reduce((s, i) => s + i.discount * i.qty, 0),
        totalQty:      clearedItems.reduce((s, i) => s + i.qty, 0),
        reason,
        customer:      { ...customer },
        billerName:    userData?.name || "Unknown",
        billerId:      userData?.uid  || null,
        storeId:       storeId        || "default",
        billStartTime: billStartTime?.toISOString() || null,
        clearedAt:     serverTimestamp(),
        clearedAtLocal: new Date().toISOString(),
      });
    } catch (e) { console.error("saveClearedData:", e); }
  }, [currentBillSerial, customer, userData, billStartTime, isOnline, storeId]);

  const saveClearedBillToFirebase = useCallback(async (billItems, reason = "bill_cancelled") => {
    if (!billItems?.length || !isOnline) return;
    try {
      await addDoc(collection(db, "clearedBills"), {
        serialNo:      currentBillSerial,
        items:         billItems,
        totalAmount:   billItems.reduce((s, i) => s + i.price * i.qty - i.discount * i.qty, 0),
        totalDiscount: billItems.reduce((s, i) => s + i.discount * i.qty, 0),
        totalQty:      billItems.reduce((s, i) => s + i.qty, 0),
        reason,
        customer:      { ...customer },
        billerName:    userData?.name || "Unknown",
        billerId:      userData?.uid  || null,
        storeId:       storeId        || "default",
        billStartTime: billStartTime?.toISOString() || null,
        billEndTime:   new Date().toISOString(),
        datetime:      new Date().toISOString(),
        clearedAt:     serverTimestamp(),
      });
    } catch (e) { console.error("saveClearedBill:", e); }
  }, [currentBillSerial, customer, userData, billStartTime, isOnline, storeId]);

  const recordItemSerial = useCallback(async (serialId, billSerial) => {
    if (!isOnline) return;
    try {
      await addDoc(collection(db, "itemSerials"), {
        serialId,
        billSerial,
        storeId:   storeId || "default",
        createdAt: serverTimestamp(),
      });
    } catch (_) {}
  }, [isOnline, storeId]);

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadRecentOrders = useCallback(async () => {
    if (!isOnline) { setLoadingOrders(false); return; }
    setLoadingOrders(true);
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5))
      );
      setRecentOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("loadRecentOrders:", e); }
    finally { setLoadingOrders(false); }
  }, [isOnline]);

  const loadStore = useCallback(async () => {
    if (!storeId || !isOnline) return;
    try {
      const s = await getStoreById(storeId);
      if (s) setStore(s);
    } catch (e) { console.error("loadStore:", e); }
  }, [storeId, isOnline]);

  const syncOfflineData = useCallback(async () => {
    if (!isOnline) return;
    try {
      const count = await getOfflineOrdersCount();
      if (!count) return;
      addAlert(`Syncing ${count} offline order(s)...`, "warning");
      const result = await syncOfflineOrders();
      if (result.success && result.synced > 0) {
        playSoundSafe("syncComplete");
        addAlert(`✅ Synced ${result.synced} orders!`, "success");
        setOfflineCount(0);
        loadRecentOrders();
      } else if (result.failed > 0) {
        addAlert(`Failed to sync ${result.failed} orders`, "error");
      }
    } catch (e) { console.error("syncOfflineData:", e); }
  }, [isOnline, addAlert, playSoundSafe, loadRecentOrders]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ✅ FIXED: Serial init — sirf ek baar, forceNew=false
  // Page reload pe same serial return karega (draft cache se)
  useEffect(() => {
    if (serialInitialized.current) return;
    if (userData === null) return;
    serialInitialized.current = true;
    const initStoreId = storeId || "default";
    // forceNew = false: Agar draft hai to same serial, nahi to DB se fresh
    getNextBillSerial(initStoreId, isOnline ? db : null, false)
      .then((serial) => {
        setCurrentBillSerial(serial);
        console.log(`📋 Initial serial set: ${serial}`);
      });
  }, [storeId, isOnline, userData]);

  // ✅ BroadcastChannel: other tabs se serial sync
  useEffect(() => {
    if (!storeId) return;
    try {
      const bc = new BroadcastChannel(`billing_${storeId}`);
      bcRef.current = bc;
      bc.onmessage = (event) => {
        const { type, serial, num } = event.data || {};
        const LS_KEY = `serial_counter_${storeId}`;

        if (type === "SERIAL_DRAFT" || type === "SERIAL_CONFIRMED") {
          // Doosre tab ne serial use kiya → localStorage update karo
          const current = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
          if (num > current) {
            localStorage.setItem(LS_KEY, String(num));
            console.log(`📡 BC sync: ${type} → localStorage updated to ${num}`);
          }
        }
      };
      return () => { bc.close(); bcRef.current = null; };
    } catch (_) {}
  }, [storeId]);

  useEffect(() => {
    if (!isOnline) return;
    loadRecentOrders();
    loadStore();
    syncOfflineData();
  }, [isOnline, storeId]); // eslint-disable-line

  useEffect(() => {
    const check = async () => setOfflineCount(await getOfflineOrdersCount());
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!screenLocked) {
      const t = setTimeout(() => priceInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [screenLocked, items.length]);

  useEffect(() => {
    if (store?.billerPermissions)
      setPermissions((p) => ({ ...p, ...store.billerPermissions }));
  }, [store]);

  useEffect(() => {
    if (settings?.customer?.defaultCustomerName) {
      setCustomer((prev) => ({ ...prev, name: settings.customer.defaultCustomerName }));
    }
  }, [settings?.customer?.defaultCustomerName]);

  useEffect(() => {
    if (selectedRowIndex < 0 || !tableContainerRef.current) return;
    const t = setTimeout(() => {
      const rows = tableContainerRef.current?.querySelectorAll("tbody tr");
      rows?.[selectedRowIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
    return () => clearTimeout(t);
  }, [selectedRowIndex]);

  // ── ✅ Reset Bill State ───────────────────────────────────────────────────
  const resetBillState = useCallback(() => {
    setItems([]);
    setSelectedRowIndex(-1);
    setLastItemId(null);
    setCustomer({
      name: settings?.customer?.defaultCustomerName || "Walking Customer",
      phone: "", city: "Karachi", market: "",
    });
    setForm({
      productName: "", serialId: "", price: "",
      qty: 1, discount: 0, discountType: "fixed",
    });
    setLastEntry({ price: "", qty: 1, discount: 0, discountType: "fixed" });
    setBillDiscount(0);
    setBillDiscountType("fixed");
    setF8Step(0);
    setShowCustomerDialog(false);
    setShowSummaryPopup(false);
    setShowPrintModal(false);
    setPrintOrder(null);
    setShowCashierPayment(false);
    setPaymentType("cash");
    setAmountReceived("");
    autoSaveRef.current     = false;
    f8FiringRef.current     = false;
    submittingRef.current   = false;
    deleteLockedRef.current = false;
  }, [settings?.customer?.defaultCustomerName]);

  // ── Add Item ──────────────────────────────────────────────────────────────
  const handleAddItem = useCallback(async () => {
    if (screenLocked) {
      addAlert("Bill locked. Press INSERT.", "error");
      playSoundSafe("error");
      return;
    }

    const price      = (form.price !== "" && form.price !== null) ? Number(form.price) : Number(lastEntry.price) || 0;
    const qty        = Number(form.qty) || Number(lastEntry.qty) || 1;
    const discount   = (form.discount !== "" && form.discount !== null) ? Number(form.discount) : Number(lastEntry.discount) || 0;
    const discountType = form.discountType || lastEntry.discountType || "fixed";
    let   productName  = form.productName.trim();

    if (!Number.isFinite(price) || price <= 0)  { addAlert("Valid price required.", "error");   playSoundSafe("error"); return; }
    if (!Number.isFinite(qty)   || qty < 1)     { addAlert("Valid qty required.", "error");     playSoundSafe("error"); return; }
    if (showProductName && !productName)          { addAlert("Product name required.", "error"); playSoundSafe("error"); return; }

    const discAmt  = discountType === "percent"
      ? Math.min(100, Math.max(0, discount))
      : Math.max(0, discount);
    const serialId = form.serialId.trim() || getNextItemSerial();

    if (items.some((i) => i.serialId === serialId)) {
      addAlert(`Duplicate serial: ${serialId}`, "error");
      playSoundSafe("error");
      return;
    }
    if (!showProductName) productName = `Item - ${serialId}`;

    const newItem = {
      id: Date.now(), serialId, productName,
      price, qty, discount: discAmt, discountType,
    };
    setItems((prev) => [...prev, newItem]);
    setLastItemId(newItem.id);
    setLastEntry({ price: String(price), qty, discount: discAmt, discountType });
    setForm((prev) => ({
      ...prev, productName: "", serialId: "", price: "", qty, discount: discAmt, discountType,
    }));
    setSelectedRowIndex(-1);
    playSoundSafe("keyPress");
    recordItemSerial(serialId, currentBillSerial);
    setTimeout(() => priceInputRef.current?.focus(), 50);
    try {
      logActivity({ type: ActivityTypes.ITEM_ADDED, serialNo: currentBillSerial, item: newItem });
    } catch (_) {}
  }, [
    form, screenLocked, lastEntry, showProductName,
    currentBillSerial, items, addAlert, playSoundSafe, recordItemSerial,
  ]);

  // ── Row Operations ────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback((id) => {
    if (screenLocked) { playSoundSafe("error"); return; }
    const item = items.find((i) => i.id === id);
    if (item) saveClearedDataToFirebase([item], "row_deleted");
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedRowIndex(-1);
    playSoundSafe("delete");
    toastOnly(`Deleted: ${item?.productName || "item"}`, "warning");
    setTimeout(() => priceInputRef.current?.focus(), 50);
    try {
      logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item });
    } catch (_) {}
  }, [screenLocked, items, currentBillSerial, playSoundSafe, saveClearedDataToFirebase, toastOnly]);

  const handleQtyChange = useCallback((id, v) => {
    if (!screenLocked)
      setItems((p) => p.map((i) => i.id === id ? { ...i, qty: Math.max(1, Number(v) || 1) } : i));
  }, [screenLocked]);

  const handleDiscountChange = useCallback((id, v) => {
    if (!screenLocked)
      setItems((p) => p.map((i) => i.id === id ? { ...i, discount: Math.max(0, Number(v) || 0) } : i));
  }, [screenLocked]);

  const handleItemDiscountTypeChange = useCallback((id, type) => {
    if (!screenLocked)
      setItems((p) => p.map((i) => i.id === id ? { ...i, discountType: type } : i));
  }, [screenLocked]);

  // ── ✅ FIXED: Clear Bill ──────────────────────────────────────────────────
  const handleClearBill = useCallback(async () => {
    if (screenLocked) { playSoundSafe("error"); return; }

    if (items.length > 0) {
      saveClearedDataToFirebase(items, "bill_cleared").catch(() => {});
      recordBillDeletion({
        serialNo:      currentBillSerial,
        items,
        totalAmount:   subtotal,
        totalDiscount,
        totalQty,
        customer,
        billStartTime,
        billEndTime,
        billerName:    userData?.name || "Unknown",
        billerId:      userData?.uid  || null,
        storeId:       storeId        || "default",
        reason:        "bill_cleared",
      }, storeId, isOnline).catch(() => {});

      // ✅ Draft clear karo
      cancelBillSerial(currentBillSerial, storeId || "default");
    }

    resetBillState();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    playSoundSafe("delete");
    toastOnly("Bill cleared.", "success");

    // ✅ forceNew=true → naya serial generate karo
    try {
      const nextSerial = await generateNextSerial(true);
      setCurrentBillSerial(nextSerial);
    } catch (_) {}

    setTimeout(() => priceInputRef.current?.focus(), 100);
  }, [
    screenLocked, items, currentBillSerial, subtotal, totalDiscount,
    totalQty, customer, billStartTime, billEndTime, userData, storeId, isOnline,
    playSoundSafe, saveClearedDataToFirebase, toastOnly, resetBillState, generateNextSerial,
  ]);

  // ── ✅ FIXED: Cancel Bill ─────────────────────────────────────────────────
  const handleCancelBill = useCallback(async () => {
    if (items.length === 0) { toastOnly("No bill to cancel.", "warning"); return; }
    if (!window.confirm("Cancel this bill?")) return;

    const oldSerial = currentBillSerial;
    saveClearedBillToFirebase(items, "bill_cancelled").catch(() => {});
    recordBillDeletion({
      serialNo:      oldSerial,
      items,
      customer,
      totalAmount:   subtotal,
      totalDiscount,
      totalQty,
      billStartTime,
      billEndTime,
      billerName:    userData?.name || "Unknown",
      billerId:      userData?.uid  || null,
      storeId:       storeId        || "default",
      reason:        "bill_cancelled",
    }, storeId, isOnline).catch(() => {});

    // ✅ Draft clear karo
    cancelBillSerial(currentBillSerial, storeId || "default");

    resetBillState();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    playSoundSafe("delete");
    toastOnly("Bill cancelled.", "success");

    // ✅ forceNew=true → naya serial generate karo
    try {
      const nextSerial = await generateNextSerial(true);
      setCurrentBillSerial(nextSerial);
    } catch (_) {}

    try {
      logActivity({ type: ActivityTypes.ORDER_CANCELLED, serialNo: oldSerial });
    } catch (_) {}
  }, [
    items, currentBillSerial, subtotal, totalDiscount, totalQty,
    customer, billStartTime, billEndTime, userData, storeId, isOnline,
    playSoundSafe, saveClearedBillToFirebase, toastOnly, resetBillState, generateNextSerial,
  ]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateOrder = useCallback(() => {
    const errors = [];
    if (!items.length) errors.push("Add at least one product.");
    if (!customer.name?.trim() && !customer.phone?.trim())
      errors.push("Customer name required.");
    items.forEach((item, i) => {
      if (!item.serialId?.trim()) errors.push(`Item ${i + 1}: Serial ID missing.`);
      if (item.price <= 0)        errors.push(`Item ${i + 1}: Invalid price.`);
      if (item.qty < 1)           errors.push(`Item ${i + 1}: Invalid qty.`);
    });
    const serials = items.map((i) => i.serialId);
    const dupes   = serials.filter((s, idx) => serials.indexOf(s) !== idx);
    if (dupes.length)
      errors.push(`Duplicate serials: ${[...new Set(dupes)].join(", ")}`);
    return errors;
  }, [items, customer]);

  // ── ✅ FIXED: Submit Order ────────────────────────────────────────────────
  const handleSubmitOrderInternal = useCallback(async (overridePayment = null) => {
    if (submittingRef.current) { console.warn("Already submitting"); return; }
    submittingRef.current = true;

    const errors = validateOrder();
    if (errors.length) {
      errors.forEach((e) => addAlert(e, "error"));
      playSoundSafe("error");
      submittingRef.current = false;
      return;
    }

    const resolvedName =
      customer.name?.trim() ||
      (customer.phone?.trim() ? getNextCustomerNumber() : "Walking Customer");

    setSubmitting(true);

    const serialNo      = currentBillSerial;
    const endTime       = billEndTime || new Date();
    const savedItems    = [...items];
    const savedCustomer = { ...customer };

    try {
      const preparedItems = savedItems.map((item) => {
        const discAmt = item.discountType === "percent"
          ? Math.round((item.price * item.discount) / 100)
          : item.discount;
        return {
          serialId:     item.serialId    || "",
          productName:  item.productName || "",
          price:        Number(item.price    || 0),
          qty:          Number(item.qty      || 0),
          discount:     Number(item.discount || 0),
          discountType: item.discountType || "fixed",
          total:        (Number(item.price || 0) - discAmt) * Number(item.qty || 0),
        };
      });

      const orderData = {
        serialNo,
        billSerial: serialNo,
        customer: {
          name:   resolvedName,
          phone:  savedCustomer.phone?.trim() || "",
          city:   savedCustomer.city          || "Karachi",
          market: savedCustomer.market        || "",
        },
        items:          preparedItems,
        totalQty,
        subtotal,
        totalDiscount,
        billDiscount:   billDiscountValue,
        totalAmount:    finalTotal,
        paymentType:    overridePayment?.type     || null,
        amountReceived: overridePayment?.received || null,
        changeGiven:    overridePayment?.change   || null,
        status:          isAutoApproved ? "approved" : "pending",
        cashierHandover: !isAutoApproved,
        ...(isAutoApproved && {
          cashierName:       userData?.name || "Unknown",
          cashierId:         userData?.uid  || null,
          cashierApprovedAt: new Date().toISOString(),
        }),
        billerSubmittedAt: new Date().toISOString(),
        billerName:        userData?.name || "Unknown",
      storeId:           storeId        || "default",
        billEndTime:       endTime.toISOString(),
        createdAt:         new Date().toISOString(),
      };

      let result;
      try {
        result = await saveOrder(orderData, isOnline);
      } catch (saveErr) {
        console.error("saveOrder error:", saveErr);
        result = {
          success:   true,
          id:        `ERR-${Date.now()}`,
          offline:   true,
          duplicate: false,
        };
      }

      if (result.duplicate) {
        addAlert(`Order ${serialNo} already exists.`, "warning");
        playSoundSafe("error");
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      // ✅ FIXED: Serial confirm karo (draft clear) + localStorage update
      confirmBillSerial(serialNo, storeId || "default");

      if (result.offline) {
        playSoundSafe("offline");
        addAlert(`📴 Bill #${serialNo} saved OFFLINE. Will sync when online.`, "warning");
        getOfflineOrdersCount().then(setOfflineCount).catch(() => {});
      } else {
        playSoundSafe("billSaved");
        try {
          await createAuditLog(
            { ...orderData, id: result.id },
            "ORDER_SUBMITTED",
            userData?.uid
          );
        } catch (_) {}
      }

      try {
        logActivity({
          type:        ActivityTypes.ORDER_SUBMITTED,
          orderId:     result.id,
          serialNo,
          totalAmount: finalTotal,
          itemsCount:  savedItems.length,
        });
      } catch (_) {}

      if (isOnline && !result.offline) {
        setRecentOrders((p) =>
          [{ id: result.id, ...orderData, createdAt: new Date() }, ...p].slice(0, 5)
        );
        setTimeout(loadRecentOrders, 500);
      }

      clearAllAlerts();
      addAlert(
        isAutoApproved
          ? `✅ Bill #${serialNo} approved & saved! Press INSERT for new bill.`
          : `📤 Bill #${serialNo} sent to cashier. Press INSERT for new bill.`,
        "success"
      );

      // ✅ Immediate state clear
      setScreenLocked(true);
      setBillStartTime(null);
      setBillEndTime(null);
      setItems([]);
      setSelectedRowIndex(-1);
      setLastItemId(null);
      setCustomer({
        name: settings?.customer?.defaultCustomerName || "Walking Customer",
        phone: "", city: "Karachi", market: "",
      });
      setForm({
        productName: "", serialId: "", price: "",
        qty: 1, discount: 0, discountType: "fixed",
      });
      setLastEntry({ price: "", qty: 1, discount: 0, discountType: "fixed" });
      setBillDiscount(0);
      setBillDiscountType("fixed");
      setF8Step(0);
      setShowCustomerDialog(false);
      setShowSummaryPopup(false);
      setShowPrintModal(false);
      setPrintOrder(null);
      setShowCashierPayment(false);
      setPaymentType("cash");
      setAmountReceived("");
      f8FiringRef.current     = false;
      submittingRef.current   = false;
      deleteLockedRef.current = false;
      autoSaveRef.current     = false;

      // ✅ Get a fresh serial after successful save
      generateNextSerial(true).then(setCurrentBillSerial).catch(() => {});

      setTimeout(() => priceInputRef.current?.focus(), 300);

    } catch (err) {
      console.error("❌ Submit error:", err);
      addAlert(`Save failed: ${err.message}. Try again.`, "error");
      playSoundSafe("error");
      submittingRef.current = false;
    }

    setSubmitting(false);
  }, [
    validateOrder, currentBillSerial, billStartTime, billEndTime,
    customer, items, totalQty, subtotal, totalDiscount, finalTotal,
    billDiscountValue, userData, storeId, isOnline, isAutoApproved,
    addAlert, playSoundSafe, clearAllAlerts, generateNextSerial,
    loadRecentOrders, settings?.customer?.defaultCustomerName,
  ]);

  // ── F8 Handlers ───────────────────────────────────────────────────────────
  const openCustomerDialog = useCallback(() => {
    if (items.length === 0) {
      toastOnly("Add items first.", "error"); playSoundSafe("error"); return;
    }
    if (screenLocked) {
      toastOnly("Unlock bill first (INSERT).", "error"); playSoundSafe("error"); return;
    }
    if (customer.phone && customer.name === "Walking Customer")
      setCustomer((prev) => ({ ...prev, name: getNextCustomerNumber() }));
    setShowCustomerDialog(true);
    setF8Step(1);
    playSoundSafe("keyPress");
  }, [items.length, screenLocked, customer, playSoundSafe, toastOnly]);

  const handleCustomerSubmit = useCallback((customerData) => {
    setCustomer(customerData);
    setShowCustomerDialog(false);
    setShowSummaryPopup(true);
    setF8Step(2);
    f8FiringRef.current = false;
    playSoundSafe("keyPress");
  }, [playSoundSafe]);

  const handleSummaryProceed = useCallback(() => {
    setShowSummaryPopup(false);
    const endTime = new Date();
    setBillEndTime(endTime);
    const tempOrder = {
      serialNo:      currentBillSerial,
      billSerial:    currentBillSerial,
      customer,
      items,
      totalQty,
      totalAmount:   finalTotal,
      subtotal,
      totalDiscount: totalDiscount + billDiscountValue,
      billDiscount:  billDiscountValue,
      status:        directPaid ? "paid" : (isAutoApproved ? "approved" : "pending"),
      createdAt:     billStartTime || new Date(),
      billStartTime: billStartTime || new Date(),
      billEndTime:   endTime,
    };
    setPrintOrder(tempOrder);

    const shouldShowPrint = showInvoicePreview || (!isOnline && showOfflineInvoice);
    if (shouldShowPrint) {
      setShowPrintModal(true);
      setF8Step(3);
      f8FiringRef.current = false;
      playSoundSafe("keyPress");
    } else if (cashierModeActive || isDualRole) {
      setShowCashierPayment(true);
      setF8Step(4);
      f8FiringRef.current = false;
      playSoundSafe("keyPress");
    } else {
      setF8Step(0);
      f8FiringRef.current = false;
      playSoundSafe("keyPress");
      setTimeout(() => handleSubmitOrderInternal(), 100);
    }
  }, [
    currentBillSerial, customer, items, totalQty, finalTotal, subtotal,
    totalDiscount, billDiscountValue, billStartTime, isAutoApproved,
    showInvoicePreview, showOfflineInvoice, isOnline,
    cashierModeActive, isDualRole, playSoundSafe, handleSubmitOrderInternal,
  ]);

  const handlePrintClose = useCallback(() => {
    setShowPrintModal(false);
    setPrintOrder(null);
    if (cashierModeActive || isDualRole) {
      setShowCashierPayment(true);
      setF8Step(4);
      f8FiringRef.current = false;
      playSoundSafe("keyPress");
      return;
    }
    setF8Step(0);
    f8FiringRef.current = false;
    setTimeout(() => handleSubmitOrderInternal(), 150);
  }, [cashierModeActive, isDualRole, playSoundSafe, handleSubmitOrderInternal]);

  const handleCashierPaymentSubmit = useCallback(async () => {
    const received = Number(amountReceived || 0);
    if (paymentType === "cash" && received < finalTotal) {
      toastOnly("Amount received is less than total.", "error"); return;
    }
    const change = Math.max(0, received - finalTotal);
    setShowCashierPayment(false);
    setF8Step(0);
    f8FiringRef.current = false;
    await handleSubmitOrderInternal({
      type:     paymentType,
      received: paymentType === "cash" ? received : finalTotal,
      change:   paymentType === "cash" ? change   : 0,
    });
  }, [amountReceived, finalTotal, paymentType, handleSubmitOrderInternal, toastOnly]);

  const handleF8Key = useCallback(() => {
    if (f8Step === 1) return;
    if (f8Step === 3 && showPrintModal) return;
    if (f8FiringRef.current) return;
    f8FiringRef.current = true;
    setTimeout(() => { f8FiringRef.current = false; }, 600);
    if (items.length === 0) {
      toastOnly("Add items first.", "error"); playSoundSafe("error"); return;
    }
    switch (f8Step) {
      case 0: openCustomerDialog(); break;
      case 2: if (showSummaryPopup) handleSummaryProceed(); break;
      case 3: if (showPrintModal)   handlePrintClose();     break;
      case 4: handleCashierPaymentSubmit();                  break;
      default: openCustomerDialog();
    }
  }, [
    f8Step, items.length, showPrintModal, showSummaryPopup,
    openCustomerDialog, handleSummaryProceed, handlePrintClose,
    handleCashierPaymentSubmit, toastOnly, playSoundSafe,
  ]);

  const handleEscapeKey = useCallback(() => {
    if (showCashierPayment) {
      setShowCashierPayment(false);
      f8FiringRef.current = false;
      if (showInvoicePreview || (!isOnline && showOfflineInvoice)) {
        setShowPrintModal(true); setF8Step(3);
      } else {
        setShowSummaryPopup(true); setF8Step(2);
      }
      playSoundSafe("lock"); return;
    }
    if (f8Step === 3 && showPrintModal) {
      setShowPrintModal(false); setPrintOrder(null);
      setShowSummaryPopup(true); setF8Step(2);
      f8FiringRef.current = false; playSoundSafe("lock"); return;
    }
    if (f8Step === 2 && showSummaryPopup) {
      setShowSummaryPopup(false); setShowCustomerDialog(true); setF8Step(1);
      f8FiringRef.current = false; playSoundSafe("lock"); return;
    }
    if (f8Step === 1 && showCustomerDialog) {
      setShowCustomerDialog(false); setF8Step(0);
      f8FiringRef.current = false; playSoundSafe("lock");
      setTimeout(() => priceInputRef.current?.focus(), 60); return;
    }
    clearAllAlerts();
    setSelectedRowIndex(-1);
    priceInputRef.current?.focus();
    playSoundSafe("lock");
  }, [
    f8Step, showPrintModal, showSummaryPopup, showCustomerDialog,
    showCashierPayment, showInvoicePreview, showOfflineInvoice,
    isOnline, clearAllAlerts, playSoundSafe,
  ]);

  // ── ✅ INSERT Key ──────────────────────────────────────────────────────────
  const handleInsertKey = useCallback(async () => {
    if (screenLocked) {
      if (submittingRef.current) {
        toastOnly("Saving, please wait...", "warning"); return;
      }
      setItems([]);
      setSelectedRowIndex(-1);
      setLastItemId(null);
      setScreenLocked(false);
      setBillStartTime(new Date());
      setBillEndTime(null);
      setF8Step(0);
      setShowCustomerDialog(false);
      setShowSummaryPopup(false);
      setShowPrintModal(false);
      setPrintOrder(null);
      setShowCashierPayment(false);
      f8FiringRef.current     = false;
      submittingRef.current   = false;
      deleteLockedRef.current = false;
      autoSaveRef.current     = false;
      playSoundSafe("unlock");
      toastOnly("✅ New bill started. Enter items.", "success");
      setTimeout(() => priceInputRef.current?.focus(), 60);
      try {
        logActivity({ type: ActivityTypes.BILL_UNLOCKED, serialNo: currentBillSerial });
      } catch (_) {}
      return;
    }
    if (items.length > 0) {
      toastOnly("Clear current bill first (DEL key).", "warning"); return;
    }
    toastOnly("Bill active. Enter items.", "success");
    setTimeout(() => priceInputRef.current?.focus(), 60);
  }, [screenLocked, items.length, currentBillSerial, toastOnly, playSoundSafe]);

  // ── Minus / Delete Keys ───────────────────────────────────────────────────
  const handleMinusKey = useCallback(() => {
    if (screenLocked || items.length === 0) { playSoundSafe("error"); return; }
    if (deleteLockedRef.current) return;
    const idx  = selectedRowIndex >= 0 && selectedRowIndex < items.length
      ? selectedRowIndex : items.length - 1;
    const item = items[idx];
    if (!item) { playSoundSafe("error"); return; }
    deleteLockedRef.current = true;
    setTimeout(() => { deleteLockedRef.current = false; }, DELETE_COOLDOWN);
    saveClearedDataToFirebase([item], "minus_key_deleted").catch(() => {});
    setItems((prev) => prev.filter((_, i) => i !== idx));
    playSoundSafe("delete");
    toastOnly(`Deleted: ${item.productName}`, "warning");
    const newLen = items.length - 1;
    setSelectedRowIndex(newLen <= 0 ? -1 : Math.min(idx, newLen - 1));
    setTimeout(() => priceInputRef.current?.focus(), 50);
    try {
      logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item });
    } catch (_) {}
  }, [
    screenLocked, items, selectedRowIndex, currentBillSerial,
    playSoundSafe, saveClearedDataToFirebase, toastOnly,
  ]);

  const handleDeleteKey = useCallback(() => {
    if (screenLocked || !items.length) return;
    if (!window.confirm("Clear full bill?")) return;
    handleClearBill();
  }, [handleClearBill, screenLocked, items.length]);

  const handleEndKey   = useCallback(() => { window.open(window.location.href, "_blank"); }, []);
  const handleHomeKey  = useCallback(() => { if (!screenLocked) setTimeout(() => phoneInputRef.current?.focus(),    50); }, [screenLocked]);
  const handlePlusKey  = useCallback(() => { if (!screenLocked) setTimeout(() => qtyInputRef.current?.focus(),     50); }, [screenLocked]);
  const handleSlashKey = useCallback(() => { if (!screenLocked) setTimeout(() => discountInputRef.current?.focus(), 50); }, [screenLocked]);
  const handleArrowUp   = useCallback(() => { if (items.length) setSelectedRowIndex((p) => (p <= 0 ? items.length - 1 : p - 1)); }, [items.length]);
  const handleArrowDown = useCallback(() => { if (items.length) setSelectedRowIndex((p) => (p >= items.length - 1 ? 0 : p + 1)); }, [items.length]);
  const handlePageUp    = useCallback(() => { if (items.length) setSelectedRowIndex((p) => Math.max(0, (p < 0 ? items.length - 1 : p) - 5)); }, [items.length]);
  const handlePageDown  = useCallback(() => { if (items.length) setSelectedRowIndex((p) => Math.min(items.length - 1, (p < 0 ? 0 : p) + 5)); }, [items.length]);

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  const shortcuts = useMemo(() => ({
    Insert:         handleInsertKey,
    F8:             handleF8Key,
    F9:             openCustomerDialog,
    Escape:         handleEscapeKey,
    Home:           handleHomeKey,
    End:            handleEndKey,
    Delete:         handleDeleteKey,
    ArrowUp:        handleArrowUp,
    ArrowDown:      handleArrowDown,
    PageUp:         handlePageUp,
    PageDown:       handlePageDown,
    numpadAdd:      handlePlusKey,
    Minus:          handleMinusKey,
    numpadSubtract: handleMinusKey,
    numpadDivide:   handleSlashKey,
  }), [
    handleInsertKey, handleF8Key, openCustomerDialog, handleEscapeKey,
    handleHomeKey, handleEndKey, handleDeleteKey, handleArrowUp, handleArrowDown,
    handlePageUp, handlePageDown, handlePlusKey, handleMinusKey, handleSlashKey,
  ]);

  useKeyboardShortcuts(shortcuts, true);

  // ── Permission Toggle ─────────────────────────────────────────────────────
  const toggleBillerPermission = useCallback(async (key) => {
    const newValue = !permissions[key];
    setPermissions((p) => ({ ...p, [key]: newValue }));
    if (!isSuperAdmin || !store?.id) return;
    try {
      const updated = { ...(store.billerPermissions || {}), [key]: newValue };
      await updateStore(store.id, { billerPermissions: updated });
      setStore((prev) => ({ ...prev, billerPermissions: updated }));
      addAlert("Permission saved.", "success");
    } catch (error) {
      console.error("Toggle perm failed:", error);
      addAlert("Unable to save permission.", "error");
    }
  }, [isSuperAdmin, permissions, store, addAlert]);

  const handleAddRuntimeCity = useCallback((c) => {
    if (c && !runtimeCities.includes(c)) setRuntimeCities((p) => [...p, c]);
  }, [runtimeCities]);

  const handleAddRuntimeMarket = useCallback((m) => {
    if (m && !runtimeMarkets.includes(m)) setRuntimeMarkets((p) => [...p, m]);
  }, [runtimeMarkets]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtTime = (d) => {
    if (!d) return "--:--:--";
    const dd = d instanceof Date ? d : new Date(d);
    return isNaN(dd.getTime()) ? "--:--:--" : dd.toLocaleTimeString("en-PK", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  };

  const cardClass = `rounded-2xl ${
    isDark
      ? "border border-yellow-500/20 bg-[#15120d]/95"
      : "border border-yellow-200 bg-white"
  }`;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen" style={{ fontSize: `${billerFontSize}px` }}>

      <BillerHeader
        currentBillSerial={currentBillSerial}
        screenLocked={screenLocked}
        currentDateTime={currentDateTime}
        customer={customer}
        setCustomer={setCustomer}
        isOnline={isOnline}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenCustomerDialog={openCustomerDialog}
        offlineCount={offlineCount}
        items={items}
        billerName={userData?.name}
        showRecentOrders={showRecentOrders}
        toggleRecentOrders={() => setShowRecentOrders((v) => !v)}
        canToggleCashierMode={canToggleCashierMode}
        cashierModeActive={cashierModeActive}
        onToggleCashierMode={() => {
          setCashierModeActive((v) => {
            const next = !v;
            toastOnly(
              next ? "✅ Cashier mode ON." : "Cashier mode OFF.",
              next ? "success" : "warning"
            );
            return next;
          });
        }}
        isSuperAdmin={isSuperAdmin}
        permissions={userData?.permissions}
        onTogglePermission={toggleBillerPermission}
        directPaid={directPaid}
        onToggleDirectPaid={() => setDirectPaid(!directPaid)}
      />

      {/* ── Lock Overlay ── */}
      {screenLocked && items.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`fixed inset-0 z-50 flex items-center justify-center ${
            isDark ? "bg-black/80" : "bg-white/80"
          }`}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`rounded-3xl px-8 py-12 text-center max-w-sm w-full mx-4 ${
              isDark
                ? "bg-[#15120d] border border-yellow-500/20"
                : "bg-white border border-yellow-200"
            }`}
          >
            <Lock size={48} className="mx-auto mb-4 text-yellow-500" />
            <h2 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Bill Locked
            </h2>
            <p className={`mt-3 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Press{" "}
              <kbd className="rounded-lg bg-yellow-500/20 px-3 py-1 font-mono font-bold text-yellow-500">
                INSERT
              </kbd>{" "}
              to start
            </p>
            {currentBillSerial && (
              <p className={`mt-4 font-mono text-sm ${isDark ? "text-yellow-500/60" : "text-yellow-600/60"}`}>
                Next Bill: <strong>{currentBillSerial}</strong>
              </p>
            )}
            {(cashierModeActive || isDualRole) && (
              <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2">
                <p className="text-sm font-semibold text-green-400">
                  <CreditCard size={14} className="inline mr-1" />
                  Cashier Mode Active
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ── Offline Banner ── */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 mx-3 mt-2"
        >
          <div className="flex items-center gap-3">
            <WifiOff size={18} className="text-orange-400" />
            <div>
              <p className="font-semibold text-orange-400 text-sm">Offline Mode</p>
              <p className="text-xs text-orange-300/70">
                Orders saved locally and sync on reconnect.
              </p>
            </div>
          </div>
          {offlineCount > 0 && (
            <span className="rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-bold text-orange-400">
              {offlineCount} pending
            </span>
          )}
        </motion.div>
      )}

      {/* ── Cashier Banner ── */}
      {(cashierModeActive || isDualRole) && !screenLocked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-2 mx-3 mt-2"
        >
          <CreditCard size={16} className="text-green-400" />
          <p className="text-sm font-semibold text-green-400">
            Cashier Mode Active — Bills auto-approved &amp; saved directly
          </p>
        </motion.div>
      )}

      {/* ── Alerts ── */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <div className="space-y-1 px-3 mt-1 flex-shrink-0">
            {alerts.slice(0, 3).map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs ${
                  alert.type === "error"
                    ? isDark
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-red-200 bg-red-50 text-red-700"
                    : alert.type === "success"
                      ? isDark
                        ? "border-green-500/20 bg-green-500/10 text-green-300"
                        : "border-green-200 bg-green-50 text-green-700"
                      : isDark
                        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                        : "border-yellow-200 bg-yellow-50 text-yellow-800"
                }`}
              >
                <span>{alert.text}</span>
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="rounded p-0.5 hover:bg-black/10"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── Recent Orders ── */}
      <AnimatePresence>
        {showRecentOrders && permissions.showRecentOrders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-3 mt-1"
          >
            <div className={`rounded-2xl p-3 border ${
              isDark ? "bg-[#15120d] border-yellow-500/20" : "bg-yellow-50 border-yellow-300"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-yellow-600">RECENT ORDERS</h3>
                <button
                  onClick={() => setShowRecentOrders(false)}
                  className="text-xs text-gray-500 hover:text-yellow-600"
                >
                  Close
                </button>
              </div>
              {loadingOrders ? (
                <div className="flex justify-center py-3">
                  <Loader2 size={18} className="animate-spin text-yellow-500" />
                </div>
              ) : recentOrders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center">No recent orders</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`min-w-[180px] rounded-xl p-3 border ${
                        isDark ? "bg-white/5 border-yellow-500/20" : "bg-white border-yellow-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-yellow-600">
                          {order.serialNo || order.billSerial}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          order.status === "approved"
                            ? "bg-green-100 text-green-600"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {order.status || "pending"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {order.customer?.name || "Walking Customer"}
                      </p>
                      <p className="text-base font-bold text-yellow-600 mt-1">
                        Rs. {(order.totalAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Grid ── */}
      <div className="flex-1 grid gap-2 xl:grid-cols-[260px_1fr] min-h-0 px-3 mt-1 pb-2">

        {/* LEFT: Entry */}
        <section className={`${cardClass} p-3 flex flex-col gap-2 overflow-y-auto`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-yellow-500" />
              <h2
                className="font-bold text-yellow-600"
                style={{ fontSize: `${billerFontSize}px` }}
              >
                ENTRY
              </h2>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {(cashierModeActive || isDualRole) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                  CASHIER
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                screenLocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
              }`}>
                {screenLocked ? "LOCKED" : "ACTIVE"}
              </span>
            </div>
          </div>

          {!screenLocked && (
            <div className={`rounded-xl p-2.5 border ${
              isDark ? "bg-yellow-500/5 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"
            }`}>
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Bill Serial</p>
              <p className="text-lg font-bold text-yellow-600 font-mono">{currentBillSerial}</p>
              {billStartTime && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Started: {fmtTime(billStartTime)}
                </p>
              )}
            </div>
          )}

          {showProductName && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
                Product Name *
              </label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                disabled={screenLocked}
                placeholder="Product name..."
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                  isDark
                    ? "border-yellow-500/20 bg-[#0f0d09] text-white focus:border-yellow-500/50"
                    : "border-yellow-200 bg-white text-gray-900 focus:border-yellow-500"
                } disabled:opacity-50`}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
                Price (Rs.) *
              </label>
              <input
                ref={priceInputRef}
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v))
                    setForm((p) => ({ ...p, price: v }));
                }}
                onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                onKeyDown={(e) => {
                  const allowed = [
                    "Backspace","Delete","Tab","Escape","Enter",
                    "ArrowLeft","ArrowRight",".",
                  ];
                  if (
                    !allowed.includes(e.key) &&
                    !/^\d$/.test(e.key) &&
                    !((e.ctrlKey || e.metaKey) &&
                      ["a","c","v","x"].includes(e.key.toLowerCase()))
                  ) e.preventDefault();
                  if (e.key === "Enter") handleAddItem();
                }}
                placeholder={lastEntry.price ? `↵ ${lastEntry.price}` : "0.00"}
                disabled={screenLocked}
                style={{ fontSize: `${settings?.fonts?.priceFontSize || billerFontSize}px` }}
                className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none transition ${
                  isDark
                    ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400 placeholder:text-gray-600 focus:border-yellow-500/60"
                    : "border-yellow-300 bg-white text-yellow-700 placeholder:text-gray-400 focus:border-yellow-500"
                } disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
                Qty (Num+)
              </label>
              <input
                ref={qtyInputRef}
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                disabled={screenLocked}
                style={{ fontSize: `${settings?.fonts?.qtyFontSize || billerFontSize}px` }}
                className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none transition ${
                  isDark
                    ? "border-yellow-500/20 bg-[#0f0d09] text-white focus:border-yellow-500/50"
                    : "border-yellow-200 bg-white text-gray-900 focus:border-yellow-500"
                } disabled:opacity-50`}
              />
            </div>
          </div>

          {showDiscountField && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
                Discount / Item (Num/)
              </label>
              <div className="flex gap-2">
                <input
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                  onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                  disabled={screenLocked}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none ${
                    isDark
                      ? "border-yellow-500/20 bg-[#0f0d09] text-white focus:border-yellow-500/50"
                      : "border-yellow-200 bg-white text-gray-900 focus:border-yellow-500"
                  } disabled:opacity-50`}
                />
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      discountType: f.discountType === "fixed" ? "percent" : "fixed",
                    }))
                  }
                  disabled={screenLocked}
                  className="px-3 rounded-xl bg-yellow-100 text-yellow-700 font-bold text-sm disabled:opacity-50"
                >
                  {form.discountType === "percent" ? "%" : "Rs"}
                </button>
              </div>
            </div>
          )}

          <hr className={isDark ? "border-yellow-500/10" : "border-yellow-100"} />

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
              Customer
            </label>
            <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              isDark
                ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                : "border-yellow-200 bg-white text-gray-900"
            }`}>
              {customer.name || "Walking Customer"}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase">
              Phone (Home)
            </label>
            <input
              ref={phoneInputRef}
              type="text"
              value={customer.phone}
              onChange={(e) => setCustomer((p) => ({ ...p, phone: e.target.value }))}
              disabled={screenLocked}
              placeholder="Phone..."
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                isDark
                  ? "border-yellow-500/20 bg-[#0f0d09] text-white focus:border-yellow-500/50"
                  : "border-yellow-200 bg-white text-gray-900 focus:border-yellow-500"
              } disabled:opacity-50`}
            />
          </div>

          <button
            onClick={handleAddItem}
            disabled={screenLocked}
            className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 transition"
          >
            Add Item (Enter)
          </button>

          {lastEntry.price && (
            <p className="text-center text-[10px] text-gray-400">
              ↵ Repeat: Rs.{lastEntry.price}
              {lastEntry.discount > 0 &&
                ` − ${lastEntry.discount}${lastEntry.discountType === "percent" ? "%" : ""}`}
              {" "}×{lastEntry.qty}
            </p>
          )}
        </section>

        {/* RIGHT: Bill Table */}
        <div className="flex flex-col min-h-0 gap-1.5">
          <section className={`${cardClass} flex flex-col flex-1 overflow-hidden`}>

            {/* Table Header */}
            <div className={`flex-shrink-0 ${isDark ? "bg-[#1a1508]" : "bg-yellow-50"}`}>
              <table
                className="w-full table-fixed"
                style={{ fontSize: `${billerFontSize}px` }}
              >
                <colgroup>
                  <col style={{ width: "28px" }} />
                  {showProductName && <col />}
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "48px" }} />
                  {showDiscountField && <col style={{ width: "82px" }} />}
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "26px" }} />
                </colgroup>
                <thead>
                  <tr className={isDark ? "text-yellow-500" : "text-yellow-700"}>
                    <th className="px-1 py-1.5 text-left">#</th>
                    {showProductName && <th className="px-1 py-1.5 text-left">Product</th>}
                    <th className="px-1 py-1.5 text-left">Price</th>
                    <th className="px-1 py-1.5 text-left">Qty</th>
                    {showDiscountField && <th className="px-1 py-1.5 text-left">Disc</th>}
                    <th className="px-1 py-1.5 text-left">Total</th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
              </table>
            </div>

            {/* Table Body */}
            <div
              ref={tableContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden"
            >
              <table
                className="w-full table-fixed"
                style={{ fontSize: `${billerFontSize}px` }}
              >
                <colgroup>
                  <col style={{ width: "28px" }} />
                  {showProductName && <col />}
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "48px" }} />
                  {showDiscountField && <col style={{ width: "82px" }} />}
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "26px" }} />
                </colgroup>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center">
                          <Package size={26} className="mb-2 text-yellow-500/40" />
                          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            No items yet
                          </p>
                          <p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                            Press INSERT to unlock, then enter price + Enter
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : items.map((item, index) => {
                    const discAmt   = item.discountType === "percent"
                      ? Math.round((item.price * item.discount) / 100)
                      : item.discount;
                    const hasDisc   = discAmt > 0;
                    const lineTotal = (item.price - discAmt) * item.qty;
                    const origTotal = item.price * item.qty;
                    const isSelected = selectedRowIndex === index;
                    const isLast     = lastItemId === item.id;
                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.1 }}
                        onClick={() => setSelectedRowIndex(index)}
                        className={`cursor-pointer border-b transition-colors ${
                          isSelected
                            ? isDark
                              ? "border-yellow-500/40 bg-yellow-500/15 shadow-[inset_3px_0_0_0_#eab308]"
                              : "border-yellow-300 bg-yellow-100/60 shadow-[inset_3px_0_0_0_#eab308]"
                            : isLast
                              ? isDark
                                ? "border-yellow-500/10 bg-green-500/5"
                                : "border-yellow-100 bg-green-50/30"
                              : isDark
                                ? "border-yellow-500/10 text-white hover:bg-white/5"
                                : "border-yellow-100 text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-1 py-1">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                            isSelected
                              ? "bg-yellow-500 text-black"
                              : isDark
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        {showProductName && (
                          <td className={`px-1 py-1 truncate ${
                            isDark ? "text-gray-200" : "text-gray-800"
                          }`}>
                            {item.productName}
                          </td>
                        )}
                        <td className="px-1 py-1">
                          {hasDisc ? (
                            <div className="flex flex-col leading-tight">
                              <span className={`text-[10px] line-through ${
                                isDark ? "text-gray-500" : "text-gray-400"
                              }`}>
                                Rs.{item.price.toLocaleString()}
                              </span>
                              <span className={`font-semibold ${
                                isDark ? "text-green-400" : "text-green-600"
                              }`}>
                                Rs.{(item.price - discAmt).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className={`font-semibold ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}>
                              Rs.{item.price.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            disabled={screenLocked}
                            onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                            className={`w-11 rounded-lg border px-1 py-0.5 text-center font-semibold outline-none ${
                              isDark
                                ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50"
                                : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"
                            }`}
                          />
                        </td>
                        {showDiscountField && (
                          <td className="px-1 py-1">
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                value={item.discount}
                                onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                                disabled={screenLocked}
                                onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                                className={`w-12 rounded-lg border px-1 py-0.5 text-center font-semibold outline-none ${
                                  isDark
                                    ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50"
                                    : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"
                                }`}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemDiscountTypeChange(
                                    item.id,
                                    item.discountType === "fixed" ? "percent" : "fixed"
                                  );
                                }}
                                disabled={screenLocked}
                                className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                                  isDark
                                    ? "bg-yellow-500/10 text-yellow-400"
                                    : "bg-yellow-50 text-yellow-600"
                                }`}
                              >
                                {item.discountType === "percent" ? "%" : "Rs"}
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="px-1 py-1">
                          {hasDisc ? (
                            <div className="flex flex-col leading-tight">
                              <span className={`text-[10px] line-through ${
                                isDark ? "text-gray-500" : "text-gray-400"
                              }`}>
                                Rs.{origTotal.toLocaleString()}
                              </span>
                              <span className="font-bold text-yellow-500">
                                Rs.{lineTotal.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-yellow-500">
                              Rs.{lineTotal.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRow(item.id); }}
                            disabled={screenLocked}
                            className={`rounded-lg p-1 transition ${
                              isDark
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                                : "bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40"
                            }`}
                          >
                            <X size={9} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bill Discount */}
            {items.length > 0 && allowBillDiscount && (
              <div className={`flex-shrink-0 border-t px-3 py-1.5 ${
                isDark
                  ? "border-yellow-500/10 bg-[#12100a]"
                  : "border-yellow-100 bg-yellow-50/50"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <label className={`text-[10px] font-bold uppercase tracking-wide ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Bill Discount
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={billDiscount}
                      onChange={(e) => setBillDiscount(e.target.value)}
                      disabled={screenLocked}
                      className={`w-16 rounded-lg border px-2 py-1 text-center text-sm outline-none ${
                        isDark
                          ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50"
                          : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"
                      }`}
                    />
                    <button
                      onClick={() =>
                        setBillDiscountType((t) => t === "fixed" ? "percent" : "fixed")
                      }
                      disabled={screenLocked}
                      className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {billDiscountType === "percent" ? "%" : "Rs"}
                    </button>
                    {billDiscountValue > 0 && (
                      <span className="text-sm font-bold text-red-400 ml-1">
                        -{billDiscountValue.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Grand Total */}
            {items.length > 0 && (
              <div className={`flex-shrink-0 border-t-2 ${
                isDark
                  ? "border-yellow-500/30 bg-[#1a1508]"
                  : "border-yellow-300 bg-yellow-50"
              }`}>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className={`text-[10px] uppercase ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>Items</span>
                      <p
                        className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                        style={{ fontSize: `${billerFontSize}px` }}
                      >
                        {items.length}
                      </p>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>Qty</span>
                      <p
                        className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                        style={{ fontSize: `${billerFontSize}px` }}
                      >
                        {totalQty}
                      </p>
                    </div>
                    {totalDiscount + billDiscountValue > 0 && (
                      <div>
                        <span className={`text-[10px] uppercase ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>Disc</span>
                        <p
                          className="font-bold text-red-400"
                          style={{ fontSize: `${billerFontSize}px` }}
                        >
                          -{(totalDiscount + billDiscountValue).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {billDiscountValue > 0 && (
                      <span className={`text-[10px] line-through ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>
                        Rs. {subtotal.toLocaleString()}
                      </span>
                    )}
                    <p
                      className="font-extrabold text-yellow-500"
                      style={{ fontSize: `${totalFontSize}px` }}
                    >
                      Rs. {finalTotal.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Action Bar */}
          <section className={`${cardClass} p-2 flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {permissions.showTimestamps && billStartTime && (
                  <span className={`inline-flex items-center gap-1 ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  }`}>
                    <Clock3 size={10} />
                    {fmtTime(billStartTime)}
                    {billEndTime && <> – {fmtTime(billEndTime)}</>}
                  </span>
                )}
                {selectedRowIndex >= 0 && items.length > 0 && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                    isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-600"
                  }`}>
                    Row {selectedRowIndex + 1}/{items.length}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {permissions.allowCancelBill && (
                  <button
                    onClick={handleCancelBill}
                    disabled={items.length === 0}
                    className={`rounded-xl px-2.5 py-2 text-xs font-medium transition ${
                      isDark
                        ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                        : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                    }`}
                  >
                    <Trash2 size={12} className="inline mr-1" />Cancel
                  </button>
                )}
                <button
                  onClick={handleF8Key}
                  disabled={items.length === 0 || submitting}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isDark
                      ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-40"
                      : "border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-40"
                  }`}
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                  {submitting
                    ? "Saving..."
                    : (cashierModeActive || isDualRole) ? "F8: Checkout & Pay" : "F8: Checkout"}
                </button>
                {permissions.allowDirectSubmit && (
                  <button
                    onClick={() => handleSubmitOrderInternal()}
                    disabled={submitting || screenLocked || items.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    {submitting ? "Saving..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Keyboard Help */}
          <section className={`${cardClass} p-1.5 flex-shrink-0`}>
            <div className="flex flex-wrap gap-1">
              {[
                ["INS","Start/New"],["Enter","Add Item"],["F8","Checkout"],["ESC","Back"],
                ["END","New Tab"],["Num−","Del Row"],["DEL","Clear Bill"],["↑↓","Navigate"],
                ["Home","Phone"],["Num+","Qty"],["Num/","Discount"],
              ].map(([k, a]) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] ${
                    isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  <span className="font-mono font-bold">{k}</span>
                  <span className={isDark ? "text-gray-600" : "text-gray-400"}>{a}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ════ DIALOGS ════ */}

      <AnimatePresence>
        {showCustomerDialog && (
          <CustomerDialog
            isOpen={showCustomerDialog}
            initialCustomer={customer}
            onSubmit={handleCustomerSubmit}
            onClose={() => {
              setShowCustomerDialog(false);
              setF8Step(0);
              f8FiringRef.current = false;
              setTimeout(() => priceInputRef.current?.focus(), 60);
            }}
            runtimeCities={runtimeCities}
            runtimeMarkets={runtimeMarkets}
            onAddCity={handleAddRuntimeCity}
            onAddMarket={handleAddRuntimeMarket}
            isSuperAdmin={isSuperAdmin}
            storeId={storeId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummaryPopup && (
          <SummaryPopup
            isOpen={showSummaryPopup}
            items={items}
            totalQty={totalQty}
            totalDiscount={totalDiscount}
            subtotal={subtotal}
            billDiscount={Number(billDiscount)}
            billDiscountType={billDiscountType}
            setBillDiscount={setBillDiscount}
            setBillDiscountType={setBillDiscountType}
            grandTotal={finalTotal}
            billSerial={currentBillSerial}
            customer={customer}
            onProceed={handleSummaryProceed}
            onClose={() => {
              setShowSummaryPopup(false);
              setShowCustomerDialog(true);
              setF8Step(1);
              f8FiringRef.current = false;
            }}
          />
        )}
      </AnimatePresence>

      {showPrintModal && printOrder && (
        <InvoicePrint
          order={printOrder}
          store={storeInfo}
          onClose={handlePrintClose}
          billStartTime={billStartTime}
          billEndTime={billEndTime}
          directPrint={!showInvoicePreview}
        />
      )}

      <AnimatePresence>
        {showCashierPayment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${
                isDark
                  ? "bg-[#15120d] border border-yellow-500/20"
                  : "bg-white border border-yellow-200"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center">
                    <CreditCard size={20} className="text-green-400" />
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      Collect Payment
                    </h2>
                    <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Bill #{currentBillSerial}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCashierPayment(false);
                    f8FiringRef.current = false;
                    if (showInvoicePreview || (!isOnline && showOfflineInvoice)) {
                      setShowPrintModal(true); setF8Step(3);
                    } else {
                      setShowSummaryPopup(true); setF8Step(2);
                    }
                  }}
                  className={`rounded-xl p-2 ${
                    isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={`rounded-2xl p-4 mb-5 text-center ${
                isDark
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                <p className={`text-xs uppercase tracking-wide mb-1 ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}>
                  Total Due
                </p>
                <p className="text-4xl font-extrabold text-yellow-500">
                  Rs. {finalTotal.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 font-mono ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}>
                  {customer.name} · {items.length} item{items.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="mb-4">
                <label className={`block text-xs font-bold uppercase tracking-wide mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}>
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "card", "online"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setPaymentType(type)}
                      className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition ${
                        paymentType === type
                          ? "bg-yellow-500 text-black shadow-lg"
                          : isDark
                            ? "bg-white/5 text-gray-300 hover:bg-white/10 border border-yellow-500/20"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {paymentType === "cash" && (
                <div className="mb-4">
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-2 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}>
                    Amount Received (Rs.)
                  </label>
                  <input
                    type="number"
                    min={finalTotal}
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    placeholder={`Min: ${finalTotal}`}
                    className={`w-full rounded-xl border px-4 py-3 text-xl font-bold outline-none transition ${
                      isDark
                        ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400 focus:border-yellow-500"
                        : "border-yellow-300 bg-white text-yellow-700 focus:border-yellow-500"
                    }`}
                  />
                  {changeAmount > 0 && (
                    <div className="mt-3 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-400">Change to Return</span>
                      <span className="text-2xl font-extrabold text-green-400">
                        Rs. {changeAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {amountReceived && Number(amountReceived) < finalTotal && (
                    <p className="mt-2 text-xs text-red-400 font-medium">
                      ⚠ Short by Rs. {(finalTotal - Number(amountReceived)).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleCashierPaymentSubmit}
                disabled={
                  submitting ||
                  (paymentType === "cash" && Number(amountReceived || 0) < finalTotal)
                }
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3.5 text-base font-bold text-white hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Processing...</>
                  : <><Send size={16} /> Confirm &amp; Save Bill</>
                }
              </button>
              <p className={`mt-3 text-center text-xs ${
                isDark ? "text-gray-600" : "text-gray-400"
              }`}>
                Bill saved as{" "}
                <strong className="text-green-400">approved</strong> immediately
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;