// src/components/CustomerDialog.jsx
// ✅ RUNTIME SAVE — har input change pe save hota hai
// ✅ BACK + RETURN — data wapas milta hai, inputs filled rehte hain
// ✅ FIX-1: Customer 001/002 space-style ALLOWED
// ✅ FIX-2: Triple persist — memory + sessionStorage + localStorage
// ✅ FIX-3: isOpen effect refs se — no stale closure
// ✅ FIX-4: No auto Customer_XXXX in submit
// ✅ FIX-5: City/Market selected state maintain
// ✅ FIX-6: Walking Customer name clear on open

import {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, Phone, MapPin, Store, Plus, UserPlus,
  Loader2, AlertCircle, Check, Globe,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  doc, setDoc, serverTimestamp,
  collection, query, where, getDocs, limit,
} from "firebase/firestore";
import { db } from "../services/firebase";

// ── Phone utils ──────────────────────────────────────────────────────────────
const normalizePhone = (input = "") => {
  if (!input) return "";
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("0092"))                       d = "0" + d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = "0" + d.slice(2);
  if (d.length === 10 && d.startsWith("3"))       d = "0" + d;
  return d;
};

const PK_PHONE   = /^03[0-9]{9}$/;
const INTL_PHONE = /^\+?[1-9][0-9]{6,14}$/;

const validatePhone = (raw, allowIntl = false) => {
  if (!raw) return null;
  const norm    = normalizePhone(raw);
  const rawTrim = String(raw).trim().replace(/[\s\-()]/g, "");
  if (PK_PHONE.test(norm))
    return { valid: true, normalized: norm,    type: "pk" };
  if (allowIntl && INTL_PHONE.test(rawTrim))
    return { valid: true, normalized: rawTrim, type: "intl" };
  if (norm.length > 0 && norm.length < 11)
    return { valid: false, reason: "short" };
  return { valid: false, reason: "format" };
};

// ✅ FIX-1: "Customer 001" (space) ALLOW — only underscore block
const isValidCustomer = (c) => {
  if (!c) return false;
  const name  = (c.name  || "").trim();
  const phone = (c.phone || "").trim();
  if (!name && !phone) return false;
  if (/^Walking\s*Customer$/i.test(name) && !phone) return false;
  if (/^Walk-in$/i.test(name) && !phone)             return false;
  if (/^Customer_\d+$/i.test(name) && !phone)        return false;
  if (/^auto_customer/i.test(name) && !phone)        return false;
  return true;
};

const isDisplayableCustomer = (c) => {
  if (!isValidCustomer(c)) return false;
  const name = (c.name || "").trim();
  if (/^Customer_\d+$/i.test(name) && !(c.phone || "").trim()) return false;
  if (/^auto_customer/i.test(name)) return false;
  return true;
};

// Cities / Markets
const CITY_MARKETS = {
  Karachi:    ["Saddar","Tariq Road","Hyderi","Clifton","Garden","Bahadurabad","Gulshan"],
  Lahore:     ["Anarkali","Liberty","Mall Road","Gulberg","Johar","Shalimar","DHA"],
  Islamabad:  ["F-10 Markaz","G-9 Markaz","Blue Area","I-8 Markaz"],
  Rawalpindi: ["Raja Bazaar","Saddar","Commercial Market"],
};
const BASE_CITIES = [
  ...Object.keys(CITY_MARKETS),
  "Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala",
].sort();

// ════════════════════════════════════════════════════════════════════════════
// ✅ PERSISTENCE LAYER — memory + sessionStorage + localStorage
// Triple fallback — data kabhi nahi jaata
// ════════════════════════════════════════════════════════════════════════════
const _mem = new Map(); // billId → formData

const _storageKey = (billId) => `cd_v6:${billId || "default"}`;

export const persistCustomer = (data, billId) => {
  if (!billId) return;

  // Skip if completely empty
  const isEmpty =
    !data?.name?.trim()   &&
    !data?.phone?.trim()  &&
    !(data?.city && data.city !== "Karachi") &&
    !data?.market?.trim();
  if (isEmpty) return;

  const payload = {
    name:   (data.name   || "").trim(),
    phone:  (data.phone  || "").trim(),
    city:   data.city    || "Karachi",
    market: data.market  || "",
    _savedAt: Date.now(),
  };

  // 1. Memory (fastest)
  _mem.set(billId, payload);

  // 2. sessionStorage (tab-level)
  try { sessionStorage.setItem(_storageKey(billId), JSON.stringify(payload)); } catch {}

  // 3. localStorage (cross-tab, survives refresh)
  try { localStorage.setItem(_storageKey(billId), JSON.stringify(payload)); } catch {}
};

export const getPersistedCustomer = (billId) => {
  if (!billId) return null;

  // 1. Memory first
  if (_mem.has(billId)) {
    return _mem.get(billId);
  }

  // 2. sessionStorage
  try {
    const raw = sessionStorage.getItem(_storageKey(billId));
    if (raw) {
      const p = JSON.parse(raw);
      _mem.set(billId, p); // warm memory
      return p;
    }
  } catch {}

  // 3. localStorage fallback
  try {
    const raw = localStorage.getItem(_storageKey(billId));
    if (raw) {
      const p = JSON.parse(raw);
      _mem.set(billId, p); // warm memory
      return p;
    }
  } catch {}

  return null;
};

export const resetPersistedCustomer = (billId) => {
  if (!billId) return;
  _mem.delete(billId);
  try { sessionStorage.removeItem(_storageKey(billId)); } catch {}
  try { localStorage.removeItem(_storageKey(billId));   } catch {}
};

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMER CACHE — storeId isolated
// ════════════════════════════════════════════════════════════════════════════
const _caches  = {};
const CACHE_TTL = 90_000;

const _getStoreCache = (sid) => {
  if (!_caches[sid]) {
    _caches[sid] = {
      items: [], byPhone: new Map(), byId: new Map(),
      loaded: false, loadedAt: 0, loading: false,
    };
  }
  return _caches[sid];
};

const cacheUpsert = (raw, storeId) => {
  if (!raw || !isValidCustomer(raw)) return null;
  const cache = _getStoreCache(storeId || "default");
  const phone = normalizePhone(raw.phone || "");
  const name  = (raw.name || "").trim();
  const id    = raw.id || "";
  if (!phone && !name) return null;

  if (phone && cache.byPhone.has(phone)) {
    const ex = cache.byPhone.get(phone);
    if (name)       ex.name   = name;
    if (raw.city)   ex.city   = raw.city;
    if (raw.market) ex.market = raw.market;
    if (id) { ex.id = id; cache.byId.set(id, ex); }
    return ex;
  }
  if (id && cache.byId.has(id)) {
    const ex = cache.byId.get(id);
    if (name)  ex.name  = name;
    if (phone) { ex.phone = phone; cache.byPhone.set(phone, ex); }
    if (raw.city)   ex.city   = raw.city;
    if (raw.market) ex.market = raw.market;
    return ex;
  }

  const entry = {
    id:     id || `rt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name, phone,
    city:   raw.city   || "",
    market: raw.market || "",
  };
  cache.items.unshift(entry);
  if (phone) cache.byPhone.set(phone, entry);
  if (id)    cache.byId.set(id, entry);
  return entry;
};

const cacheLoad = async (storeId, force = false) => {
  const sid   = storeId || "default";
  const cache = _getStoreCache(sid);
  if (!force && cache.loaded && Date.now() - cache.loadedAt < CACHE_TTL)
    return true;
  if (cache.loading) {
    let n = 0;
    while (cache.loading && n++ < 30)
      await new Promise((r) => setTimeout(r, 100));
    return cache.loaded;
  }
  cache.loading = true;
  try {
    const snap = await getDocs(query(
      collection(db, "customers"),
      where("storeId", "==", sid),
      limit(2000),
    ));
    cache.items   = [];
    cache.byPhone = new Map();
    cache.byId    = new Map();
    snap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() };
      if (isValidCustomer(data)) cacheUpsert(data, sid);
    });
    cache.loaded   = true;
    cache.loadedAt = Date.now();
    return true;
  } catch { return false; }
  finally   { cache.loading = false; }
};

const cacheSearch = (term, storeId) => {
  if (!term || term.trim().length < 2) return [];
  const cache  = _getStoreCache(storeId || "default");
  const lower  = term.toLowerCase().trim();
  const digits = term.replace(/\D/g, "");
  const isPhone = digits.length >= 3;
  const out = [], seen = new Set();

  for (const c of cache.items) {
    if (out.length >= 15) break;
    if (!isValidCustomer(c)) continue;
    const cP = (c.phone || "").replace(/\D/g, "");
    const cN = (c.name  || "").toLowerCase();
    let ok = false;
    if (isPhone && cP) ok = cP.startsWith(digits) || cP.includes(digits);
    if (!ok && lower.length >= 2 && cN) ok = cN.includes(lower);
    if (ok) {
      const key = cP || cN || c.id;
      if (!seen.has(key)) { seen.add(key); out.push(c); }
    }
  }
  return out;
};

export { cacheLoad, cacheSearch, isValidCustomer, isDisplayableCustomer, normalizePhone };

// ── SugItem ──────────────────────────────────────────────────────────────────
const SugItem = memo(({ c, onSelect, isDark, isHighlighted }) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onSelect(c); }}
    className={`w-full text-left px-3 py-2.5 text-sm border-b last:border-0 transition-colors ${
      isHighlighted
        ? isDark ? "bg-yellow-500/20 text-white" : "bg-yellow-100 text-gray-900"
        : isDark ? "hover:bg-yellow-500/10 text-white border-yellow-500/10"
                 : "hover:bg-yellow-50 text-gray-900 border-gray-100"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <User size={11} className={`shrink-0 ${isDark ? "text-yellow-500/50" : "text-yellow-400"}`} />
        <span className="font-semibold truncate">{c.name || "No Name"}</span>
      </div>
      {c.phone && (
        <span className={`font-mono text-xs shrink-0 font-bold px-1.5 py-0.5 rounded ${
          isDark ? "text-yellow-400 bg-yellow-500/10" : "text-yellow-700 bg-yellow-50"
        }`}>
          {c.phone}
        </span>
      )}
    </div>
    {(c.city || c.market) && (
      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ml-5 ${
        isDark ? "text-gray-500" : "text-gray-400"
      }`}>
        <MapPin size={8} />
        {[c.city, c.market].filter(Boolean).join(" • ")}
      </p>
    )}
  </button>
));
SugItem.displayName = "SugItem";

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
const CustomerDialog = ({
  isOpen, initialCustomer, onSubmit, onClose,
  runtimeCities  = [],
  runtimeMarkets = [],
  onAddCity, onAddMarket,
  isSuperAdmin, storeId, billerId, billId,
}) => {
  const { isDark } = useTheme();

  const phoneRef       = useRef(null);
  const nameRef        = useRef(null);
  const submittedRef   = useRef(false);
  const searchTimer    = useRef(null);
  const prevCityRef    = useRef("Karachi");
  const activeFieldRef = useRef("");
  const persistTimer   = useRef(null); // ✅ debounce persist

  // ✅ FIX-3: Stable refs — no stale closure in effects
  const billIdRef          = useRef(billId);
  const initialCustomerRef = useRef(initialCustomer);
  const storeIdRef         = useRef(storeId);

  useEffect(() => { billIdRef.current          = billId;          }, [billId]);
  useEffect(() => { initialCustomerRef.current = initialCustomer; }, [initialCustomer]);
  useEffect(() => { storeIdRef.current         = storeId;         }, [storeId]);

  // ── Form state — loaded from persistence on open ──────────
  const [form, setForm] = useState({
    name: "", phone: "", city: "Karachi", market: "",
  });

  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [phoneStatus, setPhoneStatus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug,     setShowSug]     = useState(false);
  const [sugLoading,  setSugLoading]  = useState(false);
  const [activeField, setActiveField] = useState("");
  const [cacheReady,  setCacheReady]  = useState(false);
  const [newCity,     setNewCity]     = useState("");
  const [newMarket,   setNewMarket]   = useState("");
  const [allowIntl,   setAllowIntl]   = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [recentCusts, setRecentCusts] = useState([]);

  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  const allCities = useMemo(() =>
    [...new Set([...BASE_CITIES, ...runtimeCities])].sort(),
  [runtimeCities]);

  const allMarkets = useMemo(() => {
    const base = CITY_MARKETS[form.city] || [];
    return [...new Set([...base, ...runtimeMarkets])];
  }, [form.city, runtimeMarkets]);

  const refreshRecent = useCallback((sid) => {
    const cache = _getStoreCache(sid || "default");
    setRecentCusts(cache.items.filter(isDisplayableCustomer).slice(0, 8));
  }, []);

  // ✅ CORE FIX: isOpen effect — restore from persistence FIRST
  useEffect(() => {
    if (!isOpen) return;

    const curBillId          = billIdRef.current;
    const curInitialCustomer = initialCustomerRef.current;
    const curStoreId         = storeIdRef.current || "default";

    // Reset meta state
    submittedRef.current = false;
    setSaveOk(false);
    setSuggestions([]);
    setShowSug(false);
    setHighlighted(-1);
    setCacheReady(false);

    // ✅ PRIORITY ORDER:
    // 1. Persisted data (user typed before going back)
    // 2. initialCustomer prop (from parent state)
    // 3. Empty defaults
    const persisted = getPersistedCustomer(curBillId);

    let source = null;

    if (persisted && (persisted.name || persisted.phone)) {
      // User had typed something — restore it
      source = persisted;
    } else if (
      curInitialCustomer &&
      (curInitialCustomer.name || curInitialCustomer.phone)
    ) {
      source = curInitialCustomer;
    }

    const restored = {
      name:   source?.name   || "",
      phone:  source?.phone  || "",
      city:   source?.city   || "Karachi",
      market: source?.market || "",
    };

    // ✅ Clear walking customer placeholder (show blank so user types)
    if (
      /^Walking\s*Customer$/i.test(restored.name) ||
      /^Walk-in$/i.test(restored.name)
    ) {
      restored.name = "";
    }

    setForm(restored);
    prevCityRef.current = restored.city;
    setActiveField("");

    // Phone status
    if (restored.phone) {
      const v = validatePhone(restored.phone, false);
      setPhoneStatus(v?.valid ? "found" : null);
    } else {
      setPhoneStatus(null);
    }

    // Focus phone if empty, else name
    requestAnimationFrame(() => {
      if (!restored.phone) {
        phoneRef.current?.focus();
      } else if (!restored.name) {
        nameRef.current?.focus();
      } else {
        phoneRef.current?.focus();
      }
    });

    // Load cache
    const needReload =
      !_getStoreCache(curStoreId).loaded ||
      Date.now() - _getStoreCache(curStoreId).loadedAt > CACHE_TTL;

    cacheLoad(curStoreId, needReload)
      .then(() => {
        setCacheReady(true);
        refreshRecent(curStoreId);
      })
      .catch(() => setCacheReady(true));

  }, [isOpen, refreshRecent]);

  // City change → clear market if city changed
  useEffect(() => {
    if (form.city !== prevCityRef.current) {
      prevCityRef.current = form.city;
      setForm((p) => ({ ...p, market: "" }));
    }
  }, [form.city]);

  // ✅ RUNTIME SAVE — debounced, every form change
  // Ye ensures back jaate waqt data save hota hai
  const doPersist = useCallback((data) => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const bid = billIdRef.current;
      if (!bid) return;
      persistCustomer(data, bid);
    }, 100); // 100ms debounce
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    doPersist(form);
  }, [form, isOpen, doPersist]);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    clearTimeout(persistTimer.current);
  }, []);

  // ── Search ──────────────────────────────────────────────────
  const doSearch = useCallback(async (term) => {
    const t = (term || "").trim();
    if (t.length < 2) {
      setSuggestions([]);
      setShowSug(false);
      setSugLoading(false);
      setHighlighted(-1);
      return;
    }
    const sid  = storeIdRef.current || "default";
    const hits = cacheSearch(t, sid);
    if (hits.length > 0) {
      setSuggestions(hits);
      setShowSug(true);
      setSugLoading(false);
      setHighlighted(-1);
      return;
    }
    setSugLoading(true);
    setShowSug(true);
    await cacheLoad(sid, false);
    const hits2 = cacheSearch(t, sid);
    setSuggestions(hits2);
    setShowSug(hits2.length > 0);
    setSugLoading(false);
    setHighlighted(-1);
  }, []);

  // ── Phone change ─────────────────────────────────────────────
  const handlePhoneChange = useCallback((value) => {
    const clean = allowIntl
      ? value.replace(/[^0-9+]/g, "").replace(/(?!^\+)\+/g, "")
      : value.replace(/\D/g, "");
    const norm = normalizePhone(clean);

    setForm((p) => ({ ...p, phone: clean }));
    setPhoneStatus(null);
    setActiveField("phone");
    setHighlighted(-1);
    clearTimeout(searchTimer.current);

    if (!norm) { setSuggestions([]); setShowSug(false); return; }

    if (norm.length >= 11) {
      const v = validatePhone(clean, allowIntl);
      if (!v?.valid) { setPhoneStatus("invalid"); setShowSug(false); return; }

      searchTimer.current = setTimeout(() => {
        const sid    = storeIdRef.current || "default";
        const cache  = _getStoreCache(sid);
        const cached = cache.byPhone.get(v.normalized);
        if (cached) {
          setForm((p) => ({
            ...p,
            name:   cached.name   || p.name,
            city:   cached.city   || p.city,
            market: cached.market || p.market,
          }));
          setPhoneStatus("found");
          setShowSug(false);
        } else {
          setPhoneStatus("not_found");
          setShowSug(false);
        }
      }, 100);
    } else if (norm.length >= 3) {
      searchTimer.current = setTimeout(() => doSearch(norm), 150);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }, [doSearch, allowIntl]);

  // ── Name change ──────────────────────────────────────────────
  const handleNameChange = useCallback((value) => {
    setForm((p) => ({ ...p, name: value }));
    setActiveField("name");
    setHighlighted(-1);
    clearTimeout(searchTimer.current);
    if (value.length >= 2) {
      searchTimer.current = setTimeout(() => doSearch(value), 150);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }, [doSearch]);

  // ── Pick suggestion ──────────────────────────────────────────
  const pickCustomer = useCallback((c) => {
    const phone = normalizePhone(c.phone || "") || c.phone || "";
    const nf = {
      name:   c.name   || "",
      phone,
      city:   c.city   || "Karachi",
      market: c.market || "",
    };
    setForm(nf);
    prevCityRef.current = nf.city;
    setPhoneStatus(phone ? "found" : null);
    setShowSug(false);
    setSuggestions([]);
    setActiveField("");
    setHighlighted(-1);
    // ✅ Immediate persist on pick
    persistCustomer(nf, billIdRef.current);
  }, []);

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    const v = form.phone ? validatePhone(form.phone, allowIntl) : null;
    if (v && !v.valid) { setPhoneStatus("invalid"); return; }

    submittedRef.current = true;

    const data = {
      name:   (form.name || "").trim(),
      phone:  normalizePhone(form.phone),
      city:   form.city   || "Karachi",
      market: form.market || "",
    };

    // ✅ Persist before submit (so back still works if dialog re-opens)
    persistCustomer(data, billIdRef.current);
    onSubmit(data);

    setTimeout(() => { submittedRef.current = false; }, 1000);
  }, [form, onSubmit, allowIntl]);

  // ── Keyboard navigation ──────────────────────────────────────
  const handleInputKeyDown = useCallback((e) => {
    if (showSug && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation();
        setHighlighted((p) => Math.min(p + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation();
        setHighlighted((p) => Math.max(p - 1, 0));
        return;
      }
      if (e.key === "Enter" && highlighted >= 0 && suggestions[highlighted]) {
        e.preventDefault();
        pickCustomer(suggestions[highlighted]);
        return;
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowSug(false);
        setHighlighted(-1);
        return;
      }
    }
    if (e.key === "Enter" && !showSug) {
      e.preventDefault();
      handleSubmit();
    }
  }, [showSug, highlighted, suggestions, pickCustomer, handleSubmit]);

  // ── Global ESC / F8 ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault(); e.stopPropagation();
        handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        if (showSug) {
          setShowSug(false); setHighlighted(-1);
          return;
        }
        e.preventDefault(); e.stopPropagation();
        // ✅ Save before close — data preserved on back
        persistCustomer(form, billIdRef.current);
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, handleSubmit, onClose, form, showSug]);

  // ── Save to DB only ──────────────────────────────────────────
  const handleSaveOnly = useCallback(async () => {
    const name  = (form.name || "").trim();
    const phone = normalizePhone(form.phone);
    if (!name && !phone) return;
    const v = form.phone ? validatePhone(form.phone, allowIntl) : null;
    if (v && !v.valid) { setPhoneStatus("invalid"); return; }
    setSaving(true);
    try {
      const sid   = storeIdRef.current || "default";
      const docId = phone
        ? `${sid}_phone_${phone}`
        : `${sid}_name_${name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40).toLowerCase()}`;
      await setDoc(doc(db, "customers", docId), {
        name, nameLower: name.toLowerCase(),
        phone, phoneNormalized: phone,
        city: form.city, market: form.market,
        storeId: sid, billerId: billerId || null,
        isWalking: false,
        updatedAt: serverTimestamp(), createdAt: serverTimestamp(),
      }, { merge: true });
      cacheUpsert({ name, phone, city: form.city, market: form.market }, sid);
      setSaveOk(true);
      refreshRecent(sid);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {}
    setSaving(false);
  }, [form, billerId, allowIntl, refreshRecent]);

  const handleFieldBlur = useCallback((field) => {
    setTimeout(() => {
      if (activeFieldRef.current === field) {
        setShowSug(false);
        setActiveField("");
        setHighlighted(-1);
      }
    }, 220);
  }, []);

  const addCity = useCallback(() => {
    const c = newCity.trim();
    if (!c) return;
    onAddCity?.(c);
    setForm((p) => ({ ...p, city: c, market: "" }));
    prevCityRef.current = c;
    setNewCity("");
  }, [newCity, onAddCity]);

  const addMarket = useCallback(() => {
    const m = newMarket.trim();
    if (!m) return;
    onAddMarket?.(m);
    setForm((p) => ({ ...p, market: m }));
    setNewMarket("");
  }, [newMarket, onAddMarket]);

  // ✅ Close — always persist before closing
  const handleClose = useCallback(() => {
    persistCustomer(form, billIdRef.current);
    onClose();
  }, [form, onClose]);

  if (!isOpen) return null;

  const inp = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"
  }`;
  const lbl = `mb-1 block text-[10px] font-semibold uppercase tracking-wide ${
    isDark ? "text-gray-400" : "text-gray-600"
  }`;
  const cache = _getStoreCache(storeIdRef.current || "default");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.1 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <User size={14} className="text-yellow-500" />
            <h2 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Details
            </h2>
            {!cacheReady && (
              <Loader2 size={12} className="animate-spin text-yellow-500 ml-1" />
            )}
            {cacheReady && cache.items.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                isDark ? "bg-green-500/15 text-green-400" : "bg-green-50 text-green-600"
              }`}>
                {cache.items.length} loaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* ✅ Persist indicator — shows data is saved */}
            {(form.name || form.phone) && (
              <span className={`text-[8px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                isDark ? "text-green-400/60" : "text-green-600/60"
              }`}>
                <Check size={7} />saved
              </span>
            )}
            <button
              type="button"
              onClick={() => { setAllowIntl((p) => !p); setPhoneStatus(null); }}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition ${
                allowIntl
                  ? isDark ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                           : "bg-blue-50 border-blue-200 text-blue-600"
                  : isDark ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                           : "bg-yellow-50 border-yellow-200 text-yellow-600"
              }`}
            >
              <Globe size={10} />
              {allowIntl ? "🌐 INTL" : "🇵🇰 PK"}
            </button>
            <span className={`text-[9px] px-2 py-1 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              F8 Submit
            </span>
            <button type="button" onClick={handleClose} className="rounded-lg p-1 hover:bg-black/10">
              <X size={13} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-4 space-y-3 max-h-[72vh] overflow-y-auto">

          {/* Recent customers */}
          {recentCusts.length > 0 && !form.phone && (
            <div>
              <label className={lbl}>
                Recent Customers ({recentCusts.length})
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {recentCusts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className={`flex-shrink-0 rounded-xl px-3 py-2 text-left text-xs border transition min-w-[90px] active:scale-95 ${
                      isDark
                        ? "border-yellow-500/20 bg-white/5 hover:bg-yellow-500/10 text-white"
                        : "border-yellow-200 bg-yellow-50 hover:bg-yellow-100 text-gray-900"
                    }`}
                  >
                    <div className="font-semibold truncate max-w-[90px]">{c.name}</div>
                    {c.phone && (
                      <div className="text-[9px] text-gray-500 font-mono mt-0.5">{c.phone}</div>
                    )}
                    {c.city && (
                      <div className="text-[8px] text-gray-500 mt-0.5">{c.city}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Phone ── */}
          <div>
            <label className={lbl}>
              <Phone size={9} className="inline mr-1" />Phone
              <span className="text-gray-500 normal-case font-normal ml-1">
                {allowIntl ? "— international" : "— Pakistan (03XX-XXXXXXX)"}
              </span>
            </label>
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={phoneRef}
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onFocus={() => {
                  setActiveField("phone");
                  const d = normalizePhone(form.phone);
                  if (d.length >= 3 && d.length < 11) doSearch(d);
                }}
                onBlur={() => handleFieldBlur("phone")}
                onKeyDown={handleInputKeyDown}
                placeholder={allowIntl ? "+1234567890" : "03XXXXXXXXX"}
                className={`${inp} pl-9`}
              />
              {sugLoading && activeField === "phone" && (
                <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              <AnimatePresence>
                {showSug && activeField === "phone" && (
                  <motion.div
                    data-dropdown-open="true"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`absolute top-full left-0 right-0 z-[999] mt-1 rounded-xl border shadow-2xl max-h-52 overflow-y-auto ${
                      isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"
                    }`}
                  >
                    {sugLoading ? (
                      <div className="flex items-center justify-center py-4 gap-2">
                        <Loader2 size={14} className="animate-spin text-yellow-500" />
                        <span className="text-xs text-gray-400">Searching…</span>
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((c, i) => (
                        <SugItem key={c.id || i} c={c} onSelect={pickCustomer}
                          isDark={isDark} isHighlighted={i === highlighted} />
                      ))
                    ) : (
                      <div className={`px-3 py-4 text-xs text-center ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>
                        <AlertCircle size={14} className="inline mr-1.5 text-orange-400" />
                        No customer found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Phone status messages */}
            {phoneStatus === "found" && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <Check size={10} />Found — data auto-filled
              </p>
            )}
            {phoneStatus === "not_found" && (
              <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />New customer — will be saved
              </p>
            )}
            {phoneStatus === "invalid" && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />
                {allowIntl ? "Invalid format" : "Must be 03XXXXXXXXX (11 digits)"}
              </p>
            )}
          </div>

          {/* ── Name ── */}
          <div>
            <label className={lbl}>
              <User size={9} className="inline mr-1" />Name
              <span className="text-gray-500 normal-case font-normal ml-1">
                — leave empty for auto
              </span>
            </label>
            <div className="relative">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => {
                  setActiveField("name");
                  if (form.name.length >= 2) doSearch(form.name);
                }}
                onBlur={() => handleFieldBlur("name")}
                onKeyDown={handleInputKeyDown}
                placeholder="Search or type name…"
                className={`${inp} pl-9`}
              />
              {sugLoading && activeField === "name" && (
                <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              <AnimatePresence>
                {showSug && activeField === "name" && (
                  <motion.div
                    data-dropdown-open="true"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`absolute top-full left-0 right-0 z-[999] mt-1 rounded-xl border shadow-2xl max-h-52 overflow-y-auto ${
                      isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"
                    }`}
                  >
                    {sugLoading ? (
                      <div className="flex items-center justify-center py-4 gap-2">
                        <Loader2 size={14} className="animate-spin text-yellow-500" />
                        <span className="text-xs text-gray-400">Searching…</span>
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((c, i) => (
                        <SugItem key={c.id || i} c={c} onSelect={pickCustomer}
                          isDark={isDark} isHighlighted={i === highlighted} />
                      ))
                    ) : (
                      <div className={`px-3 py-4 text-xs text-center ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}>
                        <AlertCircle size={14} className="inline mr-1.5 text-orange-400" />
                        No customer found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── City + Market ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>
                <MapPin size={9} className="inline mr-1" />City
              </label>
              {/* ✅ Selected city shows correctly */}
              <select
                value={form.city || ""}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className={inp}
              >
                <option value="">Select City</option>
                {allCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Add city"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"
                  }`}
                />
                <button type="button" onClick={addCity}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30">
                  <Plus size={9} />
                </button>
              </div>
            </div>
            <div>
              <label className={lbl}>
                <Store size={9} className="inline mr-1" />Market
              </label>
              {/* ✅ Selected market shows correctly */}
              <select
                value={form.market || ""}
                onChange={(e) => setForm((p) => ({ ...p, market: e.target.value }))}
                className={inp}
              >
                <option value="">{allMarkets.length ? "Select Market" : "None"}</option>
                {allMarkets.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text"
                  value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value)}
                  placeholder="Add market"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMarket(); } }}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"
                  }`}
                />
                <button type="button" onClick={addMarket}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30">
                  <Plus size={9} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Save to DB ── */}
          {(form.name.trim() || normalizePhone(form.phone)) && (
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={saving}
              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                saveOk
                  ? isDark ? "border border-green-500/30 bg-green-500/15 text-green-400"
                           : "border border-green-200 bg-green-50 text-green-700"
                  : isDark ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                           : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saveOk ? <><Check size={11} />Saved!</> : <><UserPlus size={11} />Save to Database</>}
            </button>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {cache.items.length > 0 && (
              <span className="mr-2">📋 {cache.items.length}</span>
            )}
            {/* ✅ User ko pata chale data saved hai */}
            ESC = back <span className="text-green-400">(data saved ✓)</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition border ${
                isDark
                  ? "border-gray-700 text-gray-400 hover:bg-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 active:scale-95 transition-transform"
            >
              Continue (F8) →
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default memo(CustomerDialog);