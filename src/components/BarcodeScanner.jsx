import { useState, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { playSound } from "../services/soundService";
import { ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BarcodeScanner = ({ onProductAdd, disabled = false }) => {
  const { isDark } = useTheme();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanStatus, setScanStatus] = useState(null); // null, 'success', 'error'
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  // Parse barcode format: SERIAL-PRICE (e.g., RNG001-45000)
  const parseBarcode = useCallback((barcode) => {
    const trimmed = barcode.trim().toUpperCase();

    // Format: SERIAL-PRICE
    const dashFormat = /^([A-Z]{2,5}\d{1,6})-(\d+)$/;
    const match = trimmed.match(dashFormat);

    if (match) {
      return {
        serialId: match[1],
        productName: `Product ${match[1]}`,
        price: parseInt(match[2], 10),
        qty: 1,
        discount: 0,
        valid: true,
      };
    }

    // Format: Just serial (no price)
    const serialOnly = /^[A-Z]{2,5}\d{1,6}$/;
    if (serialOnly.test(trimmed)) {
      return {
        serialId: trimmed,
        productName: `Product ${trimmed}`,
        price: 0,
        qty: 1,
        discount: 0,
        valid: true,
        needsPrice: true,
      };
    }

    return { valid: false };
  }, []);

  const handleScan = useCallback(() => {
    if (!barcodeInput.trim() || disabled) return;

    setScanning(true);

    setTimeout(() => {
      const parsed = parseBarcode(barcodeInput);

      if (parsed.valid) {
        setScanStatus("success");
        playSound("barcodeSuccess");

        if (parsed.needsPrice) {
          setScanStatus("error");
          setScanning(false);
          return;
        }

        onProductAdd(parsed);
        setBarcodeInput("");

        setTimeout(() => setScanStatus(null), 2000);
      } else {
        setScanStatus("error");
        playSound("error");
        setTimeout(() => setScanStatus(null), 3000);
      }

      setScanning(false);
    }, 300);
  }, [barcodeInput, disabled, parseBarcode, onProductAdd]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  const statusColors = {
    success: isDark
      ? "border-green-500/50 bg-green-500/10"
      : "border-green-300 bg-green-50",
    error: isDark
      ? "border-red-500/50 bg-red-500/10"
      : "border-red-300 bg-red-50",
  };

  return (
    <div className="space-y-2">
      <label
        className={`mb-2 block text-xs font-semibold uppercase tracking-wide ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}
      >
        Barcode Scanner
      </label>

      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <ScanLine
            size={16}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              scanStatus === "success"
                ? "text-green-500"
                : scanStatus === "error"
                ? "text-red-500"
                : "text-gray-500"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode (e.g., RNG001-45000)"
            disabled={disabled}
            className={`w-full rounded-xl border px-3 py-3 pl-10 outline-none transition ${
              isDark
                ? "border-yellow-500/20 bg-[#0f0d09] text-white placeholder:text-gray-500 focus:border-yellow-500/50"
                : "border-yellow-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-yellow-500"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${
              scanStatus ? statusColors[scanStatus] : ""
            }`}
          />

          {scanStatus === "success" && (
            <CheckCircle
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
            />
          )}
          {scanStatus === "error" && (
            <XCircle
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"
            />
          )}
        </div>

        <button
          onClick={handleScan}
          disabled={disabled || scanning || !barcodeInput.trim()}
          className={`rounded-xl px-4 py-3 font-medium transition ${
            isDark
              ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
              : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
          }`}
        >
          {scanning ? <Loader2 size={16} className="animate-spin" /> : "Scan"}
        </button>
      </div>

      {scanStatus === "error" && (
        <p className="text-xs text-red-500">
          Invalid barcode format. Use format: RNG001-45000 (SERIAL-PRICE)
        </p>
      )}
      {scanStatus === "success" && (
        <p className="text-xs text-green-500">
          ✓ Barcode scanned successfully!
        </p>
      )}
    </div>
  );
};

export default BarcodeScanner;