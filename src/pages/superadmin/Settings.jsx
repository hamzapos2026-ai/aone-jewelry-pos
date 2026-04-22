// src/pages/superadmin/SuperAdminSettings.jsx
import { useState, useEffect, useCallback } from "react";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Download,
  Upload,
  Eye,
  Type,
  Percent,
  Receipt,
  Layers,
  Hash,
  User,
  Shield,
  Database,
  CheckCircle,
  AlertCircle,
  Loader,
  Store,
  Image,
  FileText,
} from "lucide-react";

// ─── Default Settings (fallback) ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  general: {
    currency: "PKR",
    theme: "dark",
    language: "en",
  },
  store: {
    name: "AONE JEWELRY",
    tagline: "Fine Jewelry & Accessories",
    address: "Shop #1, Main Market, Karachi",
    phone: "0300-0000000",
    ntn: "",
    logo: "",
  },
  invoice: {
    footerNote: "Thank you for your business!",
    showTimestamps: true,
    showSerialId: true,
    paperSize: "80mm",
  },
  billerUI: {
    showProductName: false,
    showPriceField: true,
    showDiscountField: true,
    showCustomerSection: true,
    enableAutoHideHeader: false,
  },
  fonts: {
    billerFontSize: 15,
    priceFontSize: 14,
    qtyFontSize: 14,
    totalFontSize: 20,
  },
  discount: {
    maxDiscountPKR: 0,
    maxDiscountPercent: 100,
    allowItemDiscount: true,
    allowBillDiscount: true,
  },
  billFlow: {
    showInvoicePreview: true,
    showOfflineInvoice: false,
    autoPrintAfterSubmit: false,
    autoClearAfterPrint: true,
    lockScreenAfterSubmit: true,
  },
  multiTab: {
    enableMultiTab: false,
    maxTabsLimit: 5,
  },
  serial: {
    prefix: "",
    startNumber: 1,
    resetMonthly: false,
  },
  customer: {
    defaultCustomerName: "Walking Customer",
    autoCustomerNumbering: false,
  },
  roles: {
    assignRoles: ["biller"],
    multiRoleEnable: false,
  },
  autoApproval: {
    autoApproval: false,
  },
  cashierVisibility: {
    showBillToCashier: true,
  },
  deleteTracking: {
    enableDeletedBillsLogging: true,
  },
  qrBarcode: {
    enableQRCode: false,
    enableBarcode: false,
  },
  security: {
    allowEditBill: false,
    allowCancelBill: true,
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SuperAdminSettings = () => {
  const { settings, loading, saving, updateSettings, resetToDefaults } =
    useSettings();
  const { isDark } = useTheme();

  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState("store");
  const [hasChanges, setHasChanges] = useState(false);
  const [savingStatus, setSavingStatus] = useState(null); // null | saving | success | error

  // ── Sync from context when loaded ──────────────────────────────────────────
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // Deep merge: keep defaults for any missing keys
      setLocalSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        ...settings,
        general:    { ...DEFAULT_SETTINGS.general,    ...settings.general },
        store:      { ...DEFAULT_SETTINGS.store,       ...settings.store },
        invoice:    { ...DEFAULT_SETTINGS.invoice,     ...settings.invoice },
        billerUI:   { ...DEFAULT_SETTINGS.billerUI,    ...settings.billerUI },
        fonts:      { ...DEFAULT_SETTINGS.fonts,       ...settings.fonts },
        discount:   { ...DEFAULT_SETTINGS.discount,    ...settings.discount },
        billFlow:   { ...DEFAULT_SETTINGS.billFlow,    ...settings.billFlow },
        multiTab:   { ...DEFAULT_SETTINGS.multiTab,    ...settings.multiTab },
        serial:     { ...DEFAULT_SETTINGS.serial,      ...settings.serial },
        customer:   { ...DEFAULT_SETTINGS.customer,    ...settings.customer },
        roles:      { ...DEFAULT_SETTINGS.roles,       ...settings.roles },
        autoApproval:        { ...DEFAULT_SETTINGS.autoApproval,        ...settings.autoApproval },
        cashierVisibility:   { ...DEFAULT_SETTINGS.cashierVisibility,   ...settings.cashierVisibility },
        deleteTracking:      { ...DEFAULT_SETTINGS.deleteTracking,      ...settings.deleteTracking },
        qrBarcode:           { ...DEFAULT_SETTINGS.qrBarcode,           ...settings.qrBarcode },
        security:            { ...DEFAULT_SETTINGS.security,            ...settings.security },
      }));
    }
  }, [settings]);

  // ── Handle individual field change ─────────────────────────────────────────
  const handleChange = useCallback((category, key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  }, []);

  // ── Save ALL settings at once ──────────────────────────────────────────────
  const handleSave = async () => {
    setSavingStatus("saving");
    try {
      // ✅ FIX: Save entire localSettings object, not just one section
      const success = await updateSettings(null, localSettings);
      if (success) {
        setSavingStatus("success");
        setHasChanges(false);
      } else {
        setSavingStatus("error");
      }
    } catch (err) {
      console.error("Save failed:", err);
      setSavingStatus("error");
    }
    setTimeout(() => setSavingStatus(null), 2500);
  };

  // ── Save current section only ──────────────────────────────────────────────
  const handleSaveSection = async () => {
    setSavingStatus("saving");
    try {
      const success = await updateSettings(
        activeSection,
        localSettings[activeSection]
      );
      if (success) {
        setSavingStatus("success");
        setHasChanges(false);
      } else {
        setSavingStatus("error");
      }
    } catch (err) {
      console.error("Section save failed:", err);
      setSavingStatus("error");
    }
    setTimeout(() => setSavingStatus(null), 2500);
  };

  // ── Reset to defaults ──────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!confirm("Reset ALL settings to default? This cannot be undone."))
      return;
    setSavingStatus("saving");
    try {
      const success = await resetToDefaults();
      if (success) {
        setLocalSettings(DEFAULT_SETTINGS);
        setSavingStatus("success");
        setHasChanges(false);
      } else {
        setSavingStatus("error");
      }
    } catch {
      setSavingStatus("error");
    }
    setTimeout(() => setSavingStatus(null), 2500);
  };

  // ── Sections list ──────────────────────────────────────────────────────────
  const sections = [
    { id: "store",             label: "Store Info",          icon: Store },
    { id: "general",          label: "General",              icon: SettingsIcon },
    { id: "invoice",          label: "Invoice / Receipt",    icon: FileText },
    { id: "billerUI",         label: "Biller UI Control",    icon: Eye },
    { id: "fonts",            label: "Font Settings",        icon: Type },
    { id: "discount",         label: "Discount Control",     icon: Percent },
    { id: "billFlow",         label: "Bill Flow",            icon: Receipt },
    { id: "multiTab",         label: "Multi Tab",            icon: Layers },
    { id: "serial",           label: "Serial Numbers",       icon: Hash },
    { id: "customer",         label: "Customer",             icon: User },
    { id: "roles",            label: "Role Management",      icon: Shield },
    { id: "autoApproval",     label: "Auto Approval",        icon: CheckCircle },
    { id: "cashierVisibility",label: "Cashier Visibility",   icon: Eye },
    { id: "deleteTracking",   label: "Delete Tracking",      icon: AlertCircle },
    { id: "qrBarcode",        label: "QR / Barcode",         icon: Image },
    { id: "security",         label: "Security",             icon: Shield },
    { id: "dataControl",      label: "Data Control",         icon: Database },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-yellow-500 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  const s = localSettings;

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-0.5 text-sm">
            Configure system-wide settings — changes apply to all billers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>

          {/* Save Section */}
          <button
            onClick={handleSaveSection}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition ${
              hasChanges && !saving
                ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            Save Section
          </button>

          {/* Save All */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${
              hasChanges && !saving
                ? "bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            }`}
          >
            {savingStatus === "saving" ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : savingStatus === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : savingStatus === "error" ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savingStatus === "saving"
              ? "Saving..."
              : savingStatus === "success"
                ? "Saved!"
                : savingStatus === "error"
                  ? "Error!"
                  : "Save All"}
          </button>
        </div>
      </div>

      {/* ── Changes Warning Banner ────────────────────────────────────────── */}
      {hasChanges && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-400/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          You have unsaved changes. Click "Save All" to apply them.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sticky top-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mb-2">
              Categories
            </p>
            <div className="space-y-0.5">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all ${
                    activeSection === section.id
                      ? "bg-yellow-500 text-black font-semibold shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{section.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Settings Content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">

            {activeSection === "store" && (
              <StoreSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "general" && (
              <GeneralSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "invoice" && (
              <InvoiceSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "billerUI" && (
              <BillerUISettings s={s} onChange={handleChange} />
            )}
            {activeSection === "fonts" && (
              <FontSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "discount" && (
              <DiscountSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "billFlow" && (
              <BillFlowSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "multiTab" && (
              <MultiTabSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "serial" && (
              <SerialSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "customer" && (
              <CustomerSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "roles" && (
              <RoleSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "autoApproval" && (
              <AutoApprovalSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "cashierVisibility" && (
              <CashierVisibilitySettings s={s} onChange={handleChange} />
            )}
            {activeSection === "deleteTracking" && (
              <DeleteTrackingSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "qrBarcode" && (
              <QRBarcodeSettings s={s} onChange={handleChange} />
            )}
            {activeSection === "security" && (
              <SecuritySettings s={s} onChange={handleChange} />
            )}
            {activeSection === "dataControl" && (
              <DataControlSettings settings={localSettings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Reusable UI ──────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, disabled = false }) => (
  <label className={`relative inline-flex items-center ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => !disabled && onChange(e.target.checked)}
      className="sr-only peer"
      disabled={disabled}
    />
    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500" />
  </label>
);

const SettingRow = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-3 gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </p>
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const SectionTitle = ({ title, description }) => (
  <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
      {title}
    </h2>
    {description && (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
    )}
  </div>
);

const InputField = ({ label, description, value, onChange, type = "text", placeholder = "", min, max }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </label>
    {description && (
      <p className="text-xs text-gray-500 mb-1.5">{description}</p>
    )}
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => {
        const v =
          type === "number" ? Number(e.target.value) : e.target.value;
        onChange(v);
      }}
      placeholder={placeholder}
      min={min}
      max={max}
      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </label>
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 transition"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

// ─── Settings Sections ────────────────────────────────────────────────────────

// ✅ NEW: Store Info Section
const StoreSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Store Information"
      description="This info appears on every printed invoice/receipt"
    />

    {/* Live Preview */}
    <div className="rounded-xl border border-yellow-200 dark:border-yellow-500/20 bg-yellow-50 dark:bg-yellow-500/5 p-4 text-center font-mono text-sm">
      <div className="text-lg font-black tracking-widest">
        {s.store?.name || "STORE NAME"}
      </div>
      {s.store?.tagline && (
        <div className="text-xs opacity-70 mt-0.5">{s.store.tagline}</div>
      )}
      {s.store?.address && (
        <div className="text-xs mt-0.5">{s.store.address}</div>
      )}
      {s.store?.phone && (
        <div className="text-xs">Ph: {s.store.phone}</div>
      )}
      {s.store?.ntn && (
        <div className="text-xs opacity-60">NTN: {s.store.ntn}</div>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InputField
        label="Store Name *"
        value={s.store?.name}
        onChange={(v) => onChange("store", "name", v)}
        placeholder="AONE JEWELRY"
      />
      <InputField
        label="Tagline"
        value={s.store?.tagline}
        onChange={(v) => onChange("store", "tagline", v)}
        placeholder="Fine Jewelry & Accessories"
      />
      <InputField
        label="Address"
        value={s.store?.address}
        onChange={(v) => onChange("store", "address", v)}
        placeholder="Shop #1, Main Market"
      />
      <InputField
        label="Phone"
        value={s.store?.phone}
        onChange={(v) => onChange("store", "phone", v)}
        placeholder="0300-0000000"
      />
      <InputField
        label="NTN Number"
        value={s.store?.ntn}
        onChange={(v) => onChange("store", "ntn", v)}
        placeholder="Optional"
      />
    </div>
  </div>
);

// ✅ NEW: Invoice/Receipt Settings
const InvoiceSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Invoice / Receipt Settings"
      description="Customize invoice content and layout"
    />

    <InputField
      label="Footer Note"
      description="Message shown at bottom of every invoice"
      value={s.invoice?.footerNote}
      onChange={(v) => onChange("invoice", "footerNote", v)}
      placeholder="Thank you for your business!"
    />

    <SelectField
      label="Paper Size"
      value={s.invoice?.paperSize}
      onChange={(v) => onChange("invoice", "paperSize", v)}
      options={[
        { value: "80mm", label: "80mm (Thermal)" },
        { value: "58mm", label: "58mm (Mini Thermal)" },
        { value: "A4", label: "A4 (Full Page)" },
      ]}
    />

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      <SettingRow
        label="Show Timestamps"
        description="Show bill start/end time on invoice"
      >
        <Toggle
          checked={s.invoice?.showTimestamps !== false}
          onChange={(v) => onChange("invoice", "showTimestamps", v)}
        />
      </SettingRow>
      <SettingRow
        label="Show Serial ID"
        description="Show item serial ID on invoice"
      >
        <Toggle
          checked={s.invoice?.showSerialId !== false}
          onChange={(v) => onChange("invoice", "showSerialId", v)}
        />
      </SettingRow>
    </div>
  </div>
);

const GeneralSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle title="General Settings" />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SelectField
        label="Currency"
        value={s.general?.currency}
        onChange={(v) => onChange("general", "currency", v)}
        options={[
          { value: "PKR", label: "PKR (Pakistani Rupee)" },
          { value: "USD", label: "USD (US Dollar)" },
          { value: "EUR", label: "EUR (Euro)" },
          { value: "GBP", label: "GBP (British Pound)" },
          { value: "AED", label: "AED (UAE Dirham)" },
          { value: "SAR", label: "SAR (Saudi Riyal)" },
        ]}
      />
      <SelectField
        label="Default Theme"
        value={s.general?.theme}
        onChange={(v) => onChange("general", "theme", v)}
        options={[
          { value: "dark", label: "Dark Mode" },
          { value: "light", label: "Light Mode" },
        ]}
      />
      <SelectField
        label="Language"
        value={s.general?.language}
        onChange={(v) => onChange("general", "language", v)}
        options={[
          { value: "en", label: "English" },
          { value: "ur", label: "Urdu (اردو)" },
          { value: "ru", label: "Roman Urdu" },
        ]}
      />
    </div>
  </div>
);

const BillerUISettings = ({ s, onChange }) => (
  <div className="space-y-4">
    <SectionTitle
      title="Biller UI Control"
      description="Control what biller can see and interact with on their dashboard"
    />

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {[
        {
          key: "showProductName",
          label: "Show Product Name Field",
          desc: "Allow biller to type product name for each item",
        },
        {
          key: "showPriceField",
          label: "Show Price Field",
          desc: "Show price input (disable for fixed-price stores)",
        },
        {
          key: "showDiscountField",
          label: "Show Discount Field",
          desc: "Show per-item discount input and discount column",
        },
        {
          key: "showCustomerSection",
          label: "Show Customer Section",
          desc: "Show customer name/phone panel on left side",
        },
        {
          key: "enableAutoHideHeader",
          label: "Auto Hide Header During Billing",
          desc: "Hide top header when biller is actively billing",
        },
      ].map(({ key, label, desc }) => (
        <SettingRow key={key} label={label} description={desc}>
          <Toggle
            checked={s.billerUI?.[key] === true}
            onChange={(v) => onChange("billerUI", key, v)}
          />
        </SettingRow>
      ))}
    </div>
  </div>
);

const FontSettings = ({ s, onChange }) => (
  <div className="space-y-6">
    <SectionTitle
      title="Font Size Settings"
      description="Adjust font sizes for biller dashboard"
    />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[
        { key: "billerFontSize", label: "Biller Base Font", min: 10, max: 22 },
        { key: "priceFontSize",  label: "Price Font Size",  min: 10, max: 24 },
        { key: "qtyFontSize",    label: "Qty Font Size",    min: 10, max: 24 },
        { key: "totalFontSize",  label: "Grand Total Font", min: 14, max: 36 },
      ].map(({ key, label, min, max }) => {
        const val = s.fonts?.[key] || DEFAULT_SETTINGS.fonts[key];
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </label>
              <span className="text-sm font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10 px-2 py-0.5 rounded">
                {val}px
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={val}
              onChange={(e) =>
                onChange("fonts", key, parseInt(e.target.value))
              }
              className="w-full accent-yellow-500 h-2 rounded-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>{min}px</span>
              <span
                style={{ fontSize: `${val}px`, lineHeight: 1 }}
                className="text-yellow-600 font-bold"
              >
                Aa
              </span>
              <span>{max}px</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const DiscountSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle title="Discount Control" />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InputField
        label="Max Item Discount (PKR)"
        description="0 = unlimited"
        value={s.discount?.maxDiscountPKR}
        onChange={(v) => onChange("discount", "maxDiscountPKR", v)}
        type="number"
        min={0}
      />
      <InputField
        label="Max Item Discount (%)"
        description="0-100"
        value={s.discount?.maxDiscountPercent}
        onChange={(v) => onChange("discount", "maxDiscountPercent", v)}
        type="number"
        min={0}
        max={100}
      />
    </div>

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      <SettingRow
        label="Allow Item Discount"
        description="Allow discount per item in bill"
      >
        <Toggle
          checked={s.discount?.allowItemDiscount === true}
          onChange={(v) => onChange("discount", "allowItemDiscount", v)}
        />
      </SettingRow>
      <SettingRow
        label="Allow Bill Discount"
        description="Allow overall bill discount at checkout"
      >
        <Toggle
          checked={s.discount?.allowBillDiscount === true}
          onChange={(v) => onChange("discount", "allowBillDiscount", v)}
        />
      </SettingRow>
    </div>
  </div>
);

const BillFlowSettings = ({ s, onChange }) => (
  <div className="space-y-4">
    <SectionTitle
      title="Bill Flow Control"
      description="Control the billing lifecycle — from checkout to print"
    />

    {/* Visual flow indicator */}
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex-wrap">
      <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-medium">Add Items</span>
      <span>→</span>
      <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-medium">F8 Checkout</span>
      <span>→</span>
      <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 font-medium">Summary</span>
      <span>→</span>
      <span className={`px-2 py-1 rounded font-medium ${
        s.billFlow?.showInvoicePreview
          ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
          : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 line-through"
      }`}>
        {s.billFlow?.showInvoicePreview ? "Preview" : "Preview (OFF)"}
      </span>
      <span>→</span>
      <span className="px-2 py-1 rounded bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 font-medium">Print</span>
      <span>→</span>
      <span className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium">Save & Lock</span>
    </div>

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      <SettingRow
        label="Show Invoice Preview"
        description="ON = biller sees preview before submitting. OFF = auto-print + auto-submit directly."
      >
        <Toggle
          checked={s.billFlow?.showInvoicePreview !== false}
          onChange={(v) => onChange("billFlow", "showInvoicePreview", v)}
        />
      </SettingRow>
      <SettingRow
        label="Auto Print After Submit"
        description="Automatically trigger print dialog after bill submission"
      >
        <Toggle
          checked={s.billFlow?.autoPrintAfterSubmit === true}
          onChange={(v) => onChange("billFlow", "autoPrintAfterSubmit", v)}
        />
      </SettingRow>
      <SettingRow
        label="Auto Clear After Print"
        description="Clear bill data automatically after printing"
      >
        <Toggle
          checked={s.billFlow?.autoClearAfterPrint !== false}
          onChange={(v) => onChange("billFlow", "autoClearAfterPrint", v)}
        />
      </SettingRow>
      <SettingRow
        label="Show Offline Invoice"
        description="Show invoice preview dialog even when offline"
      >
        <Toggle
          checked={s.billFlow?.showOfflineInvoice === true}
          onChange={(v) => onChange("billFlow", "showOfflineInvoice", v)}
        />
      </SettingRow>
    </div>
  </div>
);

const MultiTabSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Multi Tab Control"
      description="Allow biller to open multiple bill tabs simultaneously"
    />

    <SettingRow
      label="Enable Multi-tab Billing"
      description="Press END key to open new bill in another tab"
    >
      <Toggle
        checked={s.multiTab?.enableMultiTab === true}
        onChange={(v) => onChange("multiTab", "enableMultiTab", v)}
      />
    </SettingRow>

    <InputField
      label="Max Tabs Limit"
      description="Maximum number of simultaneous bill tabs"
      value={s.multiTab?.maxTabsLimit}
      onChange={(v) => onChange("multiTab", "maxTabsLimit", v)}
      type="number"
      min={1}
      max={20}
    />
  </div>
);

const SerialSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Serial Number Control"
      description="Configure bill serial number format"
    />

    {/* Preview */}
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">Preview</p>
      <p className="text-2xl font-mono font-bold text-yellow-600">
        {s.serial?.prefix || ""}
        {String(s.serial?.startNumber || 1).padStart(4, "0")}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InputField
        label="Bill Serial Prefix"
        description="Optional prefix before number"
        value={s.serial?.prefix}
        onChange={(v) => onChange("serial", "prefix", v)}
        placeholder="e.g., INV- or BILL-"
      />
      <InputField
        label="Start Number"
        description="Next bill will start from this number"
        value={s.serial?.startNumber}
        onChange={(v) => onChange("serial", "startNumber", v)}
        type="number"
        min={1}
      />
    </div>

    <SettingRow
      label="Reset Serials Monthly"
      description="Reset bill number to start value on 1st of each month"
    >
      <Toggle
        checked={s.serial?.resetMonthly === true}
        onChange={(v) => onChange("serial", "resetMonthly", v)}
      />
    </SettingRow>
  </div>
);

const CustomerSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle title="Customer Settings" />

    <InputField
      label="Default Customer Name"
      description="Used when customer name is not entered"
      value={s.customer?.defaultCustomerName}
      onChange={(v) => onChange("customer", "defaultCustomerName", v)}
      placeholder="Walking Customer"
    />

    <SettingRow
      label="Auto Customer Numbering"
      description="Auto-assign Customer 001, 002... when phone is entered"
    >
      <Toggle
        checked={s.customer?.autoCustomerNumbering === true}
        onChange={(v) => onChange("customer", "autoCustomerNumbering", v)}
      />
    </SettingRow>
  </div>
);

const RoleSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Role Management"
      description="Configure available user roles"
    />

    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Available Roles
      </p>
      <div className="grid grid-cols-2 gap-2">
        {["biller", "cashier", "manager", "viewer", "superadmin"].map(
          (role) => (
            <label
              key={role}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                (s.roles?.assignRoles || []).includes(role)
                  ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10"
                  : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={(s.roles?.assignRoles || []).includes(role)}
                onChange={(e) => {
                  const current = s.roles?.assignRoles || [];
                  const updated = e.target.checked
                    ? [...current, role]
                    : current.filter((r) => r !== role);
                  onChange("roles", "assignRoles", updated);
                }}
                className="w-4 h-4 accent-yellow-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                {role}
              </span>
            </label>
          )
        )}
      </div>
    </div>

    <SettingRow
      label="Multi-role Enable"
      description="Allow one user to have multiple roles"
    >
      <Toggle
        checked={s.roles?.multiRoleEnable === true}
        onChange={(v) => onChange("roles", "multiRoleEnable", v)}
      />
    </SettingRow>
  </div>
);

const AutoApprovalSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle title="Auto Approval System" />

    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
      <p className="text-sm text-blue-800 dark:text-blue-200">
        <strong>How it works:</strong> If a user has both{" "}
        <strong>Biller + Cashier</strong> roles, their bills are automatically
        approved — skipping the pending queue entirely.
      </p>
    </div>

    <SettingRow
      label="Enable Auto Approval"
      description="Dual-role users bypass pending approval queue"
    >
      <Toggle
        checked={s.autoApproval?.autoApproval === true}
        onChange={(v) => onChange("autoApproval", "autoApproval", v)}
      />
    </SettingRow>
  </div>
);

const CashierVisibilitySettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Cashier Visibility"
      description="Control what cashier can see"
    />

    <SettingRow
      label="Show Bill to Cashier"
      description="Cashier can view submitted bills from biller"
    >
      <Toggle
        checked={s.cashierVisibility?.showBillToCashier !== false}
        onChange={(v) =>
          onChange("cashierVisibility", "showBillToCashier", v)
        }
      />
    </SettingRow>
  </div>
);

const DeleteTrackingSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Delete / Cancel Tracking"
      description="Track all deleted and cancelled bills"
    />

    <SettingRow
      label="Enable Deleted Bills Logging"
      description="Save deleted/cancelled bills to database for audit"
    >
      <Toggle
        checked={s.deleteTracking?.enableDeletedBillsLogging !== false}
        onChange={(v) =>
          onChange("deleteTracking", "enableDeletedBillsLogging", v)
        }
      />
    </SettingRow>
  </div>
);

const QRBarcodeSettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="QR Code & Barcode"
      description="Control QR code and barcode on printed invoice"
    />

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {/* ✅ FIX: Both default to false — only enabled when explicitly turned ON */}
      <SettingRow
        label="Enable QR Code"
        description="Show QR code on printed invoice (default: OFF)"
      >
        <Toggle
          checked={s.qrBarcode?.enableQRCode === true}
          onChange={(v) => onChange("qrBarcode", "enableQRCode", v)}
        />
      </SettingRow>

      <SettingRow
        label="Enable Barcode"
        description="Show barcode on printed invoice (default: OFF)"
      >
        <Toggle
          checked={s.qrBarcode?.enableBarcode === true}
          onChange={(v) => onChange("qrBarcode", "enableBarcode", v)}
        />
      </SettingRow>
    </div>

    {/* Status preview */}
    <div className="flex gap-3 mt-2">
      <div className={`flex-1 rounded-lg p-3 text-center text-sm font-medium ${
        s.qrBarcode?.enableQRCode === true
          ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20"
          : "bg-gray-50 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600"
      }`}>
        QR: {s.qrBarcode?.enableQRCode === true ? "✅ ON" : "❌ OFF"}
      </div>
      <div className={`flex-1 rounded-lg p-3 text-center text-sm font-medium ${
        s.qrBarcode?.enableBarcode === true
          ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20"
          : "bg-gray-50 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-600"
      }`}>
        Barcode: {s.qrBarcode?.enableBarcode === true ? "✅ ON" : "❌ OFF"}
      </div>
    </div>
  </div>
);

const SecuritySettings = ({ s, onChange }) => (
  <div className="space-y-5">
    <SectionTitle
      title="Security Settings"
      description="Control biller permissions for sensitive actions"
    />

    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      <SettingRow
        label="Allow Edit Bill"
        description="Biller can edit items after adding"
      >
        <Toggle
          checked={s.security?.allowEditBill === true}
          onChange={(v) => onChange("security", "allowEditBill", v)}
        />
      </SettingRow>
      <SettingRow
        label="Allow Cancel Bill"
        description="Biller can cancel/void entire bill"
      >
        <Toggle
          checked={s.security?.allowCancelBill !== false}
          onChange={(v) => onChange("security", "allowCancelBill", v)}
        />
      </SettingRow>
    </div>
  </div>
);

const DataControlSettings = ({ settings }) => {
  const handleExport = () => {
    try {
      const data = JSON.stringify(settings, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          alert(
            "Settings parsed successfully. Save functionality can be connected to updateSettings."
          );
          console.log("Imported settings:", imported);
        } catch {
          alert("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Data Control"
        description="Export settings backup or import from file"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-3 px-4 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-semibold"
        >
          <Download className="w-5 h-5" />
          Export Settings Backup
        </button>
        <button
          onClick={handleImport}
          className="flex items-center justify-center gap-3 px-4 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-semibold"
        >
          <Upload className="w-5 h-5" />
          Import Settings File
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/30">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          Settings version: 2.0 | Last structure update: 2025
        </p>
      </div>
    </div>
  );
};

export default SuperAdminSettings;