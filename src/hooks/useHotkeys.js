// src/hooks/useHotkeys.js
import { useEffect, useCallback, useRef } from "react";

// Keys that work even when an input is focused
const ALWAYS_GLOBAL = new Set([
  "Escape", "F8", "F9", "Insert",
  "Home", "End", "Delete",
  "Minus", "PageUp", "PageDown",
  "ArrowUp", "ArrowDown",
  "numpadAdd", "numpadSubtract", "numpadMultiply", "numpadDivide",
]);

// Keys that must NOT auto-repeat (fire once per press)
const ONE_SHOT = new Set([
  "Insert", "F8", "F9", "Escape",
  "End", "PageUp", "PageDown",
  "Delete",
]);

// Minimum ms between two fires of the same key
const DEBOUNCE_MS = 280;

const useKeyboardShortcuts = (shortcuts, enabled = true) => {
  const shortcutsRef = useRef(shortcuts);
  const enabledRef   = useRef(enabled);
  const keyHeld      = useRef(new Set());   // for delete-type keys
  const lastFire     = useRef({});          // timestamp per key

  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);

  const handleKeyDown = useCallback((e) => {
    if (!enabledRef.current) return;

    // ── Normalise key name ────────────────────────────────────────────────
    let key = e.key;
    if (e.code === "Minus" || e.key === "-") key = "Minus";
    if (e.code === "NumpadAdd")              key = "numpadAdd";
    if (e.code === "NumpadSubtract")         key = "numpadSubtract";
    if (e.code === "NumpadMultiply")         key = "numpadMultiply";
    if (e.code === "NumpadDivide")           key = "numpadDivide";

    // ── Drop auto-repeat for guarded keys ─────────────────────────────────
    if (e.repeat && ONE_SHOT.has(key)) {
      e.preventDefault();
      return;
    }
    if (e.repeat && (key === "Minus" || key === "numpadSubtract")) {
      e.preventDefault();
      return;
    }

    const handler = shortcutsRef.current?.[key];
    if (!handler) return;

    // ── Editable element check ────────────────────────────────────────────
    const tag        = e.target?.tagName ?? "";
    const isEditable =
      ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
      !!e.target?.isContentEditable;

    if (isEditable && !ALWAYS_GLOBAL.has(key)) return;

    // ── Debounce one-shot keys ────────────────────────────────────────────
    const now = Date.now();
    if (ONE_SHOT.has(key)) {
      const last = lastFire.current[key] ?? 0;
      if (now - last < DEBOUNCE_MS) { e.preventDefault(); return; }
      lastFire.current[key] = now;
    }

    // ── Single-fire guard for minus / numpad-minus ────────────────────────
    if (key === "Minus" || key === "numpadSubtract") {
      if (keyHeld.current.has(key)) { e.preventDefault(); return; }
      keyHeld.current.add(key);
    }

    // ── Prevent browser default for all handled keys ──────────────────────
    e.preventDefault();
    e.stopPropagation();

    // ── Blur input first, then fire delete-type handler ───────────────────
    if (
      (key === "Delete" || key === "Minus" || key === "numpadSubtract") &&
      isEditable
    ) {
      e.target.blur();
      requestAnimationFrame(() => handler());
      return;
    }

    handler();
  }, []);

  const handleKeyUp = useCallback((e) => {
    let key = e.key;
    if (e.code === "Minus" || e.key === "-") key = "Minus";
    if (e.code === "NumpadSubtract")          key = "numpadSubtract";
    keyHeld.current.delete(key);
  }, []);

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