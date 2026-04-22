// src/services/offlineDb.js - FINAL FIXED
import Dexie from "dexie";

class LocalDatabase extends Dexie {
  constructor() {
    super("AOneJewelryPOS");
    
    // ✅ Single version, all tables, firestoreDocId indexed for dedup
    this.version(5).stores({
      pendingOrders:
        "++id, serialNo, firestoreDocId, storeId, syncStatus, savedAt",
      deletedBills:
        "++id, serialNo, storeId, synced, syncStatus, deletedAt",
      clearedData:
        "++id, serialNo, storeId, syncStatus, clearedAt",
      serialTracker:
        "++id, storeId, lastNumber, updatedAt",
      customers:
        "++id, phone, name, storeId",
      settings:
        "key, value",
    });
  }
}

export const localDB = new LocalDatabase();

let _openPromise = null;
let _isOpen      = false;

export const ensureDBOpen = async () => {
  // Already open
  if (_isOpen && localDB.isOpen()) return true;

  // Another open in progress — wait for it
  if (_openPromise) return _openPromise;

  _openPromise = (async () => {
    try {
      if (!localDB.isOpen()) {
        await localDB.open();
      }
      _isOpen      = true;
      _openPromise = null;
      console.log("✅ IndexedDB opened");
      return true;
    } catch (err) {
      _openPromise = null;
      console.error("❌ IndexedDB open failed:", err.name, err.message);

      // VersionError or corruption → recreate
      if (["VersionError","InvalidStateError","DatabaseClosedError"].includes(err.name)) {
        try {
          await Dexie.delete("AOneJewelryPOS");
          await localDB.open();
          _isOpen = true;
          console.log("✅ IndexedDB recreated");
          return true;
        } catch (e2) {
          console.error("❌ Recreate failed:", e2.message);
          return false;
        }
      }
      return false;
    }
  })();

  // 4 second timeout
  const timeout = new Promise((resolve) =>
    setTimeout(() => {
      console.warn("⚠️ IndexedDB open timed out");
      _openPromise = null;
      resolve(false);
    }, 4000)
  );

  return Promise.race([_openPromise, timeout]);
};

export const initLocalDB = async () => {
  const ok = await ensureDBOpen();
  if (ok) {
    const pending = await localDB.pendingOrders.count().catch(() => "?");
    console.log("✅ LocalDB ready | pending orders:", pending);
  } else {
    console.warn("⚠️ LocalDB unavailable — using localStorage fallback");
  }
  return ok;
};

export default localDB;