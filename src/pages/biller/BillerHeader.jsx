// src/pages/biller/BillerHeader.jsx
// ✅ FINAL — No auto-hide, manual toggle only, all bugs fixed

import {
  useState, useRef, useCallback, useEffect, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, User, X, Wifi, WifiOff, Volume2, VolumeX,
  Hash, Clock, Lock, Unlock, Loader2, Phone, MapPin, Database,
  ChevronDown, Sun, Moon, Languages, Bell, LogOut, Settings,
  Gem, Menu, CreditCard, ShoppingBag, RefreshCw, Eye,
  Check, AlertCircle, Store, Plus,
} from "lucide-react";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, getDocs, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { db }           from "../../services/firebase";
import { useTheme }     from "../../context/ThemeContext";
import { useLanguage }  from "../../hooks/useLanguage";
import { useAuth }      from "../../context/AuthContext";
import useNetworkStatus from "../../hooks/useNetworkStatus";
import InvoicePrint     from "../../components/InvoicePrint";

// ─── Phone helpers ────────────────────────────────────────
const normalizePhone = (input = "") => {
  if (!input) return "";
  let p = String(input).trim().replace(/[\s\-()]/g, "");
  if (p.startsWith("+92"))                        p = "0" + p.slice(3);
  else if (p.startsWith("0092"))                  p = "0" + p.slice(4);
  else if (p.startsWith("92") && p.length === 12) p = "0" + p.slice(2);
  return p;
};
const PK_PHONE = /^03[0-9]{9}$/;

// ─── Format helpers ───────────────────────────────────────
const fmtTime = (d) =>
  d.toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
const fmtDate = (d) =>
  d.toLocaleDateString("en-PK", {
    weekday: "short", month: "short", day: "numeric",
  });
const fmtAmt       = (n) => Number(n || 0).toLocaleString("en-PK");
const fmtOrderTime = (v) => {
  if (!v) return "--";
  try {
    const d = v?.toDate ? v.toDate() : new Date(v);
    if (isNaN(d)) return "--";
    return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "--"; }
};
const cleanProductName = (raw = "", i = 0) => {
  if (!raw) return `Item ${i + 1}`;
  return raw.startsWith("Item - ITEM-")
    ? raw.replace(/^Item - ITEM-[0-9]+-[0-9]+-?/, "").trim() || `Item ${i + 1}`
    : raw;
};

// ─── City / Market data ───────────────────────────────────
const CITY_MARKETS = {
  Karachi:    ["Saddar","Tariq Road","Hyderi","Clifton","Garden","Bahadurabad","Gulshan"],
  Lahore:     ["Anarkali","Liberty","Mall Road","Gulberg","Johar","Shalimar","DHA"],
  Islamabad:  ["F-10 Markaz","G-9 Markaz","Blue Area","I-8 Markaz"],
  Rawalpindi: ["Raja Bazaar","Saddar","Commercial Market"],
};
const ALL_CITIES = [
  ...Object.keys(CITY_MARKETS),
  "Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala",
].sort();

// ═══════════════════════════════════════════════════════════
// TOP 6 RECENT ORDERS
// ═══════════════════════════════════════════════════════════
const Top6RecentGrid = ({ billerId, storeId, isDark, onViewInvoice }) => {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const unsubRef   = useRef(null);
  const mountedRef = useRef(true);

  const load = useCallback(() => {
    if (!billerId) { setOrders([]); setLoading(false); return; }
    setLoading(true);
    unsubRef.current?.();

    const q = query(
      collection(db, "orders"),
      where("billerId", "==", billerId),
      where("storeId",  "==", storeId || "default"),
      orderBy("createdAt", "desc"),
      limit(6),
    );

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        if (!mountedRef.current) return;
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      async () => {
        try {
          const snap = await getDocs(q);
          if (mountedRef.current)
            setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch {
          if (mountedRef.current) setOrders([]);
        }
        if (mountedRef.current) setLoading(false);
      },
    );
  }, [billerId, storeId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; unsubRef.current?.(); };
  }, [load]);

  if (!loading && orders.length === 0) return null;

  const statusColor = (s) => {
    if (s === "completed" || s === "paid" || s === "approved") return "bg-green-500";
    if (s === "cancelled") return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <div className={`px-3 lg:px-4 py-2 ${
      isDark
        ? "border-b border-yellow-500/10 bg-black/15"
        : "border-b border-yellow-100 bg-yellow-50/30"}`}>

      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg
            bg-gradient-to-br from-yellow-500 to-amber-600 shadow">
            <ShoppingBag size={12} className="text-white" />
          </div>
          <span className={`text-[11px] font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-gray-900"}`}>
            Recent Orders
          </span>
        </div>
        <button
          type="button"
          onClick={() => { unsubRef.current?.(); load(); }}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1
            text-[9px] font-bold transition active:scale-95 ${
            isDark
              ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              : "border-yellow-200 bg-white text-yellow-700 hover:bg-yellow-50"}`}
        >
          <RefreshCw size={9} />Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-[90px] animate-pulse rounded-xl border ${
              isDark ? "border-yellow-500/10 bg-white/3" : "border-yellow-100 bg-white"}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {orders.map((order) => {
            const its      = Array.isArray(order.items) ? order.items : [];
            const topItems = its.slice(0, 2);
            const serial   = order.billSerial || order.serialNo || "----";
            const timeVal  = order.createdAt  || order.billerSubmittedAt;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onViewInvoice(order)}
                className={`group relative overflow-hidden rounded-xl border text-left
                  transition-all duration-150 hover:shadow-lg active:scale-[0.97]
                  cursor-pointer ${
                  isDark
                    ? "border-yellow-500/15 bg-white/[0.03] hover:border-yellow-500/40 hover:bg-yellow-500/10"
                    : "border-yellow-200 bg-white hover:border-yellow-400 hover:bg-yellow-50 shadow-sm"}`}
              >
                <div className={`h-[3px] w-full ${statusColor(order.status)} opacity-70`} />
                <div className="p-2 flex flex-col gap-1" style={{ minHeight: 84 }}>
                  <div className="flex items-center justify-between gap-1">
                    <div className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 ${
                      isDark
                        ? "bg-yellow-500/10 border border-yellow-500/15"
                        : "bg-yellow-50 border border-yellow-200/60"}`}>
                      <Hash size={8} className="text-yellow-500" />
                      <span className={`font-mono text-[10px] font-black ${
                        isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                        {serial}
                      </span>
                    </div>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusColor(order.status)}`} />
                  </div>
                  <p className={`truncate text-[10px] font-bold leading-tight ${
                    isDark ? "text-white" : "text-gray-900"}`}>
                    {order.customer?.name || "Walk-in"}
                  </p>
                  <div className="flex-1">
                    {topItems.length > 0
                      ? topItems.map((item, i) => (
                          <p key={i} className={`truncate text-[8px] leading-tight ${
                            isDark ? "text-gray-500" : "text-gray-400"}`}>
                            • {cleanProductName(item.productName, i)} ×{item.qty || 0}
                          </p>
                        ))
                      : <p className={`text-[8px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                          {its.length} items
                        </p>
                    }
                  </div>
                  <div className={`flex items-end justify-between gap-1 pt-1 border-t border-dashed ${
                    isDark ? "border-yellow-500/10" : "border-yellow-200/40"}`}>
                    <div>
                      <p className={`text-[11px] font-extrabold leading-none ${
                        isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                        Rs {fmtAmt(order.totalAmount)}
                      </p>
                      <p className={`text-[7px] mt-0.5 ${
                        isDark ? "text-gray-600" : "text-gray-400"}`}>
                        {fmtOrderTime(timeVal)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-0.5 rounded px-1 py-0.5
                      opacity-0 group-hover:opacity-100 transition-opacity ${
                      isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>
                      <Eye size={7} />
                      <span className="text-[7px] font-bold">View</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// CUSTOMER DIALOG
// ═══════════════════════════════════════════════════════════
const CustomerDialog = ({
  isOpen, initialCustomer, onSubmit, onClose, storeId, billerId,
}) => {
  const { isDark } = useTheme();
  const phoneRef   = useRef(null);
  const submitted  = useRef(false);
  const phoneTimer = useRef(null);
  const nameTimer  = useRef(null);
  const prevCity   = useRef("Karachi");

  const [form, setForm] = useState({
    name: "", phone: "", city: "Karachi", market: "",
  });
  const [saving,       setSaving]       = useState(false);
  const [saveOk,       setSaveOk]       = useState(false);
  const [phoneStatus,  setPhoneStatus]  = useState(null);
  const [phoneSug,     setPhoneSug]     = useState([]);
  const [nameSug,      setNameSug]      = useState([]);
  const [showPhone,    setShowPhone]    = useState(false);
  const [showName,     setShowName]     = useState(false);
  const [phLoading,    setPhLoading]    = useState(false);
  const [nmLoading,    setNmLoading]    = useState(false);
  const [newCity,      setNewCity]      = useState("");
  const [newMarket,    setNewMarket]    = useState("");
  const [extraCities,  setExtraCities]  = useState([]);
  const [extraMarkets, setExtraMarkets] = useState([]);

  const allCities = useMemo(
    () => [...new Set([...ALL_CITIES, ...extraCities])].sort(), [extraCities]);
  const allMarkets = useMemo(() => {
    const base = CITY_MARKETS[form.city] || [];
    return [...new Set([...base, ...extraMarkets])];
  }, [form.city, extraMarkets]);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    submitted.current = false;
    setSaveOk(false); setPhoneStatus(null);
    setPhoneSug([]); setNameSug([]);
    setShowPhone(false); setShowName(false);
    setForm({
      name:   initialCustomer?.name   || "",
      phone:  initialCustomer?.phone  || "",
      city:   initialCustomer?.city   || "Karachi",
      market: initialCustomer?.market || "",
    });
    prevCity.current = initialCustomer?.city || "Karachi";
    setTimeout(() => phoneRef.current?.focus(), 100);
  }, [isOpen]); // eslint-disable-line

  // City change → clear market
  useEffect(() => {
    if (form.city !== prevCity.current) {
      prevCity.current = form.city;
      setForm((p) => ({ ...p, market: "" }));
    }
  }, [form.city]);

  const searchPhone = useCallback(async (raw) => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits || digits.length < 3) {
      setPhoneSug([]); setShowPhone(false); setPhoneStatus(null); return;
    }
    if (digits.length >= 11) {
      const norm = normalizePhone(raw);
      if (!PK_PHONE.test(norm)) { setPhoneStatus("invalid"); return; }
      setPhLoading(true);
      try {
        const snap = await getDocs(query(
          collection(db, "customers"),
          where("phone", "==", norm), limit(1),
        ));
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setForm((p) => ({
            ...p,
            name:   d.name   || p.name,
            city:   d.city   || p.city,
            market: d.market || p.market,
          }));
          prevCity.current = d.city || "Karachi";
          setPhoneStatus("found");
        } else { setPhoneStatus("not_found"); }
      } catch { setPhoneStatus(null); }
      setPhLoading(false);
      return;
    }
    setPhLoading(true); setShowPhone(true);
    try {
      const snap = await getDocs(query(
        collection(db, "customers"),
        where("storeId", "==", storeId || "default"),
        where("phone",   ">=", digits),
        where("phone",   "<=", digits + "\uf8ff"),
        limit(8),
      ));
      setPhoneSug(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch { setPhoneSug([]); }
    setPhLoading(false);
  }, [storeId]);

  const searchName = useCallback(async (name) => {
    if (!name || name.length < 2) { setNameSug([]); setShowName(false); return; }
    setNmLoading(true); setShowName(true);
    try {
      const lower = name.toLowerCase();
      const snap  = await getDocs(query(
        collection(db, "customers"),
        where("storeId",   "==", storeId || "default"),
        where("nameLower", ">=", lower),
        where("nameLower", "<=", lower + "\uf8ff"),
        limit(8),
      ));
      setNameSug(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snap = await getDocs(query(
          collection(db, "customers"),
          where("storeId", "==", storeId || "default"),
          limit(20),
        ));
        const lower = name.toLowerCase();
        setNameSug(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => c.name?.toLowerCase().includes(lower))
            .slice(0, 8),
        );
      } catch { setNameSug([]); }
    }
    setNmLoading(false);
  }, [storeId]);

  const handlePhoneChange = useCallback((v) => {
    const c = v.replace(/[^0-9+\-]/g, "");
    setForm((p) => ({ ...p, phone: c }));
    setPhoneStatus(null);
    clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => searchPhone(c), 250);
  }, [searchPhone]);

  const handleNameChange = useCallback((v) => {
    setForm((p) => ({ ...p, name: v }));
    clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => searchName(v), 250);
  }, [searchName]);

  const pickCustomer = useCallback((c) => {
    setForm({
      name:   c.name   || "",
      phone:  normalizePhone(c.phone || "") || c.phone || "",
      city:   c.city   || "Karachi",
      market: c.market || "",
    });
    prevCity.current = c.city || "Karachi";
    setPhoneStatus(c.phone ? "found" : null);
    setShowPhone(false); setPhoneSug([]);
    setShowName(false);  setNameSug([]);
  }, []);

  const saveToFirebase = useCallback(async (data) => {
    const sid   = storeId || "default";
    const phone = normalizePhone(data.phone || "") || data.phone?.replace(/[^0-9]/g, "") || "";
    const name  = data.name?.trim() || "";
    if (!name) return { ok: false };
    if (phone && !PK_PHONE.test(phone)) return { ok: false, error: "invalid_phone" };
    try {
      const docId = phone
        ? `${sid}_${phone}`
        : `${sid}_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      await setDoc(doc(db, "customers", docId), {
        name, nameLower: name.toLowerCase(), phone, phoneNormalized: phone,
        city:      data.city   || "Karachi",
        market:    data.market || "",
        storeId:   sid,
        billerId:  billerId || null,
        createdBy: billerId || null,
        isWalking: /^(Walking Customer|Customer\s?\d+)$/i.test(name),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }, [storeId, billerId]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (normalizePhone(form.phone) && !PK_PHONE.test(normalizePhone(form.phone))) {
      setPhoneStatus("invalid"); return;
    }
    setSaving(true);
    const r = await saveToFirebase(form);
    if (r.ok) {
      setSaveOk(true); toast.success("Saved!");
      setTimeout(() => setSaveOk(false), 2500);
    } else if (r.error === "invalid_phone") { setPhoneStatus("invalid"); }
    setSaving(false);
  };

  const handleSubmit = useCallback(async () => {
    if (submitted.current) return;
    const phone = normalizePhone(form.phone) || form.phone.replace(/[^0-9]/g, "");
    if (phone && !PK_PHONE.test(phone)) { setPhoneStatus("invalid"); return; }
    submitted.current = true;
    const name = form.name.trim() || (phone ? "Walking Customer" : "Customer001");
    const data = { name, phone, city: form.city, market: form.market };
    saveToFirebase(data).catch(() => {});
    onSubmit(data);
    setTimeout(() => { submitted.current = false; }, 800);
  }, [form, onSubmit, saveToFirebase]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => {
      if (e.key === "F8")     { e.preventDefault(); handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [isOpen, handleSubmit, onClose]);

  useEffect(() => () => {
    clearTimeout(phoneTimer.current);
    clearTimeout(nameTimer.current);
  }, []);

  if (!isOpen) return null;

  const inp = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"}`;
  const lbl = `mb-1 block text-[10px] font-semibold uppercase tracking-wide ${
    isDark ? "text-gray-400" : "text-gray-600"}`;

  const SugList = ({ items, loading: ld, show, onPick }) => {
    if (!show) return null;
    return (
      <div className={`absolute top-full left-0 right-0 z-[999] mt-1 rounded-xl border
        shadow-2xl max-h-52 overflow-y-auto ${
        isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"}`}>
        {ld ? (
          <div className="flex justify-center py-4">
            <Loader2 size={14} className="animate-spin text-yellow-500" />
          </div>
        ) : items.length > 0 ? items.map((c, i) => (
          <button
            key={c.id || i} type="button"
            onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
            className={`w-full text-left px-3 py-2.5 text-sm border-b last:border-0
              transition hover:bg-yellow-500/10 ${
              isDark ? "text-white border-yellow-500/10" : "text-gray-900 border-gray-100"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate">{c.name || "No Name"}</span>
              <span className={`font-mono text-xs font-bold flex-shrink-0 ${
                isDark ? "text-yellow-400" : "text-yellow-600"}`}>
                {normalizePhone(c.phone || "") || c.phone || "—"}
              </span>
            </div>
            {(c.city || c.market) && (
              <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                isDark ? "text-gray-500" : "text-gray-400"}`}>
                <MapPin size={8} />
                {[c.city, c.market].filter(Boolean).join(" · ")}
              </p>
            )}
          </button>
        )) : (
          <div className={`px-3 py-4 text-center text-xs ${
            isDark ? "text-gray-500" : "text-gray-400"}`}>
            <AlertCircle size={13} className="inline mr-1 text-orange-400" />
            No record found
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{   scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <div className="flex items-center gap-2">
            <User size={14} className="text-yellow-500" />
            <h2 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Details
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-1 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"}`}>
              F8 Submit
            </span>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10">
              <X size={13} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>

          {/* Phone */}
          <div>
            <label className={lbl}><Phone size={9} className="inline mr-1" />Phone</label>
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={phoneRef} type="tel" inputMode="numeric"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onFocus={() =>
                  form.phone.replace(/[^0-9]/g, "").length >= 3 && searchPhone(form.phone)}
                onBlur={() => setTimeout(() => setShowPhone(false), 200)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="03XX-XXXXXXX"
                className={`${inp} pl-9`}
              />
              {phLoading && (
                <Loader2 size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              <SugList items={phoneSug} loading={phLoading} show={showPhone} onPick={pickCustomer} />
            </div>
            {phoneStatus === "found"     && <p className="text-xs text-green-500 mt-1 flex items-center gap-1"><Check size={9} />Found</p>}
            {phoneStatus === "not_found" && <p className="text-xs text-orange-400 mt-1 flex items-center gap-1"><AlertCircle size={9} />New customer</p>}
            {phoneStatus === "invalid"   && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={9} />Invalid — 03XXXXXXXXX</p>}
          </div>

          {/* Name */}
          <div>
            <label className={lbl}><User size={9} className="inline mr-1" />Name</label>
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text" value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => form.name.length >= 2 && searchName(form.name)}
                onBlur={() => setTimeout(() => setShowName(false), 200)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Search or type…"
                className={`${inp} pl-9`}
              />
              {nmLoading && (
                <Loader2 size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              <SugList items={nameSug} loading={nmLoading} show={showName} onPick={pickCustomer} />
            </div>
          </div>

          {/* City + Market */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}><MapPin size={9} className="inline mr-1" />City</label>
              <select
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className={inp}
              >
                {allCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Add city"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCity.trim()) {
                      setExtraCities((p) => [...p, newCity.trim()]);
                      setForm((p) => ({ ...p, city: newCity.trim() }));
                      setNewCity("");
                    }
                  }}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"}`}
                />
                <button
                  onClick={() => {
                    if (!newCity.trim()) return;
                    setExtraCities((p) => [...p, newCity.trim()]);
                    setForm((p) => ({ ...p, city: newCity.trim() }));
                    setNewCity("");
                  }}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30"
                >
                  <Plus size={9} />
                </button>
              </div>
            </div>
            <div>
              <label className={lbl}><Store size={9} className="inline mr-1" />Market</label>
              <select
                value={form.market}
                onChange={(e) => setForm((p) => ({ ...p, market: e.target.value }))}
                className={inp}
              >
                <option value="">{allMarkets.length ? "Select" : "None"}</option>
                {allMarkets.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value)}
                  placeholder="Add market"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMarket.trim()) {
                      setExtraMarkets((p) => [...p, newMarket.trim()]);
                      setForm((p) => ({ ...p, market: newMarket.trim() }));
                      setNewMarket("");
                    }
                  }}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"}`}
                />
                <button
                  onClick={() => {
                    if (!newMarket.trim()) return;
                    setExtraMarkets((p) => [...p, newMarket.trim()]);
                    setForm((p) => ({ ...p, market: newMarket.trim() }));
                    setNewMarket("");
                  }}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30"
                >
                  <Plus size={9} />
                </button>
              </div>
            </div>
          </div>

          {/* Save */}
          {form.name.trim() && (
            <button
              onClick={handleSave} disabled={saving}
              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition
                flex items-center justify-center gap-1.5 ${
                saveOk
                  ? isDark
                    ? "border border-green-500/30 bg-green-500/15 text-green-400"
                    : "border border-green-200 bg-green-50 text-green-700"
                  : isDark
                    ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                    : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"}`}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saveOk
                ? <><Check size={11} />Saved!</>
                : <><UserPlus size={11} />Save to Database</>}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
          <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Empty name = auto
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-medium border ${
                isDark
                  ? "border-gray-700 text-gray-400 hover:bg-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              ESC
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500
                px-5 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400"
            >
              Continue (F8) →
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════
// BILLER HEADER — MAIN
// ═══════════════════════════════════════════════════════════
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
  notifications = [],
  store,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const { userData, currentUser, signOut } = useAuth();
  const isOnline = useNetworkStatus();
  const navigate = useNavigate();

  const searchRef   = useRef(null);
  const profileRef  = useRef(null);
  const menuRef     = useRef(null);
  const customerRef = useRef(null);
  const recentOrdersRef = useRef(null);
  const searchTimer = useRef(null);
  const searchToken = useRef(0);
  const searchCache = useRef(new Map());

  const [searchQuery,       setSearchQuery]       = useState("");
  const [searchResults,     setSearchResults]     = useState([]);
  const [searching,         setSearching]         = useState(false);
  const [showResults,       setShowResults]       = useState(false);
  const [showSearchBox,     setShowSearchBox]     = useState(false);
  const [showCustomerInfo,  setShowCustomerInfo]  = useState(false);
  const [showProfile,       setShowProfile]       = useState(false);
  const [showControlMenu,   setShowControlMenu]   = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCustomerDlg,   setShowCustomerDlg]   = useState(false);
  const [invoiceOrder,      setInvoiceOrder]      = useState(null);

  const activeUser       = userData || currentUser || null;
  const resolvedBillerId = billerId || activeUser?.uid || null;
  const resolvedStoreId  = storeId  || userData?.storeId || "default";

  const btnBase = useMemo(() => `rounded-xl border-2 transition-all ${
    isDark
      ? "border-yellow-500/30 bg-white/5 text-yellow-500 hover:bg-yellow-500/10"
      : "border-yellow-300 bg-white text-amber-600 hover:bg-yellow-50"}`,
  [isDark]);

  const unreadCount       = useMemo(
    () => (notifications || []).filter((n) => n.unread).length,
    [notifications],
  );
  const safeNotifications = notifications || [];
  const hasCustomer       = customer?.name && customer.name !== "Walking Customer";
  const isPlaceholder     = currentBillSerial?.startsWith("PENDING-");

  // Outside click handler
  useEffect(() => {
    const h = (e) => {
      if (searchRef.current   && !searchRef.current.contains(e.target))   setShowResults(false);
      if (profileRef.current  && !profileRef.current.contains(e.target))  setShowProfile(false);
      if (menuRef.current     && !menuRef.current.contains(e.target)) {
        setShowControlMenu(false);
        setShowNotifications(false);
      }
      if (customerRef.current && !customerRef.current.contains(e.target)) setShowCustomerInfo(false);
      if (recentOrdersRef.current && !recentOrdersRef.current.contains(e.target)) setShowRecentOrders(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setSearchResults([]); setShowResults(false); setSearching(false); return;
    }
    const key = q.toLowerCase().trim();
    if (searchCache.current.has(key)) {
      setSearchResults(searchCache.current.get(key));
      setShowResults(true); setSearching(false); return;
    }
    const token = ++searchToken.current;
    setSearching(true); setShowResults(true);
    try {
      const results = [];
      const digits  = q.replace(/[^0-9]/g, "");
      if (digits.length >= 3) {
        const snap = await getDocs(query(
          collection(db, "customers"),
          where("phone", ">=", digits),
          where("phone", "<=", digits + "\uf8ff"),
          limit(6),
        ));
        snap.docs.forEach((d) => {
          if (!results.find((r) => r.phone === d.data().phone))
            results.push({ id: d.id, ...d.data() });
        });
      }
      const lower    = q.toLowerCase();
      const nameSnap = await getDocs(query(
        collection(db, "customers"),
        where("nameLower", ">=", lower),
        where("nameLower", "<=", lower + "\uf8ff"),
        limit(6),
      ));
      nameSnap.docs.forEach((d) => {
        if (!results.find((r) => r.id === d.id))
          results.push({ id: d.id, ...d.data() });
      });
      if (token !== searchToken.current) return;
      const final = results.slice(0, 10);
      searchCache.current.set(key, final);
      if (searchCache.current.size > 50)
        searchCache.current.delete(searchCache.current.keys().next().value);
      setSearchResults(final);
    } catch {
      if (token === searchToken.current) setSearchResults([]);
    } finally {
      if (token === searchToken.current) setSearching(false);
    }
  }, []);

  const onSearchChange = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q) { setSearchResults([]); setShowResults(false); return; }
    searchTimer.current = setTimeout(() => doSearch(q), 150);
  }, [doSearch]);

  const handleToggleSearch = useCallback(() => {
    setShowSearchBox((p) => {
      if (p) { setSearchQuery(""); setSearchResults([]); setShowResults(false); }
      return !p;
    });
  }, []);

  const selectCustomer = useCallback((c) => {
    setCustomer({
      name:   c.name   || "Walking Customer",
      phone:  c.phone  || "",
      city:   c.city   || "Karachi",
      market: c.market || "",
    });
    setSearchQuery(""); setSearchResults([]); setShowResults(false);
    toast.success(`Customer: ${c.name}`, { duration: 1200 });
  }, [setCustomer]);

  const clearCustomer = useCallback(() => {
    setCustomer({ name: "Walking Customer", phone: "", city: "Karachi", market: "" });
    setShowCustomerInfo(false);
  }, [setCustomer]);

  const handleLogout = useCallback(async () => {
    try {
      if (signOut) await signOut();
      ["session", "user", "userData"].forEach((k) => localStorage.removeItem(k));
      toast.success("Logged out");
      setShowProfile(false);
      navigate("/login", { replace: true });
    } catch { toast.error("Logout failed"); }
  }, [signOut, navigate]);

  const handleCustomerSubmit = useCallback((data) => {
    setCustomer(data);
    setShowCustomerDlg(false);
    toast.success(`Customer: ${data.name}`, { duration: 1200 });
  }, [setCustomer]);

  const openCustomerDialog  = useCallback(() => setShowCustomerDlg(true), []);
  const handleToggleProfile = useCallback(() => {
    setShowProfile((p) => !p);
    setShowControlMenu(false);
    setShowNotifications(false);
  }, []);
  const handleToggleMenu = useCallback(() => {
    setShowControlMenu((p) => !p);
    setShowProfile(false);
    setShowNotifications(false);
  }, []);
  const handleViewInvoice = useCallback((order) => setInvoiceOrder(order), []);

  return (
    <>
      <header className={`sticky top-0 z-40 backdrop-blur-xl transition-all flex-shrink-0 ${
        isDark
          ? "bg-[#0a0908]/95 border-b border-yellow-500/15 shadow-[0_2px_20px_rgba(0,0,0,0.3)]"
          : "bg-white/95 border-b border-yellow-200 shadow-sm"}`}>

        {/* ═══ ROW 1 ═══ */}
        <div className="flex items-center justify-between px-3 lg:px-4 h-11">

          {/* Left */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 p-1.5 shadow-lg shadow-yellow-500/25">
                <Gem size={16} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className={`text-sm font-extrabold tracking-tight leading-none ${
                  isDark ? "text-white" : "text-gray-900"}`}>A ONE</h1>
                <p className={`text-[8px] font-semibold uppercase tracking-widest ${
                  isDark ? "text-yellow-500/70" : "text-yellow-600/70"}`}>Biller</p>
              </div>
            </div>

            <div className={`hidden md:block h-6 w-px ${isDark ? "bg-yellow-500/20" : "bg-yellow-200"}`} />

            <div className={`hidden md:flex items-center gap-1 rounded-xl px-2 py-1 ${
              isDark
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : "bg-yellow-50 border border-yellow-200"}`}>
              <Hash size={11} className="text-yellow-500" />
              <span className={`font-mono text-xs font-bold ${
                isDark ? "text-yellow-400" : "text-yellow-700"}`}>
                {isPlaceholder
                  ? <span className="opacity-50 italic text-[10px]">pending…</span>
                  : currentBillSerial || "---"}
              </span>
            </div>

            {screenLocked ? (
              <span className={`hidden sm:inline-flex items-center gap-1 rounded-xl
                px-2 py-0.5 text-[10px] font-bold ${
                isDark
                  ? "bg-red-500/15 text-red-400 border border-red-500/20"
                  : "bg-red-50 text-red-600 border border-red-200"}`}>
                <Lock size={9} />LOCKED
              </span>
            ) : (
              <span className={`hidden sm:inline-flex items-center gap-1 rounded-xl
                px-2 py-0.5 text-[10px] font-bold ${
                isDark
                  ? "bg-green-500/15 text-green-400 border border-green-500/20"
                  : "bg-green-50 text-green-600 border border-green-200"}`}>
                <Unlock size={9} />ACTIVE
              </span>
            )}

            {items?.length > 0 && (
              <span className={`hidden lg:inline-flex items-center gap-1 rounded-full
                px-2 py-0.5 text-[10px] font-bold ${
                isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-100 text-yellow-700"}`}>
                {items.length} items
              </span>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">

            <div className={`hidden xl:flex items-center gap-1 rounded-xl px-2 py-1
              text-[10px] font-medium ${
              isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-500"}`}>
              <Clock size={10} />
              <span className="font-mono">
                {fmtDate(currentDateTime)} · {fmtTime(currentDateTime)}
              </span>
            </div>

            <div className={`inline-flex items-center gap-1 rounded-xl px-2 py-1
              text-[10px] font-bold border ${
              isOnline
                ? isDark
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-green-50 text-green-700 border-green-200"
                : isDark
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-red-50 text-red-700 border-red-200"}`}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span className="hidden sm:inline">{isOnline ? "ON" : "OFF"}</span>
            </div>

            {offlineCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1
                text-[10px] font-bold border ${
                isDark
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
                  : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                <Database size={10} />{offlineCount}
              </span>
            )}

            {/* ✅ Recent Orders toggle — manual only, no auto-hide */}
            <button
              type="button"
              onClick={toggleRecentOrders}
              className={`${btnBase} px-2 py-1 text-[10px] font-semibold
                inline-flex items-center gap-1`}
            >
              <ShoppingBag size={11} />
              {showRecentOrders ? "Hide" : "Orders"}
            </button>

            <button
              type="button"
              onClick={handleToggleSearch}
              className={`${btnBase} p-1.5`}
            >
              {showSearchBox ? <X size={14} /> : <Search size={14} />}
            </button>

            {/* Menu */}
            <div ref={menuRef} className="relative">
              <button type="button" onClick={handleToggleMenu} className={`${btnBase} p-1.5`}>
                <Menu size={14} />
              </button>

              <AnimatePresence>
                {showControlMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.1 }}
                    className={`absolute right-0 top-full z-[200] mt-1.5 w-52 rounded-2xl
                      border-2 shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d]"
                        : "border-yellow-200 bg-white"}`}
                  >
                    {[
                      {
                        icon:   <Languages size={14} />,
                        label:  language === "en" ? "اردو" : "English",
                        action: () => { toggleLanguage(); setShowControlMenu(false); },
                      },
                      {
                        icon:   isDark ? <Sun size={14} /> : <Moon size={14} />,
                        label:  isDark ? "Light" : "Dark",
                        action: () => { toggleTheme(); setShowControlMenu(false); },
                      },
                      {
                        icon:   soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />,
                        label:  soundEnabled ? "Sound ON" : "Sound OFF",
                        action: () => { setSoundEnabled((p) => !p); setShowControlMenu(false); },
                      },
                    ].map((item) => (
                      <button
                        key={item.label} type="button" onClick={item.action}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                          text-sm font-semibold transition ${
                          isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-50"}`}
                      >
                        {item.icon}{item.label}
                      </button>
                    ))}

                    {permissions?.canDirectPay && (
                      <button
                        type="button"
                        onClick={() => { onToggleDirectPaid(); setShowControlMenu(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                          text-sm font-semibold transition ${
                          isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-50"}`}
                      >
                        <CreditCard size={14} />
                        {directPaid ? "Direct Paid ON" : "Direct Paid OFF"}
                      </button>
                    )}

                    {canToggleCashierMode && (
                      <button
                        type="button"
                        onClick={() => { onToggleCashierMode(); setShowControlMenu(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                          text-sm font-semibold transition ${
                          isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-50"}`}
                      >
                        <Lock size={14} />
                        {cashierModeActive ? "Exit Cashier" : "Cashier Mode"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setShowNotifications(true); setShowControlMenu(false); }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left
                        text-sm font-semibold transition ${
                        isDark ? "text-white hover:bg-white/5" : "text-gray-900 hover:bg-gray-50"}`}
                    >
                      <Bell size={14} />Notifications
                      {unreadCount > 0 && (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5
                          text-[9px] font-bold text-white">
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
                    className={`absolute right-0 top-full z-[200] mt-1.5 w-72 rounded-2xl
                      border-2 shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/30 bg-[#15120d]"
                        : "border-yellow-300 bg-white"}`}
                  >
                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
                      <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                        Notifications
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="text-[10px] font-semibold text-yellow-500"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {safeNotifications.length === 0 ? (
                        <p className={`px-4 py-6 text-center text-sm ${
                          isDark ? "text-gray-500" : "text-gray-400"}`}>
                          No notifications
                        </p>
                      ) : safeNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b last:border-0 ${
                            n.unread
                              ? isDark ? "bg-yellow-500/5" : "bg-yellow-50"
                              : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                              n.unread ? "bg-yellow-500" : "bg-gray-400"}`} />
                            <div>
                              <p className={`text-sm font-medium ${
                                isDark ? "text-white" : "text-gray-900"}`}>
                                {n.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-gray-500">{n.time} ago</p>
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
                type="button" onClick={handleToggleProfile}
                className={`flex items-center gap-1.5 rounded-xl border-2 p-1 pr-2 transition-all ${
                isDark
                  ? "border-yellow-500/30 bg-white/5 hover:border-yellow-500/50"
                  : "border-yellow-300 bg-white hover:bg-yellow-50"}`}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg
                  bg-gradient-to-br from-yellow-500 to-amber-600">
                  <User size={12} className="text-white" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className={`text-[11px] font-semibold leading-tight ${
                    isDark ? "text-white" : "text-gray-900"}`}>
                    {billerName || activeUser?.name || "Biller"}
                  </p>
                  <p className="text-[9px] text-gray-500 leading-tight">
                    {activeUser?.role || "biller"}
                  </p>
                </div>
                <ChevronDown size={11} className={`transition-transform ${
                  showProfile ? "rotate-180" : ""} ${
                  isDark ? "text-gray-400" : "text-gray-500"}`} />
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute right-0 z-[200] mt-1.5 w-52 rounded-2xl border-2
                      shadow-2xl overflow-hidden ${
                      isDark
                        ? "border-yellow-500/30 bg-[#15120d]"
                        : "border-yellow-300 bg-white"}`}
                  >
                    <div className={`border-b px-4 py-3 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
                      <p className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                        {billerName || activeUser?.name || "Biller"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{activeUser?.email || ""}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { label: "Profile",  icon: <User size={13} className="text-yellow-500" />,
                          path: "/biller/profile" },
                        { label: "Settings", icon: <Settings size={13} className="text-yellow-500" />,
                          path: "/biller/settings" },
                      ].map((item) => (
                        <button
                          key={item.label} type="button"
                          onClick={() => { navigate(item.path); setShowProfile(false); }}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-sm
                            font-medium transition ${
                            isDark
                              ? "text-gray-300 hover:bg-white/5"
                              : "text-gray-700 hover:bg-yellow-50"}`}
                        >
                          {item.icon}{item.label}
                        </button>
                      ))}
                    </div>
                    <div className={`border-t py-1 ${
                      isDark ? "border-yellow-500/20" : "border-yellow-200"}`}>
                      <button
                        type="button" onClick={handleLogout}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-sm
                          font-medium text-red-500 transition ${
                          isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"}`}
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

        {/* ═══ TOP 6 RECENT — manual show/hide only ═══ */}
        <AnimatePresence>
          {showRecentOrders && resolvedBillerId && (
            <motion.div
              ref={recentOrdersRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ overflow: "hidden" }}
            >
              <Top6RecentGrid
                billerId={resolvedBillerId}
                storeId={resolvedStoreId}
                isDark={isDark}
                onViewInvoice={handleViewInvoice}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ TAB BAR ═══ */}
        {tabs && tabs.length > 0 && (
          <div
            className={`flex items-center gap-1 px-3 lg:px-4 overflow-x-auto ${
              isDark ? "border-b border-yellow-500/10" : "border-b border-yellow-100"}`}
            style={{ scrollbarWidth: "none" }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const hasItems = (tab.state?.items?.length || 0) > 0;
              return (
                <button
                  key={tab.id} type="button"
                  onClick={() => onSwitchTab?.(tab.id)}
                  className={`relative flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5
                    text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
                    isActive
                      ? isDark
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-yellow-500 bg-yellow-50 text-yellow-700"
                      : isDark
                        ? "border-transparent text-gray-500 hover:text-gray-300"
                        : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  {hasItems && (
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-yellow-500" : "bg-gray-400"}`} />
                  )}
                  {tab.label}
                  {tabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRemoveTab?.(tab.id); }}
                      className={`ml-0.5 rounded p-0.5 hover:bg-red-500/20 hover:text-red-400
                        transition ${isDark ? "text-gray-600" : "text-gray-400"}`}
                    >
                      <X size={9} />
                    </button>
                  )}
                </button>
              );
            })}
            {canAddTab && (
              <button
                type="button" onClick={() => onAddTab?.()}
                className={`flex-shrink-0 rounded-t-xl px-2 py-1.5 text-xs font-bold transition ${
                isDark
                  ? "text-yellow-500/60 hover:text-yellow-400 hover:bg-yellow-500/10"
                  : "text-yellow-600/60 hover:text-yellow-700 hover:bg-yellow-50"}`}
              >
                + Bill
              </button>
            )}
          </div>
        )}

        {/* ═══ ROW 2 — Search + Customer ═══ */}
        <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5">

          {showSearchBox && (
            <div className="relative flex-1 max-w-sm" ref={searchRef}>
              <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5
                transition-all ${
                isDark
                  ? "border-yellow-500/25 bg-white/5 focus-within:border-yellow-500/50"
                  : "border-yellow-300 bg-white focus-within:border-yellow-500"}`}>
                <Search size={13} className="shrink-0 text-yellow-500" />
                <input
                  type="search" value={searchQuery}
                  onChange={onSearchChange}
                  onFocus={() => searchResults.length && setShowResults(true)}
                  autoFocus
                  placeholder="Search phone or name…"
                  className={`flex-1 bg-transparent text-sm outline-none ${
                    isDark
                      ? "text-white placeholder:text-gray-500"
                      : "text-gray-900 placeholder:text-gray-400"}`}
                />
                {searching && (
                  <Loader2 size={12} className="shrink-0 animate-spin text-yellow-500" />
                )}
                {searchQuery && !searching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(""); setSearchResults([]); setShowResults(false);
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
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.08 }}
                    className={`absolute left-0 right-0 top-full z-[100] mt-1 max-h-56
                      overflow-y-auto rounded-2xl border-2 shadow-2xl ${
                      isDark
                        ? "border-yellow-500/25 bg-[#15120d]"
                        : "border-yellow-200 bg-white"}`}
                  >
                    <div className={`sticky top-0 px-3 py-1.5 text-[10px] font-bold uppercase ${
                      isDark
                        ? "bg-[#15120d] text-gray-500 border-b border-yellow-500/10"
                        : "bg-gray-50 text-gray-500 border-b border-gray-100"}`}>
                      {searchResults.length} found
                    </div>
                    {searchResults.map((c) => (
                      <button
                        key={c.id} type="button"
                        onMouseDown={() => selectCustomer(c)}
                        className={`w-full px-3 py-2 text-left flex items-center
                          justify-between border-b last:border-0 transition ${
                          isDark
                            ? "border-yellow-500/10 hover:bg-yellow-500/10 text-white"
                            : "border-yellow-100 hover:bg-yellow-50 text-gray-900"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                            isDark
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-yellow-100 text-yellow-700"}`}>
                            <User size={13} />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block leading-tight">
                              {c.name}
                            </span>
                            <span className={`text-[10px] flex items-center gap-1 ${
                              isDark ? "text-gray-400" : "text-gray-500"}`}>
                              <Phone size={9} />{c.phone || "—"}
                            </span>
                          </div>
                        </div>
                        {c.city && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                            isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                            <MapPin size={8} className="inline" /> {c.city}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showResults && searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={`absolute left-0 right-0 top-full z-[100] mt-1 rounded-2xl
                      border-2 px-4 py-3 text-center text-sm ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d] text-gray-400"
                        : "border-yellow-200 bg-white text-gray-500"}`}
                  >
                    No match for "{searchQuery}"
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            type="button" onClick={openCustomerDialog} disabled={screenLocked}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5
              text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 ${
              isDark
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                : "border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"}`}
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Add Customer</span>
          </button>

          {hasCustomer && (
            <div className="relative" ref={customerRef}>
              <button
                type="button"
                onClick={() => setShowCustomerInfo((p) => !p)}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-2 py-1.5
                  text-xs transition-all ${
                  isDark
                    ? "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15"
                    : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"}`}
              >
                <User size={12} />
                <div className="hidden sm:block text-left">
                  <span className="font-semibold max-w-[80px] truncate block leading-tight">
                    {customer.name}
                  </span>
                  {customer.phone && (
                    <span className={`text-[9px] leading-tight ${
                      isDark ? "text-green-300/60" : "text-green-600/60"}`}>
                      {customer.phone}
                    </span>
                  )}
                </div>
                <ChevronDown size={10} className={`transition-transform ${
                  showCustomerInfo ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showCustomerInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.08 }}
                    className={`absolute right-0 top-full z-[100] mt-1 w-52 rounded-2xl
                      border-2 shadow-2xl p-3 ${
                      isDark
                        ? "border-yellow-500/20 bg-[#15120d]"
                        : "border-yellow-200 bg-white"}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          isDark
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"}`}>
                          <User size={14} />
                        </div>
                        <div>
                          <span className={`font-bold text-sm block ${
                            isDark ? "text-white" : "text-gray-900"}`}>
                            {customer.name}
                          </span>
                          {customer.phone && (
                            <span className={`text-xs flex items-center gap-1 ${
                              isDark ? "text-gray-400" : "text-gray-500"}`}>
                              <Phone size={9} />{customer.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      {customer.city && (
                        <div className={`flex items-center gap-1.5 text-xs ${
                          isDark ? "text-gray-400" : "text-gray-500"}`}>
                          <MapPin size={10} />
                          {customer.city}{customer.market && ` – ${customer.market}`}
                        </div>
                      )}
                      <div className={`h-px ${isDark ? "bg-yellow-500/10" : "bg-gray-100"}`} />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { openCustomerDialog(); setShowCustomerInfo(false); }}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                            isDark
                              ? "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                              : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button" onClick={clearCustomer}
                          className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                            isDark
                              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              : "bg-red-50 text-red-600 hover:bg-red-100"}`}
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

      {/* ═══ CUSTOMER DIALOG ═══ */}
      <AnimatePresence>
        {showCustomerDlg && (
          <CustomerDialog
            isOpen={showCustomerDlg}
            initialCustomer={customer}
            onSubmit={handleCustomerSubmit}
            onClose={() => setShowCustomerDlg(false)}
            storeId={resolvedStoreId}
            billerId={resolvedBillerId}
          />
        )}
      </AnimatePresence>

      {/* ═══ INVOICE PRINT ═══ */}
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