// src/hooks/useHotkeys.js
// ✅ FIXED: Hold-key tracked by e.code (consistent keydown/keyup)
// ✅ FIXED: isBillTableInput — checks data-bill-input attribute
// ✅ FIXED: onKeyUp uses e.code only (no getActionKey call needed)
// ✅ FIXED: Escape always fires even inside dialogs
// ✅ FIXED: NumpadSubtract fully blocked in all inputs
// ✅ FIXED: Delete blocked in ALL inputs except data-bill-input ones
// ✅ FIXED: getActionKey wrapped stable — no stale closure risk

import { useEffect, useRef, useCallback } from "react";

// ─── Per-key debounce (ms) ────────────────────────────────────
const KEY_DEBOUNCE = {
  Insert:         50,
  F8:             300,
  Escape:         120,
  Delete:         500,
  Home:           150,
  End:            150,
  ArrowUp:        60,
  ArrowDown:      60,
  PageUp:         180,
  PageDown:       180,
  numpadAdd:      180,
  Minus:          500,
  numpadSubtract: 500,
  numpadDivide:   180,
  ClearCache:     1000, // ✅ NEW: Ctrl+Shift+Delete for cache clear
};

// ─── Always fire even when input focused ──────────────────────
const ALWAYS_FIRE = new Set([
  "Insert",
  "F8",
  "Escape",
  "Home",
  "End",
  "numpadAdd",
  "numpadDivide",
  "Minus",           // ✅ FIXED: Allow minus key even in price input
  "numpadSubtract",  // ✅ FIXED: Allow numpad minus key in inputs too
]);

// ─── Block when any editable element is focused ───────────────
const BLOCK_IN_EDITABLE = new Set([
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
]);

// ─── Helpers ──────────────────────────────────────────────────

/** True if element is a text-input type */
const isEditableElement = (el) => {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return (
    tag === "input"    ||
    tag === "textarea" ||
    tag === "select"   ||
    el.isContentEditable === true
  );
};

/**
 * True if element is inside a bill-table qty/discount input.
 * These inputs handle their own Delete/Backspace.
 * Mark them with: data-bill-input="true"
 */
const isBillTableInput = (el) => {
  if (!el) return false;
  // Check self
  if (el.dataset?.billInput === "true") return true;
  // Check up to 3 ancestors (td → tr → tbody)
  let node = el.parentElement;
  let depth = 0;
  while (node && depth < 4) {
    if (node.dataset?.billInput === "true") return true;
    node = node.parentElement;
    depth++;
  }
  return false;
};

/**
 * True if a suggestion/combobox dropdown is currently open.
 * Arrows should be passed through so dropdown can handle navigation.
 */
const isDropdownVisible = () => {
  if (document.querySelector('[data-dropdown-open="true"]'))  return true;
  if (document.querySelector('[role="listbox"]:not([hidden])')) return true;
  if (document.querySelector(".suggestion-list:not(.hidden)")) return true;
  return false;
};

// ─── Map e → actionKey (pure function, no deps) ───────────────
const getActionKey = (e) => {
  const { code, key } = e;

  // Numpad — use code for locale independence
  if (code === "NumpadAdd")      return "numpadAdd";
  if (code === "NumpadSubtract") return "numpadSubtract";
  if (code === "NumpadDivide")   return "numpadDivide";
  if (code === "NumpadEnter")    return "Enter";
  if (code === "NumpadDecimal")  return null;
  if (code === "NumpadMultiply") return null;

  // Insert — both code and key (laptop keyboards vary)
  if (code === "Insert" || key === "Insert") return "Insert";

  // F-keys — only F8; allow browser defaults for rest
  if (key === "F8")  return "F8";
  if (key === "F5")  return null;
  if (key === "F11") return null;
  if (key === "F12") return null;

  // Always-global
  if (key === "Escape")    return "Escape";
  if (key === "Home")      return "Home";
  if (key === "End")       return "End";

  // Navigation
  if (key === "Delete")    return "Delete";
  if (key === "ArrowUp")   return "ArrowUp";
  if (key === "ArrowDown") return "ArrowDown";
  if (key === "PageUp")    return "PageUp";
  if (key === "PageDown")  return "PageDown";

  // Minus — main keyboard ONLY (code=Minus, key="-")
  // Shifted minus (underscore) is excluded by key==="-" check
  if (code === "Minus" && key === "-") return "Minus";

  return null;
};

// ════════════════════════════════════════════════════════════════
// HOOK
// ════════════════════════════════════════════════════════════════
export default function useKeyboardShortcuts(handlers, enabled = true) {
  const handlersRef  = useRef(handlers);
  const lastFiredRef = useRef({});
  // ✅ Track by e.code — consistent between keydown and keyup
  const heldCodesRef = useRef(new Set());

  // Always keep handlers fresh — no stale closures
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      // ✅ FIXED: Allow Ctrl+Shift+Delete for cache clear
      const isCacheClear = e.ctrlKey && e.shiftKey && e.key === "Delete";
      
      // ── 1. Skip all modifier combos (except cache clear) ─
      if ((e.ctrlKey || e.altKey || e.metaKey) && !isCacheClear) return;

      // ── 2. Resolve action key ─────────────────────────────
      const actionKey = isCacheClear ? "ClearCache" : getActionKey(e);
      if (!actionKey) return;

      // ── 3. Check handler exists ───────────────────────────
      const handler = handlersRef.current?.[actionKey];
      if (typeof handler !== "function") return;

      const editable     = isEditableElement(e.target);
      const dropdownOpen = isDropdownVisible();

      // ── 4. Routing logic ──────────────────────────────────
      if (editable) {
        if (ALWAYS_FIRE.has(actionKey)) {
          // Insert / F8 / Escape / numpadAdd / numpadDivide / Minus
          // → always fire, but don't steal cursor from Home/End/Escape
          if (
            actionKey !== "Home"   &&
            actionKey !== "End"    &&
            actionKey !== "Escape"
          ) {
            e.preventDefault();
          }
          // fall through → fire handler

        } else if (BLOCK_IN_EDITABLE.has(actionKey)) {

          // Arrow keys in open dropdown → let dropdown handle
          if (
            (actionKey === "ArrowUp" || actionKey === "ArrowDown") &&
            dropdownOpen
          ) {
            return;
          }

          // ✅ Delete in bill-table qty input → let input handle it
          // The qty input has data-bill-input="true" and also calls
          // e.stopPropagation() in its own onKeyDown as a double guard
          if (actionKey === "Delete" && isBillTableInput(e.target)) {
            return;
          }

          // Block everything else (arrows, PageUp/Dn)
          return;

        } else {
          // Unknown key in editable → browser handles
          return;
        }
      } else {
        // Non-editable → prevent browser defaults (scroll, etc.)
        if (actionKey === "ClearCache" || !ALWAYS_FIRE.has(actionKey)) {
          e.preventDefault();
        }
      }

      // ── 5. Hold-key / repeat prevention ──────────────────
      // e.repeat is the native "key held down" flag — most reliable
      if (e.repeat) return;

      // Secondary guard using e.code tracking
      if (heldCodesRef.current.has(e.code)) return;
      heldCodesRef.current.add(e.code);

      // ── 6. Per-key debounce ───────────────────────────────
      const debounceMs = KEY_DEBOUNCE[actionKey] ?? 150;
      const now        = Date.now();
      const lastFired  = lastFiredRef.current[actionKey] || 0;
      if (now - lastFired < debounceMs) return;
      lastFiredRef.current[actionKey] = now;

      // ── 7. Fire ───────────────────────────────────────────
      try {
        handler(e);
      } catch (err) {
        console.error(`[useHotkeys] "${actionKey}" handler threw:`, err);
      }
    };

    // ✅ keyUp: clear by e.code ONLY — no getActionKey needed
    // This ensures heldCodesRef is always cleared even if key
    // mapping changes or getActionKey returns null for some reason
    const onKeyUp = (e) => {
      heldCodesRef.current.delete(e.code);
    };

    // Capture phase — runs BEFORE React synthetic events
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup",   onKeyUp,   { capture: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup",   onKeyUp,   { capture: true });
    };
  }, [enabled]); // ✅ No getActionKey dep — it's a pure module-level function now
}