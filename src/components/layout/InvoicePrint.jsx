// src/components/InvoicePrint.jsx
import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Printer, Check, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import Barcode from "react-barcode";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd)) return "—";
  return dd.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────
const InvoicePrint = ({
  order,
  store,
  onClose,
  billStartTime,
  billEndTime,
  directPrint = false,
}) => {
  const { isDark } = useTheme();
  const { settings } = useSettings();
  const printRef = useRef(null);
  const barcodeRef = useRef(null);
  const hasAutoPrinted = useRef(false);

  // ── Order Data ──────────────────────────────────────────────────────────────
  const items = order?.items || [];
  const customer = order?.customer || {};
  const totalQty = order?.totalQty || 0;
  const totalAmount = order?.totalAmount || 0;
  const totalDiscount = order?.totalDiscount || 0;
  const billDiscount = order?.billDiscount || 0;
  const subtotal = order?.subtotal || 0;
  const serialNo = order?.serialNo || order?.billSerial || "000000";
  const createdAt = order?.createdAt;
  const resolvedStart = billStartTime || order?.billStartTime;
  const resolvedEnd = billEndTime || order?.billEndTime;

  // ── Settings — correctly read from settings context ─────────────────────────
  // ✅ FIX: Default false for QR — only show when explicitly enabled
  const enableQR = settings?.qrBarcode?.enableQRCode === true;
  // ✅ FIX: Default false for barcode — only show when explicitly enabled
  const enableBarcode = settings?.qrBarcode?.enableBarcode === true;
  const showDiscountCol = settings?.billerUI?.showDiscountField === true;
  const footerNote =
    settings?.invoice?.footerNote || "Thank you for your business!";

  // ── Print Handler ───────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;

    // Extract barcode SVG from DOM if enabled
    let barcodeSVGHTML = "";
    if (enableBarcode && barcodeRef.current) {
      const svgEl = barcodeRef.current.querySelector("svg");
      if (svgEl) {
        // Clone SVG and force inline styles for print compatibility
        const clonedSVG = svgEl.cloneNode(true);
        clonedSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clonedSVG.style.display = "block";
        clonedSVG.style.margin = "0 auto";
        clonedSVG.style.maxWidth = "100%";
        barcodeSVGHTML = `
          <div style="text-align:center;margin:10px auto 4px;display:flex;flex-direction:column;align-items:center;">
            ${clonedSVG.outerHTML}
          </div>
        `;
      }
    }

    const win = window.open("", "_blank", "width=820,height=750");
    if (!win) {
      alert("Popup blocked. Please allow popups for printing.");
      return;
    }

    // Replace placeholder in cloned HTML
    const clonedHTML = content.innerHTML;
    const finalHTML = clonedHTML.replace(
      "{{BARCODE_PLACEHOLDER}}",
      barcodeSVGHTML
    );

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${serialNo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: 80mm;
      margin: 0 auto;
      padding: 0;
    }
    .invoice-body {
      width: 80mm;
      padding: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 2px 4px;
      font-size: 11px;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #000;
    }
    svg {
      display: block;
      margin: 0 auto;
      max-width: 100%;
    }
    @media print {
      html, body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="invoice-body">
    ${finalHTML}
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.print();
        window.close();
      }, 300);
    };
  <\/script>
</body>
</html>`);

    win.document.close();
  }, [serialNo, enableBarcode]);

  // ── Direct Print (no preview) ───────────────────────────────────────────────
  useEffect(() => {
    if (directPrint && !hasAutoPrinted.current) {
      hasAutoPrinted.current = true;
      const t = setTimeout(() => {
        handlePrint();
        setTimeout(() => onClose?.(), 700);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [directPrint, handlePrint, onClose]);

  // ── F8 inside invoice = submit ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  // ── Receipt Props (shared between directPrint ghost + preview) ──────────────
  const receiptProps = {
    store,
    serialNo,
    createdAt,
    resolvedStart,
    resolvedEnd,
    customer,
    items,
    totalQty,
    totalDiscount,
    billDiscount,
    subtotal,
    totalAmount,
    showDiscountCol,
    enableQR,
    footerNote,
  };

  // ── Ghost render for directPrint ────────────────────────────────────────────
  if (directPrint) {
    return (
      <div
        style={{
          position: "fixed",
          top: -99999,
          left: -99999,
          width: "80mm",
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div ref={printRef}>
          <ReceiptContent {...receiptProps} />

          {/* Barcode placeholder text — replaced in handlePrint */}
          <div>{"{{BARCODE_PLACEHOLDER}}"}</div>
        </div>

        {/* Real barcode DOM — extracted as SVG in handlePrint */}
        {enableBarcode && (
          <div ref={barcodeRef}>
            <Barcode
              value={serialNo}
              width={2.2}
              height={70}
              fontSize={14}
              margin={4}
              background="#ffffff"
              lineColor="#000000"
              displayValue
              textAlign="center"
              textPosition="bottom"
              textMargin={4}
              font="'Courier New', Courier, monospace"
            />
          </div>
        )}
      </div>
    );
  }

  // ── Preview Modal ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`relative flex max-h-[95vh] w-full max-w-lg flex-col rounded-2xl shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[#15120d] border border-yellow-500/20"
            : "bg-white border border-yellow-200"
        }`}
      >
        {/* ── Modal Header ───────────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-b flex-shrink-0 ${
            isDark ? "border-yellow-500/20" : "border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-yellow-500" />
            <h2
              className={`font-bold text-base ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Invoice Preview
            </h2>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                isDark
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-yellow-50 text-yellow-700"
              }`}
            >
              #{serialNo}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`rounded-lg p-1.5 transition ${
              isDark
                ? "hover:bg-white/10 text-gray-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Receipt Preview Area ────────────────────────────────────────── */}
        <div
          className={`flex-1 overflow-y-auto p-6 flex justify-center ${
            isDark ? "bg-[#0a0908]" : "bg-gray-100"
          }`}
        >
          <div
            style={{
              width: "80mm",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "12px",
              color: "#000",
              background: "#fff",
              padding: "10px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
              borderRadius: "4px",
            }}
          >
            {/* printRef wraps ONLY the content that goes to print window */}
            <div ref={printRef}>
              <ReceiptContent {...receiptProps} />

              {/* Placeholder replaced during print */}
              <div
                style={{ display: "none" }}
              >
                {"{{BARCODE_PLACEHOLDER}}"}
              </div>
            </div>

            {/* ── Live Barcode (preview only, NOT inside printRef) ────────── */}
            {enableBarcode && (
              <div
                ref={barcodeRef}
                style={{
                  textAlign: "center",
                  margin: "10px auto 4px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Barcode
                  value={serialNo}
                  width={2.2}
                  height={70}
                  fontSize={14}
                  margin={4}
                  background="#ffffff"
                  lineColor="#000000"
                  displayValue
                  textAlign="center"
                  textPosition="bottom"
                  textMargin={4}
                  font="'Courier New', Courier, monospace"
                />
              </div>
            )}

            {/* ── Footer (always visible in preview) ─────────────────────── */}
            <div
              style={{
                textAlign: "center",
                fontSize: "10px",
                marginTop: "8px",
                borderTop: "1px dashed #000",
                paddingTop: "6px",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{footerNote}</div>
              {store?.name && (
                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "1px",
                  }}
                >
                  {store.name}
                </div>
              )}
              <div style={{ marginTop: "3px", opacity: 0.55 }}>
                Cashier handover — pending payment
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Action Bar ───────────────────────────────────────────── */}
        <div
          className={`flex items-center justify-between gap-3 px-5 py-3 border-t flex-shrink-0 ${
            isDark ? "border-yellow-500/20" : "border-yellow-200"
          }`}
        >
          {/* Back */}
          <button
            onClick={onClose}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              isDark
                ? "border border-gray-600 text-gray-400 hover:bg-white/5"
                : "border border-gray-200 text-gray-600 hover:bg-gray-100"
            }`}
          >
            Back (ESC)
          </button>

          <div className="flex gap-2">
            {/* Print Only */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-2 text-sm font-bold text-black hover:from-yellow-400 hover:to-amber-400 transition"
            >
              <Printer size={14} />
              Print
            </button>

            {/* Submit & Save (F8) */}
            <button
              onClick={onClose}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition ${
                isDark
                  ? "border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              <Check size={14} />
              Submit &amp; Save (F8)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── ReceiptContent ───────────────────────────────────────────────────────────
// Pure HTML — used in both preview and print window
// NOTE: No Barcode component here — handled separately via barcodeRef
const ReceiptContent = ({
  store,
  serialNo,
  createdAt,
  resolvedStart,
  resolvedEnd,
  customer,
  items,
  totalQty,
  totalDiscount,
  billDiscount,
  subtotal,
  totalAmount,
  showDiscountCol,
  enableQR,       // ✅ Only renders if true
  footerNote,
}) => (
  <div>
    {/* ── Store Header ──────────────────────────────────────────────────── */}
    <div style={{ textAlign: "center", marginBottom: "6px" }}>
      <div
        style={{
          fontSize: "20px",
          fontWeight: 900,
          letterSpacing: "3px",
        }}
      >
        {store?.name || "AONE JEWELRY"}
      </div>

      {store?.tagline && (
        <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.7 }}>
          {store.tagline}
        </div>
      )}
      {store?.address && (
        <div style={{ fontSize: "10px", marginTop: "2px" }}>
          {store.address}
        </div>
      )}
      {store?.phone && (
        <div style={{ fontSize: "10px" }}>Ph: {store.phone}</div>
      )}
      {store?.ntn && (
        <div style={{ fontSize: "9px", color: "#555" }}>
          NTN: {store.ntn}
        </div>
      )}
    </div>

    <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

    {/* ── Bill Info ─────────────────────────────────────────────────────── */}
    <div style={{ textAlign: "center", marginBottom: "5px" }}>
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          letterSpacing: "1px",
        }}
      >
        {serialNo}
      </div>
      <div style={{ fontSize: "10px", marginTop: "2px" }}>
        {fmtDate(createdAt || new Date())}
        {"  |  "}
        {fmtTime(resolvedStart)}
        {resolvedEnd ? ` – ${fmtTime(resolvedEnd)}` : ""}
      </div>
    </div>

    {/* ── Customer ──────────────────────────────────────────────────────── */}
    {(customer?.name || customer?.phone) && (
      <>
        <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />
        <div style={{ fontSize: "11px" }}>
          <div>
            <b>Customer:</b>{" "}
            {customer.name || "Walking Customer"}
          </div>
          {customer.phone && (
            <div>
              <b>Phone:</b> {customer.phone}
            </div>
          )}
          {customer.city && (
            <div>
              <b>City:</b> {customer.city}
            </div>
          )}
          {customer.market && (
            <div>
              <b>Market:</b> {customer.market}
            </div>
          )}
        </div>
      </>
    )}

    <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

    {/* ── Items Table ───────────────────────────────────────────────────── */}
    <table
      style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}
    >
      <thead>
        <tr style={{ borderBottom: "1px solid #000" }}>
          <th style={{ textAlign: "left", padding: "2px", width: "16px" }}>
            #
          </th>
          <th style={{ textAlign: "left", padding: "2px" }}>Serial</th>
          <th style={{ textAlign: "right", padding: "2px" }}>Price</th>
          <th
            style={{ textAlign: "right", padding: "2px", width: "24px" }}
          >
            Qty
          </th>
          {showDiscountCol && (
            <th style={{ textAlign: "right", padding: "2px" }}>Disc</th>
          )}
          <th style={{ textAlign: "right", padding: "2px" }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const discAmt =
            item.discountType === "percent"
              ? Math.round((item.price * item.discount) / 100)
              : Number(item.discount) || 0;
          const hasDisc = discAmt > 0;
          const lineTotal = (item.price - discAmt) * item.qty;

          return (
            <tr key={i} style={{ borderBottom: "1px dotted #ddd" }}>
              <td style={{ padding: "2px" }}>{i + 1}</td>
              <td
                style={{
                  padding: "2px",
                  fontFamily: "monospace",
                  fontSize: "10px",
                }}
              >
                {item.serialId}
              </td>
              <td style={{ textAlign: "right", padding: "2px" }}>
                {hasDisc ? (
                  <>
                    <span
                      style={{
                        textDecoration: "line-through",
                        opacity: 0.45,
                        fontSize: "9px",
                        display: "block",
                      }}
                    >
                      {Number(item.price).toLocaleString()}
                    </span>
                    <span>
                      {(item.price - discAmt).toLocaleString()}
                    </span>
                  </>
                ) : (
                  Number(item.price).toLocaleString()
                )}
              </td>
              <td style={{ textAlign: "right", padding: "2px" }}>
                {item.qty}
              </td>
              {showDiscountCol && (
                <td style={{ textAlign: "right", padding: "2px" }}>
                  {hasDisc ? (
                    <span style={{ color: "#c53030" }}>
                      -{discAmt.toLocaleString()}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td
                style={{
                  textAlign: "right",
                  padding: "2px",
                  fontWeight: "bold",
                }}
              >
                {lineTotal.toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />

    {/* ── Sub-totals ────────────────────────────────────────────────────── */}
    <table style={{ width: "100%", fontSize: "11px" }}>
      <tbody>
        <tr>
          <td style={{ padding: "1px 2px" }}>Total Items</td>
          <td style={{ textAlign: "right", padding: "1px 2px" }}>
            {items.length}
          </td>
        </tr>
        <tr>
          <td style={{ padding: "1px 2px" }}>Total Qty</td>
          <td style={{ textAlign: "right", padding: "1px 2px" }}>
            {totalQty}
          </td>
        </tr>

        {/* ✅ Item discounts (only item-level, not bill discount) */}
        {totalDiscount - billDiscount > 0 && (
          <tr>
            <td style={{ padding: "1px 2px" }}>Item Discounts</td>
            <td
              style={{
                textAlign: "right",
                padding: "1px 2px",
                color: "#c53030",
              }}
            >
              − Rs. {(totalDiscount - billDiscount).toLocaleString()}
            </td>
          </tr>
        )}

        {/* ✅ Subtotal (only when there is any discount) */}
        {(totalDiscount > 0 || billDiscount > 0) && (
          <tr>
            <td style={{ padding: "1px 2px" }}>Subtotal</td>
            <td style={{ textAlign: "right", padding: "1px 2px" }}>
              Rs. {subtotal.toLocaleString()}
            </td>
          </tr>
        )}

        {/* ✅ Bill discount */}
        {billDiscount > 0 && (
          <tr>
            <td style={{ padding: "1px 2px" }}>Bill Discount</td>
            <td
              style={{
                textAlign: "right",
                padding: "1px 2px",
                color: "#c53030",
              }}
            >
              − Rs. {billDiscount.toLocaleString()}
            </td>
          </tr>
        )}
      </tbody>
    </table>

    {/* ── Grand Total ───────────────────────────────────────────────────── */}
    <div
      style={{
        borderTop: "2px solid #000",
        margin: "7px 0 0",
        paddingTop: "5px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 900 }}>GRAND TOTAL</span>
      <span style={{ fontSize: "17px", fontWeight: 900 }}>
        Rs. {totalAmount.toLocaleString()}
      </span>
    </div>

    <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

    {/* ── QR Code ───────────────────────────────────────────────────────── */}
    {/* ✅ FIX: ONLY renders when enableQR === true from settings */}
    {enableQR === true && (
      <div style={{ textAlign: "center", margin: "8px 0 4px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            border: "1px solid #ccc",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            color: "#aaa",
            borderRadius: "2px",
          }}
        >
          QR Code
        </div>
        <div style={{ fontSize: "8px", color: "#777", marginTop: "2px" }}>
          Scan to verify
        </div>
      </div>
    )}

    {/* ── Footer Note ───────────────────────────────────────────────────── */}
    <div
      style={{
        textAlign: "center",
        fontSize: "10px",
        marginTop: "8px",
        borderTop: "1px dashed #000",
        paddingTop: "6px",
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: "bold" }}>{footerNote}</div>
    </div>
  </div>
);

export default InvoicePrint;