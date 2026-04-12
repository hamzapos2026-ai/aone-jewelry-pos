// src/services/offlineDB.js
import Dexie from "dexie";

const offlineDB = new Dexie("AOneJewelryPOS");

offlineDB.version(1).stores({
  pendingOrders: "++id, serialNo, billSerial, status, synced, createdAt",
  pendingSyncQueue: "++id, type, createdAt, attempts",
});

export default offlineDB;