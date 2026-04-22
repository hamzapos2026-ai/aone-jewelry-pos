import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

// Default settings structure
const defaultSettings = {
  // General Settings
  general: {
    currency: "PKR",
    theme: "dark",
    language: "en",
  },

  // Biller UI Control
  billerUI: {
    showProductName: true,
    showPriceField: true,
    showDiscountField: true,
    showCustomerSection: true,
    enableAutoHideHeader: false,
  },

  // Font Settings
  fonts: {
    priceFontSize: 16,
    qtyFontSize: 14,
    totalFontSize: 18,
  },

  // Discount Control
  discount: {
    maxDiscountPKR: 100,
    maxDiscountPercent: 10,
    allowItemDiscount: true,
    allowBillDiscount: true,
  },

  // Bill Flow Control
  billFlow: {
    autoPrintAfterSubmit: true,
    autoClearAfterPrint: true,
    lockScreenAfterSubmit: false,
    showInvoicePreview: false,
    showOfflineInvoice: false,
  },

  // Multi Tab Control
  multiTab: {
    enableMultiTab: true,
    maxTabsLimit: 5,
  },

  // Serial Control
  serial: {
    prefix: "",
    startNumber: 1,
    resetMonthly: false,
  },

  // Customer Settings
  customer: {
    defaultCustomerName: "Walking Customer",
    autoCustomerNumbering: true,
  },

  // Role Management
  roles: {
    assignRoles: ["biller", "cashier", "manager"],
    multiRoleEnable: false,
  },

  // Auto Approval System
  autoApproval: {
    autoApproval: false,
  },

  // Cashier Visibility
  cashierVisibility: {
    showBillToCashier: true,
  },

  // Delete Tracking
  deleteTracking: {
    enableDeletedBillsLogging: true,
  },

  // QR/Barcode Settings
  qrBarcode: {
    enableQRCode: true,
    enableBarcode: true,
  },

  // Security
  security: {
    allowEditBill: false,
    allowCancelBill: false,
  },

  // Data Control
  dataControl: {
    exportData: true,
    importData: true,
  },
};

export const getSystemSettings = async () => {
  try {
    const ref = doc(db, "settings", "system");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Create default settings if they don't exist
      await setDoc(ref, defaultSettings);
      return defaultSettings;
    }

    const data = snap.data();
    // Merge with defaults to ensure all keys exist
    return { ...defaultSettings, ...data };
  } catch (error) {
    console.error("Error getting system settings:", error);
    return defaultSettings;
  }
};

export const updateSystemSettings = async (updates) => {
  try {
    const ref = doc(db, "settings", "system");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, updates);
    } else {
      await setDoc(ref, { ...defaultSettings, ...updates });
    }

    return true;
  } catch (error) {
    console.error("Error updating system settings:", error);
    return false;
  }
};

export const updateSettingsCategory = async (category, updates) => {
  try {
    const currentSettings = await getSystemSettings();
    const updatedSettings = {
      ...currentSettings,
      [category]: {
        ...currentSettings[category],
        ...updates,
      },
    };

    return await updateSystemSettings(updatedSettings);
  } catch (error) {
    console.error("Error updating settings category:", error);
    return false;
  }
};

export const resetSettingsToDefault = async () => {
  try {
    const ref = doc(db, "settings", "system");
    await setDoc(ref, defaultSettings);
    return true;
  } catch (error) {
    console.error("Error resetting settings:", error);
    return false;
  }
};

// Export data functionality
export const exportSettings = async () => {
  try {
    const settings = await getSystemSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `aone-pos-settings-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    return true;
  } catch (error) {
    console.error("Error exporting settings:", error);
    return false;
  }
};

// Import data functionality
export const importSettings = async (settingsData) => {
  try {
    // Validate the imported data structure
    if (!settingsData || typeof settingsData !== 'object') {
      throw new Error("Invalid settings data format");
    }

    // Merge with defaults to ensure all required keys exist
    const mergedSettings = { ...defaultSettings, ...settingsData };

    const ref = doc(db, "settings", "system");
    await setDoc(ref, mergedSettings);

    return true;
  } catch (error) {
    console.error("Error importing settings:", error);
    return false;
  }
};

// Get settings for specific store (if multi-store support is added later)
export const getStoreSettings = async (storeId) => {
  try {
    const ref = doc(db, "stores", storeId, "settings", "config");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Return system settings as fallback
      return await getSystemSettings();
    }

    const data = snap.data();
    return { ...defaultSettings, ...data };
  } catch (error) {
    console.error("Error getting store settings:", error);
    return await getSystemSettings();
  }
};

export const updateStoreSettings = async (storeId, updates) => {
  try {
    const ref = doc(db, "stores", storeId, "settings", "config");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, updates);
    } else {
      await setDoc(ref, { ...defaultSettings, ...updates });
    }

    return true;
  } catch (error) {
    console.error("Error updating store settings:", error);
    return false;
  }
};