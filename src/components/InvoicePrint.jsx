// src/components/InvoicePrint.jsx
import { useRef, useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Printer, Check, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import QRCode from "qrcode";

const fmtTime = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleDateString("en-PK", {
    year: "numeric", month: "short", day: "2-digit",
  });
};

const InvoicePrint = ({
  order,
  store,
  onClose,
  billStartTime,
  billEndTime,
  directPrint = false,
}) => {
  const { isDark }   = useTheme();
  const { settings } = useSettings();
  const printRef     = useRef(null);
  // ✅ Prevent auto-print firing twice
  const hasAutoPrinted = useRef(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrReady,   setQrReady]   = useState(false);

  const items         = order?.items         || [];
  const customer      = order?.customer      || {};
  const totalQty      = order?.totalQty      || 0;
  const totalAmount   = order?.totalAmount   || 0;
  const totalDiscount = order?.totalDiscount || 0;
  const billDiscount  = order?.billDiscount  || 0;
  const subtotal      = order?.subtotal      || 0;
  const serialNo      = order?.serialNo      || order?.billSerial || "000000";
  const createdAt     = order?.createdAt;
  const resolvedStart = billStartTime || order?.billStartTime;
  const resolvedEnd   = billEndTime   || order?.billEndTime;

  const showDiscountCol = settings?.billerUI?.showDiscountField === true;
  const footerNote      = settings?.invoice?.footerNote || "Thank you for your business!";

  // ── QR Code ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(
          JSON.stringify({
            bill:   serialNo,
            amount: totalAmount,
            date:   fmtDate(createdAt || new Date()),
            store:  store?.name || "Store",
          }),
          { width: 80, margin: 1, color: { dark: "#000000", light: "#ffffff" } }
        );
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation failed:", err);
      } finally {
        setQrReady(true); // ✅ Always mark ready (even on error)
      }
    };
    generateQR();
  }, [serialNo, totalAmount, createdAt, store?.name]);

  // ── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=700");
    if (!win) {
      alert("Popup blocked. Please allow popups for printing.");
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${serialNo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px; color: #000; background: #fff;
      width: 80mm; margin: 0 auto; padding: 6px 8px;
    }
    table { width:100%; border-collapse:collapse; }
    th, td { padding:1px 2px; font-size:10px; }
    th { text-align:left; border-bottom:1px solid #000; }
    img { display:block; margin:0 auto; }
    @media print {
      html, body { width:80mm; }
      @page { margin:0; size:80mm auto; }
    }
  </style>
</head>
<body>
  ${content.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  <\/script>
</body>
</html>`);
    win.document.close();
  }, [serialNo]);

  // ✅ FIX: directPrint — qrReady ke baad hi print karo
  useEffect(() => {
    if (!directPrint) return;
    if (!qrReady) return;
    if (hasAutoPrinted.current) return;
    hasAutoPrinted.current = true;

    const t = setTimeout(() => {
      handlePrint();
      // ✅ Print ke baad onClose → handlePrintClose → save
      setTimeout(() => onClose?.(), 600);
    }, 300);

    return () => clearTimeout(t);
  }, [directPrint, qrReady, handlePrint, onClose]);

  // ✅ FIX: Preview mode mein F8 = Submit & Save
  // onClose → handlePrintClose → handleSubmitOrderInternal
  useEffect(() => {
    if (directPrint) return;

    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [directPrint, onClose]);

  // ── Receipt Content ───────────────────────────────────────────────────────
  const ReceiptHTML = () => (
    <div>
      {/* Store Header */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <div style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "2px" }}>
          {store?.name || "STORE"}
        </div>
        {store?.tagline && (
          <div style={{ fontSize: "8px", marginTop: "1px", opacity: 0.7 }}>
            {store.tagline}
          </div>
        )}
        {store?.address && (
          <div style={{ fontSize: "8px", marginTop: "1px" }}>{store.address}</div>
        )}
        {store?.phone && (
          <div style={{ fontSize: "8px" }}>Ph: {store.phone}</div>
        )}
        {store?.ntn && (
          <div style={{ fontSize: "7px", color: "#555" }}>NTN: {store.ntn}</div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* Bill Info */}
      <div style={{ textAlign: "center", marginBottom: "3px" }}>
        <div style={{ fontSize: "13px", fontWeight: "bold", letterSpacing: "1px" }}>
          {serialNo}
        </div>
        <div style={{ fontSize: "8px", marginTop: "1px" }}>
          {fmtDate(createdAt || new Date())}
          {"  |  "}
          {fmtTime(resolvedStart)}
          {resolvedEnd ? ` – ${fmtTime(resolvedEnd)}` : ""}
        </div>
      </div>

      {/* Customer */}
      {(customer?.name || customer?.phone) && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
          <div style={{ fontSize: "9px" }}>
            <div><b>Customer:</b> {customer.name || "Walking Customer"}</div>
            {customer.phone  && <div><b>Phone:</b>  {customer.phone}</div>}
            {customer.city   && <div><b>City:</b>   {customer.city}</div>}
            {customer.market && <div><b>Market:</b> {customer.market}</div>}
          </div>
        </>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ textAlign: "left",  padding: "1px", width: "14px" }}>#</th>
            <th style={{ textAlign: "left",  padding: "1px" }}>Serial</th>
            <th style={{ textAlign: "right", padding: "1px" }}>Price</th>
            <th style={{ textAlign: "right", padding: "1px", width: "20px" }}>Qty</th>
            {showDiscountCol && (
              <th style={{ textAlign: "right", padding: "1px" }}>Disc</th>
            )}
            <th style={{ textAlign: "right", padding: "1px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const discAmt   = item.discountType === "percent"
              ? Math.round((item.price * item.discount) / 100)
              : Number(item.discount) || 0;
            const hasDisc   = discAmt > 0;
            const lineTotal = (item.price - discAmt) * item.qty;

            return (
              <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
                <td style={{ padding: "1px" }}>{i + 1}</td>
                <td style={{ padding: "1px", fontFamily: "monospace", fontSize: "8px" }}>
                  {item.serialId}
                </td>
                <td style={{ textAlign: "right", padding: "1px" }}>
                  {hasDisc ? (
                    <>
                      <span style={{
                        textDecoration: "line-through",
                        opacity: 0.4, fontSize: "7px", display: "block",
                      }}>
                        {Number(item.price).toLocaleString()}
                      </span>
                      <span>{(item.price - discAmt).toLocaleString()}</span>
                    </>
                  ) : (
                    Number(item.price).toLocaleString()
                  )}
                </td>
                <td style={{ textAlign: "right", padding: "1px" }}>{item.qty}</td>
                {showDiscountCol && (
                  <td style={{ textAlign: "right", padding: "1px" }}>
                    {hasDisc
                      ? <span style={{ color: "#c00" }}>-{discAmt.toLocaleString()}</span>
                      : "—"
                    }
                  </td>
                )}
                <td style={{ textAlign: "right", padding: "1px", fontWeight: "bold" }}>
                  {lineTotal.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* Sub-totals */}
      <table style={{ width: "100%", fontSize: "9px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "1px 2px" }}>Items: {items.length}</td>
            <td style={{ textAlign: "right", padding: "1px 2px" }}>Qty: {totalQty}</td>
          </tr>
          {(totalDiscount - billDiscount) > 0 && (
            <tr>
              <td style={{ padding: "1px 2px" }}>Item Disc</td>
              <td style={{ textAlign: "right", padding: "1px 2px", color: "#c00" }}>
                −Rs.{(totalDiscount - billDiscount).toLocaleString()}
              </td>
            </tr>
          )}
          {billDiscount > 0 && (
            <tr>
              <td style={{ padding: "1px 2px" }}>Bill Disc</td>
              <td style={{ textAlign: "right", padding: "1px 2px", color: "#c00" }}>
                −Rs.{billDiscount.toLocaleString()}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Grand Total */}
      <div style={{
        borderTop: "2px solid #000", margin: "4px 0 0", paddingTop: "3px",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 900 }}>TOTAL</span>
        <span style={{ fontSize: "15px", fontWeight: 900 }}>
          Rs.{totalAmount.toLocaleString()}
        </span>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

      {/* QR Code */}
      {qrDataUrl && (
        <div style={{ textAlign: "center", margin: "6px 0 4px" }}>
          <img
            src={qrDataUrl} alt="QR"
            style={{ width: "70px", height: "70px", margin: "0 auto" }}
          />
          <div style={{ fontSize: "7px", color: "#777", marginTop: "1px" }}>
            Scan to verify
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: "center", fontSize: "8px", marginTop: "4px",
        borderTop: "1px dashed #000", paddingTop: "4px", lineHeight: 1.3,
      }}>
        <div style={{ fontWeight: "bold", fontSize: "9px" }}>{footerNote}</div>
        {store?.name && (
          <div style={{ marginTop: "2px", fontSize: "9px", fontWeight: 700, letterSpacing: "1px" }}>
            {store.name}
          </div>
        )}
        <div style={{ marginTop: "2px", opacity: 0.5, fontSize: "7px" }}>
          Bill# {serialNo}
        </div>
      </div>
    </div>
  );

  // ── Direct Print: ghost render ────────────────────────────────────────────
  if (directPrint) {
    return (
      <div style={{
        position: "fixed", top: -99999, left: -99999,
        opacity: 0, pointerEvents: "none", width: "80mm",
      }}>
        <div ref={printRef}>
          <ReceiptHTML />
        </div>
      </div>
    );
  }

  // ── Preview Modal ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`relative flex max-h-[95vh] w-full max-w-md flex-col rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          <div className="flex items-center gap-2">
            <Printer size={14} className="text-yellow-500" />
            <span className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              Invoice Preview
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              isDark ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}>
              #{serialNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] px-2 py-0.5 rounded font-semibold ${
              isDark ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-700"
            }`}>
              F8 = Submit & Save
            </span>
            <button
              onClick={onClose}
              className={`rounded-lg p-1 transition ${
                isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className={`flex-1 overflow-y-auto p-3 flex justify-center ${
          isDark ? "bg-[#0a0908]" : "bg-gray-100"
        }`}>
          <div style={{
            width: "80mm",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "11px",
            color: "#000",
            background: "#fff",
            padding: "8px",
            boxShadow: "0 1px 8px rgba(0,0,0,0.12)",
            borderRadius: "3px",
          }}>
            <div ref={printRef}>
              <ReceiptHTML />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`flex items-center justify-between gap-2 px-4 py-2.5 border-t ${
          isDark ? "border-yellow-500/20" : "border-yellow-200"
        }`}>
          {/* ESC = close without saving (back to summary) */}
          <button
            onClick={onClose}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isDark
                ? "border border-gray-600 text-gray-400 hover:bg-white/5"
                : "border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            ← ESC
          </button>

          <div className="flex gap-2">
            {/* Print only — no save */}
            <button
              onClick={handlePrint}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                isDark
                  ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                  : "border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              <Printer size={12} />
              Print Only
            </button>

            {/* F8 = Print + Submit + Save */}
            <button
              onClick={() => {
                handlePrint();
                setTimeout(() => onClose?.(), 400);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-black hover:from-yellow-400 hover:to-amber-400 transition"
            >
              <Check size={12} />
              Print & Submit (F8)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePrint;