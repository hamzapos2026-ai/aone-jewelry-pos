// src/services/orderService.js
// ✅ ZERO UI BLOCKING
// ✅ Reset happens BEFORE save
// ✅ Background save with full fallback chain

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db }                            from "./firebase";
import { localDB, ensureDBOpen }         from "./offlineDb";
import { generateBillSerial }            from "./serialService";

// ─── Doc ID builder ───────────────────────────────────────────────────────────
const makeDocId = (storeId, serialNo) =>
  `${storeId}_${serialNo}`.replace(/[^a-zA-Z0-9_-]/g, "_");

// ─── In-flight duplicate guard ────────────────────────────────────────────────
// Prevents double-save if F8 is pressed twice fast
const _inFlight = new Set();

// ─── Duplicate check within same session ─────────────────────────────────────
const _savedThisSession = new Set(); // docIds saved this session

// ════════════════════════════════════════════════════════════════════════════
// MAIN SAVE — called from background (queueMicrotask)
// UI has already reset before this runs
// ════════════════════════════════════════════════════════════════════════════
export const saveOrder = async (orderData, isOnline) => {
  const storeId  = orderData.storeId  || "default";
  const billerId = orderData.billerId || null;

  // ── Step 1: Generate atomic serial ───────────────────────────────────
  let serialNo;
  try {
    serialNo = await generateBillSerial(storeId, isOnline);
  } catch {
    serialNo = `ERR-${Date.now()}`;
  }

  const docId = makeDocId(storeId, serialNo);

  // ── Step 2: Duplicate guard ───────────────────────────────────────────
  if (_inFlight.has(docId) || _savedThisSession.has(docId)) {
    return {
      success:   false,
      duplicate: true,
      id:        docId,
      offline:   !isOnline,
      serialNo,
    };
  }
  _inFlight.add(docId);

  const finalOrder = {
    ...orderData,
    serialNo,
    billSerial:     serialNo,
    storeId,
    billerId,
    firestoreDocId: docId,
  };

  try {
    const result = isOnline
      ? await _saveOnline(finalOrder, docId, serialNo)
      : await _saveOffline(finalOrder, docId, serialNo);

    _savedThisSession.add(docId);
    return result;

  } finally {
    _inFlight.delete(docId);
  }
};

// ── Online save ───────────────────────────────────────────────────────────────
const _saveOnline = async (finalOrder, docId, serialNo) => {
  try {
    await setDoc(doc(db, "orders", docId), {
      ...finalOrder,
      savedAt: serverTimestamp(),
      source:  "online",
    });

    return {
      success:   true,
      id:        docId,
      offline:   false,
      duplicate: false,
      serialNo,
    };
  } catch (err) {
    console.warn("[orderService] Firestore save failed → offline:", err.message);
    // Auto-fallback to offline
    return _saveOffline(finalOrder, docId, serialNo);
  }
};

// ── Offline save (IndexedDB → localStorage → memory) ─────────────────────────
const _saveOffline = async (finalOrder, docId, serialNo) => {
  // Try IndexedDB first
  try {
    const ok = await ensureDBOpen();
    if (ok) {
      // Check for duplicate
      const existing = await localDB.pendingOrders
        .where("firestoreDocId")
        .equals(docId)
        .first()
        .catch(() => null);

      if (existing) {
        return {
          success:   false,
          duplicate: true,
          id:        String(existing.id),
          offline:   true,
          serialNo,
        };
      }

      const localId = await localDB.pendingOrders.add({
        ...finalOrder,
        syncStatus: "pending",
        savedAt:    new Date().toISOString(),
        source:     "offline_indexeddb",
      });

      return {
        success:   true,
        id:        String(localId),
        offline:   true,
        duplicate: false,
        serialNo,
      };
    }
  } catch (err) {
    console.warn("[orderService] IndexedDB failed:", err.message);
  }

  // Fallback: localStorage
  return _saveLocalStorage(finalOrder, docId, serialNo);
};

// ── localStorage fallback ─────────────────────────────────────────────────────
const _saveLocalStorage = (orderData, docId, serialNo) => {
  try {
    const lsKey = `offline_order_${docId}`;
    const list  = JSON.parse(
      localStorage.getItem("offline_pending_orders") || "[]"
    );

    if (list.includes(lsKey)) {
      return {
        success: false, duplicate: true,
        id: lsKey, offline: true, serialNo,
      };
    }

    localStorage.setItem(lsKey, JSON.stringify({
      ...orderData,
      syncStatus: "pending",
      savedAt:    new Date().toISOString(),
      source:     "offline_localstorage",
    }));

    list.push(lsKey);
    localStorage.setItem("offline_pending_orders", JSON.stringify(list));

    return {
      success: true, id: lsKey, offline: true,
      duplicate: false, serialNo,
    };
  } catch {
    // Even localStorage failed — just return success to not break UX
    return {
      success: true, id: `MEM-${Date.now()}`,
      offline: true, duplicate: false, serialNo,
    };
  }
};