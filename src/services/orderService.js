// src/services/orderService.js
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

const saveOffline = async (orderData) => {
  try {
    const { default: offlineDB } = await import("./offlineDb");
    const id = await offlineDB.pendingOrders.add({
      ...orderData,
      _savedAt: new Date().toISOString(),
      _synced: false,
    });
    return { offline: true, id: String(id) };
  } catch (e) {
    console.error("saveOffline:", e);
    throw e;
  }
};

// In-memory set to track serials submitted in this session
const _submittedSerials = new Set();

export const saveOrder = async (orderData, isOnline = true) => {
  const iKey =
    orderData.idempotencyKey ||
    `${orderData.storeId || "na"}_${orderData.serialNo}`;

  const enriched = { ...orderData, idempotencyKey: iKey };

  // ── Session-level duplicate check ───────────────────────────
  if (_submittedSerials.has(iKey)) {
    console.warn("Session duplicate blocked:", iKey);
    return { id: "session-dup", duplicate: true };
  }

  if (!isOnline) {
    _submittedSerials.add(iKey);
    return saveOffline(enriched);
  }

  try {
    // ── Firestore duplicate check (by serialNo + storeId) ─────
    const checks = [];

    // Check by idempotency key
    checks.push(
      getDocs(
        query(
          collection(db, "orders"),
          where("idempotencyKey", "==", iKey),
          limit(1)
        )
      )
    );

    // Also check by serialNo + storeId directly
    checks.push(
      getDocs(
        query(
          collection(db, "orders"),
          where("serialNo", "==", orderData.serialNo),
          where("storeId", "==", orderData.storeId || null),
          limit(1)
        )
      )
    );

    const [byKey, bySerial] = await Promise.all(checks);

    if (!byKey.empty) {
      console.warn("Duplicate order blocked (idempotency key):", iKey);
      _submittedSerials.add(iKey);
      return { id: byKey.docs[0].id, duplicate: true };
    }

    if (!bySerial.empty) {
      console.warn("Duplicate order blocked (serialNo):", orderData.serialNo);
      _submittedSerials.add(iKey);
      return { id: bySerial.docs[0].id, duplicate: true };
    }

    // ── Save ──────────────────────────────────────────────────
    _submittedSerials.add(iKey);
    const docRef = await addDoc(collection(db, "orders"), {
      ...enriched,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, offline: false };
  } catch (e) {
    console.error("saveOrder online failed, falling back offline:", e);
    return saveOffline(enriched);
  }
};

// Call this to clear session cache (e.g., on logout)
export const clearOrderCache = () => {
  _submittedSerials.clear();
};