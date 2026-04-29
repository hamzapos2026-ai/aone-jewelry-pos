// src/db/localDB.js
// ✅ FIXED: Dexie only — no conflict with offlineDb.js
// ✅ FIXED: offlineDb.js handles POS offline queue
// ✅ FIXED: This file handles app-level local data only
// ✅ FIXED: Version upgrade safe

import Dexie from "dexie";

// ── Dexie instance ────────────────────────────────────────────
const appDB = new Dexie("AOneJewelryPOS_App");

// ✅ Separate from billerOfflineDB (raw IndexedDB in offlineDb.js)
// This DB is for: customers cache, settings, UI state only
appDB.version(1).stores({
  // Customer cache — fast local lookup
  customersCache:
    "++id, &phone, name, storeId, updatedAt",

  // App settings cache
  settingsCache: "key",

  // Recent orders for display (not for sync)
  recentOrders:
    "++id, serialNo, storeId, billerId, createdAt",
});

// ── Export ────────────────────────────────────────────────────
export { appDB };

// ════════════════════════════════════════════════════════
// initLocalDB — safe open, handles corruption
// ════════════════════════════════════════════════════════
export const initLocalDB = async () => {
  try {
    await appDB.open();
    return true;
  } catch (err) {
    console.warn("⚠️ Dexie open failed:", err.message);
    // Handle corrupt DB
    if (
      err.name === "VersionError" ||
      err.name === "InvalidStateError" ||
      err.name === "OpenFailedError"
    ) {
      try {
        await Dexie.delete("AOneJewelryPOS_App");
        await appDB.open();
        console.log("✅ Dexie DB recreated after corruption");
        return true;
      } catch (recreateErr) {
        console.error(
          "❌ Dexie recreate failed:",
          recreateErr.message
        );
        return false;
      }
    }
    return false;
  }
};

// ════════════════════════════════════════════════════════
// CUSTOMER CACHE — fast local search
// ════════════════════════════════════════════════════════
export const cacheCustomers = async (customers) => {
  try {
    await appDB.customersCache.bulkPut(customers);
  } catch {}
};

export const searchCachedCustomers = async (term) => {
  if (!term || term.length < 2) return [];
  const lower = term.toLowerCase();
  try {
    const all = await appDB.customersCache.toArray();
    return all
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(lower) ||
          c.phone?.includes(term)
      )
      .slice(0, 10);
  } catch {
    return [];
  }
};

// ════════════════════════════════════════════════════════
// SETTINGS CACHE
// ════════════════════════════════════════════════════════
export const cacheSettings = async (key, value) => {
  try {
    await appDB.settingsCache.put({ key, value });
  } catch {}
};

export const getCachedSettings = async (key) => {
  try {
    const rec = await appDB.settingsCache.get(key);
    return rec?.value ?? null;
  } catch {
    return null;
  }
};