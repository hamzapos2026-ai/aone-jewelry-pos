// src/services/offlineDB.js
import Dexie from "dexie";

const offlineDB = new Dexie("AOneJewelryPOS");

offlineDB.version(1).stores({
  pendingOrders: "++id, serialNo, billSerial, status, synced, createdAt",
  pendingSyncQueue: "++id, type, createdAt, attempts",
});

offlineDB.version(2).stores({
  pendingOrders: "++id, serialNo, billSerial, status, synced, createdAt",
  pendingSyncQueue: "++id, type, createdAt, attempts",
  deletedBills: "++id, serialNo, synced, timestamp",
  billSerials: "++id, serialNo, deviceId, timestamp, synced",
});

export default offlineDB;