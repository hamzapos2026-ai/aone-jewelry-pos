// src/main.jsx
// ✅ FIXED: syncOfflineOrders removed from orderService import
// ✅ FIXED: Vite dynamic import — @vite-ignore comment added
// ✅ FIXED: All static import paths (no variable paths)
// ✅ FIXED: Dev helpers use correct module sources
// ✅ Boot error boundary
// ✅ IDB availability check
// ✅ forceSync typo fixed

import React    from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App      from "./App";
import "./index.css";

// ════════════════════════════════════════════════════════
// IDB AVAILABILITY CHECK
// ════════════════════════════════════════════════════════
const _isIDBAvailable = () => {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
};

// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════
const startApp = async () => {

  // ── Step 1: Init IndexedDB ────────────────────────────
  if (_isIDBAvailable()) {
    try {
      const { initLocalDB } = await import(
        /* @vite-ignore */
        "./services/offlineDb"
      );
      const ok = await initLocalDB();
      if (!ok) {
        console.warn(
          "⚠️ IndexedDB init failed — using localStorage fallback"
        );
      }
    } catch (err) {
      console.warn("⚠️ IndexedDB boot error:", err.message);
    }
  } else {
    console.warn(
      "⚠️ IndexedDB unavailable (private mode?) — localStorage fallback"
    );
  }

  // ── Step 2: Mount React ───────────────────────────────
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

  // ── Step 3: Dev helpers (after mount) ─────────────────
  if (import.meta.env.DEV) {
    _attachDevHelpers();
  }

  // ── Step 4: Global cache clear (always available) ────
  _attachCacheClear();
};

// ════════════════════════════════════════════════════════
// TOP-LEVEL ERROR BOUNDARY
// ════════════════════════════════════════════════════════
startApp().catch((err) => {
  console.error("🔴 App failed to start:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;height:100vh;font-family:sans-serif;
        background:#0f0d09;color:#fff;gap:12px;padding:24px;
      ">
        <h2 style="color:#eab308;margin:0">⚠️ App Failed to Start</h2>
        <p style="color:#9ca3af;font-size:14px;margin:0;text-align:center">
          ${err?.message || "Unknown error"}
        </p>
        <button
          onclick="location.reload()"
          style="
            margin-top:8px;padding:10px 28px;background:#eab308;
            color:#000;border:none;border-radius:10px;
            font-weight:bold;cursor:pointer;font-size:15px;
          "
        >Reload App</button>
      </div>
    `;
  }
});

// ════════════════════════════════════════════════════════
// DEV HELPERS
// ✅ All imports use /* @vite-ignore */ + static-like paths
// ✅ Each helper imports from CORRECT module
// ════════════════════════════════════════════════════════
function _attachDevHelpers() {

  // ── resetBillSerials ──────────────────────────────────
  window.resetBillSerials = () => {
    const removed = [];
    Object.keys(localStorage)
      .filter((k) =>
        k.startsWith("pos_lastSerial_")      ||
        k.startsWith("pos_serialBroadcast_") ||
        k.startsWith("cust_serial_")         ||
        k.startsWith("bill_draft_")          ||
        k === "pos_offline_orders"
      )
      .forEach((k) => {
        localStorage.removeItem(k);
        removed.push(k);
      });
    console.log(
      removed.length
        ? `✅ Removed ${removed.length} keys: ${removed.join(", ")}`
        : "ℹ️ Nothing to remove"
    );
  };

  // ── clearOfflineDB ────────────────────────────────────
  window.clearOfflineDB = async () => {
    if (!_isIDBAvailable()) {
      console.warn("⚠️ IndexedDB not available");
      return;
    }
    try {
      // ✅ @vite-ignore — intentional dynamic import for dev only
      const { localDB } = await import(
        /* @vite-ignore */
        "./services/offlineDb"
      );

      const tasks = [
        ["pendingOrders", () => localDB.pendingOrders.clear()],
        ["deletedBills",  () => localDB.deletedBills.clear()],
        ["clearedData",   () => localDB.clearedData.clear()],
        ["serialTracker", () => localDB.serialTracker?.clear?.()],
      ];

      const results = await Promise.allSettled(
        tasks.map(async ([name, fn]) => {
          await fn?.();
          return name;
        })
      );

      results.forEach(({ status, value, reason }) => {
        if (status === "fulfilled") {
          console.log(`  ✅ ${value} cleared`);
        } else {
          console.warn(`  ⚠️ ${value} failed:`, reason?.message);
        }
      });
      console.log("✅ Offline DB clear complete");
    } catch (err) {
      console.error("❌ clearOfflineDB failed:", err.message);
    }
  };

  // ── checkOfflineDB ────────────────────────────────────
  window.checkOfflineDB = async () => {
    if (!_isIDBAvailable()) {
      console.warn("⚠️ IndexedDB not available");
      return;
    }
    try {
      const { localDB } = await import(
        /* @vite-ignore */
        "./services/offlineDb"
      );
      const [orders, bills, cleared] = await Promise.all([
        localDB.pendingOrders.count().catch(() => "error"),
        localDB.deletedBills.count().catch(()  => "error"),
        localDB.clearedData.count().catch(()   => "error"),
      ]);
      console.table({
        pendingOrders: orders,
        deletedBills:  bills,
        clearedData:   cleared,
      });
    } catch (err) {
      console.error("❌ checkOfflineDB failed:", err.message);
    }
  };

  // ── checkPending ──────────────────────────────────────
  window.checkPending = async () => {
    if (!_isIDBAvailable()) {
      console.warn("⚠️ IndexedDB not available");
      return;
    }
    try {
      const { getPendingOrders } = await import(
        /* @vite-ignore */
        "./services/offlineDb"
      );
      const pending = await getPendingOrders();
      if (!pending.length) {
        console.log("✅ No pending orders");
        return;
      }
      console.log(`📋 ${pending.length} pending orders:`);
      console.table(
        pending.map((o) => ({
          localId:    (o.localId    || "-").slice(-12),
          serialNo:   o.serialNo   || "-",
          syncStatus: o.syncStatus || "pending",
          attempts:   o.syncAttempts ?? 0,
          storeId:    o.storeId    || "-",
          savedAt:    o.savedAt
            ? new Date(o.savedAt).toLocaleTimeString()
            : "-",
        }))
      );
    } catch (err) {
      console.error("❌ checkPending failed:", err.message);
    }
  };

  // ── forceSync ─────────────────────────────────────────
  // ✅ FIXED: syncOfflineOrders is in offlineSync.js (NOT orderService.js)
  window.forceSync = async () => {
    if (!navigator.onLine) {
      console.warn("⚠️ Cannot sync — device is offline");
      return;
    }
    try {
      // ✅ Correct module: offlineSync (not orderService)
      const { syncOfflineOrders } = await import(
        /* @vite-ignore */
        "./services/offlineSync"
      );
      console.log("🔄 Force syncing...");
      const result = await syncOfflineOrders();
      console.log("✅ Sync result:", result);
    } catch (err) {
      console.error("❌ forceSync failed:", err.message);
    }
  };

  // ── checkLsQueue ──────────────────────────────────────
  window.checkLsQueue = () => {
    try {
      const raw = localStorage.getItem("pos_offline_orders");
      const q   = JSON.parse(raw || "[]");
      if (!q.length) {
        console.log("✅ localStorage queue is empty");
        return;
      }
      console.log(`📋 localStorage queue: ${q.length} orders`);
      console.table(
        q.map((o) => ({
          serialNo:   o.serialNo   || "-",
          storeId:    o.storeId    || "-",
          syncStatus: o.syncStatus || "pending",
          savedAt:    o.savedAt    || "-",
        }))
      );
    } catch {
      console.log("📋 localStorage queue: empty or corrupt");
    }
  };

  // ── checkSerial ───────────────────────────────────────
  window.checkSerial = async () => {
    try {
      const { getPlaceholderSerial } = await import(
        /* @vite-ignore */
        "./services/serialService"
      );
      const storeIds = [
        ...new Set(
          Object.keys(localStorage)
            .filter((k) => k.startsWith("pos_lastSerial_"))
            .map((k) => k.replace("pos_lastSerial_", ""))
        ),
      ];
      if (!storeIds.length) storeIds.push("default");
      for (const sid of storeIds) {
        const last = localStorage.getItem(`pos_lastSerial_${sid}`) || "0";
        const next = navigator.onLine
          ? await getPlaceholderSerial(sid).catch(() => "?")
          : "offline";
        console.log(`  📍 ${sid}: last=${last}, next=${next}`);
      }
    } catch (err) {
      console.error("❌ checkSerial failed:", err.message);
    }
  };

  // ── clearDrafts ───────────────────────────────────────
  window.clearDrafts = () => {
    const removed = [];
    Object.keys(localStorage)
      .filter((k) => k.startsWith("bill_draft_"))
      .forEach((k) => {
        localStorage.removeItem(k);
        removed.push(k);
      });
    console.log(
      removed.length
        ? `✅ Cleared ${removed.length} draft(s)`
        : "ℹ️ No drafts found"
    );
  };

  // ── Help ──────────────────────────────────────────────
  console.log(
    "%c🛠️  POS Dev Helpers\n" +
    "%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "%c  resetBillSerials() %c— serials + drafts + queue\n" +
    "%c  clearOfflineDB()   %c— clear IndexedDB stores\n" +
    "%c  checkOfflineDB()   %c— count records\n" +
    "%c  checkPending()     %c— list unsynced orders\n" +
    "%c  forceSync()        %c— sync offline orders\n" +
    "%c  checkLsQueue()     %c— localStorage queue\n" +
    "%c  checkSerial()      %c— serial state\n" +
    "%c  clearDrafts()      %c— clear drafts only\n" +
    "%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "color:#eab308;font-weight:bold;font-size:13px",
    "color:#4b5563",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#60a5fa;font-weight:bold", "color:#9ca3af",
    "color:#4b5563",
  );
}

// ════════════════════════════════════════════════════════
// GLOBAL CACHE CLEAR (Always Available)
// ════════════════════════════════════════════════════════
function _attachCacheClear() {
  // ✅ Main cache clear function
  window.clearCache = async () => {
    console.log("🧹 Clearing all cache...");
    try {
      // 1. Clear localStorage
      localStorage.clear();
      console.log("✅ localStorage cleared");

      // 2. Clear sessionStorage
      sessionStorage.clear();
      console.log("✅ sessionStorage cleared");

      // 3. Clear IndexedDB databases
      if ("indexedDB" in window) {
        const dbs = await window.indexedDB.databases?.() || [];
        for (const db of dbs) {
          window.indexedDB.deleteDatabase(db.name);
          console.log(`✅ IndexedDB database '${db.name}' deleted`);
        }
      }

      // 4. Clear Service Worker cache
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log(`✅ Cache '${cacheName}' deleted`);
        }
      }

      // 5. Clear cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        if (name) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
        }
      });
      console.log("✅ Cookies cleared");

      console.log("✅✅✅ All cache cleared! Page will reload in 1 second...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      console.error("❌ Error clearing cache:", error);
    }
  };

  // ✅ Alias for convenience
  window.cc = window.clearCache;

  console.log(
    "%c🧹 Cache Clear Available\n" +
    "%c━━━━━━━━━━━━━━━━━━━━━━\n" +
    "%c  clearCache() %c— full cache/storage clear + reload\n" +
    "%c  cc()         %c— shortcut (same as above)\n" +
    "%c━━━━━━━━━━━━━━━━━━━━━━",
    "color:#10b981;font-weight:bold;font-size:12px",
    "color:#4b5563",
    "color:#10b981;font-weight:bold", "color:#9ca3af",
    "color:#10b981;font-weight:bold", "color:#9ca3af",
    "color:#4b5563",
  );
}