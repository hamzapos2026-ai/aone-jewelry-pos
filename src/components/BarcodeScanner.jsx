// src/components/BarcodeScanner.jsx
import { useState, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BarcodeScanner = ({ onProductAdd, disabled = false }) => {
  const { isDark } = useTheme();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  const handleScan = useCallback(() => {
    if (!value.trim() || disabled) return;

    setScanning(true);
    const trimmed = value.trim().toUpperCase();

    // Parse SERIAL-PRICE format
    const match = trimmed.match(/^([A-Z0-9]{2,10})-(\d+)$/);

    setTimeout(() => {
      if (match) {
        onProductAdd({
          serialId: match[1],
          productName: `Product ${match[1]}`,
          price: parseInt(match[2], 10),
          qty: 1,
          discount: 0,
        });
        setStatus("success");
        setValue("");
      } else if (/^[A-Z0-9]{2,10}$/.test(trimmed)) {
        onProductAdd({
          serialId: trimmed,
          productName: `Product ${trimmed}`,
          price: 0,
          qty: 1,
          discount: 0,
          needsPrice: true,
        });
        setStatus("success");
        setValue("");
      } else {
        setStatus("error");
      }

      setScanning(false);
      setTimeout(() => setStatus(null), 2000);
      inputRef.current?.focus();
    }, 200);
  }, [value, disabled, onProductAdd]);

  return (
    <div className="space-y-1">
      <label
        className={`block text-[10px] font-semibold uppercase tracking-wide ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}
      >
        Barcode Scanner
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine
            size={14}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              status === "success"
                ? "text-green-500"
                : status === "error"
                  ? "text-red-500"
                  : "text-gray-500"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Scan barcode (RNG001-45000)"
            disabled={disabled}
            className={`w-full rounded-xl border px-3 py-2.5 pl-9 text-sm outline-none transition ${
              isDark
                ? "border-yellow-500/20 bg-[#0f0d09] text-white focus:border-yellow-500/50"
                : "border-yellow-200 bg-white text-gray-900 focus:border-yellow-500"
            } ${disabled ? "opacity-50" : ""} ${
              status === "success"
                ? isDark
                  ? "border-green-500/50"
                  : "border-green-300"
                : status === "error"
                  ? isDark
                    ? "border-red-500/50"
                    : "border-red-300"
                  : ""
            }`}
          />
          {status === "success" && (
            <CheckCircle
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
            />
          )}
          {status === "error" && (
            <XCircle
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"
            />
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={disabled || scanning || !value.trim()}
          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isDark
              ? "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
              : "border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          } disabled:opacity-50`}
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : "Scan"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-[10px] text-red-500">
          Invalid format. Use: RNG001-45000 (SERIAL-PRICE)
        </p>
      )}
    </div>
  );
};

export default BarcodeScanner;