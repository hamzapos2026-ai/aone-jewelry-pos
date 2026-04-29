// src/modules/biller/BillerDashboard.jsx
// ✅ ALL FIXES APPLIED v6:
// FIX-1: WiFi ON/OFF — ZERO bill mutations
// FIX-2: Internal Item IDs hidden from UI
// FIX-3: ESC = global back/close for ALL dialogs
// FIX-4: Minus = delete last row (one at a time)
// FIX-5: Delete = clear entire bill with confirmation (blocked inside table inputs)
// FIX-6: Walking Customer default
// FIX-7: Customer name updatable later
// FIX-8: Item serial 01, 02, 03 format
// FIX-9: Bill serial 0001, 0002 format
// FIX-10: handleFormQtyChange NEVER mutates existing table items
// FIX-11: handleAddItem ALWAYS creates new row (no silent price-merge)
// FIX-12: Duplicate (price empty) uses form qty if user typed one
// FIX-13: resetBill has NO contradictory re-activation
// FIX-14: lastEntryRef reset on restoreDraft
// FIX-15: printModalOpenRef prevents serial jump during print

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

import { useTheme }          from "../../context/ThemeContext";
import { useLanguage }       from "../../hooks/useLanguage";
import useNetworkStatus      from "../../hooks/useNetworkStatus";
import useKeyboardShortcuts  from "../../hooks/useHotkeys";
import { db }                from "../../services/firebase";
import { createAuditLog }    from "../../services/activityLogger";
import { saveOrder }         from "../../services/orderService";
import { useAuth }           from "../../context/AuthContext";
import { useSettings }       from "../../context/SettingsContext";
import { getStoreById, updateStore } from "../../modules/stores/storeService";
import { syncOfflineOrders, getOfflineOrdersCount } from "../../services/offlineSync";
import { playSound }         from "../../services/soundService";
import BillerHeader          from "./BillerHeader";
import CustomerDialog, {
  resetPersistedCustomer,
} from "../../components/CustomerDialog";
import SummaryPopup          from "../../components/SummaryPopup";
import InvoicePrint          from "../../components/InvoicePrint";
import { recordBillDeletion } from "../../services/deletedBillsService";
import {
  getNextItemSerial,
  getPlaceholderSerial,
} from "../../services/serialService";

// ─── Utils ────────────────────────────────────────────────────
const normalizePhone = (input = "") => {
  if (!input) return "";
  let p = String(input).trim().replace(/[\s\-()]/g, "");
  if      (p.startsWith("+92"))                   p = "0" + p.slice(3);
  else if (p.startsWith("0092"))                  p = "0" + p.slice(4);
  else if (p.startsWith("92") && p.length === 12) p = "0" + p.slice(2);
  if      (p.length === 10 && p.startsWith("3"))  p = "0" + p;
  return p;
};

const fmt4 = (n) =>
  String(Math.max(0, Number(n) || 0)).padStart(4, "0");

const fmtItemSerial = (n) =>
  String(Math.max(0, Number(n) || 0)).padStart(2, "0");

const getFriendlyError = (err) => {
  if (!err) return "Something went wrong.";
  const msg  = err?.message || String(err);
  const code = err?.code    || "";
  if (
    code === "unavailable"                    ||
    msg.includes("INTERNET_DISCONNECTED")     ||
    msg.includes("network-request-failed")    ||
    msg.includes("Failed to fetch")           ||
    msg.includes("ERR_INTERNET_DISCONNECTED") ||
    msg.includes("offline")
  ) return "📴 No internet — bill saved offline.";
  if (code === "permission-denied")  return "❌ Permission denied.";
  if (code === "not-found")          return "❌ Record not found.";
  if (code === "already-exists")     return "⚠️ Duplicate entry.";
  if (code === "deadline-exceeded")  return "⏱️ Request timed out — retrying offline.";
  if (code === "resource-exhausted") return "⚠️ Too many requests — try again.";
  if (msg.includes("duplicate"))     return "⚠️ Duplicate bill detected.";
  return "Save failed. Please try again.";
};

const EMPTY_FORM = {
  productName: "", serialId: "", price: "", qty: 1,
  discount: 0, discountType: "fixed",
};

// ─── Customer Serial ──────────────────────────────────────────
const CustomerSerial = {
  lastNum: 0, initialized: false, storeId: null,
  async init(storeId) {
    const sid = storeId || "default";
    if (this.initialized && this.storeId === sid) return;
    const localNum = parseInt(localStorage.getItem(`cust_serial_${sid}`) || "0", 10);
    this.lastNum = localNum;
    if (navigator.onLine) {
      try {
        const snap = await getDocs(query(
          collection(db, "customers"),
          where("storeId", "==", sid),
          where("isAutoSerial", "==", true),
          orderBy("serialNum", "desc"),
          limit(1),
        ));
        this.lastNum = Math.max(
          localNum,
          snap.empty ? 0 : (snap.docs[0].data().serialNum || 0),
        );
      } catch {}
    }
    this.initialized = true;
    this.storeId     = sid;
  },
  syncFromName(name) {
    if (!name) return;
    const m = String(name).match(/^Customer\s+(\d+)$/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > this.lastNum) {
        this.lastNum = num;
        localStorage.setItem(`cust_serial_${this.storeId || "default"}`, String(num));
      }
    }
  },
  next(storeId) {
    this.lastNum++;
    const sid = storeId || this.storeId || "default";
    localStorage.setItem(`cust_serial_${sid}`, String(this.lastNum));
    return `Customer ${this.lastNum}`;
  },
  reset() { this.initialized = false; this.storeId = null; },
};

// ─── Customer Cache ───────────────────────────────────────────
const _cc = { data: [], loaded: false, storeId: null, loading: false, loadedAt: 0 };
const CC_TTL = 120_000;

const _loadCC = async (storeId, force = false) => {
  const sid = storeId || "default";
  if (!force && _cc.loaded && _cc.storeId === sid && Date.now() - _cc.loadedAt < CC_TTL) return;
  if (_cc.loading || !navigator.onLine) return;
  _cc.loading = true;
  try {
    const snap = await getDocs(query(
      collection(db, "customers"),
      where("storeId", "==", sid),
      limit(1000),
    ));
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
    _cc.loadedAt = Date.now();
  } catch (err) {
    if (err?.code !== "unavailable") console.warn("[_loadCC]", err?.message);
  } finally { _cc.loading = false; }
};

const _enrichCC = async (storeId, billerId) => {
  if (!navigator.onLine) return;
  try {
    const snap = await getDocs(query(
      collection(db, "orders"),
      where("billerId", "==", billerId),
      limit(100),
    ));
    snap.docs.forEach((d) => {
      const c = d.data().customer || {}, key = c.phone || c.name;
      if (key && !_cc.data.find((x) => (x.phone || x.name) === key))
        _cc.data.push({
          name: c.name || "", phone: c.phone || "",
          city: c.city || "", market: c.market || "",
        });
    });
  } catch {}
};

const _searchCC = (term) => {
  if (!term || term.length < 2) return [];
  const lower = term.toLowerCase(), digits = term.replace(/\D/g, "");
  const out = [];
  for (const c of _cc.data) {
    if (
      c.name?.toLowerCase().includes(lower) ||
      (digits.length >= 3 && c.phone?.replace(/\D/g, "").includes(digits))
    ) out.push(c);
    if (out.length >= 10) break;
  }
  return out;
};

const _pushCC = (c) => {
  const key = c.phone || c.name;
  if (key && !_cc.data.find((x) => (x.phone || x.name) === key))
    _cc.data.unshift({
      name: c.name || "", phone: c.phone || "",
      city: c.city || "", market: c.market || "",
    });
};

const _saveCustomerBg = async (storeId, billerId, data, isAutoSerial = false) => {
  const phone = normalizePhone(data.phone || "");
  const name  = (data.name || "").trim();
  if (!name && !phone) return;
  const sid   = storeId || "default";
  const docId = phone
    ? `${sid}_phone_${phone}`
    : isAutoSerial
      ? `${sid}_auto_${name.replace(/\s+/g, "_").toLowerCase()}`
      : `${sid}_name_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
  try {
    await setDoc(doc(db, "customers", docId), {
      name, nameLower: name.toLowerCase(), phone, phoneNormalized: phone,
      city: data.city || "", market: data.market || "",
      storeId: sid, billerId, isAutoSerial,
      serialNum: isAutoSerial ? (parseInt(name.replace(/\D/g, ""), 10) || 0) : 0,
      isWalking: false,
      updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
    }, { merge: true });
  } catch {}
  _pushCC(data);
};

// ─── Draft helpers ────────────────────────────────────────────
const _draftKey = (sid, uid) =>
  `bill_draft_v6:${sid || "default"}:${uid || "anon"}`;

const _saveDraft = (key, p) => {
  try {
    const r = JSON.stringify(p);
    sessionStorage.setItem(key, r);
    localStorage.setItem(key, r);
  } catch {}
};

const _loadDraft = (key) => {
  try {
    const r = sessionStorage.getItem(key) || localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
};

const _clearDraft = (key) => {
  try { sessionStorage.removeItem(key); } catch {}
  try { localStorage.removeItem(key);   } catch {}
};

const _broadcastSerial = (sid, lastNum) => {
  try {
    localStorage.setItem(
      `pos_serialBroadcast_${sid || "default"}`,
      JSON.stringify({ lastSerial: lastNum, savedAt: Date.now() }),
    );
  } catch {}
};

const _cleanItem = ({ id, serialId, productName, price, qty, discount, discountType }) => ({
  id, serialId, productName, price, qty, discount, discountType,
});

// ═══════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { isDark }                 = useTheme();
  useLanguage();
  const isOnline                   = useNetworkStatus();
  const { userData, isSuperAdmin } = useAuth();
  const { settings }               = useSettings();

  // ── DOM refs ─────────────────────────────────────────────────
  const priceInputRef     = useRef(null);
  const qtyInputRef       = useRef(null);
  const phoneInputRef     = useRef(null);
  const discountInputRef  = useRef(null);
  const tableContainerRef = useRef(null);
  const nameInputRef      = useRef(null);
  const searchTimerRef    = useRef(null);
  const draftSaveTimer    = useRef(null);
  const wifiTimerRef      = useRef(null);

  // ── Logic refs (never trigger re-render) ─────────────────────
  const serialInitRef     = useRef(false);
  const draftRestoredRef  = useRef(false);
  const submittingRef     = useRef(false);
  const deleteLockRef     = useRef(false);
  const f8LockRef         = useRef(false);
  const minusUsedRef      = useRef(false);
  const activeBillRef     = useRef(false);
  const activeBillIdRef   = useRef("");
  const saveDoneRef       = useRef(false);
  const lastF8Ref         = useRef(0);
  const wasOnlineRef      = useRef(isOnline);
  const intentionalDupRef = useRef(false);
  // ✅ FIX-15: track print modal open state via ref for saveInBackground
  const printModalOpenRef = useRef(false);

  const storeIdRef   = useRef(userData?.storeId || "default");
  const userUidRef   = useRef(userData?.uid);
  const isOnlineRef  = useRef(isOnline);
  // ✅ lastEntryRef tracks the LAST SUCCESSFULLY ADDED item — never mutated by form changes
  const lastEntryRef = useRef({ price: "", qty: 1, discount: 0, discountType: "fixed" });

  // ── Settings ─────────────────────────────────────────────────
  const showProductName   = isSuperAdmin && settings?.billerUI?.showProductName === true;
  const showDiscountField = settings?.billerUI?.showDiscountField === true;
  const allowBillDiscount = settings?.discount?.allowBillDiscount === true;
  const billerFontSize    = settings?.fonts?.billerFontSize  || 16;
  const totalFontSize     = settings?.fonts?.totalFontSize   || 28;
  const invoiceFontSize   = settings?.fonts?.invoiceFontSize || 14;
  const storeId           = userData?.storeId || "default";
  const billerId          = userData?.uid;
  const showOfflineInvoice = settings?.billFlow?.showOfflineInvoice !== false;

  const userRoles = userData?.roles || (userData?.role ? [userData.role] : []);
  const isDualRole = (
    userRoles.includes("biller") || userData?.role === "biller"
  ) && (
    userRoles.includes("cashier") || userData?.role === "cashier"
  );
  const isAutoApproved = isDualRole || settings?.autoApproval?.autoApproval === true;
  const draftKey       = useMemo(() => _draftKey(storeId, billerId), [storeId, billerId]);

  // ── State ─────────────────────────────────────────────────────
  const [submitting,         setSubmitting]         = useState(false);
  const [soundEnabled,       setSoundEnabled]       = useState(true);
  const [offlineCount,       setOfflineCount]       = useState(0);
  const [store,              setStore]              = useState(null);
  const [currentDateTime,    setCurrentDateTime]    = useState(() => new Date());
  const [cashierModeActive,  setCashierModeActive]  = useState(false);
  const [directPaid,         setDirectPaid]         = useState(false);
  const [runtimeCities,      setRuntimeCities]      = useState([]);
  const [runtimeMarkets,     setRuntimeMarkets]     = useState([]);
  const [viewingOrder,       setViewingOrder]       = useState(null);
  const [showRecentOrders,   setShowRecentOrders]   = useState(false);
  const [permissions,        setPermissions]        = useState({
    showTimestamps: true, allowCancelBill: true, allowCashierMode: false,
  });
  const [screenLocked,       setScreenLocked]       = useState(true);
  const [activeBill,         setActiveBill]         = useState(false);
  const [billStartTime,      setBillStartTime]      = useState(null);
  const [billEndTime,        setBillEndTime]        = useState(null);
  const [currentBillSerial,  setCurrentBillSerial]  = useState("----");
  const [items,              setItems]              = useState([]);
  const [selectedRowIndex,   setSelectedRowIndex]   = useState(-1);
  const [lastItemId,         setLastItemId]         = useState(null);
  const [billDiscount,       setBillDiscount]       = useState(0);
  const [billDiscountType,   setBillDiscountType]   = useState("fixed");
  const [form,               setForm]               = useState(EMPTY_FORM);
  const [customer,           setCustomer]           = useState({
    name: "Walking Customer", phone: "", city: "Karachi", market: "",
  });
  const [custNameSearch,     setCustNameSearch]     = useState("");
  const [custPhoneSearch,    setCustPhoneSearch]    = useState("");
  const [custSuggestions,    setCustSuggestions]    = useState([]);
  const [showSug,            setShowSug]            = useState(false);
  const [sugLoading,         setSugLoading]         = useState(false);
  const [activeField,        setActiveField]        = useState("");
  const [f8Step,             setF8Step]             = useState(0);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showSummaryPopup,   setShowSummaryPopup]   = useState(false);
  const [showCashierPayment, setShowCashierPayment] = useState(false);
  const [paymentType,        setPaymentType]        = useState("cash");
  const [amountReceived,     setAmountReceived]     = useState("");
  const [showPrintModal,     setShowPrintModal]     = useState(false);
  const [printOrder,         setPrintOrder]         = useState(null);

  const canToggleCashierMode =
    isSuperAdmin || isDualRole || permissions.allowCashierMode;

  // ── Sync refs ─────────────────────────────────────────────────
  useEffect(() => { storeIdRef.current  = storeId;       }, [storeId]);
  useEffect(() => { userUidRef.current  = userData?.uid; }, [userData?.uid]);
  useEffect(() => { isOnlineRef.current = isOnline;      }, [isOnline]);
  // ✅ FIX-15: keep printModalOpenRef in sync
  useEffect(() => { printModalOpenRef.current = showPrintModal; }, [showPrintModal]);

  // ── Derived totals ────────────────────────────────────────────
  const totalQty = useMemo(() =>
    items.reduce((s, i) => s + Number(i.qty || 0), 0), [items]);

  const totalDiscount = useMemo(() =>
    items.reduce((s, i) => {
      const u = Number(i.price || 0), q = Number(i.qty || 0), d = Number(i.discount || 0);
      return s + (i.discountType === "percent" ? Math.round(u * q * d / 100) : d * q);
    }, 0), [items]);

  const subtotal = useMemo(() =>
    items.reduce((s, i) => {
      const u = Number(i.price || 0), q = Number(i.qty || 0), d = Number(i.discount || 0);
      const da = i.discountType === "percent" ? Math.round(u * d / 100) : d;
      return s + (u - da) * q;
    }, 0), [items]);

  const billDiscountValue = useMemo(() => {
    const v = Number(billDiscount || 0);
    return billDiscountType === "percent"
      ? Math.round(subtotal * Math.min(100, Math.max(0, v)) / 100)
      : Math.max(0, v);
  }, [billDiscount, billDiscountType, subtotal]);

  const finalTotal = useMemo(() =>
    Math.max(0, subtotal - billDiscountValue),
    [subtotal, billDiscountValue]);

  const changeAmount = useMemo(() => {
    const r = Number(amountReceived || 0);
    return r > finalTotal ? r - finalTotal : 0;
  }, [amountReceived, finalTotal]);

  const hasAnyDiscount = useMemo(() =>
    items.some((i) => Number(i.discount || 0) > 0), [items]);

  const storeInfo = useMemo(() => ({
    name:    settings?.store?.name    || store?.name    || "STORE",
    tagline: settings?.store?.tagline || store?.tagline || "",
    address: settings?.store?.address || store?.address || "",
    phone:   settings?.store?.phone   || store?.phone   || "",
    ntn:     settings?.store?.ntn     || store?.ntn     || "",
  }), [settings?.store, store]);

  // ── Helpers ───────────────────────────────────────────────────
  const play = useCallback(
    (n) => { if (soundEnabled) playSound(n); },
    [soundEnabled],
  );

  const showToast = useCallback((text, type = "warning") => {
    if      (type === "success") toast.success(text, { duration: 1800 });
    else if (type === "error")   toast.error(text,   { duration: 2500 });
    else                         toast(text, { duration: 1800, icon: "⚠️" });
  }, []);

  const logClearedData = useCallback((cleared, reason) => {
    if (!cleared?.length) return;
    addDoc(collection(db, "clearedData"), {
      serialNo:   currentBillSerial,
      items:      cleared.map(_cleanItem),
      reason,
      billerName: userData?.name || "Unknown",
      billerId:   billerId || null,
      storeId,
      deletedAt: serverTimestamp(),
      date:      new Date().toISOString().split("T")[0],
    }).catch(() => {});
  }, [currentBillSerial, userData, billerId, storeId]);

  const logClearedBill = useCallback((billItems, reason) => {
    if (!billItems?.length) return;
    addDoc(collection(db, "clearedBills"), {
      serialNo:   currentBillSerial,
      items:      billItems.map(_cleanItem),
      reason,
      customer:   { ...customer },
      billerName: userData?.name || "Unknown",
      billerId:   billerId || null,
      storeId,
      deletedAt: serverTimestamp(),
      date:      new Date().toISOString().split("T")[0],
    }).catch(() => {});
  }, [currentBillSerial, customer, userData, billerId, storeId]);

  const fmtTime = useCallback((d) => {
    if (!d) return "--:--:--";
    const dd = d instanceof Date ? d : new Date(d);
    if (isNaN(dd)) return "--:--:--";
    return dd.toLocaleTimeString("en-PK", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  }, []);

  const refreshOfflineCount = useCallback(() => {
    getOfflineOrdersCount().then(setOfflineCount).catch(() => {});
  }, []);

  const refreshSerial = useCallback(async (sid) => {
    try {
      const next = await getPlaceholderSerial(sid || storeIdRef.current);
      activeBillIdRef.current = next;
      setCurrentBillSerial(next);
      return next;
    } catch { return null; }
  }, []);

  // ── Draft ─────────────────────────────────────────────────────
  const saveDraft = useCallback(() => {
    const idle = screenLocked && items.length === 0 && !activeBill;
    if (idle) { _clearDraft(draftKey); return; }
    _saveDraft(draftKey, {
      v: 6, screenLocked, activeBill,
      currentBillSerial: activeBillIdRef.current || currentBillSerial,
      items,
      selectedRowIndex, lastItemId,
      billDiscount, billDiscountType,
      customer, custNameSearch, custPhoneSearch,
      f8Step, paymentType, amountReceived,
      billStartTime: billStartTime ? new Date(billStartTime).toISOString() : null,
      billEndTime:   billEndTime   ? new Date(billEndTime).toISOString()   : null,
    });
  }, [
    draftKey, screenLocked, activeBill, currentBillSerial,
    items, selectedRowIndex, lastItemId, billDiscount, billDiscountType,
    customer, custNameSearch, custPhoneSearch,
    f8Step, paymentType, amountReceived, billStartTime, billEndTime,
  ]);

  useEffect(() => {
    if (!userData?.uid) return;
    clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(saveDraft, 200);
    return () => clearTimeout(draftSaveTimer.current);
  }, [saveDraft, userData?.uid]);

  // ✅ FIX-14: reset lastEntryRef on draft restore
  const restoreDraft = useCallback(() => {
    if (draftRestoredRef.current) return false;
    const d = _loadDraft(draftKey);
    if (!d || d.v !== 6) return false;
    draftRestoredRef.current = true;
    const isActive = !!d.activeBill || !!(d.items?.length) || !d.screenLocked;
    activeBillRef.current   = isActive;
    activeBillIdRef.current = d.currentBillSerial || "";
    setActiveBill(isActive);
    CustomerSerial.syncFromName(d.customer?.name || "");
    setScreenLocked(d.screenLocked ?? true);
    setCurrentBillSerial(d.currentBillSerial || "----");
    setItems(Array.isArray(d.items) ? d.items : []);
    setSelectedRowIndex(typeof d.selectedRowIndex === "number" ? d.selectedRowIndex : -1);
    setLastItemId(d.lastItemId || null);
    setBillDiscount(d.billDiscount || 0);
    setBillDiscountType(d.billDiscountType || "fixed");
    setForm(EMPTY_FORM);
    // ✅ FIX-14: always reset lastEntryRef so ghost duplicates can't appear
    lastEntryRef.current = { price: "", qty: 1, discount: 0, discountType: "fixed" };
    setCustomer(d.customer || { name: "Walking Customer", phone: "", city: "Karachi", market: "" });
    setCustNameSearch(d.custNameSearch  || "");
    setCustPhoneSearch(d.custPhoneSearch || "");
    setF8Step(d.f8Step || 0);
    setPaymentType(d.paymentType   || "cash");
    setAmountReceived(d.amountReceived || "");
    setBillStartTime(d.billStartTime ? new Date(d.billStartTime) : null);
    setBillEndTime(d.billEndTime     ? new Date(d.billEndTime)   : null);
    return true;
  }, [draftKey]);

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (serialInitRef.current || !userData?.uid) return;
    serialInitRef.current = true;
    (async () => {
      const sid = storeIdRef.current;
      await CustomerSerial.init(sid).catch(() => {});
      if (navigator.onLine) await _loadCC(sid).catch(() => {});
      const restored = restoreDraft();
      if (!restored) {
        await refreshSerial(sid).catch(() => {});
      } else if (activeBillRef.current && activeBillIdRef.current) {
        // ✅ draft restored with active bill — keep its serial, don't overwrite
        setCurrentBillSerial(activeBillIdRef.current);
      }
    })();
  }, [userData?.uid, restoreDraft, refreshSerial]);

  useEffect(() => () => {
    serialInitRef.current    = false;
    draftRestoredRef.current = false;
    CustomerSerial.reset();
    _cc.loaded = false; _cc.storeId = null;
    clearTimeout(wifiTimerRef.current);
  }, [userData?.uid]);

  // cross-tab serial sync
  useEffect(() => {
    const handler = (e) => {
      const sid         = storeIdRef.current || "default";
      const isSerial    = e.key === `pos_lastSerial_${sid}`;
      const isBroadcast = e.key === `pos_serialBroadcast_${sid}`;
      if (!isSerial && !isBroadcast) return;
      if (!e.newValue) return;
      try {
        let lastNum = 0;
        if (isBroadcast) {
          const data = JSON.parse(e.newValue);
          lastNum = data?.lastSerial || 0;
        } else {
          lastNum = parseInt(e.newValue, 10) || 0;
        }
        if (lastNum <= 0) return;
        localStorage.setItem(`pos_lastSerial_${sid}`, String(lastNum));
        const nextPreview = fmt4(lastNum + 1);
        if (!activeBillRef.current) {
          activeBillIdRef.current = nextPreview;
          setCurrentBillSerial(nextPreview);
        }
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ✅ FIX-1: WiFi ON/OFF — ZERO bill mutations
  useEffect(() => {
    const prev = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (prev === isOnline) return;

    if (!isOnline) {
      toast("📴 Offline — bills save locally", { duration: 2500, icon: "📴" });
      return;
    }

    toast.success("🌐 Back online!", { duration: 1500 });
    clearTimeout(wifiTimerRef.current);
    wifiTimerRef.current = setTimeout(async () => {
      const sid = storeIdRef.current;
      const uid = userUidRef.current;

      try {
        const result = await syncOfflineOrders();
        if (result?.synced > 0) {
          toast.success(`✅ ${result.synced} bills synced!`, { duration: 3000 });
          getOfflineOrdersCount().then(setOfflineCount).catch(() => {});
        }
      } catch {}

      // ✅ CRITICAL: never touch serial if a bill is active
      if (!activeBillRef.current) {
        try {
          const next = await getPlaceholderSerial(sid);
          activeBillIdRef.current = next;
          setCurrentBillSerial(next);
        } catch {}
      }

      try { const s = await getStoreById(sid); if (s) setStore(s); } catch {}
      if (uid) {
        _loadCC(sid, true).catch(() => {});
        _enrichCC(sid, uid).catch(() => {});
      }
    }, 600);

    return () => clearTimeout(wifiTimerRef.current);
  }, [isOnline]);

  useEffect(() => {
    if (!userData?.uid) return;
    if (isOnline) {
      getStoreById(storeId).then((s) => { if (s) setStore(s); }).catch(() => {});
      _enrichCC(storeId, userData.uid).catch(() => {});
    }
    refreshOfflineCount();
  }, [storeId, userData?.uid, isOnline, refreshOfflineCount]);

  useEffect(() => {
    const t = setInterval(refreshOfflineCount, 30_000);
    return () => clearInterval(t);
  }, [refreshOfflineCount]);

  useEffect(() => {
    const t = setInterval(() => setCurrentDateTime(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!screenLocked)
      requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [screenLocked]);

  useEffect(() => {
    if (store?.billerPermissions)
      setPermissions((p) => ({ ...p, ...store.billerPermissions }));
  }, [store]);

  useEffect(() => {
    if (settings?.customer?.defaultCustomerName && !activeBillRef.current)
      setCustomer((p) => ({ ...p, name: settings.customer.defaultCustomerName }));
  }, [settings?.customer?.defaultCustomerName]);

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

  // ✅ FIX-13: resetBill — clean, NO contradictory re-activation
  const resetBill = useCallback(() => {
    if (activeBillIdRef.current) resetPersistedCustomer(activeBillIdRef.current);

    activeBillRef.current     = false;
    activeBillIdRef.current   = "";
    submittingRef.current     = false;
    f8LockRef.current         = false;
    minusUsedRef.current      = false;
    deleteLockRef.current     = false;
    saveDoneRef.current       = false;
    lastF8Ref.current         = 0;
    intentionalDupRef.current = false;

    setActiveBill(false);
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
    setForm(EMPTY_FORM);
    lastEntryRef.current = { price: "", qty: 1, discount: 0, discountType: "fixed" };
    setBillDiscount(0);
    setBillDiscountType("fixed");
    setF8Step(0);
    setShowCustomerDialog(false);
    setShowSummaryPopup(false);
    setShowCashierPayment(false);
    setPaymentType("cash");
    setAmountReceived("");
    _clearDraft(draftKey);
    // ✅ No setTimeout re-activation — WiFi protection is in the isOnline useEffect
  }, [settings?.customer?.defaultCustomerName, draftKey]);

  const _afterClear = useCallback(async () => {
    saveDoneRef.current = false;
    resetBill();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    play("delete");
    await refreshSerial(storeIdRef.current);
  }, [resetBill, play, refreshSerial]);

  // ── Customer search ───────────────────────────────────────────
  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setCustSuggestions([]); setShowSug(false); setSugLoading(false); return;
    }
    const mem = _searchCC(term);
    if (mem.length > 0) {
      setCustSuggestions(mem); setShowSug(true); setSugLoading(false); return;
    }
    setSugLoading(true); setShowSug(true);
    await _loadCC(storeIdRef.current);
    const results = _searchCC(term);
    setCustSuggestions(results);
    setShowSug(results.length > 0);
    setSugLoading(false);
  }, []);

  const onNameChange = useCallback((v) => {
    setCustNameSearch(v);
    setCustomer((p) => ({ ...p, name: v }));
    setActiveField("name");
    clearTimeout(searchTimerRef.current);
    if (!v || v.length < 2) { setCustSuggestions([]); setShowSug(false); return; }
    searchTimerRef.current = setTimeout(() => doSearch(v), 150);
  }, [doSearch]);

  const onPhoneChange = useCallback((raw) => {
    const clean = raw.replace(/[^0-9+]/g, "");
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
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, []);

  const openCustDialog = useCallback(() => {
    if (screenLocked) { showToast("Press INSERT first.", "error"); return; }
    setShowCustomerDialog(true); setF8Step(1); play("keyPress");
  }, [screenLocked, play, showToast]);

  const openCustDialogAlways = useCallback(() => {
    setShowCustomerDialog(true);
    if (!screenLocked && items.length > 0) setF8Step(1);
    play("keyPress");
  }, [screenLocked, items.length, play]);

  // ── Item management ───────────────────────────────────────────

  // ✅ FIX-10: handleFormQtyChange NEVER touches existing table items
  // ✅ FIX-12: sets intentionalDupRef so duplicate knows to use form qty
  const handleFormQtyChange = useCallback((v) => {
    const cleaned = String(v).replace(/\D/g, "");
    if (cleaned === "") {
      setForm((p) => ({ ...p, qty: "" }));
      return;
    }
    const numQty = Math.max(1, parseInt(cleaned, 10) || 1);
    setForm((p) => ({ ...p, qty: numQty }));
    // If price is blank, user is setting qty for an upcoming duplicate
    if (!form.price || form.price === "") {
      intentionalDupRef.current = true;
    }
  }, [form.price]);

  // ✅ FIX-11: always new row — no silent price-merge
  // ✅ FIX-12: duplicate uses form qty when intentionalDupRef is set
  const handleAddItem = useCallback(() => {
    if (screenLocked) {
      showToast("Press INSERT to start.", "error"); play("error"); return;
    }

    const rawPrice   = String(form.price ?? "").trim();
    const priceEmpty = rawPrice === "";
    const price      = Number(rawPrice);
    const priceValid = !priceEmpty && Number.isFinite(price) && price > 0;
    // qty defaults to 1 if blank/invalid
    const formQty    = Number(form.qty);
    const qtyVal     = formQty > 0 ? formQty : 1;

    // ── CASE A: price is blank → duplicate last item ───────────
    if (priceEmpty) {
      if (!items.length) {
        showToast("Enter a price first.", "warning"); play("error"); return;
      }
      const lastListItem = items[items.length - 1];
      // ✅ FIX-12: use form qty if user explicitly typed one; else copy last item's qty
      const dupQty = intentionalDupRef.current ? qtyVal : lastListItem.qty;

      const newItem = {
        id:           Date.now(),
        serialId:     getNextItemSerial(),
        productName:  lastListItem.productName,
        price:        lastListItem.price,
        qty:          dupQty,
        discount:     lastListItem.discount,
        discountType: lastListItem.discountType,
      };

      setItems((p) => [...p, newItem]);
      setLastItemId(newItem.id);
      minusUsedRef.current      = false;
      intentionalDupRef.current = false;
      play("add");
      showToast(
        `✅ Duplicated: Rs.${lastListItem.price?.toLocaleString()} ×${dupQty}`,
        "success",
      );
      setForm((prev) => ({ ...prev, price: "", qty: 1 }));
      requestAnimationFrame(() => priceInputRef.current?.focus());
      return;
    }

    // ── CASE B: price present but invalid ──────────────────────
    if (!priceValid) {
      showToast("Valid price required.", "error"); play("error");
      priceInputRef.current?.focus(); return;
    }
    if (qtyVal <= 0) {
      showToast("Enter quantity first.", "warning"); play("error");
      qtyInputRef.current?.focus(); return;
    }
    if (showProductName && !(form.productName || "").trim()) {
      showToast("Product name required.", "error"); play("error"); return;
    }

    // ── CASE C: valid price → always add a NEW row ─────────────
    const discountRaw = form.discount !== ""
      ? Number(form.discount)
      : (Number(lastEntryRef.current.discount) || 0);
    const discType = form.discountType || lastEntryRef.current.discountType || "fixed";
    const discAmt  = discType === "percent"
      ? Math.min(100, Math.max(0, discountRaw))
      : Math.max(0, discountRaw);
    const serialId = (form.serialId || "").trim() || getNextItemSerial();
    const prodName = showProductName
      ? (form.productName || "").trim()
      : `Item ${fmtItemSerial(items.length + 1)}`;

    const newItem = {
      id: Date.now(), serialId, productName: prodName,
      price, qty: qtyVal, discount: discAmt, discountType: discType,
    };

    setItems((prev) => [...prev, newItem]);
    setLastItemId(newItem.id);
    minusUsedRef.current      = false;
    intentionalDupRef.current = false;

    // ✅ update lastEntryRef ONLY when a real item is added
    lastEntryRef.current = {
      price: String(price), qty: qtyVal, discount: discAmt, discountType: discType,
    };

    setForm({
      productName: "", serialId: "", price: "", qty: 1,
      discount: discAmt, discountType: discType,
    });
    setSelectedRowIndex(-1);
    play("add");
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [form, screenLocked, items, showProductName, play, showToast]);

  const deleteRow = useCallback((id) => {
    if (screenLocked) { play("error"); return; }
    const item = items.find((i) => i.id === id);
    if (item) logClearedData([item], "row_deleted");
    setItems((p) => p.filter((i) => i.id !== id));
    setSelectedRowIndex(-1);
    minusUsedRef.current = false;
    play("delete");
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [screenLocked, items, play, logClearedData]);

  const changeQty = useCallback((id, v) => {
    if (screenLocked) return;
    const n = parseInt(String(v).replace(/\D/g, ""), 10);
    setItems((p) => p.map((i) =>
      i.id === id ? { ...i, qty: Math.max(1, n || 1) } : i,
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

  // ── Bill actions ──────────────────────────────────────────────
  const clearBill = useCallback(() => {
    if (screenLocked) { play("error"); return; }
    if (items.length > 0) {
      logClearedData(items, "bill_cleared");
      recordBillDeletion({
        serialNo: currentBillSerial,
        items: items.map(_cleanItem),
        customer, totalAmount: subtotal,
        totalDiscount, totalQty, billStartTime, billEndTime,
        billerName: userData?.name, billerId, storeId, reason: "bill_cleared",
      }, storeId, isOnline).catch(() => {});
    }
    showToast("Bill cleared.", "success");
    _afterClear();
  }, [
    screenLocked, items, currentBillSerial, subtotal, totalDiscount, totalQty,
    customer, billStartTime, billEndTime, userData, billerId, storeId, isOnline,
    play, logClearedData, showToast, _afterClear,
  ]);

  const cancelBill = useCallback(() => {
    if (!items.length) { showToast("No bill to cancel.", "warning"); return; }
    if (!window.confirm("Cancel this bill?")) return;
    logClearedBill(items, "bill_cancelled");
    recordBillDeletion({
      serialNo: currentBillSerial,
      items: items.map(_cleanItem),
      customer, totalAmount: subtotal,
      totalDiscount, totalQty, billStartTime, billEndTime,
      billerName: userData?.name, billerId, storeId, reason: "bill_cancelled",
    }, storeId, isOnline).catch(() => {});
    showToast("Bill cancelled.", "success");
    _afterClear();
  }, [
    items, currentBillSerial, subtotal, totalDiscount, totalQty, customer,
    billStartTime, billEndTime, userData, billerId, storeId, isOnline,
    logClearedBill, showToast, _afterClear,
  ]);

  const resolveCustomerName = useCallback((cust) => {
    const name  = (cust.name || "").trim();
    const phone = normalizePhone(cust.phone || "");
    const isWalking = !name ||
      name.toLowerCase() === "walking customer" ||
      name.toLowerCase() === "walk-in";
    if (isWalking && !phone)
      return { resolved: CustomerSerial.next(storeId), isAutoSerial: true };
    if (!name && phone)
      return { resolved: CustomerSerial.next(storeId), isAutoSerial: true };
    return { resolved: name, isAutoSerial: false };
  }, [storeId]);

  // ── Save in background ────────────────────────────────────────
  const saveInBackground = useCallback((snapshot) => {
    queueMicrotask(async () => {
      try {
        const { resolved: resolvedName, isAutoSerial } =
          resolveCustomerName(snapshot.customer);

        const preparedItems = snapshot.items.map((item) => {
          const da = item.discountType === "percent"
            ? Math.round(item.price * item.discount / 100)
            : item.discount;
          return {
            serialId:     item.serialId    || "",
            productName:  item.productName || "",
            price:        Number(item.price),
            qty:          Number(item.qty),
            discount:     Number(item.discount),
            discountType: item.discountType || "fixed",
            total:        (Number(item.price) - da) * Number(item.qty),
          };
        });

        const orderData = {
          customer: {
            name:   resolvedName,
            phone:  (snapshot.customer.phone  || "").trim(),
            city:   snapshot.customer.city    || "Karachi",
            market: snapshot.customer.market  || "",
          },
          items:             preparedItems,
          totalQty:          snapshot.totalQty,
          subtotal:          snapshot.subtotal,
          totalDiscount:     snapshot.totalDiscount,
          billDiscount:      snapshot.billDiscountValue,
          totalAmount:       snapshot.finalTotal,
          paymentType:       snapshot.overridePayment?.type     || null,
          amountReceived:    snapshot.overridePayment?.received || null,
          changeGiven:       snapshot.overridePayment?.change   || null,
          status:            snapshot.isAutoApproved ? "approved" : "pending",
          cashierHandover:   !snapshot.isAutoApproved,
          billerSubmittedAt: serverTimestamp(),
          billerName:        snapshot.billerName || "Unknown",
          billerId:          snapshot.billerId   || null,
          storeId:           snapshot.storeId,
          billStartTime:     snapshot.billStartTime?.toISOString() || null,
          billEndTime:       snapshot.billEndTime.toISOString(),
          createdAt:         serverTimestamp(),
        };

        const result = await saveOrder(orderData, snapshot.isOnline);
        if (!result.success && result.duplicate) {
          toast.error("Duplicate bill.", { duration: 2500 }); return;
        }

        const realSerial = result.serialNo || "----";
        const sid        = snapshot.storeId || "default";

        setPrintOrder((prev) => {
          if (!prev) return prev;
          return { ...prev, serialNo: realSerial, billSerial: realSerial };
        });

        // ✅ FIX-15: don't advance serial while print modal is open
        if (!activeBillRef.current && !printModalOpenRef.current) {
          try {
            const next = await getPlaceholderSerial(sid);
            activeBillIdRef.current = next;
            setCurrentBillSerial(next);
          } catch {}
        }

        const lastNum = parseInt(realSerial, 10);
        if (lastNum > 0) _broadcastSerial(sid, lastNum);

        queueMicrotask(() => {
          _saveCustomerBg(
            snapshot.storeId, snapshot.billerId,
            {
              name:   resolvedName,
              phone:  (snapshot.customer.phone  || "").trim(),
              city:   snapshot.customer.city    || "",
              market: snapshot.customer.market  || "",
            },
            isAutoSerial,
          );
          if (!result.offline && result.id)
            createAuditLog(
              { ...orderData, id: result.id, serialNo: realSerial },
              "ORDER_SUBMITTED",
              snapshot.billerId,
            ).catch(() => {});
          if (snapshot.isOnline) syncOfflineOrders().catch(() => {});
        });

        if (result.offline) {
          play("offline");
          toast(`📴 Bill #${realSerial} saved OFFLINE.`, { duration: 2500, icon: "📴" });
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
        console.error("[Dashboard] saveInBackground:", err);
        toast.error(getFriendlyError(err), { duration: 3000 });
        play("error");
      }
    });
  }, [play, resolveCustomerName]);

  // ── Finalize ──────────────────────────────────────────────────
  const finalizeAndPrint = useCallback((overridePayment = null) => {
    if (saveDoneRef.current || submittingRef.current) return;
    if (!items.length) { showToast("Add at least one item.", "error"); return; }

    saveDoneRef.current   = true;
    submittingRef.current = true;
    f8LockRef.current     = true;
    const endTime         = new Date();
    const displaySerial   = activeBillIdRef.current || currentBillSerial;

    const snapshot = {
      items:            items.map(_cleanItem),
      customer:         { ...customer },
      totalQty, subtotal, totalDiscount, billDiscountValue, finalTotal,
      billStartTime,
      billEndTime:      endTime,
      billerName:       userData?.name,
      storeId, billerId, isAutoApproved,
      isOnline:         isOnlineRef.current,
      overridePayment,
    };

    const orderForPrint = {
      serialNo:      displaySerial,
      billSerial:    displaySerial,
      customer:      { ...customer },
      items:         items.map(_cleanItem),
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

    setShowSummaryPopup(false);
    setShowCustomerDialog(false);
    setShowCashierPayment(false);
    setF8Step(0);
    resetBill();
    setScreenLocked(true);
    setBillStartTime(null);
    setBillEndTime(null);
    setSubmitting(false);
    submittingRef.current = false;
    setCurrentBillSerial(displaySerial);

    if (isOnlineRef.current || showOfflineInvoice) {
      setPrintOrder(orderForPrint);
      setShowPrintModal(true);
    }
    saveInBackground(snapshot);
  }, [
    items, customer, totalQty, subtotal, totalDiscount, billDiscountValue, finalTotal,
    billStartTime, userData, storeId, billerId, isAutoApproved, showOfflineInvoice,
    currentBillSerial, showToast, resetBill, saveInBackground,
  ]);

  const onPrintClose = useCallback(() => {
    setShowPrintModal(false);
    setPrintOrder(null);
    f8LockRef.current = false;
  }, []);

  const onCustomerSubmit = useCallback((cData) => {
    setCustomer(cData);
    setCustNameSearch(cData.name   || "");
    setCustPhoneSearch(cData.phone || "");
    setShowCustomerDialog(false);
    if (items.length > 0 && !screenLocked) { setShowSummaryPopup(true); setF8Step(2); }
    f8LockRef.current = false;
    play("keyPress");
    queueMicrotask(() => {
      const phone = normalizePhone(cData.phone || "");
      const name  = (cData.name || "").trim();
      if ((name && name.toLowerCase() !== "walking customer") || phone)
        _saveCustomerBg(storeId, billerId, cData, false);
    });
  }, [play, items.length, screenLocked, storeId, billerId]);

  const onSummaryProceed = useCallback(() => {
    setShowSummaryPopup(false);
    setBillEndTime(new Date());
    if (isDualRole || cashierModeActive) {
      setShowCashierPayment(true); setF8Step(4); f8LockRef.current = false;
    } else {
      finalizeAndPrint();
    }
    play("keyPress");
  }, [isDualRole, cashierModeActive, play, finalizeAndPrint]);

  const onCashierConfirm = useCallback(() => {
    if (saveDoneRef.current) return;
    const received = Number(amountReceived || 0);
    if (paymentType === "cash" && received < finalTotal) {
      showToast("Amount less than total.", "error"); return;
    }
    setShowCashierPayment(false);
    finalizeAndPrint({
      type:     paymentType,
      received: paymentType === "cash" ? received : finalTotal,
      change:   paymentType === "cash" ? Math.max(0, received - finalTotal) : 0,
    });
  }, [amountReceived, finalTotal, paymentType, showToast, finalizeAndPrint]);

  // ── Keyboard handlers ─────────────────────────────────────────
  const handleF8 = useCallback(() => {
    if (saveDoneRef.current) return;
    const now = Date.now();
    if (now - lastF8Ref.current < 300) return;
    lastF8Ref.current = now;
    if (f8LockRef.current) return;
    f8LockRef.current = true;
    if (showPrintModal) { onPrintClose(); f8LockRef.current = false; return; }
    if (!items.length) { showToast("Add items first.", "error"); f8LockRef.current = false; return; }
    switch (f8Step) {
      case 0: openCustDialog(); setTimeout(() => { f8LockRef.current = false; }, 300); break;
      case 1: f8LockRef.current = false; break;
      case 2: if (showSummaryPopup) onSummaryProceed(); else f8LockRef.current = false; break;
      case 4: onCashierConfirm(); break;
      default: openCustDialog(); setTimeout(() => { f8LockRef.current = false; }, 300);
    }
  }, [
    f8Step, items.length, showPrintModal, showSummaryPopup,
    openCustDialog, onSummaryProceed, onPrintClose, onCashierConfirm, showToast,
  ]);

  const handleEscape = useCallback(() => {
    if (showPrintModal)     { onPrintClose(); return; }
    if (showCashierPayment) {
      setShowCashierPayment(false); f8LockRef.current = false;
      setShowSummaryPopup(true); setF8Step(2); return;
    }
    if (f8Step === 2 && showSummaryPopup) {
      setShowSummaryPopup(false); setShowCustomerDialog(true);
      setF8Step(1); f8LockRef.current = false; return;
    }
    if (showCustomerDialog) {
      setShowCustomerDialog(false); setF8Step(0); f8LockRef.current = false;
      requestAnimationFrame(() => priceInputRef.current?.focus()); return;
    }
    if (showSug) {
      setShowSug(false); setCustSuggestions([]); setActiveField("");
      requestAnimationFrame(() => priceInputRef.current?.focus()); return;
    }
    setSelectedRowIndex(-1); setShowSug(false); priceInputRef.current?.focus();
  }, [f8Step, showPrintModal, showSummaryPopup, showCustomerDialog, showCashierPayment, showSug, onPrintClose]);

  const handleInsert = useCallback(() => {
    if (screenLocked) {
      if (submittingRef.current) { showToast("Bill is saving...", "warning"); return; }
      saveDoneRef.current       = false;
      submittingRef.current     = false;
      f8LockRef.current         = false;
      minusUsedRef.current      = false;
      deleteLockRef.current     = false;
      intentionalDupRef.current = false;
      activeBillRef.current     = true;
      setActiveBill(true);
      getPlaceholderSerial(storeIdRef.current)
        .then((next) => { activeBillIdRef.current = next; setCurrentBillSerial(next); })
        .catch(() => {});
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
      setForm(EMPTY_FORM);
      lastEntryRef.current = { price: "", qty: 1, discount: 0, discountType: "fixed" };
      play("unlock");
      showToast("✅ New bill started.", "success");
      requestAnimationFrame(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      });
      return;
    }
    if (items.length > 0) {
      requestAnimationFrame(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      });
      return;
    }
    if (!activeBillRef.current) {
      saveDoneRef.current   = false;
      activeBillRef.current = true;
      setActiveBill(true);
      setBillStartTime(new Date());
      getPlaceholderSerial(storeIdRef.current)
        .then((next) => { activeBillIdRef.current = next; setCurrentBillSerial(next); })
        .catch(() => {});
    }
    requestAnimationFrame(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    });
  }, [screenLocked, items.length, showToast, play]);

  const handleMinus = useCallback(() => {
    if (screenLocked || !items.length) { play("error"); return; }
    if (deleteLockRef.current) return;
    deleteLockRef.current = true;
    setTimeout(() => { deleteLockRef.current = false; }, 200);
    const last = items[items.length - 1];
    if (!last) { play("error"); return; }
    logClearedData([last], "minus_key_deleted");
    setItems((p) => p.slice(0, -1));
    setSelectedRowIndex(-1);
    minusUsedRef.current = false;
    play("delete");
    showToast(`Deleted: Rs.${last.price?.toLocaleString()} ×${last.qty}`, "warning");
    requestAnimationFrame(() => priceInputRef.current?.focus());
  }, [screenLocked, items, play, logClearedData, showToast]);

  // ✅ FIX-5: Delete key — blocked when focus is inside a table input
  const handleDelete = useCallback(() => {
    if (screenLocked) { play("error"); return; }
    if (!items.length) { showToast("Bill is already empty.", "warning"); return; }
    
    // Show confirmation toast instead of window.confirm
    const toastId = toast((t) => (
      <div className="flex flex-col gap-2">
        <div className="font-bold">🗑️ Clear Bill?</div>
        <p className="text-sm">Remove all {items.length} item(s) from current bill?</p>
        <div className="flex gap-2">
          <button
            onClick={() => { toast.dismiss(t.id); clearBill(); }}
            className="flex-1 bg-red-500 text-white px-3 py-1 rounded font-semibold text-sm hover:bg-red-600"
          >
            Clear
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-1 bg-gray-400 text-white px-3 py-1 rounded font-semibold text-sm hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000, style: { background: isDark ? "#1a1208" : "#fff", color: isDark ? "#f5f5f5" : "#000" } });
  }, [clearBill, screenLocked, items.length, play, showToast, isDark]);

  // ── Shortcuts ─────────────────────────────────────────────────
  const shortcuts = useMemo(() => ({
    Insert:         handleInsert,
    F8:             handleF8,
    Escape:         handleEscape,
    Home:           () => { if (!screenLocked) phoneInputRef.current?.focus(); },
    End:            () => window.open(window.location.href, "_blank"),
    Delete:         handleDelete,
    ArrowUp:        () => { if (items.length) setSelectedRowIndex((p) => p <= 0 ? items.length - 1 : p - 1); },
    ArrowDown:      () => { if (items.length) setSelectedRowIndex((p) => p >= items.length - 1 ? 0 : p + 1); },
    PageUp:         () => { if (items.length) setSelectedRowIndex((p) => Math.max(0, (p < 0 ? items.length - 1 : p) - 5)); },
    PageDown:       () => { if (items.length) setSelectedRowIndex((p) => Math.min(items.length - 1, (p < 0 ? 0 : p) + 5)); },
    numpadAdd:      () => { if (!screenLocked) qtyInputRef.current?.focus(); },
    Minus:          handleMinus,
    numpadSubtract: handleMinus,
    numpadDivide:   () => { if (!screenLocked) discountInputRef.current?.focus(); },
    ClearCache:     () => { if (window.clearCache) window.clearCache(); },
  }), [handleInsert, handleF8, handleEscape, handleDelete, handleMinus, screenLocked, items.length]);

  useKeyboardShortcuts(shortcuts, true);

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

  const cardClass = isDark
    ? "rounded-2xl border border-yellow-500/20 bg-[#15120d]/95"
    : "rounded-2xl border border-yellow-200 bg-white";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ fontSize: `${billerFontSize}px` }}>
      <BillerHeader
        currentBillSerial={currentBillSerial} screenLocked={screenLocked}
        currentDateTime={currentDateTime} customer={customer} setCustomer={setCustomer}
        isOnline={isOnline} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled}
        onOpenCustomerDialog={openCustDialogAlways} offlineCount={offlineCount}
        items={items} billerName={userData?.name} showRecentOrders={showRecentOrders}
        toggleRecentOrders={() => setShowRecentOrders((v) => !v)}
        onViewInvoice={(order) => setViewingOrder(order)}
        canToggleCashierMode={canToggleCashierMode} cashierModeActive={cashierModeActive}
        onToggleCashierMode={() => setCashierModeActive((v) => !v)}
        isSuperAdmin={isSuperAdmin} permissions={userData?.permissions}
        onTogglePermission={togglePermission} directPaid={directPaid}
        onToggleDirectPaid={() => setDirectPaid((v) => !v)}
        storeId={storeId} billerId={billerId} store={storeInfo}
      />

      {/* Locked overlay */}
      {screenLocked && items.length === 0 && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? "bg-black/80" : "bg-white/80"}`}>
          <div className={`rounded-3xl px-8 py-10 text-center max-w-sm w-full mx-4 ${isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"}`}>
            <Lock size={44} className="mx-auto mb-3 text-yellow-500" />
            <h2 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Bill Locked</h2>
            <p className={`mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Press <kbd className="rounded-lg bg-yellow-500/20 px-3 py-1 font-mono font-bold text-yellow-500">INSERT</kbd> to start
            </p>
            {currentBillSerial !== "----" && (
              <p className={`mt-3 font-mono text-sm ${isDark ? "text-yellow-500/60" : "text-yellow-600/60"}`}>
                Next: <strong className="text-yellow-500">{currentBillSerial}</strong>
              </p>
            )}
            {!isOnline && (
              <div className="mt-4 flex items-center justify-center gap-2 text-orange-400 text-sm">
                <WifiOff size={14} /><span>Offline — bills save locally</span>
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
            <p className="font-semibold text-orange-400 text-xs">📴 Offline — Bills saved locally</p>
          </div>
          {offlineCount > 0 && (
            <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">{offlineCount} pending</span>
          )}
        </div>
      )}

      <div className="flex-1 grid gap-2 xl:grid-cols-[300px_1fr] min-h-0 px-3 mt-1 pb-2 overflow-hidden">

        {/* ── Left panel: entry form ── */}
        <section className={`${cardClass} flex flex-col overflow-hidden`}>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">

              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-yellow-500" />
                  <h2 className="font-bold text-yellow-600 text-sm">ENTRY</h2>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${screenLocked ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                  {screenLocked ? "LOCKED" : "ACTIVE"}
                </span>
              </div>

              {!screenLocked && (
                <div className={`rounded-xl p-2 border shrink-0 ${isDark ? "bg-yellow-500/5 border-yellow-500/20" : "bg-yellow-50 border-yellow-200"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Bill Serial</p>
                  <p className="text-xl font-bold text-yellow-600 font-mono">{currentBillSerial}</p>
                  {billStartTime && <p className="text-[10px] text-gray-500 mt-0.5">Started: {fmtTime(billStartTime)}</p>}
                </div>
              )}

              {showProductName && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Product Name *</label>
                  <input
                    type="text" value={form.productName}
                    onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                    disabled={screenLocked} placeholder="Product name..."
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Price *</label>
                  <input
                    ref={priceInputRef} type="text" inputMode="numeric" value={form.price}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setForm((p) => ({ ...p, price: v }));
                      // ✅ typing a price means NOT a duplicate intent
                      if (v) intentionalDupRef.current = false;
                    }}
                    onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                    onKeyDown={(e) => {
                      const ok = ["Backspace","Delete","Tab","Escape","Enter","ArrowLeft","ArrowRight"];
                      if (!ok.includes(e.key) && !/^\d$/.test(e.key) &&
                        !((e.ctrlKey || e.metaKey) && ["a","c","v","x"].includes(e.key.toLowerCase())))
                        e.preventDefault();
                      if (e.key === "Enter") { e.preventDefault(); handleAddItem(); }
                    }}
                    placeholder={lastEntryRef.current.price ? `↵ ${lastEntryRef.current.price}` : "0"}
                    disabled={screenLocked}
                    style={{ fontSize: `${Math.max(billerFontSize, 18)}px` }}
                    className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-yellow-500/30 ${isDark ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400" : "border-yellow-300 bg-white text-yellow-700"} disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Qty</label>
                  <input
                    ref={qtyInputRef} type="text" inputMode="numeric" value={form.qty}
                    onChange={(e) => handleFormQtyChange(e.target.value)}
                    onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddItem(); }
                    }}
                    disabled={screenLocked}
                    style={{ fontSize: `${Math.max(billerFontSize, 18)}px` }}
                    className={`w-full rounded-xl border px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-yellow-500/30 ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                  />
                </div>
              </div>

              {showDiscountField && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Discount / Item</label>
                  <div className="flex gap-2">
                    <input
                      ref={discountInputRef} type="number" min="0" value={form.discount}
                      onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                      onFocus={(e) => setTimeout(() => e.target.select(), 10)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                      disabled={screenLocked}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                    />
                    <button
                      onClick={() => setForm((f) => ({ ...f, discountType: f.discountType === "fixed" ? "percent" : "fixed" }))}
                      disabled={screenLocked}
                      className="px-3 rounded-xl bg-yellow-100 text-yellow-700 font-bold text-sm disabled:opacity-50"
                    >
                      {form.discountType === "percent" ? "%" : "Rs"}
                    </button>
                  </div>
                </div>
              )}

              <hr className={isDark ? "border-yellow-500/10" : "border-yellow-100"} />

              {/* Customer name */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Customer Name</label>
                <div className="relative">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        ref={nameInputRef} type="text" value={custNameSearch || customer.name}
                        onChange={(e) => onNameChange(e.target.value)}
                        onFocus={() => {
                          setActiveField("name");
                          const v = custNameSearch || customer.name;
                          if (v.length >= 2 && v !== "Walking Customer") doSearch(v);
                        }}
                        onBlur={() => setTimeout(() => { if (activeField === "name") { setShowSug(false); setActiveField(""); } }, 200)}
                        disabled={screenLocked} placeholder="Customer name"
                        className={`w-full rounded-xl border pl-8 pr-3 py-2 text-sm outline-none ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                      />
                    </div>
                    <button onClick={openCustDialogAlways} className={`px-2.5 rounded-xl border ${isDark ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                      <User size={14} />
                    </button>
                  </div>
                  {showSug && activeField === "name" && (
                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-xl max-h-44 overflow-y-auto ${isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"}`}>
                      {sugLoading
                        ? <div className="flex items-center justify-center py-3 gap-2"><Loader2 size={13} className="animate-spin text-yellow-500" /><span className="text-xs text-gray-400">Searching...</span></div>
                        : custSuggestions.length > 0
                          ? custSuggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => onSelectSuggestion(c)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-500/10 border-b last:border-0 ${isDark ? "text-white border-yellow-500/10" : "text-gray-900 border-gray-100"}`}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{c.name || "No Name"}</span>
                                {c.phone && <span className={`text-xs font-mono ${isDark ? "text-yellow-400" : "text-yellow-600"}`}>{c.phone}</span>}
                              </div>
                              {c.city && <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{c.city}{c.market ? ` • ${c.market}` : ""}</span>}
                            </button>
                          ))
                          : <div className={`px-3 py-3 text-xs text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>No record found</div>
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Customer phone */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Phone <span className="text-gray-400">(Home)</span></label>
                <div className="relative">
                  <input
                    ref={phoneInputRef} type="tel" inputMode="numeric" value={custPhoneSearch}
                    onChange={(e) => onPhoneChange(e.target.value.replace(/[^0-9+]/g, ""))}
                    onFocus={() => { setActiveField("phone"); if (custPhoneSearch.length >= 3) doSearch(custPhoneSearch); }}
                    onBlur={() => setTimeout(() => { if (activeField === "phone") { setShowSug(false); setActiveField(""); } }, 200)}
                    disabled={screenLocked} placeholder="03XX-XXXXXXX"
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                  />
                  {showSug && activeField === "phone" && (
                    <div className={`absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border shadow-xl max-h-44 overflow-y-auto ${isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"}`}>
                      {sugLoading
                        ? <div className="flex items-center justify-center py-3 gap-2"><Loader2 size={13} className="animate-spin text-yellow-500" /><span className="text-xs text-gray-400">Searching...</span></div>
                        : custSuggestions.length > 0
                          ? custSuggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => onSelectSuggestion(c)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-500/10 border-b last:border-0 ${isDark ? "text-white border-yellow-500/10" : "text-gray-900 border-gray-100"}`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-mono font-bold ${isDark ? "text-yellow-400" : "text-yellow-600"}`}>{c.phone}</span>
                                <span className="font-medium">{c.name || "No Name"}</span>
                              </div>
                              {c.city && <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>{c.city}{c.market ? ` • ${c.market}` : ""}</span>}
                            </button>
                          ))
                          : <div className={`px-3 py-3 text-xs text-center ${isDark ? "text-gray-500" : "text-gray-400"}`}>No record found</div>
                      }
                    </div>
                  )}
                </div>
              </div>

              <button onClick={handleAddItem} disabled={screenLocked}
                className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 active:scale-95 transition-transform">
                ➕ Add Item (Enter)
              </button>

              {lastEntryRef.current.price && (
                <p className="text-center text-[10px] text-gray-400">
                  ↵ Rs.{lastEntryRef.current.price}
                  {lastEntryRef.current.discount > 0 && ` −${lastEntryRef.current.discount}${lastEntryRef.current.discountType === "percent" ? "%" : ""}`}
                  {" "}×{lastEntryRef.current.qty}
                  {" · type qty + Enter to duplicate"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Right panel: table + footer ── */}
        <div className="flex flex-col min-h-0 gap-1.5 overflow-hidden">
          <section className={`${cardClass} flex flex-col flex-1 min-h-0 overflow-hidden`}>

            {/* Table header */}
            <div className={`shrink-0 ${isDark ? "bg-[#1a1508]" : "bg-yellow-50"}`}>
              <table className="w-full table-fixed" style={{ fontSize: `${Math.max(billerFontSize, 15)}px` }}>
                <colgroup>
                  <col style={{ width: "36px" }} />{showProductName && <col />}
                  <col style={{ width: "100px" }} /><col style={{ width: "72px" }} />
                  {hasAnyDiscount && <col style={{ width: "76px" }} />}
                  <col style={{ width: "96px" }} /><col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr className={isDark ? "text-yellow-500" : "text-yellow-700"}>
                    <th className="px-1 py-1.5 text-left font-bold text-xs">#</th>
                    {showProductName && <th className="px-1 py-1.5 text-left font-bold text-xs">Product</th>}
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Price</th>
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Qty</th>
                    {hasAnyDiscount && <th className="px-1 py-1.5 text-left font-bold text-xs">Disc</th>}
                    <th className="px-1 py-1.5 text-left font-bold text-xs">Total</th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
              </table>
              <div className={`h-px ${isDark ? "bg-yellow-500/20" : "bg-yellow-200"}`} />
            </div>

            {/* Table body */}
            <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ scrollBehavior: "smooth" }}>
              <table className="w-full table-fixed" style={{ fontSize: `${Math.max(billerFontSize, 15)}px` }}>
                <colgroup>
                  <col style={{ width: "36px" }} />{showProductName && <col />}
                  <col style={{ width: "100px" }} /><col style={{ width: "72px" }} />
                  {hasAnyDiscount && <col style={{ width: "76px" }} />}
                  <col style={{ width: "96px" }} /><col style={{ width: "28px" }} />
                </colgroup>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={20} className="px-4 py-8 text-center">
                      <Package size={26} className="mx-auto mb-2 text-yellow-500/40" />
                      <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>No items</p>
                      <p className={`text-xs mt-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>INSERT → price → Enter</p>
                    </td></tr>
                  ) : items.map((item, index) => {
                    const discAmt   = item.discountType === "percent" ? Math.round(item.price * item.discount / 100) : item.discount;
                    const hasDisc   = discAmt > 0;
                    const lineTotal = (item.price - discAmt) * item.qty;
                    const origTotal = item.price * item.qty;
                    const isSel     = selectedRowIndex === index;
                    const isLast    = lastItemId === item.id;
                    return (
                      <tr key={item.id} onClick={() => setSelectedRowIndex(index)}
                        className={`cursor-pointer border-b transition-colors ${
                          isSel
                            ? isDark ? "border-yellow-500/40 bg-yellow-500/15 shadow-[inset_3px_0_0_0_#eab308]" : "border-yellow-300 bg-yellow-100/60 shadow-[inset_3px_0_0_0_#eab308]"
                            : isLast
                              ? isDark ? "border-yellow-500/10 bg-green-500/5" : "border-yellow-100 bg-green-50/30"
                              : isDark ? "border-yellow-500/10 text-white hover:bg-white/5" : "border-yellow-100 text-gray-900 hover:bg-gray-50"
                        }`}>
                        <td className="px-1 py-1">
                          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isSel ? "bg-yellow-500 text-black" : isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>
                            {fmtItemSerial(index + 1)}
                          </span>
                        </td>
                        {showProductName && (
                          <td className={`px-1 py-1 truncate text-xs ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                            {(item.productName || "").replace(/^ITEM-[\w-]+\s*/i, "").replace(/^Item\s*-\s*ITEM-[\w-]+/i, `Item ${fmtItemSerial(index + 1)}`) || `Item ${fmtItemSerial(index + 1)}`}
                          </td>
                        )}
                        <td className="px-1 py-1">
                          {hasDisc ? (
                            <div className="leading-none">
                              <span className={`text-[9px] line-through block ${isDark ? "text-gray-500" : "text-gray-400"}`}>{item.price.toLocaleString()}</span>
                              <span className={`font-bold ${isDark ? "text-green-400" : "text-green-600"}`} style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}>{(item.price - discAmt).toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className={`font-bold ${isDark ? "text-gray-200" : "text-gray-700"}`} style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}>{item.price.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          {/* ✅ FIX-5: stopPropagation on Delete/Backspace prevents bill clear */}
                          <input
                            type="text" inputMode="numeric" value={item.qty}
                            data-bill-input="true"
                            onChange={(e) => changeQty(item.id, e.target.value.replace(/\D/g, ""))}
                            disabled={screenLocked}
                            onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                            onKeyDown={(e) => {
                              if (e.key === "Delete" || e.key === "Backspace") e.stopPropagation();
                              if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); priceInputRef.current?.focus(); }
                            }}
                            style={{ fontSize: `${Math.max(billerFontSize - 2, 12)}px` }}
                            className={`w-16 min-w-[56px] rounded-lg border px-1 py-0.5 text-center font-bold outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                          />
                        </td>
                        {hasAnyDiscount && (
                          <td className="px-1 py-1">
                            {showDiscountField ? (
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number" min="0" value={item.discount}
                                  data-bill-input="true"
                                  onChange={(e) => changeDiscount(item.id, e.target.value)}
                                  disabled={screenLocked}
                                  onClick={(e) => { e.stopPropagation(); e.target.select(); }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Delete" || e.key === "Backspace") e.stopPropagation();
                                  }}
                                  className={`w-10 rounded-lg border px-1 py-0.5 text-center text-[11px] font-semibold outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                                />
                                <button onClick={(e) => { e.stopPropagation(); changeDiscountType(item.id, item.discountType === "fixed" ? "percent" : "fixed"); }}
                                  disabled={screenLocked}
                                  className={`text-[9px] font-bold px-0.5 rounded ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>
                                  {item.discountType === "percent" ? "%" : "Rs"}
                                </button>
                              </div>
                            ) : hasDisc ? (
                              <span className="text-[11px] text-red-400">-{discAmt.toLocaleString()}</span>
                            ) : null}
                          </td>
                        )}
                        <td className="px-1 py-1">
                          {hasDisc ? (
                            <div className="leading-none">
                              <span className={`text-[9px] line-through block ${isDark ? "text-gray-500" : "text-gray-400"}`}>{origTotal.toLocaleString()}</span>
                              <span className="font-extrabold text-yellow-500" style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}>{lineTotal.toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-yellow-500" style={{ fontSize: `${Math.max(billerFontSize - 1, 13)}px` }}>{lineTotal.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={(e) => { e.stopPropagation(); deleteRow(item.id); }} disabled={screenLocked}
                            className={`rounded-lg p-0.5 transition ${isDark ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-500 hover:bg-red-100"} disabled:opacity-40`}>
                            <X size={10} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bill discount row */}
            {items.length > 0 && allowBillDiscount && (
              <div className={`shrink-0 border-t px-3 py-1 ${isDark ? "border-yellow-500/10 bg-[#12100a]" : "border-yellow-100 bg-yellow-50/50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <label className={`text-[10px] font-bold uppercase ${isDark ? "text-gray-400" : "text-gray-600"}`}>Bill Discount</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" value={billDiscount}
                      onChange={(e) => setBillDiscount(e.target.value)}
                      disabled={screenLocked}
                      className={`w-16 rounded-lg border px-2 py-1 text-center text-xs outline-none ${isDark ? "border-yellow-500/20 bg-black/30 text-white" : "border-yellow-200 bg-white text-gray-900"} disabled:opacity-50`}
                    />
                    <button onClick={() => setBillDiscountType((t) => t === "fixed" ? "percent" : "fixed")}
                      disabled={screenLocked}
                      className={`text-xs font-bold px-2 py-1 rounded-lg ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
                      {billDiscountType === "percent" ? "%" : "Rs"}
                    </button>
                    {billDiscountValue > 0 && <span className="text-xs font-bold text-red-400 ml-1">-{billDiscountValue.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Totals bar */}
            {items.length > 0 && (
              <div className={`shrink-0 border-t-2 ${isDark ? "border-yellow-500/30 bg-[#1a1508]" : "border-yellow-300 bg-yellow-50"}`}>
                <div className="flex items-center justify-between px-3 py-1">
                  <div className="flex items-center gap-3">
                    {[
                      ["Items", items.length], ["Qty", totalQty],
                      ...(totalDiscount + billDiscountValue > 0 ? [["Saved", `−${(totalDiscount + billDiscountValue).toLocaleString()}`]] : []),
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span className={`text-[9px] uppercase ${isDark ? "text-gray-500" : "text-gray-400"}`}>{label}</span>
                        <p className={`font-bold leading-tight ${label === "Saved" ? "text-red-400" : isDark ? "text-white" : "text-gray-900"}`} style={{ fontSize: `${Math.max(billerFontSize - 2, 13)}px` }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-right">
                    {billDiscountValue > 0 && <span className={`text-xs line-through block ${isDark ? "text-gray-500" : "text-gray-400"}`}>Rs.{subtotal.toLocaleString()}</span>}
                    <p className="font-extrabold text-yellow-500 leading-tight" style={{ fontSize: `${Math.min(totalFontSize, 26)}px` }}>Rs.{finalTotal.toLocaleString()}</p>
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
                  <span className={`inline-flex items-center gap-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    <Clock3 size={10} />{fmtTime(billStartTime)}
                  </span>
                )}
                {selectedRowIndex >= 0 && items.length > 0 && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-600"}`}>
                    Row {selectedRowIndex + 1}/{items.length}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                {permissions.allowCancelBill && (
                  <button onClick={cancelBill} disabled={items.length === 0}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-medium ${isDark ? "border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"} disabled:opacity-40`}>
                    <Trash2 size={11} className="inline mr-1" />Cancel
                  </button>
                )}
                <button onClick={handleF8} disabled={items.length === 0 || submitting || saveDoneRef.current}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-40 active:scale-95 transition-transform">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                  {submitting ? "Saving..." : "F8: Checkout"}
                </button>
              </div>
            </div>
          </section>

          {/* Hotkey legend */}
          <section className={`${cardClass} p-1.5 shrink-0`}>
            <div className="flex flex-wrap gap-1">
              {[
                ["INS","New"],["Enter","Add"],["F8","Checkout"],["ESC","Back"],["END","Tab"],
                ["−","Del Last"],["DEL","Clear All"],["↑↓","Nav"],["Home","Phone"],["Num+","Qty"],["Num/","Disc"],
              ].map(([k, a]) => (
                <span key={k} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] ${isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
                  <span className="font-mono font-bold">{k}</span>
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>{a}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AnimatePresence>
        {showCustomerDialog && (
          <CustomerDialog isOpen={showCustomerDialog} initialCustomer={customer} onSubmit={onCustomerSubmit}
            onClose={() => { setShowCustomerDialog(false); setF8Step(0); f8LockRef.current = false; requestAnimationFrame(() => priceInputRef.current?.focus()); }}
            runtimeCities={runtimeCities} runtimeMarkets={runtimeMarkets}
            onAddCity={(c) => { if (c && !runtimeCities.includes(c)) setRuntimeCities((p) => [...p, c]); }}
            onAddMarket={(m) => { if (m && !runtimeMarkets.includes(m)) setRuntimeMarkets((p) => [...p, m]); }}
            isSuperAdmin={isSuperAdmin} storeId={storeId} billerId={billerId}
            billId={activeBillIdRef.current || currentBillSerial}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummaryPopup && (
          <SummaryPopup isOpen={showSummaryPopup} items={items} totalQty={totalQty}
            totalDiscount={totalDiscount} subtotal={subtotal} billDiscount={billDiscount}
            billDiscountType={billDiscountType} grandTotal={finalTotal}
            billSerial={currentBillSerial} customer={customer} onProceed={onSummaryProceed}
            onClose={() => { setShowSummaryPopup(false); setShowCustomerDialog(true); setF8Step(1); f8LockRef.current = false; }}
            onBillDiscountChange={(v) => setBillDiscount(v)}
            onBillDiscountTypeChange={(t) => setBillDiscountType(t)}
          />
        )}
      </AnimatePresence>

      {showPrintModal && printOrder && (
        <InvoicePrint order={printOrder} store={storeInfo} onClose={onPrintClose} directPrint autoClose fontSize={invoiceFontSize} />
      )}
      {viewingOrder && (
        <InvoicePrint order={viewingOrder} store={storeInfo} onClose={() => setViewingOrder(null)} directPrint={false} />
      )}

      <AnimatePresence>
        {showCashierPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CreditCard size={20} className="text-green-400" />
                  <div>
                    <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Collect Payment</h2>
                    <p className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>#{currentBillSerial}</p>
                  </div>
                </div>
                <button onClick={() => { setShowCashierPayment(false); f8LockRef.current = false; setShowSummaryPopup(true); setF8Step(2); }}>
                  <X size={18} className={isDark ? "text-gray-400" : "text-gray-500"} />
                </button>
              </div>
              <div className={`rounded-2xl p-4 mb-4 text-center ${isDark ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-yellow-50 border border-yellow-200"}`}>
                <p className="text-xs uppercase text-gray-500 mb-1">Total Due</p>
                <p className="text-4xl font-extrabold text-yellow-500">Rs.{finalTotal.toLocaleString()}</p>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {["cash","card","online"].map((t) => (
                    <button key={t} onClick={() => setPaymentType(t)}
                      className={`py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${paymentType === t ? "bg-yellow-500 text-black" : isDark ? "bg-white/5 text-gray-300 border border-yellow-500/20" : "bg-gray-100 text-gray-700 border border-gray-200"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {paymentType === "cash" && (
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Amount Received</label>
                  <input type="number" min={finalTotal} value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    onFocus={(e) => e.target.select()} autoFocus placeholder={`Min: ${finalTotal}`}
                    onKeyDown={(e) => { if (e.key === "Enter" && Number(amountReceived || 0) >= finalTotal) onCashierConfirm(); }}
                    className={`w-full rounded-xl border px-4 py-3 text-2xl font-bold outline-none ${isDark ? "border-yellow-500/30 bg-[#0f0d09] text-yellow-400" : "border-yellow-300 bg-white text-yellow-700"}`}
                  />
                  {changeAmount > 0 && (
                    <div className="mt-3 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-green-400">Change</span>
                      <span className="text-2xl font-extrabold text-green-400">Rs.{changeAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
              <button onClick={onCashierConfirm}
                disabled={submitting || saveDoneRef.current || (paymentType === "cash" && Number(amountReceived || 0) < finalTotal)}
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-base font-bold text-white hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                {submitting ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Send size={14} />Confirm & Save</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Dashboard);