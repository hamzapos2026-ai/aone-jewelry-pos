// src/components/cashier/QRScannerModal.jsx
// ✅ QR code ONLY — no manual input, only pending bills

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { FiX, FiCheck } from "react-icons/fi";
import { BsUpcScan } from "react-icons/bs";
import { toast } from "react-hot-toast";

const QRScannerModal = memo(({ isDark, onResult, onClose }) => {
  const [scanSuccess, setScanSuccess] = useState(false);
  const [lastScan, setLastScan]       = useState("");
  const [qrBuffer, setQrBuffer]       = useState("");

  const qrBufferRef = useRef("");
  const qrTimerRef  = useRef(null);

  const cardBg  = isDark ? "bg-[#1a1208]"     : "bg-white";
  const border  = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text    = isDark ? "text-gray-100"     : "text-gray-900";
  const subText = isDark ? "text-gray-400"     : "text-gray-500";

  const processQR = useCallback((code) => {
    const clean = (code || "").trim();
    if (!clean || clean.length < 1) return;

    setScanSuccess(true);
    setLastScan(clean);

    // ✅ Instant — close modal + send result
    setTimeout(() => {
      onResult(clean);
      setScanSuccess(false);
    }, 300);
  }, [onResult]);

  // ── USB Scanner keyboard listener ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") { onClose(); return; }

      if (e.key === "Enter") {
        const buf = qrBufferRef.current.trim();
        if (buf.length >= 1) {
          processQR(buf);
          qrBufferRef.current = "";
          setQrBuffer("");
        }
        return;
      }

      if (e.key.length === 1) {
        qrBufferRef.current += e.key;
        setQrBuffer(qrBufferRef.current);
        clearTimeout(qrTimerRef.current);
        qrTimerRef.current = setTimeout(() => {
          qrBufferRef.current = "";
          setQrBuffer("");
        }, 150);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(qrTimerRef.current);
    };
  }, [processQR, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-xs ${cardBg} rounded-2xl border ${border} shadow-2xl`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              scanSuccess ? "bg-green-500/20" : "bg-amber-500/20"
            }`}>
              {scanSuccess
                ? <FiCheck className="text-green-500 w-5 h-5" />
                : <BsUpcScan className="text-amber-500 w-5 h-5" />}
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>QR Scanner</h2>
              <p className={`text-[10px] ${subText}`}>Pending bills only</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${subText} hover:text-red-500`}>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-6">
          <div className={`rounded-xl p-8 border-2 text-center transition-all ${
            scanSuccess
              ? "border-green-500 bg-green-500/10"
              : qrBuffer
                ? "border-amber-500 bg-amber-500/10 animate-pulse"
                : `border-dashed ${isDark ? "border-amber-700 bg-amber-900/5" : "border-amber-300 bg-amber-50"}`
          }`}>
            <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
              scanSuccess ? "bg-green-500" : "bg-amber-500/20"
            }`}>
              {scanSuccess
                ? <FiCheck className="text-white w-10 h-10" />
                : <BsUpcScan className={`w-10 h-10 ${qrBuffer ? "text-amber-500 animate-pulse" : "text-amber-500"}`} />}
            </div>

            <p className={`text-lg font-bold ${text}`}>
              {scanSuccess ? "✅ Found!"
                : qrBuffer ? "⚡ Reading..."
                : "Scan QR Code"}
            </p>
            <p className={`text-xs ${subText} mt-2`}>
              {scanSuccess
                ? `Bill: ${lastScan}`
                : qrBuffer
                  ? `Buffer: ${qrBuffer}`
                  : "Point USB scanner at bill QR code"}
            </p>

            {qrBuffer && !scanSuccess && (
              <div className="mt-4">
                <div className="h-2 bg-amber-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full animate-pulse"
                    style={{ width: `${Math.min(qrBuffer.length * 10, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          <p className={`text-[10px] ${subText} mt-4 text-center`}>
            Only <span className="text-amber-500 font-bold">unpaid/pending</span> bills will be processed
          </p>
        </div>
      </div>
    </div>
  );
});

QRScannerModal.displayName = "QRScannerModal";
export default QRScannerModal;