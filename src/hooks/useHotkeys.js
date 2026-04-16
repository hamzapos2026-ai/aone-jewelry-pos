// src/hooks/useHotkeys.js
import { useEffect, useCallback, useRef } from "react";

const ALWAYS_GLOBAL = new Set([
  "Escape", "F8", "Insert", "Home",
  "Delete", "Minus",
  "PageUp", "PageDown",
  "ArrowUp", "ArrowDown",
  "numpadAdd", "numpadSubtract",
  "numpadMultiply", "numpadDivide",
]);

const ONE_SHOT_SIMPLE = new Set([
  "Insert", "F8", "PageUp", "PageDown",
]);

const useKeyboardShortcuts = (shortcuts, enabled = true) => {
  // Track per-key: how many times it has fired in current bill session
  // "Minus" and "numpadSubtract" → allowed exactly 1 time per bill
  const deleteFiredCount = useRef({ Minus: 0, numpadSubtract: 0, Delete: 0 });
  // Track if key is physically held (for repeat blocking)
  const keyHeld = useRef(new Set());
  // External signal: bill was reset (new bill started or submitted)
  // Dashboard will call resetDeleteGuard() on new bill
  const billResetSignal = useRef(0);
  const lastBillReset = useRef(0);

  // Called by Dashboard after submit or new bill starts
  // We expose this via a ref so Dashboard can call it
  const resetDeleteGuard = useCallback(() => {
    deleteFiredCount.current = { Minus: 0, numpadSubtract: 0, Delete: 0 };
    keyHeld.current.clear();
    billResetSignal.current += 1;
  }, []);

  // Attach resetDeleteGuard to shortcuts object so Dashboard can access it
  useEffect(() => {
    if (shortcuts && typeof shortcuts === "object") {
      shortcuts.__resetDeleteGuard = resetDeleteGuard;
    }
  }, [shortcuts, resetDeleteGuard]);

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // resolve key name
    let key = e.key;
    if (e.key === "-" || e.code === "Minus") key = "Minus";
    if (e.code === "NumpadAdd")      key = "numpadAdd";
    if (e.code === "NumpadSubtract") key = "numpadSubtract";
    if (e.code === "NumpadMultiply") key = "numpadMultiply";
    if (e.code === "NumpadDivide")   key = "numpadDivide";

    // block ALL key-repeat events for one-shot simple keys
    if (e.repeat && ONE_SHOT_SIMPLE.has(key)) {
      e.preventDefault();
      return;
    }

    // block key-repeat for delete keys
    if (e.repeat && (key === "Minus" || key === "numpadSubtract" || key === "Delete")) {
      e.preventDefault();
      return;
    }

    // block if key is still physically held (double-fire guard)
    if (keyHeld.current.has(key) && (key === "Minus" || key === "numpadSubtract" || key === "Delete")) {
      e.preventDefault();
      return;
    }

    const handler = shortcuts[key];
    if (!handler) return;

    const tag = e.target?.tagName || "";
    const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    if (isInput && !ALWAYS_GLOBAL.has(key)) return;

    // ── PER-BILL ONE-TIME LOCK for Minus / numpadSubtract / Delete ──
    // Each of these keys is allowed exactly ONCE per bill.
    // After firing once → locked for rest of bill.
    // Lock resets when resetDeleteGuard() is called (new bill / submit).
    if (key === "Minus" || key === "numpadSubtract" || key === "Delete") {
      if (deleteFiredCount.current[key] >= 1) {
        // Already fired once this bill → block
        e.preventDefault();
        return;
      }
      // Mark as fired for this bill
      deleteFiredCount.current[key] = 1;
      // Mark key as held
      keyHeld.current.add(key);
    }

    e.preventDefault();
    e.stopPropagation();

    // blur input before delete keys to avoid cursor conflict
    if ((key === "Delete" || key === "Minus" || key === "numpadSubtract") && isInput) {
      e.target.blur();
      requestAnimationFrame(handler);
      return;
    }

    handler();
  }, [shortcuts, enabled]);

  const handleKeyUp = useCallback((e) => {
    if (!enabled) return;
    let key = e.key;
    if (e.key === "-" || e.code === "Minus") key = "Minus";
    if (e.code === "NumpadSubtract") key = "numpadSubtract";
    // release held state
    keyHeld.current.delete(key);
  }, [enabled]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup",   handleKeyUp,   true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup",   handleKeyUp,   true);
    };
  }, [handleKeyDown, handleKeyUp]);
};

export default useKeyboardShortcuts;