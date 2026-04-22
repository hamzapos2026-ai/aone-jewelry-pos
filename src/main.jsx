// src/main.jsx - FIXED (single Toaster, initLocalDB added)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const startApp = async () => {
  // ✅ Initialize IndexedDB before render
  try {
    const { initLocalDB } = await import("./services/offlineDb"); // ✅ correct
    await initLocalDB();
  } catch (err) {
    console.warn("⚠️ IndexedDB init failed:", err.message);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
};

startApp();

// ─── Dev helpers ───────────────────────────────────────────────────────────
if (import.meta.env.DEV) {
  window.resetBillSerials = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith("billSerial") || k === "customerAutoCounter" || k.startsWith("itemSerial"))
      .forEach(k => localStorage.removeItem(k));
    console.log("✅ Serials reset");
  };

  window.clearOfflineDB = async () => {
    const { localDB } = await import("./services/offlineDb");
    await Promise.all([
      localDB.pendingOrders.clear(),
      localDB.deletedBills.clear(),
      localDB.clearedData.clear(),
      localDB.serialTracker.clear(),
    ]);
    console.log("✅ Offline DB cleared");
  };

  window.checkOfflineDB = async () => {
    const { localDB } = await import("./services/offlineDb");
    console.table({
      pendingOrders: await localDB.pendingOrders.count(),
      deletedBills:  await localDB.deletedBills.count(),
      clearedData:   await localDB.clearedData.count(),
    });
  };
}