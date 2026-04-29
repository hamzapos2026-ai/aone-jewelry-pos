// src/components/cashier/QRScannerModal.jsx
// ✅ Live suggestions, arrow keys, enter = instant pay
// ✅ "No record" feedback, glass UI, two tabs only

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import {
  X, Check, Search, Hash, AlertTriangle,
  Clock, Zap, ChevronDown, Barcode,
} from "lucide-react";

const QRScannerModal = memo(({ isDark, orders = [], onResult, onClose }) => {
  const [mode, setMode] = useState("scanner");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanError, setScanError] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [qrBuffer, setQrBuffer] = useState("");
  const [billInput, setBillInput] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const qrBufferRef = useRef("");
  const qrTimerRef = useRef(null);
  const billInputRef = useRef(null);
  const listRef = useRef(null);

  const cardBg = isDark ? "bg-[#1a1208]" : "bg-white";
  const border = isDark ? "border-[#2a1f0f]" : "border-gray-200";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const subText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-[#120d06] border-[#2a1f0f] text-gray-100 placeholder:text-gray-600"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400";
  const glassBg = isDark
    ? "bg-white/5 border-white/10"
    : "bg-white/60 border-gray-200/50";

  // ✅ Live suggestions — pending only
  const suggestions = useMemo(() => {
    if (!billInput.trim()) return [];
    const q = billInput.trim().toUpperCase();
    return orders
      .filter(o => o.status === "pending")
      .filter(o => {
        const s = (o.billSerial || o.serialNo || "").toUpperCase();
        const n = (o.customer?.name || "").toUpperCase();
        return s.includes(q) || n.includes(q);
      })
      .slice(0, 8);
  }, [billInput, orders]);

  const noMatch = useMemo(
    () => billInput.trim().length >= 2 && suggestions.length === 0,
    [billInput, suggestions],
  );

  const processCode = useCallback((code) => {
    const clean = (code || "").trim().toUpperCase();
    if (!clean) return;
    setScanSuccess(true);
    setScanError("");
    setLastScan(clean);
    setTimeout(() => { onResult(clean); setScanSuccess(false); }, 300);
  }, [onResult]);

  // USB scanner
  useEffect(() => {
    if (mode !== "scanner") return;
    const h = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter") {
        const b = qrBufferRef.current.trim();
        if (b.length >= 1) {
          processCode(b);
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
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      clearTimeout(qrTimerRef.current);
    };
  }, [mode, processCode, onClose]);

  // ESC in bill mode
  useEffect(() => {
    if (mode === "scanner") return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode, onClose]);

  // Focus input
  useEffect(() => {
    if (mode === "billno")
      setTimeout(() => billInputRef.current?.focus(), 50);
  }, [mode]);

  // ✅ Scroll selected into view
  useEffect(() => {
    if (selectedIdx >= 0 && listRef.current) {
      const el = listRef.current.children[selectedIdx];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  const handleBillSubmit = useCallback(() => {
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const bill = suggestions[selectedIdx];
      processCode(bill.billSerial || bill.serialNo || "");
      setBillInput("");
      setSelectedIdx(-1);
      return;
    }
    const v = billInput.trim();
    if (!v) { setScanError("Enter bill number"); return; }
    setScanError("");
    processCode(v);
    setBillInput("");
  }, [billInput, selectedIdx, suggestions, processCode]);

  // ✅ Arrow keys + Enter
  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(p => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(p => Math.max(p - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleBillSubmit();
    }
  }, [suggestions.length, handleBillSubmit]);

  const switchMode = useCallback((m) => {
    setMode(m);
    setScanError("");
    setScanSuccess(false);
    setBillInput("");
    setSelectedIdx(-1);
    qrBufferRef.current = "";
    setQrBuffer("");
  }, []);

  const tabCls = (m) =>
    `flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold
     rounded-xl transition-all ${
      mode === m
        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
        : `${subText} hover:text-amber-500 ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-sm ${cardBg} rounded-2xl border ${border}
        shadow-2xl backdrop-blur-xl`}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              scanSuccess ? "bg-green-500/20"
              : scanError ? "bg-red-500/20"
              : "bg-amber-500/20"
            }`}>
              {scanSuccess
                ? <Check className="text-green-500 w-5 h-5" />
                : scanError
                ? <AlertTriangle className="text-red-500 w-5 h-5" />
                : <Barcode className="text-amber-500 w-5 h-5" />}
            </div>
            <div>
              <h2 className={`font-bold text-base ${text}`}>Bill Scanner</h2>
              <p className={`text-[10px] ${subText}`}>Pending → Pay · Paid → View</p>
            </div>
          </div>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${subText} hover:text-red-500 hover:bg-red-500/10`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
          <div className={`flex gap-1 p-1 rounded-2xl ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
            <button onClick={() => switchMode("scanner")} className={tabCls("scanner")}>
              <Barcode className="w-3.5 h-3.5" />USB / QR
            </button>
            <button onClick={() => switchMode("billno")} className={tabCls("billno")}>
              <Hash className="w-3.5 h-3.5" />Bill #
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* USB Scanner */}
          {mode === "scanner" && (
            <div className={`rounded-xl p-6 border-2 text-center transition-all ${
              scanSuccess
                ? "border-green-500 bg-green-500/10"
                : qrBuffer
                ? "border-amber-500 bg-amber-500/10 animate-pulse"
                : `border-dashed ${isDark ? "border-amber-700 bg-amber-900/5" : "border-amber-300 bg-amber-50"}`
            }`}>
              <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 ${
                scanSuccess ? "bg-green-500" : "bg-amber-500/20"
              }`}>
                {scanSuccess
                  ? <Check className="text-white w-8 h-8" />
                  : <Barcode className={`w-8 h-8 text-amber-500 ${qrBuffer ? "animate-pulse" : ""}`} />}
              </div>
              <p className={`text-base font-bold ${text}`}>
                {scanSuccess ? "✅ Scanned!" : qrBuffer ? "⚡ Reading..." : "Point Scanner at QR"}
              </p>
              <p className={`text-xs ${subText} mt-1`}>
                {scanSuccess ? lastScan : qrBuffer || "USB scanner ready"}
              </p>
              {qrBuffer && !scanSuccess && (
                <div className="mt-3">
                  <div className="h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(qrBuffer.length * 8, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ✅ Bill# with live suggestions + arrow keys */}
          {mode === "billno" && (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 border ${glassBg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="w-4 h-4 text-amber-500" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${subText}`}>
                    Bill Serial Number
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2
                    text-sm font-bold text-amber-500">#</span>
                  <input
                    ref={billInputRef}
                    type="text"
                    value={billInput}
                    onChange={e => {
                      setBillInput(e.target.value.toUpperCase());
                      setScanError("");
                      setSelectedIdx(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type to search..."
                    autoFocus
                    className={`w-full pl-8 pr-4 py-3 rounded-xl border text-sm font-bold
                      focus:outline-none focus:border-amber-500 focus:ring-2
                      focus:ring-amber-500/30 transition-all ${inputBg}
                      ${scanError ? "border-red-500" : ""}`}
                  />

                  {/* ✅ Live suggestions */}
                  {suggestions.length > 0 && (
                    <div ref={listRef}
                      className={`absolute top-full left-0 right-0 mt-1 ${cardBg} border ${border}
                        rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto backdrop-blur-xl`}>
                      {suggestions.map((bill, idx) => (
                        <button key={bill.id}
                          onClick={() => {
                            processCode(bill.billSerial || bill.serialNo || "");
                            setBillInput("");
                            setSelectedIdx(-1);
                          }}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={`w-full text-left px-3 py-2.5 flex items-center
                            justify-between transition-colors border-b last:border-b-0 ${
                            isDark ? "border-white/5" : "border-gray-100"
                          } ${
                            idx === selectedIdx
                              ? isDark ? "bg-amber-500/20" : "bg-amber-50"
                              : "hover:bg-amber-500/10"
                          }`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              idx === selectedIdx
                                ? "bg-amber-500 text-white"
                                : "bg-amber-500/20"
                            }`}>
                              <Clock className={`w-3.5 h-3.5 ${
                                idx === selectedIdx ? "text-white" : "text-amber-500"
                              }`} />
                            </div>
                            <div>
                              <p className={`text-xs font-bold ${text}`}>
                                #{bill.billSerial || bill.serialNo}
                              </p>
                              <p className={`text-[10px] ${subText}`}>
                                {bill.customer?.name || "Walking"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-500">
                              Rs.{(bill.totalAmount || 0).toLocaleString()}
                            </span>
                            <Zap className="w-3 h-3 text-emerald-500" />
                          </div>
                        </button>
                      ))}
                      {/* Keyboard hint */}
                      <div className={`px-3 py-1.5 text-[10px] flex items-center gap-1 ${
                        isDark ? "bg-white/5 text-gray-500" : "bg-gray-50 text-gray-400"
                      }`}>
                        ↑↓ Navigate · Enter = Pay
                      </div>
                    </div>
                  )}

                  {/* ✅ No match */}
                  {noMatch && (
                    <div className={`absolute top-full left-0 right-0 mt-1 ${cardBg}
                      border border-red-500/30 rounded-xl p-3 text-center backdrop-blur-xl`}>
                      <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                      <p className={`text-xs font-bold ${text}`}>No pending bill found</p>
                      <p className={`text-[10px] ${subText}`}>"{billInput}" not matched</p>
                    </div>
                  )}
                </div>

                {scanError && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{scanError}
                  </p>
                )}

                <button onClick={handleBillSubmit}
                  disabled={!billInput.trim() && selectedIdx < 0}
                  className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500
                    to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40
                    disabled:cursor-not-allowed text-white text-sm font-bold active:scale-95
                    flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                  <Search className="w-4 h-4" />
                  {selectedIdx >= 0 ? "Pay Selected Bill" : "Search & Pay"}
                </button>
              </div>

              {/* Info */}
              <div className={`rounded-xl px-3 py-2.5 text-xs flex items-start gap-2
                border ${glassBg}`}>
                <span className="text-amber-500 text-base leading-none">⚡</span>
                <div className={subText}>
                  <p className="font-bold text-amber-500">
                    Type → Select → Enter = Instant Pay
                  </p>
                  <p className="mt-0.5">Use ↑↓ arrow keys or click to select</p>
                </div>
              </div>
            </div>
          )}

          <p className={`text-[10px] ${subText} mt-4 text-center`}>
            <span className="text-amber-500 font-bold">Pending</span> → Pay ·{" "}
            <span className="text-green-500 font-bold">Paid</span> → View
          </p>
        </div>
      </div>
    </div>
  );
});

QRScannerModal.displayName = "QRScannerModal";
export default QRScannerModal;