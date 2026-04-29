// src/hooks/useMultiTab.js
// ✅ COMPLETE — per-tab bill state, draft persistence, serial isolation
import { useState, useCallback, useRef, useEffect } from "react";

// ─── Draft keys per tab ───────────────────────────────────────
const _tabDraftKey = (tabId, storeId, uid) =>
  `tab_draft_v1:${storeId || "default"}:${uid || "anon"}:${tabId}`;

const _saveTabDraft = (key, state) => {
  try {
    const raw = JSON.stringify(state);
    sessionStorage.setItem(key, raw);
    localStorage.setItem(key, raw);
  } catch {}
};

const _loadTabDraft = (key) => {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const _clearTabDraft = (key) => {
  try { sessionStorage.removeItem(key); } catch {}
  try { localStorage.removeItem(key); } catch {}
};

// ─── Empty bill state ────────────────────────────────────────
export const createEmptyBillState = () => ({
  items:            [],
  customer:         { name: "Walking Customer", phone: "", city: "Karachi", market: "" },
  billDiscount:     0,
  billDiscountType: "fixed",
  billStartTime:    null,
  billEndTime:      null,
  screenLocked:     true,
  activeBill:       false,
  f8Step:           0,
  selectedRowIndex: -1,
  lastItemId:       null,
  custNameSearch:   "",
  custPhoneSearch:  "",
  paymentType:      "cash",
  amountReceived:   "",
  currentBillSerial: "----",
  lastEntry: {
    price: "", qty: 1, discount: 0, discountType: "fixed",
  },
  form: {
    productName: "", serialId: "", price: "",
    qty: 1, discount: 0, discountType: "fixed",
  },
});

// ─── Hook ─────────────────────────────────────────────────────
export const useMultiTab = (settings, storeId, uid) => {
  const maxTabs   = settings?.multiTab?.maxTabsLimit   || 5;
  const isEnabled = settings?.multiTab?.enableMultiTab !== false;

  const counterRef    = useRef(1);
  const saveTimers    = useRef({});

  const [tabs, setTabs] = useState(() => [{
    id:        1,
    label:     "Bill 1",
    state:     createEmptyBillState(),
    createdAt: Date.now(),
  }]);
  const [activeTabId, setActiveTabId] = useState(1);

  // ── Restore drafts on mount ───────────────────────────────
  useEffect(() => {
    if (!storeId || !uid) return;
    setTabs((prev) =>
      prev.map((tab) => {
        const key     = _tabDraftKey(tab.id, storeId, uid);
        const drafted = _loadTabDraft(key);
        if (!drafted) return tab;
        return { ...tab, state: { ...createEmptyBillState(), ...drafted } };
      })
    );
  }, [storeId, uid]);

  // ── Auto-save drafts on state change ─────────────────────
  const persistTabState = useCallback((tabId, state) => {
    if (!storeId || !uid) return;
    clearTimeout(saveTimers.current[tabId]);
    saveTimers.current[tabId] = setTimeout(() => {
      const key = _tabDraftKey(tabId, storeId, uid);
      // Only save if has items or is active
      if (state.items?.length > 0 || state.activeBill) {
        _saveTabDraft(key, state);
      } else {
        _clearTabDraft(key);
      }
    }, 200);
  }, [storeId, uid]);

  // ── Add tab ───────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (!isEnabled) return null;
    let newId = null;
    setTabs((prev) => {
      if (prev.length >= maxTabs) return prev;
      counterRef.current += 1;
      newId = counterRef.current;
      return [...prev, {
        id:        newId,
        label:     `Bill ${newId}`,
        state:     createEmptyBillState(),
        createdAt: Date.now(),
      }];
    });
    if (newId !== null) setTimeout(() => setActiveTabId(newId), 0);
    return newId;
  }, [maxTabs, isEnabled]);

  // ── Remove tab ────────────────────────────────────────────
  const removeTab = useCallback((tabId) => {
    // Clear draft
    if (storeId && uid) {
      _clearTabDraft(_tabDraftKey(tabId, storeId, uid));
    }
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx     = prev.findIndex((t) => t.id === tabId);
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId && newTabs.length > 0) {
        const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
        setTimeout(() => setActiveTabId(newActive.id), 0);
      }
      return newTabs;
    });
  }, [activeTabId, storeId, uid]);

  // ── Switch tab ────────────────────────────────────────────
  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  // ── Save state into tab + persist ─────────────────────────
  const saveTabState = useCallback((tabId, partialState) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== tabId) return t;
        const newState = { ...t.state, ...partialState };
        persistTabState(tabId, newState);
        return { ...t, state: newState };
      })
    );
  }, [persistTabState]);

  // ── Get tab state ─────────────────────────────────────────
  const getActiveTabState = useCallback((tabId) => {
    const id  = tabId ?? activeTabId;
    const tab = tabs.find((t) => t.id === id);
    return tab?.state ?? createEmptyBillState();
  }, [tabs, activeTabId]);

  // ── Update tab label ──────────────────────────────────────
  const updateTabLabel = useCallback((tabId, label) => {
    setTabs((prev) =>
      prev.map((t) => t.id === tabId ? { ...t, label } : t)
    );
  }, []);

  // ── Clear tab (after bill save) ───────────────────────────
  const clearTabState = useCallback((tabId) => {
    if (storeId && uid) {
      _clearTabDraft(_tabDraftKey(tabId, storeId, uid));
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, state: createEmptyBillState() }
          : t
      )
    );
  }, [storeId, uid]);

  return {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    switchTab,
    saveTabState,
    clearTabState,
    getActiveTabState,
    updateTabLabel,
    canAddTab: isEnabled && tabs.length < maxTabs,
    createEmptyBillState,
    isEnabled,
    maxTabs,
  };
};