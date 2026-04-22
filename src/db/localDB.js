// src/db/localDB.js - Complete Dexie setup
import Dexie from 'dexie';

class LocalDatabase extends Dexie {
  constructor() {
    super('AOneJewelryPOS');
    
    this.version(3).stores({
      pendingOrders: '++id, serialNumber, syncStatus, createdAt, storeId, userId',
      deletedBills: '++id, serialNumber, syncStatus, deletedAt',
      customers: '++id, phone, name, customerId',
      serialNumbers: '++id, storeId, lastSerial, prefix',
      settings: 'key',
      clearedData: '++id, clearedAt, syncStatus',
    });

    // ✅ Handle version upgrade gracefully
    this.version(3).upgrade(tx => {
      console.log('DB upgraded to version 3');
    });
  }
}

export const localDB = new LocalDatabase();

// ✅ Initialize DB
export const initLocalDB = async () => {
  try {
    await localDB.open();
    console.log('✅ LocalDB opened successfully');
    return true;
  } catch (err) {
    console.error('❌ LocalDB open failed:', err);
    // Try to delete and recreate
    try {
      await localDB.delete();
      await localDB.open();
      console.log('✅ LocalDB recreated');
      return true;
    } catch (recreateErr) {
      console.error('❌ LocalDB recreate failed:', recreateErr);
      return false;
    }
  }
};