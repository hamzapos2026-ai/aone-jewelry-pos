import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};

// Default settings structure
const defaultSettings = {
  // General Settings
  general: {
    currency: "PKR",
    theme: "dark", // light/dark
    language: "en", // en/ur/ru (Roman Urdu)
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
    maxTabsLimit: 0,
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

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings from Firestore
  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsRef = doc(db, "settings", "system");
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const loadedSettings = settingsSnap.data();
        // Merge with defaults to ensure all keys exist
        const mergedSettings = { ...defaultSettings, ...loadedSettings };
        setSettings(mergedSettings);
      } else {
        // If no settings exist, create with defaults
        await setDoc(settingsRef, defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  // Save settings to Firestore
  const saveSettings = async (newSettings) => {
    try {
      setSaving(true);
      const settingsRef = doc(db, "settings", "system");

      // Check if document exists
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        await updateDoc(settingsRef, newSettings);
      } else {
        await setDoc(settingsRef, newSettings);
      }

      setSettings(newSettings);
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Update specific setting category
  const updateSettings = async (category, updates) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        ...updates,
      },
    };

    const success = await saveSettings(newSettings);
    if (success) {
      setSettings(newSettings);
    }
    return success;
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    const success = await saveSettings(defaultSettings);
    if (success) {
      setSettings(defaultSettings);
    }
    return success;
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const value = {
    settings,
    loading,
    saving,
    loadSettings,
    saveSettings,
    updateSettings,
    resetToDefaults,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};