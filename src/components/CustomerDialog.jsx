// src/components/CustomerDialog.jsx
// ✅ FINAL PRODUCTION — Auto serial, no duplicates, exact search, store-isolated

import {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { motion } from "framer-motion";
import {
  X, User, Phone, MapPin, Store, Plus, UserPlus,
  Loader2, AlertCircle, Check,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  collection, doc, setDoc, serverTimestamp,
  query, where, getDocs, limit, runTransaction,
} from "firebase/firestore";
import { db } from "../services/firebase";

// ═══════════════════════════════════════════════════════════════════════
// ✅ PHONE HELPERS — Final Safe Version
// ═══════════════════════════════════════════════════════════════════════
const normalizePhone = (input = "") => {
  if (!input) return "";
  // Strip everything except digits
  let digits = String(input).replace(/\D/g, "");

  // Handle Pakistan formats
  if (digits.startsWith("0092"))                       digits = "0" + digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = "0" + digits.slice(2);

  // 10-digit starting with 3 → prefix 0
  if (digits.length === 10 && digits.startsWith("3")) digits = "0" + digits;

  return digits;
};

const PK_PHONE = /^03[0-9]{9}$/;

// ═══════════════════════════════════════════════════════════════════════
// CITY / MARKET DATA
// ═══════════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════════
// ✅ AUTO SERIAL — Transaction-safe Customer 1, Customer 2 ...
// ═══════════════════════════════════════════════════════════════════════
const getNextCustomerNumber = async (storeId) => {
  const sid        = storeId || "default";
  const counterRef = doc(db, "counters", `customer_${sid}`);

  const next = await runTransaction(db, async (tx) => {
    const snap    = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value || 0) : 0;
    const nextVal = current + 1;
    tx.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });

  return `Customer ${next}`;
};

// ═══════════════════════════════════════════════════════════════════════
// ✅ MODULE-LEVEL CACHE
// ═══════════════════════════════════════════════════════════════════════
const _cache = {
  items:    [],
  byPhone:  new Map(),
  byId:     new Map(),
  loaded:   false,
  storeId:  null,
  loading:  false,
  loadedAt: 0,
};

const CACHE_TTL = 90_000;

const cacheUpsert = (raw) => {
  if (!raw) return null;

  const phone = normalizePhone(raw.phone || "");
  const name  = (raw.name || "").trim();
  const id    = raw.id   || "";

  if (!phone && !name && !id) return null;

  // Update existing by phone
  if (phone && _cache.byPhone.has(phone)) {
    const ex = _cache.byPhone.get(phone);
    if (name)       ex.name   = name;
    if (raw.city)   ex.city   = raw.city;
    if (raw.market) ex.market = raw.market;
    if (id) { ex.id = id; _cache.byId.set(id, ex); }
    return ex;
  }

  // Update existing by id
  if (id && _cache.byId.has(id)) {
    const ex = _cache.byId.get(id);
    if (name)   ex.name   = name;
    if (phone) { ex.phone = phone; _cache.byPhone.set(phone, ex); }
    if (raw.city)   ex.city   = raw.city;
    if (raw.market) ex.market = raw.market;
    return ex;
  }

  // New entry
  const entry = {
    id:     id || `rt_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name,
    phone,
    city:   raw.city   || "",
    market: raw.market || "",
  };

  _cache.items.unshift(entry);
  if (phone) _cache.byPhone.set(phone, entry);
  if (id)    _cache.byId.set(id, entry);

  return entry;
};

const cacheLoad = async (storeId, force = false) => {
  const sid = storeId || "default";

  if (
    !force &&
    _cache.loaded &&
    _cache.storeId === sid &&
    Date.now() - _cache.loadedAt < CACHE_TTL
  ) return true;

  if (_cache.loading) {
    let n = 0;
    while (_cache.loading && n++ < 30) {
      await new Promise(r => setTimeout(r, 100));
    }
    return _cache.loaded;
  }

  _cache.loading = true;
  try {
    const snap = await getDocs(query(
      collection(db, "customers"),
      where("storeId", "==", sid),
      limit(2000),
    ));

    _cache.items   = [];
    _cache.byPhone = new Map();
    _cache.byId    = new Map();

    snap.docs.forEach(d => cacheUpsert({ id: d.id, ...d.data() }));

    _cache.loaded   = true;
    _cache.storeId  = sid;
    _cache.loadedAt = Date.now();

    return true;
  } catch (e) {
    console.error("[CustCache] Load error:", e?.code, e?.message);
    return false;
  } finally {
    _cache.loading = false;
  }
};

const cacheSearch = (term) => {
  if (!term || term.trim().length < 2) return [];

  const lower     = term.toLowerCase().trim();
  const digits    = term.replace(/\D/g, "");
  const isPhone   = digits.length >= 3;
  const out       = [];
  const seen      = new Set();

  for (const c of _cache.items) {
    if (out.length >= 15) break;

    const cPhone = (c.phone || "").replace(/\D/g, "");
    const cName  = (c.name  || "").toLowerCase();
    const cCity  = (c.city  || "").toLowerCase();

    let matched = false;

    if (isPhone && cPhone) {
      matched = cPhone.startsWith(digits) || cPhone.includes(digits);
    }
    if (!matched && lower.length >= 2 && cName) {
      matched = cName.includes(lower);
    }
    if (!matched && lower.length >= 3 && cCity) {
      matched = cCity.includes(lower);
    }

    if (matched) {
      const key = cPhone || cName || c.id;
      if (!seen.has(key)) { seen.add(key); out.push(c); }
    }
  }

  out.sort((a, b) => {
    const aP = (a.phone || "").replace(/\D/g, "");
    const bP = (b.phone || "").replace(/\D/g, "");
    const aN = (a.name  || "").toLowerCase();
    const bN = (b.name  || "").toLowerCase();

    if (isPhone) {
      const aS = aP.startsWith(digits), bS = bP.startsWith(digits);
      if (aS && !bS) return -1;
      if (!aS && bS) return  1;
    }
    const aS = aN.startsWith(lower), bS = bN.startsWith(lower);
    if (aS && !bS) return -1;
    if (!aS && bS) return  1;
    return 0;
  });

  return out;
};

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════
const SugItem = memo(({ c, onSelect, isDark }) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onSelect(c); }}
    className={`w-full text-left px-3 py-2.5 text-sm
      hover:bg-yellow-500/10 border-b last:border-0 transition-colors
      ${isDark ? "text-white border-yellow-500/10" : "text-gray-900 border-gray-100"}`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <User size={11} className={`shrink-0 ${isDark ? "text-yellow-500/50" : "text-yellow-400"}`} />
        <span className="font-semibold truncate">{c.name || "No Name"}</span>
      </div>
      {c.phone && (
        <span className={`font-mono text-xs shrink-0 font-bold px-1.5 py-0.5 rounded
          ${isDark ? "text-yellow-400 bg-yellow-500/10" : "text-yellow-700 bg-yellow-50"}`}>
          {c.phone}
        </span>
      )}
    </div>
    {(c.city || c.market) && (
      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ml-5
        ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        <MapPin size={8} />
        {[c.city, c.market].filter(Boolean).join(" • ")}
      </p>
    )}
  </button>
));
SugItem.displayName = "SugItem";

const SugList = memo(({ items, loading, show, onSelect, isDark }) => {
  if (!show) return null;
  return (
    <div className={`absolute top-full left-0 right-0 z-[999] mt-1
      rounded-xl border shadow-2xl max-h-52 overflow-y-auto
      ${isDark ? "bg-[#1a1508] border-yellow-500/30" : "bg-white border-yellow-200"}`}>
      {loading ? (
        <div className="flex items-center justify-center py-4 gap-2">
          <Loader2 size={14} className="animate-spin text-yellow-500" />
          <span className="text-xs text-gray-400">Searching…</span>
        </div>
      ) : items.length > 0 ? (
        items.map((c, i) => (
          <SugItem key={c.id || `${c.phone}-${i}`} c={c} onSelect={onSelect} isDark={isDark} />
        ))
      ) : (
        <div className={`px-3 py-4 text-xs text-center
          ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          <AlertCircle size={14} className="inline mr-1.5 text-orange-400" />
          No customer found — will be saved as new
        </div>
      )}
    </div>
  );
});
SugList.displayName = "SugList";

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const CustomerDialog = ({
  isOpen,
  initialCustomer,
  onSubmit,
  onClose,
  runtimeCities  = [],
  runtimeMarkets = [],
  onAddCity,
  onAddMarket,
  isSuperAdmin,
  storeId,
  billerId,
}) => {
  const { isDark } = useTheme();

  const phoneRef       = useRef(null);
  const submittedRef   = useRef(false);
  const searchTimer    = useRef(null);
  const prevCityRef    = useRef("Karachi");
  const activeFieldRef = useRef("");

  const [form,        setForm]        = useState({ name: "", phone: "", city: "Karachi", market: "" });
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState(false);
  const [phoneStatus, setPhoneStatus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug,     setShowSug]     = useState(false);
  const [sugLoading,  setSugLoading]  = useState(false);
  const [activeField, setActiveField] = useState("");
  const [recentCusts, setRecentCusts] = useState([]);
  const [cacheReady,  setCacheReady]  = useState(false);
  const [newCity,     setNewCity]     = useState("");
  const [newMarket,   setNewMarket]   = useState("");

  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);

  const allCities = useMemo(
    () => [...new Set([...BASE_CITIES, ...runtimeCities])].sort(),
    [runtimeCities],
  );

  const allMarkets = useMemo(() => {
    const base = CITY_MARKETS[form.city] || [];
    return [...new Set([...base, ...runtimeMarkets])];
  }, [form.city, runtimeMarkets]);

  // ── Refresh recent (exclude serial + walking) ──────────────────────
  const refreshRecent = useCallback(() => {
    setRecentCusts(
      _cache.items
        .filter(c =>
          c.name?.trim() &&
          !/^Customer\s+\d+$/i.test(c.name) &&
          !/^Walking Customer$/i.test(c.name)
        )
        .slice(0, 8)
    );
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // ON OPEN
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isOpen) return;

    submittedRef.current = false;
    setSaveOk(false);
    setPhoneStatus(null);
    setSuggestions([]);
    setShowSug(false);
    setActiveField("");
    setCacheReady(false);

    const initName   = initialCustomer?.name   || "";
    const initPhone  = initialCustomer?.phone  || "";
    const initCity   = initialCustomer?.city   || "Karachi";
    const initMarket = initialCustomer?.market || "";

    setForm({ name: initName, phone: initPhone, city: initCity, market: initMarket });
    prevCityRef.current = initCity;

    setTimeout(() => phoneRef.current?.focus(), 80);

    const needReload =
      !_cache.loaded ||
      _cache.storeId !== (storeId || "default") ||
      Date.now() - _cache.loadedAt > CACHE_TTL;

    cacheLoad(storeId, needReload).then(ok => {
      setCacheReady(true);
      refreshRecent();

      if (ok && initPhone) {
        const norm = normalizePhone(initPhone);
        if (norm && PK_PHONE.test(norm)) {
          const found = _cache.byPhone.get(norm);
          if (found) setPhoneStatus("found");
        }
      }
    }).catch(() => setCacheReady(true));

  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // City change → clear market
  useEffect(() => {
    if (form.city !== prevCityRef.current) {
      prevCityRef.current = form.city;
      setForm(p => ({ ...p, market: "" }));
    }
  }, [form.city]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // ════════════════════════════════════════════════════════════════════
  // ✅ SEARCH — cache first → Firestore fallback
  // ════════════════════════════════════════════════════════════════════
  const doSearch = useCallback(async (term) => {
    const trimmed = (term || "").trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSug(false);
      setSugLoading(false);
      return;
    }

    // Step 1: Cache instant
    if (_cache.loaded && _cache.storeId === (storeId || "default")) {
      const hits = cacheSearch(trimmed);
      if (hits.length > 0) {
        setSuggestions(hits);
        setShowSug(true);
        setSugLoading(false);
        return;
      }
    }

    // Step 2: Load cache if missing/wrong store
    if (!_cache.loaded || _cache.storeId !== (storeId || "default")) {
      setSugLoading(true);
      setShowSug(true);
      await cacheLoad(storeId, true);
      setCacheReady(true);
      const hits = cacheSearch(trimmed);
      if (hits.length > 0) {
        setSuggestions(hits);
        setSugLoading(false);
        return;
      }
    }

    // Step 3: Firestore fallback
    setSugLoading(true);
    setShowSug(true);

    const sid    = storeId || "default";
    const digits = trimmed.replace(/\D/g, "");
    const lower  = trimmed.toLowerCase();
    const results = [];
    const seen    = new Set();

    const addDoc = (d) => {
      const c   = { id: d.id, ...d.data() };
      const key = normalizePhone(c.phone) || c.name || c.id;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(c);
        cacheUpsert(c);
      }
    };

    try {
      // Phone search
      if (digits.length >= 3) {
        const [s1, s2] = await Promise.all([
          getDocs(query(
            collection(db, "customers"),
            where("storeId", "==", sid),
            where("phone", ">=", digits),
            where("phone", "<=", digits + "\uf8ff"),
            limit(10),
          )).catch(() => ({ docs: [] })),

          getDocs(query(
            collection(db, "customers"),
            where("storeId", "==", sid),
            where("phoneNormalized", ">=", digits),
            where("phoneNormalized", "<=", digits + "\uf8ff"),
            limit(10),
          )).catch(() => ({ docs: [] })),
        ]);
        [...s1.docs, ...s2.docs].forEach(addDoc);
      }

      // Name search
      if (lower.length >= 2 && results.length < 12) {
        const s3 = await getDocs(query(
          collection(db, "customers"),
          where("storeId",   "==", sid),
          where("nameLower", ">=", lower),
          where("nameLower", "<=", lower + "\uf8ff"),
          limit(10),
        )).catch(() => ({ docs: [] }));

        s3.docs.forEach(addDoc);

        // Cache contains fallback
        if (results.length === 0) {
          _cache.items
            .filter(c => (c.name || "").toLowerCase().includes(lower))
            .slice(0, 10)
            .forEach(c => {
              const key = c.phone || c.name || c.id;
              if (!seen.has(key)) { seen.add(key); results.push(c); }
            });
        }
      }

      setSuggestions(results);
      setShowSug(true);
    } catch (e) {
      console.warn("[doSearch] Error:", e?.message);
      const fallback = _cache.items
        .filter(c =>
          (c.phone || "").includes(digits || lower) ||
          (c.name  || "").toLowerCase().includes(lower)
        )
        .slice(0, 10);
      setSuggestions(fallback);
      setShowSug(fallback.length > 0);
    } finally {
      setSugLoading(false);
    }
  }, [storeId]);

  // ════════════════════════════════════════════════════════════════════
  // ✅ EXACT PHONE LOOKUP — cache + Firestore both fields + storeId
  // ════════════════════════════════════════════════════════════════════
  const lookupExactPhone = useCallback(async (targetPhone) => {
    // 1. Cache hit
    const cached = _cache.byPhone.get(targetPhone);
    if (cached) {
      setForm(p => ({
        ...p,
        name:   cached.name   || p.name,
        city:   cached.city   || p.city,
        market: cached.market || p.market,
      }));
      prevCityRef.current = cached.city || "Karachi";
      setPhoneStatus("found");
      setShowSug(false);
      return;
    }

    // 2. Firestore — both fields, always storeId filtered
    const sid = storeId || "default";
    setSugLoading(true);

    try {
      const [s1, s2] = await Promise.all([
        getDocs(query(
          collection(db, "customers"),
          where("storeId", "==", sid),
          where("phone",   "==", targetPhone),
          limit(1),
        )).catch(() => ({ docs: [] })),

        getDocs(query(
          collection(db, "customers"),
          where("storeId",         "==", sid),
          where("phoneNormalized", "==", targetPhone),
          limit(1),
        )).catch(() => ({ docs: [] })),
      ]);

      const found = s1.docs[0] || s2.docs[0];

      if (found) {
        const data = { id: found.id, ...found.data() };
        setForm(p => ({
          ...p,
          name:   data.name   || p.name,
          city:   data.city   || p.city,
          market: data.market || p.market,
        }));
        prevCityRef.current = data.city || "Karachi";
        setPhoneStatus("found");
        cacheUpsert(data);
      } else {
        setPhoneStatus("not_found");
      }
    } catch (e) {
      console.warn("[lookupExactPhone] Error:", e?.message);
      setPhoneStatus(null);
    } finally {
      setSugLoading(false);
      setShowSug(false);
    }
  }, [storeId]);

  // ════════════════════════════════════════════════════════════════════
  // ✅ PHONE CHANGE — Clean normalization, no gap
  // ════════════════════════════════════════════════════════════════════
  const handlePhoneChange = useCallback((value) => {
    // Allow only digits and formatting chars in UI
    const cleanUI = value.replace(/[^0-9+\-]/g, "");

    // Always normalize to get clean digits
    const norm   = normalizePhone(cleanUI);
    const digits = norm; // norm is already pure digits after normalizePhone

    setForm(p => ({ ...p, phone: cleanUI }));
    setPhoneStatus(null);
    setActiveField("phone");
    clearTimeout(searchTimer.current);

    if (digits.length === 0) {
      setSuggestions([]);
      setShowSug(false);
      return;
    }

    if (digits.length >= 11) {
      // Full number typed
      if (!PK_PHONE.test(norm)) {
        setPhoneStatus("invalid");
        setShowSug(false);
        return;
      }
      // ✅ Exact lookup using clean normalized 11-digit
      searchTimer.current = setTimeout(() => lookupExactPhone(norm), 180);

    } else if (digits.length >= 3) {
      // Partial → suggestion dropdown
      searchTimer.current = setTimeout(() => doSearch(digits), 150);

    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }, [doSearch, lookupExactPhone]);

  const handleNameChange = useCallback((value) => {
    setForm(p => ({ ...p, name: value }));
    setActiveField("name");
    clearTimeout(searchTimer.current);

    if (value.length >= 2) {
      searchTimer.current = setTimeout(() => doSearch(value), 150);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }, [doSearch]);

  // ════════════════════════════════════════════════════════════════════
  // PICK CUSTOMER
  // ════════════════════════════════════════════════════════════════════
  const pickCustomer = useCallback((c) => {
    const phone = normalizePhone(c.phone || "") || c.phone || "";
    setForm({
      name:   c.name   || "",
      phone,
      city:   c.city   || "Karachi",
      market: c.market || "",
    });
    prevCityRef.current = c.city || "Karachi";
    setPhoneStatus(phone ? "found" : null);
    setShowSug(false);
    setSuggestions([]);
    setActiveField("");
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // ✅ SAVE TO FIREBASE
  // Deterministic ID by phone → ZERO duplicates
  // isWalking = true only for serial names (Customer 1, Customer 2)
  // Admin name update → same doc, isWalking becomes false
  // ════════════════════════════════════════════════════════════════════
  const saveToFirebase = useCallback(async (data) => {
    const sid   = storeId || "default";
    const phone = normalizePhone(data.phone || "");
    let   name  = (data.name || "").trim();

    if (!phone && !name) return { ok: false };
    if (phone && !PK_PHONE.test(phone)) return { ok: false, error: "invalid_phone" };

    // Auto-serial if only phone, no name
    if (!name && phone) {
      try {
        name = await getNextCustomerNumber(sid);
      } catch {
        name = `Customer_${Date.now()}`;
      }
    }

    // ✅ Deterministic doc ID — phone wins, then name-based
    const docId = phone
      ? `${sid}_${phone}`
      : `${sid}_${name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}`;

    // isWalking = true only while name is still serial
    // When admin sets real name → isWalking = false automatically
    const isSerial  = /^Customer\s+\d+$/i.test(name);
    const isWalking = isSerial;

    const payload = {
      name,
      nameLower:       name.toLowerCase(),
      phone,
      phoneNormalized: phone,
      city:            data.city   || "Karachi",
      market:          data.market || "",
      storeId:         sid,
      billerId:        billerId || null,
      createdBy:       billerId || null,
      isWalking,
      updatedAt:       serverTimestamp(),
      createdAt:       serverTimestamp(), // merge:true won't overwrite existing
    };

    try {
      await setDoc(doc(db, "customers", docId), payload, { merge: true });
      cacheUpsert({ id: docId, name, phone, city: data.city, market: data.market });
      return { ok: true, id: docId };
    } catch (e) {
      console.warn("[saveToFirebase] Error:", e?.message);
      return { ok: false, error: e?.message };
    }
  }, [storeId, billerId]);

  // ── Manual Save Button ────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const name  = form.name.trim();
    const phone = normalizePhone(form.phone);

    if (!name && !phone) return;
    if (phone && !PK_PHONE.test(phone)) { setPhoneStatus("invalid"); return; }

    setSaving(true);
    const r = await saveToFirebase({ name, phone, city: form.city, market: form.market });

    if (r.ok) {
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      refreshRecent();
    } else if (r.error === "invalid_phone") {
      setPhoneStatus("invalid");
    }
    setSaving(false);
  }, [form, saveToFirebase, refreshRecent]);

  // ════════════════════════════════════════════════════════════════════
  // ✅ SUBMIT — instant callback + background save
  // Only phone → auto Customer N
  // With name → save as-is
  // ════════════════════════════════════════════════════════════════════
  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;

    const phone = normalizePhone(form.phone);

    if (phone && !PK_PHONE.test(phone)) {
      setPhoneStatus("invalid");
      return;
    }

    submittedRef.current = true;

    let name = form.name.trim();

    // ✅ Only phone entered, no name → auto serial
    if (!name && phone) {
      try {
        name = await getNextCustomerNumber(storeId || "default");
      } catch {
        name = `Customer_${Date.now()}`;
      }
    }

    const data = { name, phone, city: form.city, market: form.market };

    // Background save — non-blocking
    queueMicrotask(() => {
      saveToFirebase(data);
      cacheUpsert({ name, phone, city: data.city, market: data.market });
    });

    // Instant UI response
    onSubmit(data);

    setTimeout(() => { submittedRef.current = false; }, 1000);
  }, [form, onSubmit, storeId, saveToFirebase]);

  // ── Keyboard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "F8")     { e.preventDefault(); e.stopPropagation(); handleSubmit(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen, handleSubmit, onClose]);

  // ── Add City / Market ─────────────────────────────────────────────
  const addCity = useCallback(() => {
    const c = newCity.trim();
    if (!c) return;
    onAddCity?.(c);
    setForm(p => ({ ...p, city: c, market: "" }));
    prevCityRef.current = c;
    setNewCity("");
  }, [newCity, onAddCity]);

  const addMarket = useCallback(() => {
    const m = newMarket.trim();
    if (!m) return;
    onAddMarket?.(m);
    setForm(p => ({ ...p, market: m }));
    setNewMarket("");
  }, [newMarket, onAddMarket]);

  // ── Blur handler ─────────────────────────────────────────────────
  const handleFieldBlur = useCallback((field) => {
    setTimeout(() => {
      if (activeFieldRef.current === field) {
        setShowSug(false);
        setActiveField("");
      }
    }, 220);
  }, []);

  if (!isOpen) return null;

  const inp = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
      : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"
  }`;

  const lbl = `mb-1 block text-[10px] font-semibold uppercase tracking-wide ${
    isDark ? "text-gray-400" : "text-gray-600"
  }`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.1 }}
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? "bg-[#15120d] border border-yellow-500/20" : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <User size={14} className="text-yellow-500" />
            <h2 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Customer Details
            </h2>
            {!cacheReady && <Loader2 size={12} className="animate-spin text-yellow-500 ml-1" />}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-1 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>F8 Submit</span>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10">
              <X size={13} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[72vh] overflow-y-auto">

          {/* Recent Customers */}
          {recentCusts.length > 0 &&
           !form.phone &&
           (!form.name || form.name === initialCustomer?.name) && (
            <div>
              <label className={lbl}>Recent Customers</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {recentCusts.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className={`flex-shrink-0 rounded-xl px-3 py-2 text-left text-xs
                      border transition min-w-[90px] active:scale-95 ${
                      isDark
                        ? "border-yellow-500/20 bg-white/5 hover:bg-yellow-500/10 text-white"
                        : "border-yellow-200 bg-yellow-50 hover:bg-yellow-100 text-gray-900"
                    }`}
                  >
                    <div className="font-semibold truncate max-w-[90px]">{c.name}</div>
                    {c.phone && <div className="text-[9px] text-gray-500 font-mono mt-0.5">{c.phone}</div>}
                    {c.city  && <div className="text-[8px] text-gray-500 mt-0.5">{c.city}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Phone */}
          <div>
            <label className={lbl}>
              <Phone size={9} className="inline mr-1" />Phone
              <span className="text-gray-500 normal-case font-normal ml-1">— type to search</span>
            </label>
            <div className="relative">
              <Phone size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={phoneRef}
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                onFocus={() => {
                  setActiveField("phone");
                  const d = normalizePhone(form.phone);
                  if (d.length >= 3 && d.length < 11) doSearch(d);
                }}
                onBlur={() => handleFieldBlur("phone")}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }}}
                placeholder="03XX-XXXXXXX"
                className={`${inp} pl-9`}
              />
              {sugLoading && activeField === "phone" && (
                <Loader2 size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              {showSug && activeField === "phone" && (
                <SugList items={suggestions} loading={sugLoading} show onSelect={pickCustomer} isDark={isDark} />
              )}
            </div>

            {phoneStatus === "found" && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <Check size={10} />Customer found — details filled
              </p>
            )}
            {phoneStatus === "not_found" && (
              <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />New customer — will be saved
              </p>
            )}
            {phoneStatus === "invalid" && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={10} />Invalid — use 03XXXXXXXXX
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className={lbl}>
              <User size={9} className="inline mr-1" />Name
              <span className="text-gray-500 normal-case font-normal ml-1">— search by name</span>
            </label>
            <div className="relative">
              <User size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                onFocus={() => {
                  setActiveField("name");
                  if (form.name.length >= 2) doSearch(form.name);
                }}
                onBlur={() => handleFieldBlur("name")}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }}}
                placeholder="Search or type name…"
                className={`${inp} pl-9`}
              />
              {sugLoading && activeField === "name" && (
                <Loader2 size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-yellow-500" />
              )}
              {showSug && activeField === "name" && (
                <SugList items={suggestions} loading={sugLoading} show onSelect={pickCustomer} isDark={isDark} />
              )}
            </div>
          </div>

          {/* City + Market */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}><MapPin size={9} className="inline mr-1" />City</label>
              <select
                value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                className={inp}
              >
                <option value="">Select City</option>
                {allCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newCity}
                  onChange={e => setNewCity(e.target.value)}
                  placeholder="Add city"
                  onKeyDown={e => e.key === "Enter" && addCity()}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"
                  }`}
                />
                <button onClick={addCity}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30">
                  <Plus size={9} />
                </button>
              </div>
            </div>
            <div>
              <label className={lbl}><Store size={9} className="inline mr-1" />Market</label>
              <select
                value={form.market}
                onChange={e => setForm(p => ({ ...p, market: e.target.value }))}
                className={inp}
              >
                <option value="">{allMarkets.length ? "Select Market" : "None"}</option>
                {allMarkets.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-1 flex gap-1">
                <input
                  type="text" value={newMarket}
                  onChange={e => setNewMarket(e.target.value)}
                  placeholder="Add market"
                  onKeyDown={e => e.key === "Enter" && addMarket()}
                  className={`flex-1 rounded-lg border px-2 py-1 text-[10px] outline-none ${
                    isDark ? "border-yellow-500/20 bg-[#0f0d09] text-white" : "border-yellow-200 bg-white"
                  }`}
                />
                <button onClick={addMarket}
                  className="rounded-lg bg-yellow-500/20 px-2 text-yellow-500 hover:bg-yellow-500/30">
                  <Plus size={9} />
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {(form.name.trim() || normalizePhone(form.phone)) && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition
                flex items-center justify-center gap-1.5 ${
                saveOk
                  ? isDark
                    ? "border border-green-500/30 bg-green-500/15 text-green-400"
                    : "border border-green-200 bg-green-50 text-green-700"
                  : isDark
                    ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                    : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saveOk ? <><Check size={11} />Saved!</> : <><UserPlus size={11} />Save to Database</>}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {_cache.items.length > 0 && (
              <span className="mr-2">📋 {_cache.items.length} loaded</span>
            )}
            Empty name = auto Customer N
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition border ${
                isDark
                  ? "border-gray-700 text-gray-400 hover:bg-gray-800"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              ESC
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500
                px-5 py-2 text-sm font-bold text-black
                hover:from-yellow-400 hover:to-amber-400 active:scale-95 transition-transform"
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