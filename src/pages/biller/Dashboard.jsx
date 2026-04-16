// src/pages/biller/Dashboard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Clock3, Eye, EyeOff, Package, Printer, Send,
  ShoppingCart, User, Wifi, WifiOff, X, Database, Loader2, Lock, Unlock,
  Search, Calendar, Clock, CheckCircle, XCircle, Hash, Volume2, VolumeX,
  Settings, UserPlus,
} from "lucide-react";
import {
  collection, getDocs, limit, orderBy, query,
  serverTimestamp, where, addDoc,
} from "firebase/firestore";
import toast, { Toaster } from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import useKeyboardShortcuts from "../../hooks/useHotkeys";
import { db } from "../../services/firebase";
import { logActivity, createAuditLog, ActivityTypes } from "../../services/activityLogger";
import en from "../../lang/en.json";
import ur from "../../lang/ur.json";
import { saveOrder } from "../../services/orderService";
import InvoicePrint from "../../components/InvoicePrint";
import { useAuth } from "../../context/AuthContext";
import { getStoreById, updateStore } from "../../modules/stores/storeService";
import { syncOfflineOrders, getOfflineOrdersCount } from "../../services/offlineSync";
import { playSound } from "../../services/soundService";
import CustomerDialog from "../../components/CustomerDialog";
import SummaryPopup from "../../components/SummaryPopup";
import {
  getNextBillSerial,
  getNextItemSerial,
  markBillSerialUsed,
  markBillSerialCancelled,
} from "../../utils/serialNumberManager";
import { recordBillDeletion } from "../../services/deletedBillsService";

const Dashboard = () => {
  const { isDark } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const t = language === "ur" ? ur : en;
  const isOnline = useNetworkStatus();
  const { userData, isSuperAdmin } = useAuth();

  // ── REFS ──────────────────────────────────────────────────────
  const priceInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const productInputRef = useRef(null);
  const tableContainerRef = useRef(null);
  const topSearchRef = useRef(null);

  // ── Prevent serial from changing until submit ──
  const serialInitialized = useRef(false);
  const submittingRef = useRef(false);

  // ── DELETE COOLDOWN: prevent rapid-fire deletes ──
  const deleteLockedRef = useRef(false);
  const DELETE_COOLDOWN_MS = 400; // ms before another delete is allowed

  // ── UI STATE ──────────────────────────────────────────────────
  const [showRecentOrders, setShowRecentOrders] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── TOP-BAR CUSTOMER SEARCH ───────────────────────────────────
  const [topSearchQuery, setTopSearchQuery] = useState("");
  const [topSearchResults, setTopSearchResults] = useState([]);
  const [topSearching, setTopSearching] = useState(false);
  const [showTopResults, setShowTopResults] = useState(false);

  // ── BILL STATE ────────────────────────────────────────────────
  const [screenLocked, setScreenLocked] = useState(true);
  const [billStartTime, setBillStartTime] = useState(null);
  const [billEndTime, setBillEndTime] = useState(null);
  const [lastItem, setLastItem] = useState(null);
  const [currentBillSerial, setCurrentBillSerial] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [lastEntry, setLastEntry] = useState({ price: "", qty: 1, discount: 0 });

  // ── FORM & CUSTOMER ───────────────────────────────────────────
  const [form, setForm] = useState({
    productName: "", serialId: "", price: "", qty: 1, discount: 0,
  });
  const [customer, setCustomer] = useState({
    name: "Walking Customer", phone: "", city: "", market: "",
  });

  // ── F8 FLOW  (0=idle 1=customer 2=summary 3=print/submit) ────
  const [f8Step, setF8Step] = useState(0);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSummaryPopup, setShowSummaryPopup] = useState(false);

  // ── RUNTIME DROPDOWNS ─────────────────────────────────────────
  const [runtimeCities, setRuntimeCities] = useState([]);
  const [runtimeMarkets, setRuntimeMarkets] = useState([]);

  // ── BILLER PERMISSIONS ─────────────────────────────────────────
  const [permissions, setPermissions] = useState({
    showInvoicePreview: false,
    showRecentOrders: true,
    showSearchPanel: true,
    showTimestamps: true,
    allowDirectSubmit: false,
    allowCancelBill: true,
  });

  // ════════════════════════════════════════════════════════════════
  // SOUND
  // ════════════════════════════════════════════════════════════════
  const playSoundSafe = useCallback(
    (name) => { if (soundEnabled) playSound(name); },
    [soundEnabled]
  );

  // ════════════════════════════════════════════════════════════════
  // ALERTS
  // ════════════════════════════════════════════════════════════════
  const clearAlertByText = useCallback(
    (text) => setAlerts((p) => p.filter((a) => a.text !== text)), []
  );

  const addAlert = useCallback((text, type = "warning") => {
    setAlerts((prev) => {
      if (prev.some((a) => a.text === text)) return prev;
      return [...prev, { id: Date.now() + Math.random(), text, type }];
    });
    try {
      if (type === "success") {
        toast.success(text, { duration: 4000 });
        setTimeout(() => clearAlertByText(text), 5000);
      } else if (type === "error") {
        toast.error(text, { duration: 5000 });
      } else {
        toast(text, { duration: 4000, icon: "⚠️" });
      }
    } catch (_) {}
  }, [clearAlertByText]);

  const toastOnly = useCallback((text, type = "warning") => {
    try {
      if (type === "success") toast.success(text, { duration: 3000 });
      else if (type === "error") toast.error(text, { duration: 4000 });
      else toast(text, { duration: 3000, icon: "⚠️" });
    } catch (_) {}
  }, []);

  const removeAlert = useCallback((id) => setAlerts((p) => p.filter((a) => a.id !== id)), []);
  const clearAllAlerts = useCallback(() => setAlerts([]), []);

  // ════════════════════════════════════════════════════════════════
  // FIREBASE CLEARED-DATA HELPERS
  // ════════════════════════════════════════════════════════════════
  const saveClearedDataToFirebase = useCallback(async (clearedItems, reason = "manual_clear") => {
    if (!clearedItems.length || !isOnline) return;
    try {
      await addDoc(collection(db, "clearedData"), {
        serialNo: currentBillSerial,
        items: clearedItems,
        totalAmount: clearedItems.reduce((s, i) => s + (i.price * i.qty - i.discount * i.qty), 0),
        totalDiscount: clearedItems.reduce((s, i) => s + i.discount * i.qty, 0),
        totalQty: clearedItems.reduce((s, i) => s + i.qty, 0),
        reason,
        customer: { ...customer },
        billerName: userData?.name || "Unknown",
        billerId: userData?.uid || null,
        storeId: userData?.storeId || null,
        billStartTime: billStartTime ? billStartTime.toISOString() : null,
        clearedAt: serverTimestamp(),
        clearedAtLocal: new Date().toISOString(),
      });
    } catch (e) { console.error("saveClearedData:", e); }
  }, [currentBillSerial, customer, userData, billStartTime, isOnline]);

  const saveClearedBillToFirebase = useCallback(async (billItems, reason = "bill_cancelled") => {
    if (!billItems.length || !isOnline) return;
    try {
      await addDoc(collection(db, "clearedBills"), {
        serialNo: currentBillSerial,
        items: billItems,
        totalAmount: billItems.reduce((s, i) => s + (i.price * i.qty - i.discount * i.qty), 0),
        totalDiscount: billItems.reduce((s, i) => s + i.discount * i.qty, 0),
        totalQty: billItems.reduce((s, i) => s + i.qty, 0),
        reason,
        customer: { ...customer },
        billerName: userData?.name || "Unknown",
        billerId: userData?.uid || null,
        storeId: userData?.storeId || null,
        billStartTime: billStartTime ? billStartTime.toISOString() : null,
        billEndTime: new Date().toISOString(),
        datetime: new Date().toISOString(),
        clearedAt: serverTimestamp(),
      });
    } catch (e) { console.error("saveClearedBill:", e); }
  }, [currentBillSerial, customer, userData, billStartTime, isOnline]);

  // ════════════════════════════════════════════════════════════════
  // GENERATE NEXT BILL SERIAL
  // ════════════════════════════════════════════════════════════════
  const generateNextSerial = useCallback(async (forceIncrement = false) => {
    return getNextBillSerial(
      userData?.storeId || "default",
      isOnline ? db : null,
      forceIncrement
    );
  }, [userData?.storeId, isOnline]);

  // ════════════════════════════════════════════════════════════════
  // EFFECTS
  // ════════════════════════════════════════════════════════════════

  // Focus price on mount
  useEffect(() => {
    priceInputRef.current?.focus();
    const t = setTimeout(() => setShowRecentOrders(false), 7000);
    return () => clearTimeout(t);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load data when online
  useEffect(() => {
    if (isOnline) { loadRecentOrders(); loadStore(); }
    else setLoadingOrders(false);
  }, [userData?.storeId, isOnline]); // eslint-disable-line

  // Generate bill serial ONLY ONCE on mount — NO increment
  useEffect(() => {
    if (!serialInitialized.current) {
      serialInitialized.current = true;
      generateNextSerial(false).then((serial) => {
        setCurrentBillSerial(serial);
      });
    }
  }, []); // eslint-disable-line

  // Sync offline when back online
  useEffect(() => { if (isOnline) syncOfflineData(); }, [isOnline]); // eslint-disable-line

  // Offline count poller
  useEffect(() => {
    const check = async () => setOfflineCount(await getOfflineOrdersCount());
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll table
  useEffect(() => {
    if (selectedRowIndex >= 0 && tableContainerRef.current) {
      const rows = tableContainerRef.current.querySelectorAll("tbody tr");
      rows[selectedRowIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedRowIndex]);

  // Focus price when bill unlocked
  useEffect(() => {
    if (!screenLocked) setTimeout(() => priceInputRef.current?.focus(), 60);
  }, [screenLocked]);

  // Load permissions from store
  useEffect(() => {
    if (store?.billerPermissions)
      setPermissions((p) => ({ ...p, ...store.billerPermissions }));
  }, [store]);

  const toggleBillerPermission = useCallback(async (key) => {
    const newValue = !permissions[key];
    setPermissions((p) => ({ ...p, [key]: newValue }));

    if (!isSuperAdmin || !store?.id) return;
    try {
      const updatedPermissions = {
        ...(store.billerPermissions || {}),
        [key]: newValue,
      };
      await updateStore(store.id, { billerPermissions: updatedPermissions });
      setStore((prev) => ({
        ...prev,
        billerPermissions: updatedPermissions,
      }));
      addAlert("Settings saved.", "success");
    } catch (error) {
      console.error("Toggle biller permission failed:", error);
      addAlert("Unable to save setting.", "error");
    }
  }, [isSuperAdmin, permissions, store, addAlert]);

  // ════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ════════════════════════════════════════════════════════════════
  const loadRecentOrders = async () => {
    if (!isOnline) { setLoadingOrders(false); return; }
    setLoadingOrders(true);
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5))
      );
      setRecentOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("loadRecentOrders:", e); }
    finally { setLoadingOrders(false); }
  };

  const loadStore = async () => {
    if (!userData?.storeId || !isOnline) return;
    try {
      const s = await getStoreById(userData.storeId);
      if (s) setStore(s);
    } catch (e) { console.error("loadStore:", e); }
  };

  const syncOfflineData = async () => {
    if (!isOnline) return;
    try {
      const count = await getOfflineOrdersCount();
      if (!count) return;
      addAlert(`Syncing ${count} offline order(s)…`, "warning");
      const result = await syncOfflineOrders();
      if (result.success && result.synced > 0) {
        playSoundSafe("syncComplete");
        addAlert(`Synced ${result.synced} orders!`, "success");
        setOfflineCount(0);
        loadRecentOrders();
      } else if (result.failed > 0) {
        addAlert(`Failed to sync ${result.failed} orders`, "error");
      }
    } catch (e) { console.error("syncOfflineData:", e); }
  };

  // ════════════════════════════════════════════════════════════════
  // TOP-BAR CUSTOMER SEARCH
  // ════════════════════════════════════════════════════════════════
  const handleTopCustomerSearch = useCallback(async (q) => {
    setTopSearchQuery(q);
    if (!q || q.length < 2) { setTopSearchResults([]); setShowTopResults(false); return; }
    if (!isOnline) return;

    setTopSearching(true);
    setShowTopResults(true);
    try {
      const results = [];

      if (/\d{3,}/.test(q)) {
        const snap = await getDocs(
          query(
            collection(db, "orders"),
            where("customer.phone", ">=", q),
            where("customer.phone", "<=", q + "\uf8ff"),
            limit(6)
          )
        );
        snap.docs.forEach((d) => {
          const c = d.data().customer;
          if (c?.phone && !results.find((r) => r.phone === c.phone)) {
            results.push({ id: d.id, name: c.name, phone: c.phone, city: c.city || "", market: c.market || "" });
          }
        });
      }

      const nameSnap = await getDocs(
        query(
          collection(db, "customers"),
          where("nameLower", ">=", q.toLowerCase()),
          where("nameLower", "<=", q.toLowerCase() + "\uf8ff"),
          limit(6)
        )
      );
      nameSnap.docs.forEach((d) => {
        const c = d.data();
        if (!results.find((r) => r.phone === c.phone)) {
          results.push({ id: d.id, name: c.name, phone: c.phone || "", city: c.city || "", market: c.market || "" });
        }
      });

      setTopSearchResults(results.slice(0, 8));
    } catch (e) { console.error("topSearch:", e); }
    finally { setTopSearching(false); }
  }, [isOnline]);

  const selectTopCustomer = useCallback((c) => {
    setCustomer({ name: c.name || "Walking Customer", phone: c.phone || "", city: c.city || "", market: c.market || "" });
    setTopSearchQuery("");
    setTopSearchResults([]);
    setShowTopResults(false);
    toastOnly(`Customer: ${c.name}`, "success");
  }, [toastOnly]);

  // ════════════════════════════════════════════════════════════════
  // COMPUTED TOTALS
  // ════════════════════════════════════════════════════════════════
  const totalQty = useMemo(() => items.reduce((s, i) => s + Number(i.qty || 0), 0), [items]);
  const totalDiscount = useMemo(() => items.reduce((s, i) => s + Number(i.discount || 0) * Number(i.qty || 0), 0), [items]);
  const grandTotal = useMemo(() => items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.qty || 0) - Number(i.discount || 0) * Number(i.qty || 0)), 0), [items]);

  // ════════════════════════════════════════════════════════════════
  // DUPLICATE SERIAL CHECK
  // ════════════════════════════════════════════════════════════════
  const checkDuplicateSerial = useCallback(async (serialId) => {
    if (items.some((i) => i.serialId === serialId)) return true;
    if (isOnline) {
      try {
        const snap = await getDocs(
          query(collection(db, "itemSerials"), where("serialId", "==", serialId), limit(1))
        );
        if (!snap.empty) return true;
      } catch (_) {}
    }
    return false;
  }, [items, isOnline]);

  const recordItemSerial = useCallback(async (serialId, billSerial) => {
    if (!isOnline) return;
    try {
      await addDoc(collection(db, "itemSerials"), {
        serialId,
        billSerial,
        storeId: userData?.storeId || null,
        createdAt: serverTimestamp(),
      });
    } catch (_) {}
  }, [isOnline, userData?.storeId]);

  // ════════════════════════════════════════════════════════════════
  // PRICE INPUT HANDLER
  // ════════════════════════════════════════════════════════════════
  const handlePriceChange = useCallback((e) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setForm((prev) => ({ ...prev, price: val }));
    }
  }, []);

  const handlePriceKeyDown = useCallback((e) => {
    const allowed = [
      "Backspace", "Delete", "Tab", "Escape", "Enter",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "Home", "End", ".", "Period",
    ];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
    if (/^\d$/.test(e.key)) return;
    e.preventDefault();
  }, []);

  // ════════════════════════════════════════════════════════════════
  // ITEM FUNCTIONS
  // ════════════════════════════════════════════════════════════════
  const handleAddItem = useCallback(async () => {
    if (screenLocked) {
      addAlert("Bill is locked. Press INSERT.", "error");
      playSoundSafe("error");
      return;
    }

    const price = form.price !== "" ? Number(form.price) : Number(lastEntry.price) || 0;
    const qty = form.qty !== "" ? Number(form.qty) : Number(lastEntry.qty) || 1;
    const discount = form.discount !== "" ? Number(form.discount) : Number(lastEntry.discount) || 0;
    let productName = form.productName.trim();

    if (isSuperAdmin && !productName) { addAlert("Product name required.", "error"); playSoundSafe("error"); return; }
    if (!Number.isFinite(price) || price <= 0) { addAlert("Valid price required.", "error"); playSoundSafe("error"); return; }
    if (!Number.isFinite(qty) || qty < 1) { addAlert("Valid qty required.", "error"); playSoundSafe("error"); return; }
    if (!Number.isFinite(discount) || discount < 0) { addAlert("Valid discount.", "error"); playSoundSafe("error"); return; }

    const serialId = form.serialId.trim() || (await getNextItemSerial());
    if (!isSuperAdmin) productName = `Item - ${serialId}`;

    const isDuplicate = await checkDuplicateSerial(serialId);
    if (isDuplicate) {
      addAlert(`Duplicate serial: ${serialId}`, "error");
      playSoundSafe("error");
      return;
    }

    const newItem = { id: Date.now(), serialId, productName, price, qty, discount };
    setItems((prev) => [...prev, newItem]);
    setLastEntry({ price: String(price), qty, discount });
    setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
    setLastItem(newItem.id);
    setSelectedRowIndex(-1);
    playSoundSafe("keyPress");

    recordItemSerial(serialId, currentBillSerial);

    setTimeout(() => priceInputRef.current?.focus(), 50);

    try { logActivity({ type: ActivityTypes.ITEM_ADDED, serialNo: currentBillSerial, item: newItem }); } catch (_) {}
  }, [
    form, screenLocked, lastEntry, isSuperAdmin, currentBillSerial,
    checkDuplicateSerial, recordItemSerial, addAlert, playSoundSafe,
  ]);

  const handleDeleteRow = useCallback((id) => {
    if (screenLocked) { playSoundSafe("error"); return; }
    const item = items.find((i) => i.id === id);
    if (item) saveClearedDataToFirebase([item], "row_deleted");
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedRowIndex(-1);
    playSoundSafe("delete");
    toastOnly(`Deleted: ${item?.productName || "item"}`, "warning");
    setTimeout(() => priceInputRef.current?.focus(), 50);
    try { logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item }); } catch (_) {}
  }, [screenLocked, items, currentBillSerial, playSoundSafe, saveClearedDataToFirebase, toastOnly]);

  const handleQtyChange = useCallback((id, value) => {
    if (screenLocked) return;
    setItems((p) => p.map((i) => i.id === id ? { ...i, qty: Math.max(1, Number(value) || 1) } : i));
  }, [screenLocked]);

  const handleDiscountChange = useCallback((id, value) => {
    if (screenLocked) return;
    setItems((p) => p.map((i) => i.id === id ? { ...i, discount: Math.max(0, Number(value) || 0) } : i));
  }, [screenLocked]);

  // ════════════════════════════════════════════════════════════════
  // BILL ACTIONS
  // ════════════════════════════════════════════════════════════════
  const handleClearBill = useCallback(() => {
    if (screenLocked) { playSoundSafe("error"); return; }
    if (items.length > 0) saveClearedDataToFirebase(items, "bill_cleared");
    setItems([]); setSelectedRowIndex(-1); setLastItem(null);
    playSoundSafe("delete");
    toastOnly("Bill cleared.", "success");
    setTimeout(() => priceInputRef.current?.focus(), 50);
  }, [screenLocked, items, playSoundSafe, saveClearedDataToFirebase, toastOnly]);

  const handleCancelBill = useCallback(() => {
    if (items.length === 0) { toastOnly("No bill to cancel.", "warning"); return; }
    if (!window.confirm("Cancel this bill?")) return;

    const oldSerial = currentBillSerial;
    saveClearedBillToFirebase(items, "bill_cancelled");
    recordBillDeletion(oldSerial, userData?.storeId, isOnline);

    markBillSerialCancelled(oldSerial, userData?.storeId || "default");

    setScreenLocked(true);
    setItems([]);
    setCustomer({ name: "Walking Customer", phone: "", city: "", market: "" });
    setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
    setSelectedRowIndex(-1);
    setBillStartTime(null); setBillEndTime(null);
    setLastItem(null); setF8Step(0);
    setShowCustomerDialog(false); setShowSummaryPopup(false);

    // DO NOT change serial on cancel — same serial reused
    playSoundSafe("delete");
    toastOnly("Bill cancelled.", "success");
    try { logActivity({ type: ActivityTypes.ORDER_CANCELLED, serialNo: oldSerial }); } catch (_) {}
  }, [
    items, currentBillSerial, userData?.storeId, isOnline,
    playSoundSafe, saveClearedBillToFirebase, toastOnly,
  ]);

  const handleAddRuntimeCity = useCallback((c) => { if (c && !runtimeCities.includes(c)) setRuntimeCities((p) => [...p, c]); }, [runtimeCities]);
  const handleAddRuntimeMarket = useCallback((m) => { if (m && !runtimeMarkets.includes(m)) setRuntimeMarkets((p) => [...p, m]); }, [runtimeMarkets]);

  // ════════════════════════════════════════════════════════════════
  // ORDER SUBMIT
  // ════════════════════════════════════════════════════════════════
  const validateOrder = useCallback(() => {
    const errors = [];
    if (!items.length) errors.push("Add at least one product.");
    if (!customer.name.trim()) errors.push("Customer name required.");
    items.forEach((item, i) => {
      if (!item.serialId.trim()) errors.push(`Item ${i + 1}: Serial ID missing.`);
      if (item.price <= 0) errors.push(`Item ${i + 1}: Invalid price.`);
      if (item.qty < 1) errors.push(`Item ${i + 1}: Invalid qty.`);
    });
    const serials = items.map((i) => i.serialId);
    const dupes = serials.filter((s, i) => serials.indexOf(s) !== i);
    if (dupes.length) errors.push(`Duplicate serials: ${[...new Set(dupes)].join(", ")}`);
    return errors;
  }, [items, customer.name]);

  const handleSubmitOrderInternal = useCallback(async () => {
    if (submitting || submittingRef.current) return;
    submittingRef.current = true;

    const errors = validateOrder();
    if (errors.length) {
      errors.forEach((e) => addAlert(e, "error"));
      playSoundSafe("error");
      submittingRef.current = false;
      return;
    }

    setSubmitting(true);
    try {
      const serialNo = currentBillSerial;
      const endTime = new Date();

      const preparedItems = items.map((item) => ({
        serialId: item.serialId || "",
        productName: item.productName || "",
        price: Number(item.price || 0),
        qty: Number(item.qty || 0),
        discount: Number(item.discount || 0),
        total: Number(item.price || 0) * Number(item.qty || 0)
          - Number(item.discount || 0) * Number(item.qty || 0),
      }));

      const orderData = {
        serialNo,
        billSerial: currentBillSerial,
        customer: {
          name: customer.name?.trim() || "Walking Customer",
          phone: customer.phone?.trim() || "",
          city: customer.city || "",
          market: customer.market || "",
        },
        items: preparedItems,
        totalQty,
        totalAmount: grandTotal,
        totalDiscount,
        paymentType: null,
        status: "pending",
        cashierHandover: true,
        billerSubmittedAt: new Date().toISOString(),
        billerName: userData?.name || "Unknown",
        storeId: userData?.storeId || null,
        billStartTime: billStartTime ? billStartTime.toISOString() : new Date().toISOString(),
        billEndTime: endTime.toISOString(),
        ...(isOnline
          ? { createdAt: serverTimestamp() }
          : { createdAt: new Date().toISOString() }),
      };

      const result = await saveOrder(orderData, isOnline);

      if (result.duplicate) {
        addAlert(`Order ${serialNo} already exists. Skipping duplicate.`, "warning");
        playSoundSafe("error");
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      await markBillSerialUsed(serialNo, userData?.storeId || "default");

      if (result.offline) {
        playSoundSafe("offline");
        addAlert(`Order ${serialNo} saved OFFLINE.`, "warning");
        setOfflineCount(await getOfflineOrdersCount());
      } else {
        playSoundSafe("billSaved");
        try { await createAuditLog({ ...orderData, id: result.id }, "ORDER_SUBMITTED", userData?.uid); } catch (_) {}
      }

      try {
        await logActivity({
          type: ActivityTypes.ORDER_SUBMITTED,
          orderId: result.id, serialNo,
          totalAmount: grandTotal, itemsCount: items.length,
        });
      } catch (_) {}

      if (isOnline && !result.offline) {
        setRecentOrders((p) =>
          [{ id: result.id, ...orderData, createdAt: new Date() }, ...p].slice(0, 5)
        );
        setTimeout(loadRecentOrders, 500);
      }

      // ── RESET AFTER SUCCESSFUL SUBMIT ──
      setScreenLocked(true);
      setBillEndTime(endTime);
      clearAllAlerts();
      addAlert(`Order ${serialNo} submitted! Press INSERT for new bill.`, "success");
      setItems([]);
      setCustomer({ name: "Walking Customer", phone: "", city: "", market: "" });
      setForm({ productName: "", serialId: "", price: "", qty: 1, discount: 0 });
      setSelectedRowIndex(-1);
      setBillStartTime(null);
      setLastItem(null);
      setF8Step(0);
      setShowPrintModal(false);
      setPrintOrder(null);
      setShowSummaryPopup(false);
      setShowCustomerDialog(false);

      // ONLY NOW generate next serial (forceIncrement=true)
      const newSerial = await generateNextSerial(true);
      setCurrentBillSerial(newSerial);

    } catch (e) {
      console.error("submit:", e);
      addAlert("Submit failed.", "error");
      playSoundSafe("error");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [
    submitting, validateOrder, currentBillSerial, billStartTime,
    customer, items, totalQty, grandTotal, totalDiscount,
    userData, isOnline, addAlert, playSoundSafe, clearAllAlerts, generateNextSerial,
  ]);

  // ════════════════════════════════════════════════════════════════
  // F8 FLOW
  // ════════════════════════════════════════════════════════════════
  const openCustomerDialog = useCallback(() => {
    setShowCustomerDialog(true); setF8Step(1); playSoundSafe("keyPress");
  }, [playSoundSafe]);

  const handleCustomerSubmit = useCallback((customerData) => {
    setCustomer(customerData);
    setShowCustomerDialog(false);
    setShowSummaryPopup(true);
    setF8Step(2);
    playSoundSafe("keyPress");
  }, [playSoundSafe]);

  const handleSummaryProceed = useCallback(() => {
    setShowSummaryPopup(false);
    const endTime = new Date();
    setBillEndTime(endTime);

    const tempOrder = {
      serialNo: currentBillSerial,
      billSerial: currentBillSerial,
      customer, items,
      totalQty, totalAmount: grandTotal, totalDiscount,
      status: "pending",
      createdAt: billStartTime || new Date(),
      billStartTime: billStartTime || new Date(),
      billEndTime: endTime,
    };

    setF8Step(3);
    setPrintOrder(tempOrder);
    setShowPrintModal(true);
    playSoundSafe("keyPress");
  }, [
    currentBillSerial, customer, items, totalQty, grandTotal, totalDiscount,
    billStartTime, playSoundSafe,
  ]);

  const handlePrintClose = useCallback(async () => {
    setShowPrintModal(false); setPrintOrder(null); setF8Step(0);
    await handleSubmitOrderInternal();
  }, [handleSubmitOrderInternal]);

  const handleF8Key = useCallback(() => {
    if (items.length === 0) { toastOnly("Add items first.", "error"); playSoundSafe("error"); return; }

    if (f8Step === 0) {
      if (screenLocked) { toastOnly("Unlock bill first (INSERT).", "error"); playSoundSafe("error"); return; }
      openCustomerDialog();
    } else if (f8Step === 1) {
      // CustomerDialog handles F8 internally
    } else if (f8Step === 2) {
      handleSummaryProceed();
    } else if (f8Step === 3) {
      handlePrintClose();
    }
  }, [
    f8Step, items.length, screenLocked,
    openCustomerDialog, handleSummaryProceed, handlePrintClose,
    toastOnly, playSoundSafe,
  ]);

  // ════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLERS
  // ════════════════════════════════════════════════════════════════

  const handleEscapeKey = useCallback(() => {
    // F8 Step 3: Print Modal → go back to Summary
    if (f8Step === 3 && showPrintModal) {
      setShowPrintModal(false);
      setPrintOrder(null);
      setShowSummaryPopup(true);
      setF8Step(2);
      playSoundSafe("lock");
      return;
    }
    // F8 Step 2: Summary → go back to Customer Dialog (data preserved)
    if (f8Step === 2 && showSummaryPopup) {
      setShowSummaryPopup(false);
      setShowCustomerDialog(true);
      setF8Step(1);
      playSoundSafe("lock");
      return;
    }
    // F8 Step 1: Customer Dialog → close, back to billing
    if (f8Step === 1 && showCustomerDialog) {
      setShowCustomerDialog(false);
      setF8Step(0);
      playSoundSafe("lock");
      setTimeout(() => priceInputRef.current?.focus(), 60);
      return;
    }
    // Other panels
    if (showSearchPanel) { setShowSearchPanel(false); playSoundSafe("lock"); return; }
    if (showSettings) { setShowSettings(false); playSoundSafe("lock"); return; }

    clearAllAlerts();
    setSelectedRowIndex(-1);
    priceInputRef.current?.focus();
    playSoundSafe("lock");
  }, [
    f8Step, showPrintModal, showSummaryPopup, showCustomerDialog,
    showSearchPanel, showSettings, clearAllAlerts, playSoundSafe,
  ]);

  const handleInsertKey = useCallback(() => {
    // INSERT should NOT change serial — just lock/unlock
    if (screenLocked) {
      setScreenLocked(false);
      setBillStartTime(new Date());
      setBillEndTime(null);
      playSoundSafe("unlock");
      toastOnly("Bill unlocked.", "success");
      setTimeout(() => priceInputRef.current?.focus(), 60);
      try { logActivity({ type: ActivityTypes.BILL_UNLOCKED, serialNo: currentBillSerial }); } catch (_) {}
    } else {
      setScreenLocked(true);
      setBillEndTime(new Date());
      playSoundSafe("lock");
      toastOnly("Bill locked.", "success");
      try { logActivity({ type: ActivityTypes.BILL_LOCKED, serialNo: currentBillSerial, itemsCount: items.length }); } catch (_) {}
    }
  }, [screenLocked, currentBillSerial, items.length, toastOnly, playSoundSafe]);

  // ── MINUS KEY: DELETE entire selected row — ONE TIME per press ──
  const handleMinusKey = useCallback(() => {
    if (screenLocked) { playSoundSafe("error"); return; }
    if (items.length === 0) { playSoundSafe("error"); return; }

    // ── Cooldown guard: prevent multiple deletes from rapid presses ──
    if (deleteLockedRef.current) {
      return; // silently ignore — already deleted one row
    }

    const idx = (selectedRowIndex >= 0 && selectedRowIndex < items.length)
      ? selectedRowIndex
      : items.length - 1;

    const item = items[idx];
    if (!item) { playSoundSafe("error"); return; }

    // ── Lock delete for cooldown period ──
    deleteLockedRef.current = true;
    setTimeout(() => { deleteLockedRef.current = false; }, DELETE_COOLDOWN_MS);

    // Save cleared data for audit
    saveClearedDataToFirebase([item], "minus_key_deleted");

    // Remove the row
    setItems((prev) => prev.filter((_, i) => i !== idx));
    playSoundSafe("delete");
    toastOnly(`Deleted: ${item.productName}`, "warning");

    // Adjust selection
    const newLen = items.length - 1;
    if (newLen <= 0) {
      setSelectedRowIndex(-1);
    } else {
      setSelectedRowIndex(Math.min(idx, newLen - 1));
    }

    // Return focus to price
    setTimeout(() => priceInputRef.current?.focus(), 50);

    try { logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item }); } catch (_) {}
  }, [screenLocked, items, selectedRowIndex, currentBillSerial, playSoundSafe, saveClearedDataToFirebase, toastOnly]);

  // ── DELETE KEY: Also delete entire row — ONE TIME per press ──
  const handleDeleteKey = useCallback(() => {
    if (screenLocked) { playSoundSafe("error"); return; }
    if (items.length === 0) { return; }

    // ── Cooldown guard: same as minus key ──
    if (deleteLockedRef.current) {
      return;
    }

    const idx = (selectedRowIndex >= 0 && selectedRowIndex < items.length)
      ? selectedRowIndex : items.length - 1;
    const item = items[idx];

    // ── Lock delete for cooldown period ──
    deleteLockedRef.current = true;
    setTimeout(() => { deleteLockedRef.current = false; }, DELETE_COOLDOWN_MS);

    saveClearedDataToFirebase([item], "delete_key_deleted");
    setItems((p) => p.filter((_, i) => i !== idx));
    playSoundSafe("delete");
    toastOnly(`Deleted: ${item.productName}`, "warning");

    const newLen = items.length - 1;
    if (newLen <= 0) {
      setSelectedRowIndex(-1);
    } else {
      setSelectedRowIndex(Math.min(idx, newLen - 1));
    }

    setTimeout(() => priceInputRef.current?.focus(), 50);

    try { logActivity({ type: ActivityTypes.ITEM_DELETED, serialNo: currentBillSerial, item }); } catch (_) {}
  }, [screenLocked, items, selectedRowIndex, currentBillSerial, playSoundSafe, saveClearedDataToFirebase, toastOnly]);

  const handleHomeKey = useCallback(() => { if (!screenLocked) { setTimeout(() => phoneInputRef.current?.focus(), 50); playSoundSafe("keyPress"); } }, [screenLocked, playSoundSafe]);
  const handlePlusKey = useCallback(() => { if (!screenLocked) { setTimeout(() => qtyInputRef.current?.focus(), 50); playSoundSafe("keyPress"); } }, [screenLocked, playSoundSafe]);
  const handleSlashKey = useCallback(() => { if (!screenLocked) { setTimeout(() => discountInputRef.current?.focus(), 50); playSoundSafe("keyPress"); } }, [screenLocked, playSoundSafe]);

  const handleArrowUp = useCallback(() => { if (items.length) setSelectedRowIndex((p) => p <= 0 ? items.length - 1 : p - 1); }, [items.length]);
  const handleArrowDown = useCallback(() => { if (items.length) setSelectedRowIndex((p) => p >= items.length - 1 ? 0 : p + 1); }, [items.length]);
  const handlePageUp = useCallback(() => { if (items.length) setSelectedRowIndex((p) => Math.max(0, (p < 0 ? items.length - 1 : p) - 5)); }, [items.length]);
  const handlePageDown = useCallback(() => { if (items.length) setSelectedRowIndex((p) => Math.min(items.length - 1, (p < 0 ? 0 : p) + 5)); }, [items.length]);

  // ════════════════════════════════════════════════════════════════
  // SHORTCUTS MAP
  // ════════════════════════════════════════════════════════════════
  const shortcuts = useMemo(() => ({
    Insert: handleInsertKey,
    F8: handleF8Key,
    Escape: handleEscapeKey,
    Home: handleHomeKey,
    Delete: handleDeleteKey,
    ArrowUp: handleArrowUp,
    ArrowDown: handleArrowDown,
    PageUp: handlePageUp,
    PageDown: handlePageDown,
    numpadAdd: handlePlusKey,
    Minus: handleMinusKey,
    numpadSubtract: handleMinusKey,
    numpadMultiply: handleClearBill,
    numpadDivide: handleSlashKey,
  }), [
    handleInsertKey, handleF8Key, handleEscapeKey, handleHomeKey,
    handleDeleteKey, handleArrowUp, handleArrowDown, handlePageUp, handlePageDown,
    handlePlusKey, handleMinusKey, handleClearBill, handleSlashKey,
  ]);

  useKeyboardShortcuts(shortcuts, true);

  // ════════════════════════════════════════════════════════════════
  // STYLES
  // ════════════════════════════════════════════════════════════════
  const inputClass = [
    "w-full rounded-xl border px-3 py-3 outline-none transition text-sm",
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500",
    screenLocked ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

  const priceInputClass = [
    inputClass,
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  ].join(" ");

  const cardClass = [
    "rounded-2xl",
    isDark ? "border border-yellow-500/20 bg-[#15120d]/95" : "border border-yellow-200 bg-white",
  ].join(" ");

  const fmt = {
    date: (d) => d.toLocaleDateString("en-PK", { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    time: (d) => d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }),
    short: (d) => {
      if (!d) return "--:--:--";
      const dd = d instanceof Date ? d : new Date(d);
      if (isNaN(dd.getTime())) return "--:--:--";
      return dd.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    },
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <Toaster
        position="top-right"
        toastOptions={{
          className: "!rounded-xl !text-sm",
          style: {
            background: isDark ? "#1a1714" : "#fff",
            color: isDark ? "#fff" : "#111",
            border: isDark ? "1px solid rgba(234,179,8,0.2)" : "1px solid #fef3c7",
          },
        }}
      />

      {/* ── LOCK OVERLAY ─────────────────────────────────────────── */}
      {screenLocked && items.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? "bg-black/80" : "bg-white/80"}`}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`rounded-3xl px-8 py-12 text-center max-w-sm ${isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"}`}
          >
            <Lock size={48} className="mx-auto mb-4 text-yellow-500" />
            <h2 className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Bill Locked</h2>
            <p className={`mt-3 text-lg ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Press{" "}
              <kbd className="rounded-lg bg-yellow-500/20 px-3 py-1 font-mono font-bold text-yellow-500">INSERT</kbd>
              {" "}to start
            </p>
            {currentBillSerial && (
              <p className={`mt-4 font-mono text-sm ${isDark ? "text-yellow-500/60" : "text-yellow-600/60"}`}>
                Next: {currentBillSerial}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ── OFFLINE BANNER ───────────────────────────────────────── */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="text-orange-400" />
            <div>
              <p className="font-semibold text-orange-400">{t.billerDashboard?.offlineMode || "Offline Mode"}</p>
              <p className="text-sm text-orange-300/70">{t.billerDashboard?.offlineInfo || "Orders saved locally and sync on reconnect."}</p>
            </div>
          </div>
          {offlineCount > 0 && (
            <span className="rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-bold text-orange-400">
              {offlineCount} {t.billerDashboard?.offlinePending?.replace("{{count}}", offlineCount) || "pending"}
            </span>
          )}
        </motion.div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {t.billerDashboard?.title || "Biller Dashboard"}
            </h1>
            {screenLocked
              ? <span className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1 text-sm font-medium text-red-400"><Lock size={14} />{t.billerDashboard?.locked || "Locked"}</span>
              : <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400"><Unlock size={14} />{t.billerDashboard?.active || "Active"}</span>}
            {offlineCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/20 px-3 py-1 text-sm font-medium text-orange-400">
                <Database size={14} />{offlineCount} offline
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className={`inline-flex items-center gap-2 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
              <Calendar size={14} />{fmt.date(currentDateTime)}
            </span>
            <span className={`inline-flex items-center gap-2 ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
              <Clock size={14} />{fmt.time(currentDateTime)}
            </span>
            <span className={`inline-flex items-center gap-2 font-mono text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              <Hash size={14} />{currentBillSerial}
            </span>
            {permissions.showTimestamps && billStartTime && (
              <span className={`inline-flex items-center gap-2 font-mono text-xs ${isDark ? "text-green-400" : "text-green-600"}`}>
                <Clock3 size={14} />Start: {fmt.short(billStartTime)}
              </span>
            )}
            {permissions.showTimestamps && billEndTime && (
              <span className={`inline-flex items-center gap-2 font-mono text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                <Clock3 size={14} />End: {fmt.short(billEndTime)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? "border-yellow-500/20 bg-[#0f0d09]" : "border-yellow-200 bg-white"}`}>
                <Search size={14} className="shrink-0 text-gray-500" />
                <input
                  ref={topSearchRef}
                  type="text"
                  value={topSearchQuery}
                  onChange={(e) => handleTopCustomerSearch(e.target.value)}
                  onFocus={() => topSearchResults.length && setShowTopResults(true)}
                  onBlur={() => setTimeout(() => setShowTopResults(false), 200)}
                  placeholder={t.billerDashboard?.searchCustomer || "Search customer…"}
                  className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-400"}`}
                />
                {topSearching && <Loader2 size={13} className="shrink-0 animate-spin text-yellow-500" />}
              </div>

              <AnimatePresence>
                {showTopResults && topSearchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border shadow-lg ${isDark ? "border-yellow-500/20 bg-[#15120d]" : "border-yellow-200 bg-white"}`}
                  >
                    {topSearchResults.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={() => selectTopCustomer(c)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between border-b last:border-0 transition ${isDark ? "border-yellow-500/10 hover:bg-yellow-500/10 text-white" : "border-yellow-100 hover:bg-yellow-50 text-gray-900"}`}
                      >
                        <div>
                          <span className="font-medium">{c.name}</span>
                          {c.phone && <span className={`ml-2 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{c.phone}</span>}
                        </div>
                        {c.city && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                            {c.city}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={openCustomerDialog}
              disabled={screenLocked}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition whitespace-nowrap ${isDark
                ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-40"
                : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-40"
              }`}
              title="Add / Select Customer (F8)"
            >
              <UserPlus size={14} />
              {t.billerDashboard?.addCustomer || "Add Customer"}
            </button>
            <button
              onClick={toggleLanguage}
              className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-medium transition ${isDark
                ? "border-yellow-500/20 bg-white/5 text-yellow-300 hover:bg-white/10"
                : "border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"
              }`}
              title={t.common?.language || "Language"}
            >
              {language === "en" ? "EN" : "اردو"}
            </button>
          </div>

          {customer.name !== "Walking Customer" && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${isDark ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-green-50 border border-green-200 text-green-700"}`}>
              <User size={12} />
              <span className="font-medium">{customer.name}</span>
              {customer.phone && <span className="opacity-70">({customer.phone})</span>}
              <button
                onClick={() => setCustomer({ name: "Walking Customer", phone: "", city: "", market: "" })}
                className="ml-1 rounded p-0.5 hover:bg-black/10"
                title="Clear customer"
              >
                <X size={10} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${isOnline ? isDark ? "border border-green-500/20 bg-green-500/10 text-green-400" : "border border-green-200 bg-green-50 text-green-700" : isDark ? "border border-red-500/20 bg-red-500/10 text-red-400" : "border border-red-200 bg-red-50 text-red-700"}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}{isOnline ? "Online" : "Offline"}
            </div>

            <button
              onClick={() => setSoundEnabled((p) => !p)}
              className={`rounded-xl p-2 transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400" : "border border-yellow-200 bg-white text-yellow-700"}`}
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <button
              onClick={() => setShowSettings((p) => !p)}
              className={`rounded-xl p-2 transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400" : "border border-yellow-200 bg-white text-yellow-700"}`}
              title="Settings"
            >
              <Settings size={14} />
            </button>

            {permissions.showRecentOrders && (
              <button
                onClick={() => setShowRecentOrders((p) => !p)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${isDark ? "border border-yellow-500/20 bg-[#15120d] text-yellow-400" : "border border-yellow-200 bg-white text-yellow-700"}`}
              >
                {showRecentOrders ? <EyeOff size={14} /> : <Eye size={14} />}
                {showRecentOrders ? "Hide" : "Orders"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SETTINGS PANEL ───────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.section
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`${cardClass} overflow-hidden p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-yellow-500" />
                <h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                  Biller Settings
                </h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-1 hover:bg-black/10">
                <X size={14} className={isDark ? "text-gray-400" : "text-gray-600"} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "showInvoicePreview", label: "Invoice Preview", desc: "Control whether invoice print dialog opens during F8 checkout", adminOnly: true },
                { key: "showRecentOrders", label: "Recent Orders", desc: "Show recent orders section" },
                { key: "showSearchPanel", label: "Search Panel", desc: "Show order search panel" },
                { key: "showTimestamps", label: "Timestamps", desc: "Show bill start / end times" },
                { key: "allowDirectSubmit", label: "Direct Submit", desc: "Show bypass button (skip F8 flow)", adminOnly: true },
                { key: "allowCancelBill", label: "Cancel Bill", desc: "Allow biller to cancel current bill" },
              ].map(({ key, label, desc, adminOnly }) => (
                <div key={key} className={`rounded-xl border p-3 ${isDark ? "border-yellow-500/10 bg-black/20" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{label}</p>
                      <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>{desc}</p>
                    </div>
                    {adminOnly && !isSuperAdmin ? (
                      <div className="flex items-center gap-1">
                        <Lock size={12} className="text-gray-500" />
                        <span className={`text-[9px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>Admin only</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleBillerPermission(key)}
                        className={`relative h-5 w-9 rounded-full transition ${permissions[key] ? "bg-yellow-500" : isDark ? "bg-gray-700" : "bg-gray-300"}`}
                      >
                        <span
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                          style={{ left: permissions[key] ? "18px" : "2px" }}
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!isSuperAdmin && (
              <p className={`mt-3 text-[10px] flex items-center gap-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                <Lock size={10} /> Settings marked "Admin only" can only be changed by Super Admin
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── ALERTS ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                  alert.type === "error"
                    ? isDark ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"
                    : alert.type === "success"
                    ? isDark ? "border-green-500/20 bg-green-500/10 text-green-300" : "border-green-200 bg-green-50 text-green-700"
                    : isDark ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300" : "border-yellow-200 bg-yellow-50 text-yellow-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  {alert.type === "error" ? <XCircle size={16} className="mt-0.5 shrink-0" />
                    : alert.type === "success" ? <CheckCircle size={16} className="mt-0.5 shrink-0" />
                    : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                  <p className="text-sm">{alert.text}</p>
                </div>
                <button onClick={() => removeAlert(alert.id)} className="rounded-lg p-1 hover:bg-black/10">
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── RECENT ORDERS ────────────────────────────────────────── */}
      <AnimatePresence>
        {showRecentOrders && permissions.showRecentOrders && (
          <motion.section
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`${cardClass} overflow-hidden p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-yellow-500" />
                <h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                  Recent Orders
                </h2>
              </div>
              <button onClick={loadRecentOrders} className={`text-xs px-3 py-1 rounded-lg transition ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}>
                Refresh
              </button>
            </div>

            {!isOnline ? (
              <div className={`flex flex-col items-center py-8 text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <WifiOff size={28} className="mb-2 text-orange-500" /><p className="text-sm">Offline</p>
              </div>
            ) : loadingOrders ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`h-24 animate-pulse rounded-xl ${isDark ? "bg-white/5" : "bg-gray-100"}`} />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {recentOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-3 ${isDark ? "border-yellow-500/20 bg-black/30" : "border-yellow-200 bg-yellow-50/40"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-yellow-500">{order.serialNo || order.id}</p>
                        <p className={`mt-1 text-xs ${isDark ? "text-white" : "text-gray-900"}`}>
                          {order.customer?.name || "—"}
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] capitalize ${order.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {order.status || "pending"}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-bold text-yellow-500">
                      Rs. {Number(order.totalAmount || 0).toLocaleString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className={`flex flex-col items-center py-8 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                <Database size={28} className="mb-2 text-yellow-500" />
                <p className="text-sm">No recent orders</p>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── MAIN GRID ────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">

        {/* LEFT: ENTRY PANEL */}
        <section className={`${cardClass} p-4 self-start sticky top-4`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-yellow-500" />
              <h2 className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-yellow-400" : "text-yellow-700"}`}>Entry</h2>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${screenLocked ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
              {screenLocked ? <Lock size={12} /> : <Unlock size={12} />}
              {screenLocked ? "LOCKED" : "ACTIVE"}
            </span>
          </div>

          {!screenLocked && currentBillSerial && (
            <div className="mb-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Bill Serial</p>
              <p className="mt-1 text-xl font-bold text-yellow-500">{currentBillSerial}</p>
              {billStartTime && (
                <p className={`mt-1 text-[10px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  Started: {fmt.short(billStartTime)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {isSuperAdmin && (
              <div>
                <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Product Name</label>
                <input
                  ref={productInputRef}
                  type="text"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  placeholder="Product name…"
                  className={inputClass}
                  disabled={screenLocked}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Price (Rs.) *
                </label>
                <input
                  ref={priceInputRef}
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={handlePriceChange}
                  onKeyDown={(e) => {
                    handlePriceKeyDown(e);
                    if (e.key === "Enter") handleAddItem();
                  }}
                  placeholder={lastEntry.price || "0.00"}
                  className={priceInputClass}
                  disabled={screenLocked}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  Qty <span className="text-yellow-500">(Num+)</span>
                </label>
                <input
                  ref={qtyInputRef}
                  type="number" min="1"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  className={inputClass}
                  disabled={screenLocked}
                />
              </div>
            </div>

            <div>
              <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Discount / item <span className="text-yellow-500">(Num/)</span>
              </label>
              <input
                ref={discountInputRef}
                type="number" min="0"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                placeholder="0"
                className={inputClass}
                disabled={screenLocked}
              />
            </div>

            <div className={`my-2 h-px ${isDark ? "bg-yellow-500/10" : "bg-yellow-200"}`} />

            <div>
              <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>Customer</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className={`${inputClass} pl-9`}
                  disabled={screenLocked}
                />
              </div>
            </div>

            <div>
              <label className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Phone <span className="text-yellow-500">(HOME)</span>
              </label>
              <input
                ref={phoneInputRef}
                type="text"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="Phone…"
                className={inputClass}
                disabled={screenLocked}
              />
            </div>

            <button
              onClick={handleAddItem}
              disabled={screenLocked}
              className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2.5 font-semibold text-black text-sm transition hover:from-yellow-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Item (Enter)
            </button>

            {lastEntry.price && (
              <p className={`text-center text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Blank = repeat: Rs.{lastEntry.price} × {lastEntry.qty}
                {lastEntry.discount > 0 ? ` − ${lastEntry.discount}` : ""}
              </p>
            )}
          </div>
        </section>

        {/* RIGHT: BILL TABLE */}
        <div className="flex flex-col">
          <section
            className={`${cardClass} flex flex-col overflow-hidden`}
            style={{ maxHeight: "calc(100vh - 380px)", minHeight: "300px" }}
          >
            <div className={`flex-shrink-0 ${isDark ? "bg-[#1a1508]" : "bg-yellow-50"}`}>
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "120px" }} />
                  {isSuperAdmin && <col style={{ width: "130px" }} />}
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "66px" }} />
                  <col style={{ width: "76px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "40px" }} />
                </colgroup>
                <thead>
                  <tr className={isDark ? "text-yellow-500" : "text-yellow-700"}>
                    <th className="px-2 py-3 text-left">#</th>
                    <th className="px-2 py-3 text-left">Serial</th>
                    {isSuperAdmin && <th className="px-2 py-3 text-left">Product</th>}
                    <th className="px-2 py-3 text-left">Price</th>
                    <th className="px-2 py-3 text-left">Qty</th>
                    <th className="px-2 py-3 text-left">Disc</th>
                    <th className="px-2 py-3 text-left">Total</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
              </table>
            </div>

            <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "120px" }} />
                  {isSuperAdmin && <col style={{ width: "130px" }} />}
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "66px" }} />
                  <col style={{ width: "76px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "40px" }} />
                </colgroup>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 8 : 7} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <Package size={36} className="mb-3 text-yellow-500/40" />
                          <p className={`font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>No items yet</p>
                          <p className={`mt-1 text-[11px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                            Enter price → press Enter
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : items.map((item, index) => {
                    const hasDiscount = Number(item.discount) > 0;
                    const lineTotal = item.price * item.qty - item.discount * item.qty;
                    const originalTotal = item.price * item.qty;
                    const isSelected = selectedRowIndex === index;
                    const isLast = lastItem === item.id;

                    return (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.12 }}
                        onClick={() => setSelectedRowIndex(index)}
                        className={`cursor-pointer border-b transition-all duration-150 ${
                          isSelected
                            ? isDark
                              ? "border-yellow-500/40 bg-yellow-500/15 shadow-[inset_4px_0_0_0_#eab308]"
                              : "border-yellow-300 bg-yellow-100/60 shadow-[inset_4px_0_0_0_#eab308]"
                            : isLast
                            ? isDark ? "border-yellow-500/10 bg-green-500/5" : "border-yellow-100 bg-green-50/30"
                            : isDark ? "border-yellow-500/10 text-white hover:bg-white/5" : "border-yellow-100 text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${isSelected ? "bg-yellow-500 text-black" : isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>
                            {index + 1}
                          </span>
                        </td>

                        <td className="px-2 py-2.5 font-mono text-[10px] text-yellow-500 truncate">
                          {item.serialId}
                        </td>

                        {isSuperAdmin && (
                          <td className={`px-2 py-2.5 text-[11px] font-medium truncate ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                            {item.productName}
                          </td>
                        )}

                        <td className="px-2 py-2.5">
                          {hasDiscount ? (
                            <div className="flex flex-col leading-tight">
                              <span className={`text-[9px] line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                Rs.{item.price.toLocaleString()}
                              </span>
                              <span className={`text-[11px] font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}>
                                Rs.{(item.price - item.discount).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className={`text-[11px] ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                              Rs.{item.price.toLocaleString()}
                            </span>
                          )}
                        </td>

                        <td className="px-2 py-2.5">
                          <input
                            type="number" min="1"
                            value={item.qty}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            disabled={screenLocked}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-12 rounded-lg border px-1.5 py-1 text-[11px] text-center outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50" : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"}`}
                          />
                        </td>

                        <td className="px-2 py-2.5">
                          <input
                            type="number" min="0"
                            value={item.discount}
                            onChange={(e) => handleDiscountChange(item.id, e.target.value)}
                            disabled={screenLocked}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-14 rounded-lg border px-1.5 py-1 text-[11px] text-center outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white disabled:opacity-50" : "border-yellow-200 bg-white text-gray-900 disabled:opacity-50"}`}
                          />
                        </td>

                        <td className="px-2 py-2.5">
                          {hasDiscount ? (
                            <div className="flex flex-col leading-tight">
                              <span className={`text-[9px] line-through ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                Rs.{originalTotal.toLocaleString()}
                              </span>
                              <span className="text-[11px] font-bold text-yellow-500">
                                Rs.{lineTotal.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-yellow-500">
                              Rs.{lineTotal.toLocaleString()}
                            </span>
                          )}
                        </td>

                        <td className="px-2 py-2.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRow(item.id); }}
                            disabled={screenLocked}
                            className={`rounded-lg p-1.5 transition ${isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40" : "bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-40"}`}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {items.length > 0 && (
              <div className={`flex-shrink-0 border-t-2 ${isDark ? "border-yellow-500/30 bg-[#1a1508]" : "border-yellow-300 bg-yellow-50"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-5">
                    <div>
                      <span className={`text-[9px] uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-500"}`}>Items</span>
                      <p className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{items.length}</p>
                    </div>
                    <div>
                      <span className={`text-[9px] uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-500"}`}>Qty</span>
                      <p className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{totalQty}</p>
                    </div>
                    {totalDiscount > 0 && (
                      <div>
                        <span className={`text-[9px] uppercase tracking-wide ${isDark ? "text-gray-500" : "text-gray-500"}`}>Disc</span>
                        <p className="text-base font-bold text-red-400">−{totalDiscount.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] uppercase tracking-wide ${isDark ? "text-yellow-500" : "text-yellow-700"}`}>Grand Total</span>
                    <p className="text-2xl font-extrabold text-yellow-500">Rs. {grandTotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={`${cardClass} mt-4 p-4`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs">
                {permissions.showTimestamps && billStartTime && (
                  <span className={`inline-flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    <Clock3 size={11} />⏱ {fmt.short(billStartTime)}
                    {billEndTime && <> → {fmt.short(billEndTime)}</>}
                  </span>
                )}
                {selectedRowIndex >= 0 && items.length > 0 && (
                  <span className={`rounded-lg px-2 py-1 ${isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-600"}`}>
                    Row {selectedRowIndex + 1} of {items.length}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {permissions.allowCancelBill && (
                  <button
                    onClick={handleCancelBill}
                    disabled={items.length === 0}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${isDark ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40" : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"}`}
                  >
                    Cancel Bill
                  </button>
                )}

                <button
                  onClick={handleF8Key}
                  disabled={items.length === 0}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${isDark ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-40" : "border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-40"}`}
                >
                  <Printer size={16} />F8: Checkout
                </button>

                {permissions.allowDirectSubmit && (
                  <button
                    onClick={handleSubmitOrderInternal}
                    disabled={submitting || screenLocked || items.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:from-yellow-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? "Saving…" : "Direct Submit"}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className={`${cardClass} mt-4 p-3`}>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["INS", "Start/Lock"],
                ["↵", "Add"],
                ["F8×1", "Customer"],
                ["F8×2", "Summary"],
                ["F8×3", "Print"],
                ["ESC", "Back"],
                ["HOME", "Phone"],
                ["Num+", "Qty"],
                ["Num/", "Disc"],
                ["Num−", "Del Row (1x)"],
                ["DEL", "Del Row (1x)"],
                ["Num×", "Clear All"],
                ["↑↓", "Nav"],
                ["PgUp/Dn", "Jump×5"],
              ].map(([k, a]) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}
                >
                  <span className="font-mono font-bold">{k}</span>
                  <span className={isDark ? "text-gray-600" : "text-gray-400"}>{a}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── F8 DIALOGS ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showCustomerDialog && (
          <CustomerDialog
            isOpen={showCustomerDialog}
            initialCustomer={customer}
            onSubmit={handleCustomerSubmit}
            onClose={() => { setShowCustomerDialog(false); setF8Step(0); }}
            runtimeCities={runtimeCities}
            runtimeMarkets={runtimeMarkets}
            onAddCity={handleAddRuntimeCity}
            onAddMarket={handleAddRuntimeMarket}
            isSuperAdmin={isSuperAdmin}
            storeId={userData?.storeId}
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
            grandTotal={grandTotal}
            billSerial={currentBillSerial}
            customer={customer}
            onProceed={handleSummaryProceed}
            onClose={() => { setShowSummaryPopup(false); setShowCustomerDialog(true); setF8Step(1); }}
          />
        )}
      </AnimatePresence>

      {showPrintModal && printOrder && (
        <InvoicePrint
          order={printOrder}
          store={store || { name: "AONE JEWELRY", address: "Store Address", phone: "Phone" }}
          onClose={handlePrintClose}
          billStartTime={billStartTime}
          billEndTime={billEndTime}
        />
      )}
    </div>
  );
};

export default Dashboard;