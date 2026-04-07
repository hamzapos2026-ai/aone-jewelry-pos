import Dexie from "dexie";

export const offlineDb = new Dexie("aone_jewelry_pos");

offlineDb.version(1).stores({
  offlineOrders: "++id, serialNo, status, createdAt",
  pendingSync: "++id, type, refId, createdAt",
  offlineLogs: "++id, action, createdAt",
});