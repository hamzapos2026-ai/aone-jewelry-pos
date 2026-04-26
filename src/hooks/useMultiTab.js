// src/hooks/useMultiTab.js
import { useState, useCallback, useRef } from "react";

// ─── Empty bill state factory ─────────────────────────────────────────────────
export const createEmptyBillState = () => ({
  items:            [],
  customer:         { name: "Walking Customer", phone: "", city: "Karachi", market: "" },
  billDiscount:     0,
  billDiscountType: "fixed",
  billStartTime:    null,
  billEndTime:      null,
  screenLocked:     true,
  f8Step:           0,
  lastEntry:        { price: "", qty: 1, discount: 0, discountType: "fixed" },
  form: {
    productName: "", serialId: "", price: "",
    qty: 1, discount: 0, discountType: "fixed",
  },
});

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useMultiTab = (settings) => {
  const maxTabs   = settings?.multiTab?.maxTabsLimit   || 5;
  const isEnabled = settings?.multiTab?.enableMultiTab !== false;

  const [tabs, setTabs] = useState([
    {
      id:        1,
      label:     "Bill 1",
      state:     createEmptyBillState(),
      createdAt: Date.now(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState(1);
  const counterRef = useRef(1);

  // ── Add new tab ───────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    if (!isEnabled) return null;

    let newId = null;

    setTabs((prev) => {
      if (prev.length >= maxTabs) {
        console.warn(`Max tabs (${maxTabs}) reached`);
        return prev;
      }
      counterRef.current += 1;
      newId = counterRef.current;
      return [
        ...prev,
        {
          id:        newId,
          label:     `Bill ${newId}`,
          state:     createEmptyBillState(),
          createdAt: Date.now(),
        },
      ];
    });

    if (newId !== null) {
      setTimeout(() => setActiveTabId(newId), 0);
    }

    return newId;
  }, [maxTabs, isEnabled]);

  // ── Remove tab ────────────────────────────────────────────────────────────
  const removeTab = useCallback(
    (tabId) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev; // always keep 1

        const idx     = prev.findIndex((t) => t.id === tabId);
        const newTabs = prev.filter((t) => t.id !== tabId);

        if (tabId === activeTabId && newTabs.length > 0) {
          const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
          setTimeout(() => setActiveTabId(newActive.id), 0);
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

  // ── Switch tab ────────────────────────────────────────────────────────────
  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  // ── Save state into a tab ─────────────────────────────────────────────────
  const saveTabState = useCallback((tabId, partialState) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, state: { ...t.state, ...partialState } }
          : t
      )
    );
  }, []);

  // ── Get active tab state ──────────────────────────────────────────────────
  const getActiveTabState = useCallback(
    (tabId) => {
      const id  = tabId ?? activeTabId;
      const tab = tabs.find((t) => t.id === id);
      return tab?.state ?? createEmptyBillState();
    },
    [tabs, activeTabId]
  );

  // ── Update tab label ──────────────────────────────────────────────────────
  const updateTabLabel = useCallback((tabId, label) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, label } : t))
    );
  }, []);

  return {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    switchTab,
    saveTabState,
    getActiveTabState,
    updateTabLabel,
    canAddTab:           isEnabled && tabs.length < maxTabs,
    createEmptyBillState,
  };
};