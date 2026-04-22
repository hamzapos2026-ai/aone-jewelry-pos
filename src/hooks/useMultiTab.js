// src/hooks/useMultiTab.js
import { useState, useCallback, useRef } from 'react';
import { useBilling } from './useBilling';

const createNewTab = (id) => ({
  id,
  label: `Bill ${id}`,
  billState: null, // Will use separate billing instance
  createdAt: Date.now(),
});

export const useMultiTab = (settings) => {
  const maxTabs = settings?.multiTab?.maxTabsLimit || 5;
  const isEnabled = settings?.multiTab?.enableMultiTab !== false;

  const [tabs, setTabs] = useState([{ id: 1, label: 'Bill 1', createdAt: Date.now() }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const tabCounterRef = useRef(1);

  const addTab = useCallback(() => {
    if (!isEnabled) return;
    
    if (tabs.length >= maxTabs) {
      console.warn(`Max tabs (${maxTabs}) reached`);
      return false;
    }

    tabCounterRef.current += 1;
    const newId = tabCounterRef.current;
    
    setTabs(prev => [...prev, {
      id: newId,
      label: `Bill ${newId}`,
      createdAt: Date.now(),
    }]);
    
    setActiveTabId(newId);
    return newId;
  }, [tabs.length, maxTabs, isEnabled]);

  const removeTab = useCallback((tabId) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev; // Keep at least one tab
      
      const newTabs = prev.filter(t => t.id !== tabId);
      return newTabs;
    });

    // If removing active tab, switch to adjacent
    if (tabId === activeTabId) {
      setTabs(prev => {
        const idx = prev.findIndex(t => t.id === tabId);
        const newActive = prev[idx - 1] || prev[idx + 1];
        if (newActive) setActiveTabId(newActive.id);
        return prev;
      });
    }
  }, [activeTabId]);

  const switchTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  return {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    switchTab,
    canAddTab: isEnabled && tabs.length < maxTabs,
  };
};