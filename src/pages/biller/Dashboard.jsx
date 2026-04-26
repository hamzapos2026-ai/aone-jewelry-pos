// src/modules/biller/BillerDashboard.jsx
// ✅ FINAL PRODUCTION FIX
// ✅ No reset on offline/online toggle
// ✅ Serial continues from Firebase (no OFF-DEFAU format)
// ✅ Customer auto-serial only when no name given
// ✅ Save ONCE, print is display only

import {
  useEffect, useMemo, useRef, useState, useCallback, memo,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock3, Package, Printer, Send, ShoppingCart,
  WifiOff, X, Loader2, Lock, Trash2, CreditCard, Search, User,
} from "lucide-react";
import {
  collection, addDoc, serverTimestamp,
  where, doc, setDoc, getDocs, query, limit, orderBy,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { useTheme }           from "../../context/ThemeContext";
import { useLanguage }        from "../../hooks/useLanguage";
import useNetworkStatus       from "../../hooks/useNetworkStatus";
import useKeyboardShortcuts   from "../../hooks/useHotkeys";
import { db }                 from "../../services/firebase";
import { createAuditLog }     from "../../services/activityLogger";
import { saveOrder }          from "../../services/orderService";
import { useAuth }            from "../../context/AuthContext";
import { useSettings }        from "../../context/SettingsContext";
import { getStoreById, updateStore } from "../../modules/stores/storeService";
import { syncOfflineOrders, getOfflineOrdersCount } from "../../services/offlineSync";
import { playSound }          from "../../services/soundService";
import BillerHeader           from "./BillerHeader";
import CustomerDialog         from "../../components/CustomerDialog";
import SummaryPopup           from "../../components/SummaryPopup";
import InvoicePrint           from "../../components/InvoicePrint";
import { recordBillDeletion } from "../../services/deletedBillsService";
import { getNextItemSerial }  from "../../services/serialService";

// ═══════════════════════════════════════════════════════════════════════
// MODULE-LEVEL CONSTANTS — Never reset on re-render
// ═══════════════════════════════════════════════════════════════════════

const normalizePhone = (input = "") => {
  if (!input) return "";
  let p = String(input).trim().replace(/[\s\-()]/g, "");
  if      (p.startsWith("+92"))                    p = "0" + p.slice(3);
  else if (p.startsWith("0092"))                   p = "0" + p.slice(4);
  else if (p.startsWith("92") && p.length === 12)  p = "0" + p.slice(2);
  if      (p.length === 10 && p.startsWith("3"))   p = "0" + p;
  return p;
};

// ✅ Bill save guard — module level, NOT state
let _saveDone = false;
let _lastF8   = 0;

// ═══════════════════════════════════════════════════════════════════════
// ✅ SERIAL MANAGER — Module level, survives re-renders & network changes
// ═══════════════════════════════════════════════════════════════════════
const SerialManager = {
  lastNum:     0,        // Last used serial number
  initialized: false,
  storeId:     null,
  initializing: false,

  // ✅ One-time init from Firebase — reads actual last serial
  async init(storeId) {
    const sid = storeId || "default";

    // Already initialized for this store
    if (this.initialized && this.storeId === sid) return;

    // Prevent concurrent inits
    if (this.initializing) return;
    this.initializing = true;

    try {
      // Check localStorage first (fast, works offline)
      const localNum = parseInt(
        localStorage.getItem(`serial_last_${sid}`) || "0", 10,
      );

      // Try Firebase for authoritative last serial
      try {
        const snap = await getDocs(
          query(
            collection(db, "orders"),
            where("storeId", "==", sid),
            orderBy("createdAt", "desc"),
            limit(10),
          ),
        );

        let maxNum = localNum;
        snap.docs.forEach((d) => {
          const sn = d.data().serialNo || d.data().billSerial || "";
          // Parse just the number part — handles "0025", "25", etc.
          const num = parseInt(String(sn).replace(/\D/g, ""), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });

        this.lastNum = maxNum;
      } catch {
        // Firebase failed — use localStorage
        this.lastNum = localNum;
      }

      this.initialized = true;
      this.storeId     = sid;

    } finally {
      this.initializing = false;
    }
  },

  // ✅ Get preview of next serial (does NOT advance counter)
  preview() {
    return String(this.lastNum + 1).padStart(4, "0");
  },

  // ✅ Consume next serial (call when bill is being saved)
  consume() {
    // Don't advance here — advance AFTER successful save
    return String(this.lastNum + 1).padStart(4, "0");
  },

  // ✅ Confirm serial was used (call after successful save)
  confirm(serialStr, storeId) {
    const num = parseInt(String(serialStr).replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > this.lastNum) {
      this.lastNum = num;
      const sid = storeId || this.storeId || "default";
      // Persist to localStorage for offline continuity
      localStorage.setItem(`serial_last_${sid}`, String(num));
    }
  },

  // ✅ Reset for new store/user
  reset() {
    this.initialized  = false;
    this.initializing = false;
    this.storeId      = null;
    // Keep lastNum — don't reset to 0
  },
};

// ═══════════════════════════════════════════════════════════════════════
// ✅ CUSTOMER SERIAL MANAGER — Auto-numbers walk-in customers
// ═══════════════════════════════════════════════════════════════════════
const CustomerSerial = {
  lastNum:     0,
  initialized: false,
  storeId:     null,

  async init(storeId) {
    const sid = storeId || "default";
    if (this.initialized && this.storeId === sid) return;

    try {
      const localNum = parseInt(
        localStorage.getItem(`cust_serial_${sid}`) || "0", 10,
      );

      try {
        const snap = await getDocs(
          query(
            collection(db, "customers"),
            where("storeId", "==", sid),
            where("isAutoSerial", "==", true),
            orderBy("serialNum", "desc"),
            limit(1),
          ),
        );
        const fbNum = snap.empty
          ? 0
          : (snap.docs[0].data().serialNum || 0);

        this.lastNum = Math.max(localNum, fbNum);
      } catch {
        this.lastNum = localNum;
      }
    } catch {
      this.lastNum = 0;
    }

    this.initialized = true;
    this.storeId     = sid;
  },

  next(storeId) {
    this.lastNum++;
    const sid = storeId || this.storeId || "default";
    localStorage.setItem(`cust_serial_${sid}`, String(this.lastNum));
    return `Customer ${String(this.lastNum).padStart(3, "0")}`;
  },

  reset() {
    this.initialized = false;
    this.storeId     = null;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// CUSTOMER CACHE — In-memory, survives re-renders
// ═══════════════════════════════════════════════════════════════════════
const _cc = {
  data:    [],
  loaded:  false,
  storeId: null,
  loading: false,
};

const _loadCC = async (storeId) => {
  const sid = storeId || "default";
  if ((_cc.loaded && _cc.storeId === sid) || _cc.loading) return;
  _cc.loading = true;
  try {
    const snap = await getDocs(
      query(collection(db, "customers"), where("storeId", "==", sid), limit(500)),
    );
    const seen = new Map();
    snap.docs.forEach((d) => {
      const c = d.data(), key = c.phone || c.name;
      if (key) seen.set(key, {
        name: c.name || "", phone: c.phone || "",
        city: c.city || "", market: c.market || "",
      });
    });
    _cc.data    = [...seen.values()];
    _cc.loaded  = true;
    _cc.storeId = sid;
  } catch {} finally { _cc.loading = false; }
};

const _enrichCC = async (storeId, billerId) => {
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), where("billerId", "==", billerId), limit(100)),
    );
    snap.docs.forEach((d) => {
      const c = d.data().customer || {}, key = c.phone || c.name;
      if (key && !_cc.data.find((x) => (x.phone || x.name) === key)) {
        _cc.data.push({
          name: c.name || "", phone: c.phone || "",
          city: c.city || "", market: c.market || "",
        });
      }
    });
  } catch {}
};

const _searchCC = (term) => {
  if (!term || term.length < 2) return [];
  const lower  = term.toLowerCase();
  const digits = term.replace(/\D/g, "");
  const out    = [];
  for (const c of _cc.data) {
    const n = c.name?.toLowerCase().includes(lower);
    const p = digits.length >= 3 && c.phone?.replace(/\D/g, "").includes(digits);
    if (n || p) { out.push(c); if (out.length >= 10) break; }
  }
  return out;
};

const _pushCC = (c) => {
  const key = c.phone || c.name;
  if (key && !_cc.data.find((x) => (x.phone || x.name) === key)) {
    _cc.data.unshift({
      name: c.name || "", phone: c.phone || "",
      city: c.city || "", market: c.market || "",
    });
  }
};

// ✅ Save customer — phone-based dedup, supports name update later
const _saveCustomerBg = async (storeId, billerId, data, isAutoSerial = false) => {
  const phone = normalizePhone(data.phone || "");
  const name  = (data.name || "").trim();
  if (!name) return;

  const sid = storeId || "default";

  // ✅ Doc ID strategy:
  // - Has phone → use phone as key (allows name update later)
  // - No phone, auto-serial → use serial name
  // - No phone, real name → use name
  let docId;
  if (phone) {
    docId = `${sid}_phone_${phone}`;
  } else if (isAutoSerial) {
    docId = `${sid}_auto_${name.replace(/\s+/g, "_").toLowerCase()}`;
  } else {
    docId = `${sid}_name_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
  }

  const serialNum = isAutoSerial
    ? parseInt(name.replace(/\D/g, ""), 10) || 0
    : 0;

  try {
    await setDoc(doc(db, "customers", docId), {
      name,
      nameLower:    name.toLowerCase(),
      phone,
      phoneNormalized: phone,
      city:         data.city    || "",
      market:       data.market  || "",
      storeId:      sid,
      billerId,
      isAutoSerial,
      serialNum,
      isWalking:    false, // No "Walking Customer" anymore
      updatedAt:    serverTimestamp(),
      createdAt:    serverTimestamp(),
    }, { merge: true });
  } catch {}

  _pushCC(data);
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { isDark }                   = useTheme();
  useLanguage();
  const isOnline                     = useNetworkStatus();
  const { userData, isSuperAdmin }   = useAuth();
  const { settings }                 = useSettings();

  // ── Refs ──────────────────────────────────────────────────────────
  const priceInputRef    = useRef(null);
  const qtyInputRef      = useRef(null);
  const phoneInputRef    = useRef(null);
  const discountInputRef = useRef(null);
  const tableContainerRef= useRef(null);
  const nameInputRef     = useRef(null);
  const searchTimerRef   = useRef(null);

  // ✅ These refs survive network changes — no state resets
  const serialInitRef    = useRef(false);
  const submittingRef    = useRef(false);
  const deleteLockRef    = useRef(false);
  const f8LockRef        = useRef(false);
  const minusUsedRef     = useRef(false);
  const activeBillRef    = useRef(false);  // ✅ TRUE when bill is in progress
  const wasOnlineRef     = useRef(isOnline);
  const lastEntryRef     = useRef({ price: "", qty: 1, discount: 0, discountType: "fixed" });

  // ── Settings ──────────────────────────────────────────────────────
  const showProductName    = isSuperAdmin && settings?.billerUI?.showProductName === true;
  const showDiscountField  = settings?.billerUI?.showDiscountField === true;
  const allowBillDiscount  = settings?.discount?.allowBillDiscount === true;
  const billerFontSize     = settings?.fonts?.billerFontSize  || 16;
  const totalFontSize      = settings?.fonts?.totalFontSize   || 28;
  const invoiceFontSize    = settings?.fonts?.invoiceFontSize || 14;
  const storeId            = userData?.storeId || "default";
  const billerId           = userData?.uid;
  const showOfflineInvoice = settings?.billFlow?.showOfflineInvoice !== false;

  const userRoles  = userData?.roles || (userData?.role ? [userData.role] : []);
  const isDualRole = (
    (userRoles.includes("biller")   || userData?.role === "biller") &&
    (userRoles.includes("cashier")  || userData?.role === "cashier")
  );
  const isAutoApproved = isDualRole || settings?.autoApproval?.autoApproval === true;

  // ── State ─────────────────────────────────────────────────────────
  const [submitting,        setSubmitting]        = useState(false);
  const [soundEnabled,      setSoundEnabled]      = useState(true);
  const [offlineCount,      setOfflineCount]      = useState(0);
  const [store,             setStore]             = useState(null);
  const [currentDateTime,   setCurrentDateTime]   = useState(() => new Date());
  const [cashierModeActive, setCashierModeActive] = useState(false);
  const [directPaid,        setDirectPaid]        = useState(false);
  const [runtimeCities,     setRuntimeCities]     = useState([]);
  const [runtimeMarkets,    setRuntimeMarkets]    = useState([]);
  const [viewingOrder,      setViewingOrder]      = useState(null);
  const [recentOrders,      setRecentOrders]      = useState([]);
  const [loadingOrders,     setLoadingOrders]     = useState(false);
  const [showRecentOrders,  setShowRecentOrders]  = useState(false);
  const [permissions,       setPermissions]       = useState({
    showTimestamps: true, allowCancelBill: true, allowCashierMode: false,
  });
  const [screenLocked,      setScreenLocked]      = useState(true);
  const [billStartTime,     setBillStartTime]     = useState(null);
  const [billEndTime,       setBillEndTime]       = useState(null);

  // ✅ Serial display — never reset by network change
  const [currentBillSerial, setCurrentBillSerial] = useState("----");

  const [items,             setItems]             = useState([]);
  const [selectedRowIndex,  setSelectedRowIndex]  = useState(-1);
  const [lastItemId,        setLastItemId]        = useState(null);
  const [billDiscount,      setBillDiscount]      = useState(0);
  const [billDiscountType,  setBillDiscountType]  = useState("fixed");
  const [form, setForm] = useState({
    productName: "", serialId: "", price: "", qty: 1,
    discount: 0, discountType: "fixed",
  });
  const [customer, setCustomer] = useState({
    name: "Walking Customer", phone: "", city: "Karachi", market: "",
  });
  const [custNameSearch,  setCustNameSearch]  = useState("");
  const [custPhoneSearch, setCustPhoneSearch] = useState("");
  const [custSuggestions, setCustSuggestions] = useState([]);
  const [showSug,         setShowSug]         = useState(false);
  const [sugLoading,      setSugLoading]      = useState(false);
  const [activeField,     setActiveField]     = useState("");
  const [f8Step,          setF8Step]          = useState(0);
  const [showCustomerDialog,  setShowCustomerDialog]  = useState(false);
  const [showSummaryPopup,    setShowSummaryPopup]    = useState(false);
  const [showCashierPayment,  setShowCashierPayment]  = useState(false);
  const [paymentType,         setPaymentType]         = useState("cash");
  const [amountReceived,      setAmountReceived]      = useState("");
  const [showPrintModal,      setShowPrintModal]      = useState(false);
  const [printOrder,          setPrintOrder]          = useState(null);

  const canToggleCashierMode = isSuperAdmin || isDualRole || permissions.allowCashierMode;

  // ── Derived ────────────────────────────────────────────────────────
  const storeInfo = useMemo(() => ({
    name:    settings?.store?.name    || store?.name    || "STORE",
    tagline: settings?.store?.tagline || store?.tagline || "",
    address: settings?.store?.address || store?.address || "",
    phone:   settings?.store?.phone   || store?.phone   || "",
    ntn:     settings?.store?.ntn     || store?.ntn     || "",
  }), [settings?.store, store]);

  const totalQty = useMemo(
    () => items.reduce((s, i) => s + Number(i.qty || 0), 0), [items],
  );
  const totalDiscount = useMemo(
    () => items.reduce((s, i) => {
      const u = Number(i.price || 0), q = Number(i.qty || 0), d = Number(i.discount || 0);
      return s + (i.discountType === "percent" ? Math.round(u * q * d / 100) : d * q);
    }, 0), [items],
  );
  const subtotal = useMemo(
    () => items.reduce((s, i) => {
      const u  = Number(i.price    || 0);
      const q  = Number(i.qty      || 0);
      const d  = Number(i.discount || 0);
      const da = i.discountType === "percent" ? Math.round(u * d / 100) : d;
      return s + (u - da) * q;
    }, 0), [items],
  );
  const billDiscountValue = useMemo(() => {
    const v = Number(billDiscount || 0);
    return billDiscountType === "percent"
      ? Math.round(subtotal * Math.min(100, Math.max(0, v)) / 100)
      : Math.max(0, v);
  }, [billDiscount, billDiscountType, subtotal]);
  const finalTotal = useMemo(
    () => Math.max(0, subtotal - billDiscountValue), [subtotal, billDiscountValue],
  );
  const changeAmount = useMemo(() => {
    const r = Number(amountReceived || 0);
    return r > finalTotal ? r - finalTotal : 0;
  }, [amountReceived, finalTotal]);
  const hasAnyDiscount = useMemo(
    () => items.some((i) => Number(i.discount || 0) > 0), [items],
  );

  // ── Utilities ──────────────────────────────────────────────────────
  const play = useCallback(
    (n) => { if (soundEnabled) playSound(n); }, [soundEnabled],
  );

  const showToast = useCallback((text, type = "warning") => {
    if      (type === "success") toast.success(text, { duration: 1800 });
    else if (type === "error")   toast.error(text, { duration: 2500 });
    else                         toast(text, { duration: 1800, icon: "⚠️" });
  }, []);

  const logClearedData = useCallback((cleared, reason) => {
    if (!cleared?.length) return;
    addDoc(collection(db, "clearedData"), {
      serialNo: currentBillSerial, items: cleared, reason,
      billerName: userData?.name || "Unknown",
      billerId: billerId || null, storeId,
      deletedAt: serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
    }).catch(() => {});
  }, [currentBillSerial, userData, billerId, storeId]);

  const logClearedBill = useCallback((billItems, reason) => {
    if (!billItems?.length) return;
    addDoc(collection(db, "clearedBills"), {
      serialNo: currentBillSerial, items: billItems, reason,
      customer: { ...customer },
      billerName: userData?.name || "Unknown",
      billerId: billerId || null, storeId,
      deletedAt: serverTimestamp(),
      date: new Date().toISOString().split("T")[0],
    }).catch(() => {});
  }, [currentBillSerial, customer, userData, billerId, storeId]);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ INIT — One-time serial initialization, never re-run on network change
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (serialInitRef.current || !userData?.uid) return;
    serialInitRef.current = true;

    (async () => {
      // Init serial manager
      await SerialManager.init(storeId);
      // Init customer serial
      await CustomerSerial.init(storeId);
      // Load customer cache
      await _loadCC(storeId).catch(() => {});

      // Set initial serial display
      setCurrentBillSerial(SerialManager.preview());
    })();
  }, [storeId, userData?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on user change
  useEffect(() => () => {
    serialInitRef.current = false;
    SerialManager.reset();
    CustomerSerial.reset();
    _cc.loaded  = false;
    _cc.storeId = null;
  }, [userData?.uid]);

  // ✅ NETWORK CHANGE — Never reset screen data, never reset serial
  useEffect(() => {
    const prev = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    // No actual change
    if (prev === isOnline) return;

    if (!isOnline) {
      // Gone offline
      if (activeBillRef.current) {
        // Bill in progress — just notify, don't touch anything
        toast("📴 Offline — bill will save locally", {
          duration: 2000, icon: "📴",
        });
      }
      // ✅ Serial stays unchanged — SerialManager.preview() is pure local
      return;
    }

    // ✅ Back online
    if (activeBillRef.current) {
      // Bill in progress — just notify
      toast.success("🌐 Back online!", { duration: 1500 });
      return;
    }

    // Screen is idle/locked — safe to sync and refresh
    (async () => {
      try {
        const result = await syncOfflineOrders();
        if (result?.synced > 0) {
          toast.success(`✅ ${result.synced} offline bills synced!`, { duration: 3000 });
          getOfflineOrdersCount().then(setOfflineCount).catch(() => {});

          // ✅ Re-read serial from Firebase after sync (only when idle)
          if (!activeBillRef.current) {
            SerialManager.initialized = false;
            await SerialManager.init(storeId);
            setCurrentBillSerial(SerialManager.preview());
          }
        }
      } catch {}

      // Reload store info
      getStoreById(storeId).then((s) => { if (s) setStore(s); }).catch(() => {});
      _enrichCC(storeId, userData?.uid).catch(() => {});
    })();
  }, [isOnline, storeId, userData?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store + background loaders
  useEffect(() => {
    if (!userData?.uid) return;
    if (isOnline) {
      getStoreById(storeId).then((s) => { if (s) setStore(s); }).catch(() => {});
      _enrichCC(storeId, userData.uid).catch(() => {});
    }
    getOfflineOrdersCount().then(setOfflineCount).catch(() => {});
  }, [storeId, userData?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Offline count polling
  useEffect(() => {
    const t = setInterval(
      () => getOfflineOrdersCount().then(setOfflineCount).catch(() => {}),
      30_000,
    );
    return () => clearInterval(t);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentDateTime(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  // Focus on unlock
  useEffect(() => {
    if (!screenLocked) {
      const t = setTimeout(() => priceInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [screenLocked]);

  // Store permissions
  useEffect(() => {
    if (store?.billerPermissions) {
      setPermissions((p) => ({ ...p, ...store.billerPermissions }));
    }
  }, [store]);

  // Default customer name
  useEffect(() => {
    if (settings?.customer?.defaultCustomerName && !activeBillRef.current) {
      setCustomer((p) => ({ ...p, name: settings.customer.defaultCustomerName }));
    }
  }, [settings?.customer?.defaultCustomerName]);

  // Auto-scroll table
  useEffect(() => {
    if (!tableContainerRef.current || items.length === 0) return;
    const t = setTimeout(() => {
      if (tableContainerRef.current)
        tableContainerRef.current.scrollTop = tableContainerRef.current.scrollHeight;
    }, 20);
    return () => clearTimeout(t);
  }, [items.length]);

  useEffect(() => {
    if (selectedRowIndex < 0 || !tableContainerRef.current) return;
    const t = setTimeout(() => {
      tableContainerRef.current
        ?.querySelectorAll("tbody tr")?.[selectedRowIndex]
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 30);
    return () => clearTimeout(t);
  }, [selectedRowIndex]);

  // ═══════════════════════════════════════════════════════════════════
  // RESET BILL
  // ═══════════════════════════════════════════════════════════════════
  const resetBill = useCallback(() => {
    activeBillRef.current  = false; // ✅ Mark bill as done
    submittingRef.current  = false;
    f8LockRef.current      = false;
    minusUsedRef.current   = false;
    deleteLockRef.current  = false;

    setItems([]);
    setSelectedRowIndex(-1);
    setLastItemId(null);

    const defName = settings?.customer?.defaultCustomerName || "Walking Customer";
    setCustomer({ name: defName, phone: "", city: "Karachi", market: "" });
    setCustNameSearch("");
    setCustPhoneSearch("");
    setCustSuggestions([]);
    setShowSug(false);
    setActiveField("");

    setForm({
      productName: "", serialId: "", price: "", qty: 1,
      discount: 0, discountType: "fixed",
    });
    lastEntryRef.current = { price: "", qty: 1, discount: 0, discountType: "fixed" };

    setBillDiscount(0);
    setBillDiscountType("fixed");
    setF8Step(0);
    setShowCustomerDialog(false);
    setShowSummaryPopup(false);
    setShowCashierPayment(false);
    setPaymentType("cash");
    setAmountReceived("");
  }, [settings?.customer?.defaultCustomerName]);

  // ═══════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════
  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setCustSuggestions([]);
      setShowSug(false);
      setSugLoading(false);
      return;
    }
    const mem = _searchCC(term);
    if (mem.length > 0) {
      setCustSuggestions(mem);
      setShowSug(true);
      setSugLoading(false);
      return;
    }
    setSugLoading(true);
    setShowSug(true);
    await _loadCC(storeId);
    setCustSuggestions(_searchCC(term));
    setSugLoading(false);
  }, [storeId]);

  const onNameChange = useCallback((v) => {
    setCustNameSearch(v);
    setCustomer((p) => ({ ...p, name: v }));
    setActiveField("name");
    clearTimeout(searchTimerRef.current);
    if (!v || v.length < 2) { setCustSuggestions([]); setShowSug(false); return; }
    searchTimerRef.current = setTimeout(() => doSearch(v), 150);
  }, [doSearch]);

  const onPhoneChange = useCallback((raw) => {
    const clean = normalizePhone(raw) || raw.replace(/[^0-9+]/g, "");
    setCustPhoneSearch(clean);
    setCustomer((p) => ({ ...p, phone: clean }));
    setActiveField("phone");
    clearTimeout(searchTimerRef.current);
    if (!clean || clean.length < 3) { setCustSuggestions([]); setShowSug(false); return; }
    searchTimerRef.current = setTimeout(() => doSearch(clean), 150);
  }, [doSearch]);

  const onSelectSuggestion = useCallback((c) => {
    setCustomer({
      name: c.name || "", phone: c.phone || "",
      city: c.city || "Karachi", market: c.market || "",
    });
    setCustNameSearch(c.name || "");
    setCustPhoneSearch(c.phone || "");
    setShowSug(false);
    setCustSuggestions([]);
    setActiveField("");
    setTimeout(() => priceInputRef.current?.focus(), 40);
  }, []);

  const openCustDialog = useCallback(() => {
    if (screenLocked) { showToast("Press INSERT first.", "error"); return; }
    setShowCustomerDialog(true);
    setF8Step(1);
    play("keyPress");
  }, [screenLocked, play, showToast]);

  const openCustDialogAlways = useCallback(() => {
    setShowCustomerDialog(true);
    if (!screenLocked && items.length > 0) setF8Step(1);
    play("keyPress");
  }, [screenLocked, items.length, play]);

  // ═══════════════════════════════════════════════════════════════════
  // ADD ITEM
  // ═══════════════════════════════════════════════════════════════════
  const handleAddItem = useCallback(() => {
    if (screenLocked) {
      showToast("Press INSERT to start.", "error");
      play("error");
      return;
    }

    const price    = form.price !== ""
      ? Number(form.price)
      : Number(lastEntryRef.current.price) || 0;
    const qty      = Number(form.qty) > 0 ? Number(form.qty) : 1;
    const discount = form.discount !== ""
      ? Number(form.discount)
      : Number(lastEntryRef.current.discount) || 0;
    const discType = form.discountType || lastEntryRef.current.discountType || "fixed";
    let prodName   = (form.productName || "").trim();

    if (!Number.isFinite(price) || price <= 0) {
      showToast("Valid price required.", "error");
      play("error");
      priceInputRef.current?.focus();
      return;
    }
    if (showProductName && !prodName) {
      showToast("Product name required.", "error");
      play("error");
      return;
    }

    const discAmt  = discType === "percent"
      ? Math.min(100, Math.max(0, discount))
      : Math.max(0, discount);
    const serialId = (form.serialId || "").trim() || getNextItemSerial();
    if (!showProductName) prodName = `Item - ${serialId}`;

    const newItem = {
      id: Date.now(), serialId, productName: prodName,
      price, qty, discount: discAmt, discountType: discType,
    };

    setItems((prev) => [...prev, newItem]);
    setLastItemId(newItem.id);
    minusUsedRef.current = false;
    lastEntryRef.current = {
      price: String(price), qty, discount: discAmt, discountType: discType,
    };
    setForm({
      productName: "", serialId: "", price: "", qty: 1,
      discount: discAmt, discountType: discType,
    });
    setSelectedRowIndex(-1);
    play("add");
    setTimeout(() => priceInputRef.current?.focus(), 20);
  }, [form, screenLocked, showProductName, play, showToast]);

  // Row operations
  const deleteRow = useCallback((id) => {
    if (screenLocked) { play("error"); return; }
    const item = items.find((i) => i.id === id);
    if (item) logClearedData([item], "row_deleted");
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedRowIndex(-1);
    play("delete");
    setTimeout(() => priceInputRef.current?.focus(), 20);
  }, [screenLocked, items, play, logClearedData]);

  const changeQty = useCallback((id, v) => {
    if (screenLocked) return;
    setItems((p) => p.map((i) =>
      i.id === id ? { ...i, qty: Math.max(1, Number(v) || 1) } : i,
    ));
  }, [screenLocked]);

  const changeDiscount = useCallback((id, v) => {
    if (screenLocked) return;
    setItems((p) => p.map((i) =>
      i.id === id ? { ...i, discount: Math.max(0, Number(v) || 0) } : i,
    ));
  }, [screenLocked]);

  const changeDiscountType = useCallback((id, type) => {
    if (screenLocked) return;
    setItems((p) => p.map((i) =>
      i.id === id ? { ...i, discountType: type } : i,
    ));
  }, [screenLocked]);

  // ═══════════════════════════════════════════════════════════════════
  // CLEAR / CANCEL
  // ═══════════════════════════════════════════════════════════════════
  const clearBill = useCallback(() => {
    if (screenLocked) { play("error"); return; }
    if (items.length > 0) {
      logClearedData(items, "bill_cleared");
      recordBillDeletion({
        serialNo: currentBillSerial, items, customer,
        totalAmount: subtotal, totalDiscount, totalQty,
        billStartTime, billEndTime,
        billerName: userData?.name, billerId, storeId,
        reason: "bill_cleared",
      }, storeId, isOnline).catch(() => {});
    }
    _saveDone = false;
    resetBill();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    play("delete");
    showToast("Bill cleared.", "success");
    // ✅ Serial stays — preview next
    setCurrentBillSerial(SerialManager.preview());
  }, [
    screenLocked, items, currentBillSerial, subtotal, totalDiscount,
    totalQty, customer, billStartTime, billEndTime,
    userData, billerId, storeId, isOnline,
    play, logClearedData, showToast, resetBill,
  ]);

  const cancelBill = useCallback(() => {
    if (items.length === 0) { showToast("No bill to cancel.", "warning"); return; }
    if (!window.confirm("Cancel this bill?")) return;
    logClearedBill(items, "bill_cancelled");
    recordBillDeletion({
      serialNo: currentBillSerial, items, customer,
      totalAmount: subtotal, totalDiscount, totalQty,
      billStartTime, billEndTime,
      billerName: userData?.name, billerId, storeId,
      reason: "bill_cancelled",
    }, storeId, isOnline).catch(() => {});
    _saveDone = false;
    resetBill();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    play("delete");
    showToast("Bill cancelled.", "success");
    setCurrentBillSerial(SerialManager.preview());
  }, [
    items, currentBillSerial, subtotal, totalDiscount, totalQty, customer,
    billStartTime, billEndTime, userData, billerId, storeId, isOnline,
    play, logClearedBill, showToast, resetBill,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ RESOLVE CUSTOMER NAME
  // Walking Customer + no phone → auto serial "Customer 001"
  // Has phone but no name → auto serial
  // Has real name → use as-is
  // ═══════════════════════════════════════════════════════════════════
  const resolveCustomerName = useCallback((cust) => {
    const name  = (cust.name  || "").trim();
    const phone = normalizePhone(cust.phone || "");

    const isWalkingDefault = (
      !name ||
      name.toLowerCase() === "walking customer" ||
      name.toLowerCase() === "walk-in"
    );

    if (isWalkingDefault && !phone) {
      // No name, no phone → auto serial
      return { resolved: CustomerSerial.next(storeId), isAutoSerial: true };
    }

    if (!name && phone) {
      // Has phone but no name → auto serial (will be updatable via phone key)
      return { resolved: CustomerSerial.next(storeId), isAutoSerial: true };
    }

    // Real name given
    return { resolved: name, isAutoSerial: false };
  }, [storeId]);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ BACKGROUND SAVE
  // ═══════════════════════════════════════════════════════════════════
  const saveInBackground = useCallback((snapshot) => {
    queueMicrotask(async () => {
      try {
        // ✅ Resolve customer
        const { resolved: resolvedName, isAutoSerial } =
          resolveCustomerName(snapshot.customer);

        // Prepare items
        const preparedItems = snapshot.items.map((item) => {
          const da = item.discountType === "percent"
            ? Math.round(item.price * item.discount / 100)
            : item.discount;
          return {
            serialId:    item.serialId    || "",
            productName: item.productName || "",
            price:       Number(item.price),
            qty:         Number(item.qty),
            discount:    Number(item.discount),
            discountType: item.discountType || "fixed",
            total:       (Number(item.price) - da) * Number(item.qty),
          };
        });

        const orderData = {
          customer: {
            name:   resolvedName,
            phone:  (snapshot.customer.phone || "").trim(),
            city:   snapshot.customer.city   || "Karachi",
            market: snapshot.customer.market || "",
          },
          items:           preparedItems,
          totalQty:        snapshot.totalQty,
          subtotal:        snapshot.subtotal,
          totalDiscount:   snapshot.totalDiscount,
          billDiscount:    snapshot.billDiscountValue,
          totalAmount:     snapshot.finalTotal,
          paymentType:     snapshot.overridePayment?.type     || null,
          amountReceived:  snapshot.overridePayment?.received || null,
          changeGiven:     snapshot.overridePayment?.change   || null,
          status:          snapshot.isAutoApproved ? "approved" : "pending",
          cashierHandover: !snapshot.isAutoApproved,
          billerSubmittedAt: serverTimestamp(),
          billerName:      snapshot.billerName || "Unknown",
          billerId:        snapshot.billerId   || null,
          storeId:         snapshot.storeId,
          billStartTime:   snapshot.billStartTime?.toISOString() || null,
          billEndTime:     snapshot.billEndTime.toISOString(),
          createdAt:       serverTimestamp(),
        };

        // ✅ Save order
        const result = await saveOrder(orderData, snapshot.isOnline);

        if (!result.success && result.duplicate) {
          toast.error("Duplicate bill detected.", { duration: 2500 });
          return;
        }

        // ✅ Confirm serial used
        const realSerial = result.serialNo || snapshot.usedSerial || "----";
        SerialManager.confirm(realSerial, snapshot.storeId);

        // ✅ Update display to NEXT serial
        setCurrentBillSerial(SerialManager.preview());

        // ✅ Background tasks
        queueMicrotask(() => {
          // Save customer record
          _saveCustomerBg(
            snapshot.storeId,
            snapshot.billerId,
            {
              name:   resolvedName,
              phone:  (snapshot.customer.phone || "").trim(),
              city:   snapshot.customer.city   || "",
              market: snapshot.customer.market || "",
            },
            isAutoSerial,
          );

          // Audit log
          if (!result.offline && result.id) {
            createAuditLog(
              { ...orderData, id: result.id, serialNo: realSerial },
              "ORDER_SUBMITTED",
              snapshot.billerId,
            ).catch(() => {});
          }

          // Try sync
          syncOfflineOrders().catch(() => {});
        });

        // Feedback
        if (result.offline) {
          play("offline");
          toast(`📴 Bill #${realSerial} saved OFFLINE.`, {
            duration: 2500, icon: "📴",
          });
          getOfflineOrdersCount().then(setOfflineCount).catch(() => {});
        } else {
          play("billSaved");
        }

        toast.success(
          snapshot.isAutoApproved
            ? `✅ Bill #${realSerial} saved!`
            : `📤 Bill #${realSerial} sent to cashier!`,
          { duration: 2200 },
        );

      } catch (err) {
        toast.error(`Save failed: ${err.message}`, { duration: 3000 });
        play("error");
      }
    });
  }, [play, resolveCustomerName]);

  // ═══════════════════════════════════════════════════════════════════
  // ✅ FINALIZE — Save once, then show print
  // ═══════════════════════════════════════════════════════════════════
  const finalizeAndPrint = useCallback((overridePayment = null) => {
    if (_saveDone)            return;
    if (submittingRef.current) return;
    if (!items.length) {
      showToast("Add at least one item.", "error");
      return;
    }

    // ✅ Lock immediately
    _saveDone             = true;
    submittingRef.current = true;
    f8LockRef.current     = true;

    const endTime    = new Date();
    const usedSerial = SerialManager.consume(); // Get serial (not yet confirmed)

    // ✅ Snapshot everything BEFORE reset
    const snapshot = {
      items:            [...items],
      customer:         { ...customer },
      totalQty,
      subtotal,
      totalDiscount,
      billDiscountValue,
      finalTotal,
      billStartTime,
      billEndTime:      endTime,
      billerName:       userData?.name,
      storeId,
      billerId,
      isAutoApproved,
      isOnline,
      overridePayment,
      usedSerial,
    };

    // ✅ Build print order (uses snapshot data)
    const orderForPrint = {
      serialNo:      usedSerial,
      billSerial:    usedSerial,
      customer:      { ...customer },
      items:         [...items],
      totalQty,
      totalAmount:   finalTotal,
      subtotal,
      totalDiscount: totalDiscount + billDiscountValue,
      billDiscount:  billDiscountValue,
      status:        isAutoApproved ? "approved" : "pending",
      createdAt:     billStartTime || new Date(),
      billStartTime: billStartTime || new Date(),
      billEndTime:   endTime,
    };

    // ✅ Close all dialogs except print
    setShowSummaryPopup(false);
    setShowCustomerDialog(false);
    setShowCashierPayment(false);
    setF8Step(0);

    // ✅ Reset bill + lock screen
    resetBill();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    setSubmitting(false);
    submittingRef.current = false;

    // ✅ Show preview serial (before Firebase confirms)
    setCurrentBillSerial(usedSerial);

    // ✅ Show print dialog (display only)
    if (isOnline || showOfflineInvoice) {
      setPrintOrder(orderForPrint);
      setShowPrintModal(true);
    }

    // ✅ Save in background (ONE TIME)
    saveInBackground(snapshot);

  }, [
    items, customer, totalQty, subtotal, totalDiscount, billDiscountValue,
    finalTotal, billStartTime, userData, storeId, billerId,
    isAutoApproved, isOnline, showOfflineInvoice,
    showToast, resetBill, saveInBackground,
  ]);

  // ✅ Print close — just close, no save
  const onPrintClose = useCallback(() => {
    setShowPrintModal(false);
    setPrintOrder(null);
    f8LockRef.current = false;
    // Serial already updated by saveInBackground
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // F8 FLOW
  // ═══════════════════════════════════════════════════════════════════
  const onCustomerSubmit = useCallback((cData) => {
    setCustomer(cData);
    setCustNameSearch(cData.name || "");
    setCustPhoneSearch(cData.phone || "");
    setShowCustomerDialog(false);

    if (items.length > 0 && !screenLocked) {
      setShowSummaryPopup(true);
      setF8Step(2);
    }
    f8LockRef.current = false;
    play("keyPress");

    // Save customer in background
    queueMicrotask(() => {
      const phone = normalizePhone(cData.phone || "");
      const name  = (cData.name || "").trim();
      const isWalking = !name || name.toLowerCase() === "walking customer";
      if (!isWalking || phone) {
        _saveCustomerBg(storeId, billerId, cData, false);
      }
    });
  }, [play, items.length, screenLocked, storeId, billerId]);

  const onSummaryProceed = useCallback(() => {
    setShowSummaryPopup(false);
    setBillEndTime(new Date());

    if (isDualRole || cashierModeActive) {
      setShowCashierPayment(true);
      setF8Step(4);
      f8LockRef.current = false;
    } else {
      finalizeAndPrint();
    }
    play("keyPress");
  }, [isDualRole, cashierModeActive, play, finalizeAndPrint]);

  const onCashierConfirm = useCallback(() => {
    if (_saveDone) return;
    const received = Number(amountReceived || 0);
    if (paymentType === "cash" && received < finalTotal) {
      showToast("Amount less than total.", "error");
      return;
    }
    setShowCashierPayment(false);
    finalizeAndPrint({
      type:     paymentType,
      received: paymentType === "cash" ? received : finalTotal,
      change:   paymentType === "cash" ? Math.max(0, received - finalTotal) : 0,
    });
  }, [amountReceived, finalTotal, paymentType, showToast, finalizeAndPrint]);

  // ═══════════════════════════════════════════════════════════════════
  // F8 HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const handleF8 = useCallback(() => {
    if (_saveDone) return;
    const now = Date.now();
    if (now - _lastF8 < 200) return;
    _lastF8 = now;
    if (f8LockRef.current) return;
    f8LockRef.current = true;

    if (showPrintModal) {
      onPrintClose();
      return;
    }

    if (items.length === 0) {
      showToast("Add items first.", "error");
      f8LockRef.current = false;
      return;
    }

    switch (f8Step) {
      case 0:
        openCustDialog();
        break;
      case 1:
        f8LockRef.current = false;
        break;
      case 2:
        if (showSummaryPopup) onSummaryProceed();
        else f8LockRef.current = false;
        break;
      case 4:
        onCashierConfirm();
        break;
      default:
        openCustDialog();
    }

    setTimeout(() => { f8LockRef.current = false; }, 300);
  }, [
    f8Step, items.length, showPrintModal, showSummaryPopup,
    openCustDialog, onSummaryProceed, onPrintClose,
    onCashierConfirm, showToast,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // KEYBOARD HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const handleEscape = useCallback(() => {
    if (showPrintModal) { onPrintClose(); return; }
    if (showCashierPayment) {
      setShowCashierPayment(false);
      f8LockRef.current = false;
      setShowSummaryPopup(true);
      setF8Step(2);
      return;
    }
    if (f8Step === 2 && showSummaryPopup) {
      setShowSummaryPopup(false);
      setShowCustomerDialog(true);
      setF8Step(1);
      f8LockRef.current = false;
      return;
    }
    if (showCustomerDialog) {
      setShowCustomerDialog(false);
      setF8Step(0);
      f8LockRef.current = false;
      setTimeout(() => priceInputRef.current?.focus(), 40);
      return;
    }
    setSelectedRowIndex(-1);
    setShowSug(false);
    priceInputRef.current?.focus();
  }, [
    f8Step, showPrintModal, showSummaryPopup,
    showCustomerDialog, showCashierPayment, onPrintClose,
  ]);

  const handleInsert = useCallback(() => {
    if (screenLocked) {
      if (submittingRef.current) {
        showToast("Saving...", "warning");
        return;
      }
      // ✅ Reset save guard for new bill
      _saveDone             = false;
      submittingRef.current = false;
      f8LockRef.current     = false;
      minusUsedRef.current  = false;
      deleteLockRef.current = false;

      // ✅ Mark bill as active
      activeBillRef.current = true;

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
      setCurrentBillSerial(SerialManager.preview());

      play("unlock");
      showToast("✅ New bill started.", "success");
      setTimeout(() => priceInputRef.current?.focus(), 40);
      return;
    }
    if (items.length > 0) {
      showToast("Clear bill first (DEL).", "warning");
      return;
    }
    setTimeout(() => priceInputRef.current?.focus(), 40);
  }, [screenLocked, items.length, showToast, play]);

  const handleMinus = useCallback(() => {
    if (screenLocked || items.length === 0) { play("error"); return; }
    if (deleteLockRef.current) return;
    if (minusUsedRef.current) {
      showToast("Add new item first.", "warning");
      play("error");
      return;
    }
    deleteLockRef.current = true;
    setTimeout(() => { deleteLockRef.current = false; }, 400);
    const last = items[items.length - 1];
    if (!last) { play("error"); return; }
    logClearedData([last], "minus_key_deleted");
    setItems((p) => p.slice(0, -1));
    minusUsedRef.current = true;
    play("delete");
    showToast(`Deleted: ${last.productName}`, "warning");
    setSelectedRowIndex(-1);
    setTimeout(() => priceInputRef.current?.focus(), 20);
  }, [screenLocked, items, play, logClearedData, showToast]);

  const handleDelete = useCallback(() => {
    if (screenLocked || !items.length) return;
    if (!window.confirm("Clear full bill?")) return;
    clearBill();
  }, [clearBill, screenLocked, items.length]);

  // ── Shortcuts ─────────────────────────────────────────────────────
  const shortcuts = useMemo(() => ({
    Insert:         handleInsert,
    F8:             handleF8,
    F9:             openCustDialog,
    Escape:         handleEscape,
    Home:           () => { if (!screenLocked) phoneInputRef.current?.focus(); },
    End:            () => window.open(window.location.href, "_blank"),
    Delete:         handleDelete,
    ArrowUp:        () => {
      if (items.length)
        setSelectedRowIndex((p) => (p <= 0 ? items.length - 1 : p - 1));
    },
    ArrowDown:      () => {
      if (items.length)
        setSelectedRowIndex((p) => (p >= items.length - 1 ? 0 : p + 1));
    },
    PageUp:         () => {
      if (items.length)
        setSelectedRowIndex((p) => Math.max(0, (p < 0 ? items.length - 1 : p) - 5));
    },
    PageDown:       () => {
      if (items.length)
        setSelectedRowIndex((p) => Math.min(items.length - 1, (p < 0 ? 0 : p) + 5));
    },
    numpadAdd:      () => { if (!screenLocked) qtyInputRef.current?.focus(); },
    Minus:          handleMinus,
    numpadSubtract: handleMinus,
    numpadDivide:   () => { if (!screenLocked) discountInputRef.current?.focus(); },
  }), [
    handleInsert, handleF8, openCustDialog, handleEscape,
    handleDelete, handleMinus, screenLocked, items.length,
  ]);
  useKeyboardShortcuts(shortcuts, true);

  // ── Misc ──────────────────────────────────────────────────────────
  const togglePermission = useCallback(async (key) => {
    const nv = !permissions[key];
    setPermissions((p) => ({ ...p, [key]: nv }));
    if (!isSuperAdmin || !store?.id) return;
    try {
      const up = { ...(store.billerPermissions || {}), [key]: nv };
      await updateStore(store.id, { billerPermissions: up });
      setStore((p) => ({ ...p, billerPermissions: up }));
    } catch {}
  }, [isSuperAdmin, permissions, store]);

  const fmtTime = useCallback((d) => {
    if (!d) return "--:--:--";
    const dd = d instanceof Date ? d : new Date(d);
    if (isNaN(dd)) return "--:--:--";
    return dd.toLocaleTimeString("en-PK", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  }, []);

  const cardClass = isDark
    ? "rounded-2xl border border-yellow-500/20 bg-[#15120d]/95"
    : "rounded-2xl border border-yellow-200 bg-white";

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontSize: `${billerFontSize}px` }}
    >
      <BillerHeader
        currentBillSerial={currentBillSerial}
        screenLocked={screenLocked}
        currentDateTime={currentDateTime}
        customer={customer}
        setCustomer={setCustomer}
        isOnline={isOnline}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onOpenCustomerDialog={openCustDialogAlways}
        offlineCount={offlineCount}
        items={items}
        billerName={userData?.name}
        showRecentOrders={showRecentOrders}
        toggleRecentOrders={() => setShowRecentOrders((v) => !v)}
        recentOrders={recentOrders}
        loadingOrders={loadingOrders}
        onViewInvoice={(order) => setViewingOrder(order)}
        canToggleCashierMode={canToggleCashierMode}
        cashierModeActive={cashierModeActive}
        onToggleCashierMode={() => setCashierModeActive((v) => !v)}
        isSuperAdmin={isSuperAdmin}
        permissions={userData?.permissions}
        onTogglePermission={togglePermission}
        directPaid={directPaid}
        onToggleDirectPaid={() => setDirectPaid((v) => !v)}
        storeId={storeId}
        billerId={billerId}
        store={storeInfo}
      />

      {/* ✅ Lock screen — shows next serial (never "OFF-DEFAU-002") */}
      {screenLocked && items.length === 0 && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${
          isDark ? "bg-black/80" : "bg-white/80"
        }`}>
          <div className={`rounded-3xl px-8 py-10 text-center max-w-sm w-full mx-4 ${
            isDark
              ? "bg-[#15120d] border border-yellow-500/20"
              : "bg-white border border-yellow-200"
          }`}>
            <Lock size={44} className="mx-auto mb-3 text-yellow-500" />
            <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Bill Locked
            </h2>
            <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Press{" "}
              <kbd className="rounded-lg bg-yellow-500/20 px-3 py-1 font-mono font-bold text-yellow-500">
                INSERT
              </kbd>{" "}
              to start
            </p>
            {currentBillSerial !== "----" && (
              <p className={`mt-3 font-mono text-sm ${
                isDark ? "text-yellow-500/60" : "text-yellow-600/60"
              }`}>
                Next:{" "}
                <strong className="text-yellow-500">{currentBillSerial}</strong>
              </p>
            )}
            {!isOnline && (
              <div className="mt-4 flex items-center justify-center gap-2 text-orange-400 text-sm">
                <WifiOff size={14} />
                <span>Offline — bills save locally</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1 mx-3 mt-1 shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff size={13} className="text-orange-400 shrink-0" />
            <p className="font-semibold text-orange-400 text-xs">
              📴 Offline — Bills saved locally
            </p>
          </div>
          {offlineCount > 0 && (
            <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
              {offlineCount} pending
            </span>
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="flex-1 grid gap-2 xl:grid-cols-[300px_1fr] min-h-0 px-3 mt-1 pb-2 overflow-hidden">

        {/* ── LEFT: Entry panel ── */}
        <section className={`${cardClass} flex flex-col overflow-hidden`}>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">

              {/* Header */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-yellow-500" />
                  <h2 className="font-bold text-yellow-600 text-sm">ENTRY</h2>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  screenLocked
                    ? "bg-red-100 text-red-600"
                    : "bg-green-100 text-green-600"
                }`}>
                  {screenLocked ? "LOCKED" : "ACTIVE"}
                </span>
              </div>

              {/* Serial display */}
              {!screenLocked && (
                <div className={`rounded-xl p-2 border shrink-0 ${
                  isDark
                    ? "bg-yellow-500/5 border-yellow-500/20"
                    : "bg-yellow-50 border-yellow-200"
                }`}>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Bill Serial
                  </p>
                  <p className="text-xl font-bold text-yellow-600 font-mono">
                    {currentBillSerial}
                  </p>
                  {billStartTime && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Started: {fmtTime(billStartTime)}
                    </p>
                  )}
                </div>
              )}

              {/* Product name (superadmin only) */}
              {showProductName && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={form.productName}
                    onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                    disabled={screenLocked}
                    placeholder="Product name..."
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                      isDark
                        ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                        : "border-yellow-200 bg-white text-gray-900"
                    } disabled:opacity-50`}
                  />
                </div>
              )}

              {/* Price + Qty */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Price *
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
                      const ok = ["Backspace","Delete","Tab","Escape","Enter","ArrowLeft","ArrowRight","."];
                      if (
                        !ok.includes(e.key) &&
                        !/^\d$/.test(e.key) &&
                        !((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase()))
                      ) e.preventDefault();
                      if (e.key === "Enter") { e.preventDefault(); handleAddItem(); }
                    }}
                    placeholder={
                      lastEntryRef.current.price
                        ? `↵ ${lastEntryRef.current.price}`
                        : "0.00"
                    }
                    disabled={screenLocked}
                    style={{ fontSize: `${Math.max(billerFontSize, 18)}px` }}
                    className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-yellow-500/30 ${
                      isDark
                        ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400"
                        : "border-yellow-300 bg-white text-yellow-700"
                    } disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Qty
                  </label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    value={form.qty || 1}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, qty: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                    disabled={screenLocked}
                    style={{ fontSize: `${Math.max(billerFontSize, 18)}px` }}
                    className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-yellow-500/30 ${
                      isDark
                        ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                        : "border-yellow-200 bg-white text-gray-900"
                    } disabled:opacity-50`}
                  />
                </div>
              </div>

              {/* Discount */}
              {showDiscountField && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Discount / Item
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      value={form.discount}
                      onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                      onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                      disabled={screenLocked}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none ${
                        isDark
                          ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                          : "border-yellow-200 bg-white text-gray-900"
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

              {/* Customer Name */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                  Customer Name
                </label>
                <div className="relative">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={custNameSearch || customer.name}
                        onChange={(e) => onNameChange(e.target.value)}
                        onFocus={() => {
                          setActiveField("name");
                          const v = custNameSearch || customer.name;
                          if (v.length >= 2 && v !== "Walking Customer") doSearch(v);
                        }}
                        onBlur={() =>
                          setTimeout(() => {
                            if (activeField === "name") {
                              setShowSug(false);
                              setActiveField("");
                            }
                          }, 200)
                        }
                        disabled={screenLocked}
                        placeholder="Customer name (leave empty for auto)"
                        className={`w-full rounded-xl border pl-8 pr-3 py-2 text-sm outline-none ${
                          isDark
                            ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                            : "border-yellow-200 bg-white text-gray-900"
                        } disabled:opacity-50`}
                      />
                    </div>
                    <button
                      onClick={openCustDialogAlways}
                      title="F9"
                      className={`px-2.5 rounded-xl border ${
                        isDark
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }`}
                    >
                      <User size={14} />
                    </button>
                  </div>

                  {/* Name suggestions */}
                  {showSug && activeField === "name" && (
                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-xl max-h-44 overflow-y-auto ${
                      isDark
                        ? "bg-[#1a1508] border-yellow-500/30"
                        : "bg-white border-yellow-200"
                    }`}>
                      {sugLoading ? (
                        <div className="flex items-center justify-center py-3 gap-2">
                          <Loader2 size={13} className="animate-spin text-yellow-500" />
                          <span className="text-xs text-gray-400">Searching...</span>
                        </div>
                      ) : custSuggestions.length > 0 ? (
                        custSuggestions.map((c, i) => (
                          <button
                            key={i}
                            onMouseDown={() => onSelectSuggestion(c)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-500/10 border-b last:border-0 ${
                              isDark
                                ? "text-white border-yellow-500/10"
                                : "text-gray-900 border-gray-100"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{c.name || "No Name"}</span>
                              {c.phone && (
                                <span className={`text-xs font-mono ${
                                  isDark ? "text-yellow-400" : "text-yellow-600"
                                }`}>
                                  {c.phone}
                                </span>
                              )}
                            </div>
                            {c.city && (
                              <span className={`text-[10px] ${
                                isDark ? "text-gray-500" : "text-gray-400"
                              }`}>
                                {c.city}{c.market ? ` • ${c.market}` : ""}
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className={`px-3 py-3 text-xs text-center ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>
                          No record found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                  Phone <span className="text-gray-400">(Home)</span>
                </label>
                <div className="relative">
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="numeric"
                    value={custPhoneSearch}
                    onChange={(e) =>
                      onPhoneChange(e.target.value.replace(/[^0-9+]/g, ""))
                    }
                    onFocus={() => {
                      setActiveField("phone");
                      if (custPhoneSearch.length >= 3) doSearch(custPhoneSearch);
                    }}
                    onBlur={() =>
                      setTimeout(() => {
                        if (activeField === "phone") {
                          setShowSug(false);
                          setActiveField("");
                        }
                      }, 200)
                    }
                    disabled={screenLocked}
                    placeholder="03XX-XXXXXXX"
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                      isDark
                        ? "border-yellow-500/20 bg-[#0f0d09] text-white"
                        : "border-yellow-200 bg-white text-gray-900"
                    } disabled:opacity-50`}
                  />

                  {/* Phone suggestions */}
                  {showSug && activeField === "phone" && (
                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-xl max-h-44 overflow-y-auto ${
                      isDark
                        ? "bg-[#1a1508] border-yellow-500/30"
                        : "bg-white border-yellow-200"
                    }`}>
                      {sugLoading ? (
                        <div className="flex items-center justify-center py-3 gap-2">
                          <Loader2 size={13} className="animate-spin text-yellow-500" />
                          <span className="text-xs text-gray-400">Searching...</span>
                        </div>
                      ) : custSuggestions.length > 0 ? (
                        custSuggestions.map((c, i) => (
                          <button
                            key={i}
                            onMouseDown={() => onSelectSuggestion(c)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-500/10 border-b last:border-0 ${
                              isDark
                                ? "text-white border-yellow-500/10"
                                : "text-gray-900 border-gray-100"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-mono font-bold ${
                                isDark ? "text-yellow-400" : "text-yellow-600"
                              }`}>
                                {c.phone}
                              </span>
                              <span className="font-medium">{c.name || "No Name"}</span>
                            </div>
                            {c.city && (
                              <span className={`text-[10px] ${
                                isDark ? "text-gray-500" : "text-gray-400"
                              }`}>
                                {c.city}{c.market ? ` • ${c.market}` : ""}
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className={`px-3 py-3 text-xs text-center ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>
                          No record found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddItem}
                disabled={screenLocked}
                className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 active:scale-95 transition-transform"
              >
                ➕ Add Item (Enter)
              </button>

              {lastEntryRef.current.price && (
                <p className="text-center text-[10px] text-gray-400">
                  ↵ Rs.{lastEntryRef.current.price}
                  {lastEntryRef.current.discount > 0 &&
                    ` −${lastEntryRef.current.discount}${
                      lastEntryRef.current.discountType === "percent" ? "%" : ""
                    }`
                  }
                  {" "}×{lastEntryRef.current.qty}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── RIGHT: Table + totals ── */}
        <div className="flex flex-col min-h-0 gap-1.5 overflow-hidden">
          <section className={`${cardClass} flex flex-col flex-1 min-h-0 overflow-hidden`}>

            {/* Table header */}
            <div className={`shrink-0 ${isDark ? "bg-[#1a1508]" : "bg-yellow-50"}`}>
              <table
                className="w-full table-fixed"
                style={{ fontSize: `${Math.max(billerFontSize, 15)}px` }}
              >
                <colgroup>
                  <col style={{ width: "32px" }} />
                  {showProductName && <col />}
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "60px" }} />
                  {hasAnyDiscount && <col style={{ width: "76px" }} />}
                  <col style={{ width: "96px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr className={isDark ? "text-yellow-500" : "text-yellow-700"}>
                    <th className="px-1 py-1.5 text-left font-bold text-xs">#</th>
                    {showProductName && (
                      <th className="px-1 py-1.5 text-left font-bold text-xs">Product</th>
                    )}
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Price</th>
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Qty</th>
                    {hasAnyDiscount && (
                      <th className="px-1 py-1.5 text-left font-bold text-xs">Disc</th>
                    )}
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Total</th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
              </table>
              <div className={`h-px ${isDark ? "bg-yellow-500/20" : "bg-yellow-200"}`} />
            </div>

            {/* Table body */}
            <div
              ref={tableContainerRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
              style={{ scrollBehavior: "smooth" }}
            >
              <table
                className="w-full table-fixed"
                style={{ fontSize: `${Math.max(billerFontSize, 15)}px` }}
              >
                <colgroup>
                  <col style={{ width: "32px" }} />
                  {showProductName && <col />}
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "60px" }} />
                  {hasAnyDiscount && <col style={{ width: "76px" }} />}
                  <col style={{ width: "96px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="px-4 py-8 text-center">
                        <Package size={26} className="mx-auto mb-2 text-yellow-500/40" />
                        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                          No items
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                          INSERT → price → Enter
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const discAmt = item.discountType === "percent"
                        ? Math.round(item.price * item.discount / 100)
                        : item.discount;
                      const hasDisc   = discAmt > 0;
                      const lineTotal = (item.price - discAmt) * item.qty;
                      const origTotal = item.price * item.qty;
                      const isSel     = selectedRowIndex === index;
                      const isLast    = lastItemId === item.id;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedRowIndex(index)}
                          className={`cursor-pointer border-b transition-colors ${
                            isSel
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
                              isSel
                                ? "bg-yellow-500 text-black"
                                : isDark
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {index + 1}
                            </span>
                          </td>

                          {showProductName && (
                            <td className={`px-1 py-1 truncate text-xs ${
                              isDark ? "text-gray-200" : "text-gray-800"
                            }`}>
                              {item.productName}
                            </td>
                          )}

                          <td className="px-1 py-1">
                            {hasDisc ? (
                              <div className="leading-none">
                                <span className={`text-[9px] line-through block ${
                                  isDark ? "text-gray-500" : "text-gray-400"
                                }`}>
                                  {item.price.toLocaleString()}
                                </span>
                                <span
                                  className={`font-bold ${isDark ? "text-green-400" : "text-green-600"}`}
                                  style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}
                                >
                                  {(item.price - discAmt).toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`font-bold ${isDark ? "text-gray-200" : "text-gray-700"}`}
                                style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}
                              >
                                {item.price.toLocaleString()}
                              </span>
                            )}
                          </td>

                          <td className="px-1 py-1">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => changeQty(item.id, e.target.value)}
                              disabled={screenLocked}
                              onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                              style={{ fontSize: `${Math.max(billerFontSize - 2, 12)}px` }}
                              className={`w-10 rounded-lg border px-1 py-0.5 text-center font-bold outline-none ${
                                isDark
                                  ? "border-yellow-500/20 bg-black/30 text-white"
                                  : "border-yellow-200 bg-white text-gray-900"
                              } disabled:opacity-50`}
                            />
                          </td>

                          {hasAnyDiscount && (
                            <td className="px-1 py-1">
                              {showDiscountField ? (
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.discount}
                                    onChange={(e) => changeDiscount(item.id, e.target.value)}
                                    disabled={screenLocked}
                                    onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                                    className={`w-10 rounded-lg border px-1 py-0.5 text-center text-[11px] font-semibold outline-none ${
                                      isDark
                                        ? "border-yellow-500/20 bg-black/30 text-white"
                                        : "border-yellow-200 bg-white text-gray-900"
                                    } disabled:opacity-50`}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      changeDiscountType(
                                        item.id,
                                        item.discountType === "fixed" ? "percent" : "fixed",
                                      );
                                    }}
                                    disabled={screenLocked}
                                    className={`text-[9px] font-bold px-0.5 rounded ${
                                      isDark
                                        ? "bg-yellow-500/10 text-yellow-400"
                                        : "bg-yellow-50 text-yellow-600"
                                    }`}
                                  >
                                    {item.discountType === "percent" ? "%" : "Rs"}
                                  </button>
                                </div>
                              ) : (
                                hasDisc && (
                                  <span className="text-[11px] text-red-400">
                                    -{discAmt.toLocaleString()}
                                  </span>
                                )
                              )}
                            </td>
                          )}

                          <td className="px-1 py-1">
                            {hasDisc ? (
                              <div className="leading-none">
                                <span className={`text-[9px] line-through block ${
                                  isDark ? "text-gray-500" : "text-gray-400"
                                }`}>
                                  {origTotal.toLocaleString()}
                                </span>
                                <span
                                  className="font-extrabold text-yellow-500"
                                  style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}
                                >
                                  {lineTotal.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span
                                className="font-extrabold text-yellow-500"
                                style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}
                              >
                                {lineTotal.toLocaleString()}
                              </span>
                            )}
                          </td>

                          <td className="px-1 py-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteRow(item.id); }}
                              disabled={screenLocked}
                              className={`rounded-lg p-0.5 transition ${
                                isDark
                                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                  : "bg-red-50 text-red-500 hover:bg-red-100"
                              } disabled:opacity-40`}
                            >
                              <X size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bill discount */}
            {items.length > 0 && allowBillDiscount && (
              <div className={`shrink-0 border-t px-3 py-1 ${
                isDark
                  ? "border-yellow-500/10 bg-[#12100a]"
                  : "border-yellow-100 bg-yellow-50/50"
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <label className={`text-[10px] font-bold uppercase ${
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
                      className={`w-16 rounded-lg border px-2 py-1 text-center text-xs outline-none ${
                        isDark
                          ? "border-yellow-500/20 bg-black/30 text-white"
                          : "border-yellow-200 bg-white text-gray-900"
                      } disabled:opacity-50`}
                    />
                    <button
                      onClick={() =>
                        setBillDiscountType((t) => (t === "fixed" ? "percent" : "fixed"))
                      }
                      disabled={screenLocked}
                      className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        isDark
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {billDiscountType === "percent" ? "%" : "Rs"}
                    </button>
                    {billDiscountValue > 0 && (
                      <span className="text-xs font-bold text-red-400 ml-1">
                        -{billDiscountValue.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Totals bar */}
            {items.length > 0 && (
              <div className={`shrink-0 border-t-2 ${
                isDark
                  ? "border-yellow-500/30 bg-[#1a1508]"
                  : "border-yellow-300 bg-yellow-50"
              }`}>
                <div className="flex items-center justify-between px-3 py-1">
                  <div className="flex items-center gap-3">
                    {[
                      ["Items", items.length],
                      ["Qty",   totalQty],
                      ...(totalDiscount + billDiscountValue > 0
                        ? [["Saved", `−${(totalDiscount + billDiscountValue).toLocaleString()}`]]
                        : []),
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className={`text-[9px] uppercase ${
                          isDark ? "text-gray-500" : "text-gray-400"
                        }`}>
                          {label}
                        </span>
                        <p
                          className={`font-bold leading-tight ${
                            label === "Saved"
                              ? "text-red-400"
                              : isDark ? "text-white" : "text-gray-900"
                          }`}
                          style={{ fontSize: `${Math.max(billerFontSize - 2, 13)}px` }}
                        >
                          {val}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="text-right">
                    {billDiscountValue > 0 && (
                      <span className={`text-xs line-through block ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>
                        Rs.{subtotal.toLocaleString()}
                      </span>
                    )}
                    <p
                      className="font-extrabold text-yellow-500 leading-tight"
                      style={{ fontSize: `${Math.min(totalFontSize, 26)}px` }}
                    >
                      Rs.{finalTotal.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Action bar */}
          <section className={`${cardClass} px-3 py-1.5 shrink-0`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                {permissions.showTimestamps && billStartTime && (
                  <span className={`inline-flex items-center gap-1 ${
                    isDark ? "text-gray-500" : "text-gray-400"
                  }`}>
                    <Clock3 size={10} />
                    {fmtTime(billStartTime)}
                  </span>
                )}
                {selectedRowIndex >= 0 && items.length > 0 && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                    isDark
                      ? "bg-blue-500/10 text-blue-300"
                      : "bg-blue-50 text-blue-600"
                  }`}>
                    Row {selectedRowIndex + 1}/{items.length}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {permissions.allowCancelBill && (
                  <button
                    onClick={cancelBill}
                    disabled={items.length === 0}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-medium ${
                      isDark
                        ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    } disabled:opacity-40`}
                  >
                    <Trash2 size={11} className="inline mr-1" />
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleF8}
                  disabled={items.length === 0 || submitting || _saveDone}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-40 active:scale-95 transition-transform"
                >
                  {submitting
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Printer size={13} />
                  }
                  {submitting ? "Saving..." : "F8: Checkout"}
                </button>
              </div>
            </div>
          </section>

          {/* Shortcut hints */}
          <section className={`${cardClass} p-1.5 shrink-0`}>
            <div className="flex flex-wrap gap-1">
              {[
                ["INS","New"],["Enter","Add"],["F8","Checkout"],["ESC","Back"],
                ["END","Tab"],["−","Del Last"],["DEL","Clear"],["↑↓","Nav"],
                ["Home","Phone"],["Num+","Qty"],["Num/","Disc"],
              ].map(([k, a]) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] ${
                    isDark
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  <span className="font-mono font-bold">{k}</span>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>{a}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ═══ DIALOGS ═══ */}

      <AnimatePresence>
        {showCustomerDialog && (
          <CustomerDialog
            isOpen={showCustomerDialog}
            initialCustomer={customer}
            onSubmit={onCustomerSubmit}
            onClose={() => {
              setShowCustomerDialog(false);
              setF8Step(0);
              f8LockRef.current = false;
              setTimeout(() => priceInputRef.current?.focus(), 40);
            }}
            runtimeCities={runtimeCities}
            runtimeMarkets={runtimeMarkets}
            onAddCity={(c) => {
              if (c && !runtimeCities.includes(c))
                setRuntimeCities((p) => [...p, c]);
            }}
            onAddMarket={(m) => {
              if (m && !runtimeMarkets.includes(m))
                setRuntimeMarkets((p) => [...p, m]);
            }}
            isSuperAdmin={isSuperAdmin}
            storeId={storeId}
            billerId={billerId}
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
            billDiscount={billDiscount}
            billDiscountType={billDiscountType}
            grandTotal={finalTotal}
            billSerial={currentBillSerial}
            customer={customer}
            onProceed={onSummaryProceed}
            onClose={() => {
              setShowSummaryPopup(false);
              setShowCustomerDialog(true);
              setF8Step(1);
              f8LockRef.current = false;
            }}
            onBillDiscountChange={(v) => setBillDiscount(v)}
            onBillDiscountTypeChange={(t) => setBillDiscountType(t)}
          />
        )}
      </AnimatePresence>

      {/* ✅ Print modal — display only, close = just close */}
      {showPrintModal && printOrder && (
        <InvoicePrint
          order={printOrder}
          store={storeInfo}
          onClose={onPrintClose}
          directPrint
          autoClose
          fontSize={invoiceFontSize}
        />
      )}

      {viewingOrder && (
        <InvoicePrint
          order={viewingOrder}
          store={storeInfo}
          onClose={() => setViewingOrder(null)}
          directPrint={false}
        />
      )}

      {/* Cashier payment modal */}
      <AnimatePresence>
        {showCashierPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${
                isDark
                  ? "bg-[#15120d] border border-yellow-500/20"
                  : "bg-white border border-yellow-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-green-400" />
                  <div>
                    <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      Collect Payment
                    </h2>
                    <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      #{currentBillSerial}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCashierPayment(false);
                    f8LockRef.current = false;
                    setShowSummaryPopup(true);
                    setF8Step(2);
                  }}
                >
                  <X size={18} className={isDark ? "text-gray-400" : "text-gray-500"} />
                </button>
              </div>

              <div className={`rounded-2xl p-4 mb-4 text-center ${
                isDark
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-yellow-50 border border-yellow-200"
              }`}>
                <p className="text-xs uppercase text-gray-500 mb-1">Total Due</p>
                <p className="text-4xl font-extrabold text-yellow-500">
                  Rs.{finalTotal.toLocaleString()}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "card", "online"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setPaymentType(t)}
                      className={`py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                        paymentType === t
                          ? "bg-yellow-500 text-black"
                          : isDark
                          ? "bg-white/5 text-gray-300 border border-yellow-500/20"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {paymentType === "cash" && (
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
                    Amount Received
                  </label>
                  <input
                    type="number"
                    min={finalTotal}
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                    placeholder={`Min: ${finalTotal}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && Number(amountReceived || 0) >= finalTotal)
                        onCashierConfirm();
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-2xl font-bold outline-none ${
                      isDark
                        ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400"
                        : "border-yellow-300 bg-white text-yellow-700"
                    }`}
                  />
                  {changeAmount > 0 && (
                    <div className="mt-3 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-400">Change</span>
                      <span className="text-2xl font-extrabold text-green-400">
                        Rs.{changeAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onCashierConfirm}
                disabled={
                  submitting ||
                  _saveDone ||
                  (paymentType === "cash" && Number(amountReceived || 0) < finalTotal)
                }
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-base font-bold text-white hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Confirm & Save
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Dashboard);