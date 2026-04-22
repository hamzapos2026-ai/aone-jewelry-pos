// src/hooks/useHotkeys.js
import { useEffect, useCallback, useRef } from "react";

const ALWAYS_GLOBAL = new Set([
  "Escape", "F8", "F9", "Insert", "Home", "End",
  "Delete", "Minus",
  "PageUp", "PageDown",
  "ArrowUp", "ArrowDown",
  "numpadAdd", "numpadSubtract",
  "numpadMultiply", "numpadDivide",
]);

const ONE_SHOT_SIMPLE = new Set([
  "Insert", "F8", "F9", "End", "PageUp", "PageDown", "Escape",
]);

const useKeyboardShortcuts = (shortcuts, enabled = true) => {
  const deleteFiredCount = useRef({ Minus: 0, numpadSubtract: 0, Delete: 0 });
  const keyHeld          = useRef(new Set());
  const shortcutsRef     = useRef(shortcuts);
  const enabledRef       = useRef(enabled);

  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);
  useEffect(() => { enabledRef.current   = enabled;   }, [enabled]);

  const handleKeyDown = useCallback((e) => {
    if (!enabledRef.current) return;

    let key = e.key;
    if (e.key === "-" || e.code === "Minus")  key = "Minus";
    if (e.code === "NumpadAdd")                key = "numpadAdd";
    if (e.code === "NumpadSubtract")           key = "numpadSubtract";
    if (e.code === "NumpadMultiply")           key = "numpadMultiply";
    if (e.code === "NumpadDivide")             key = "numpadDivide";

    if (e.repeat && ONE_SHOT_SIMPLE.has(key)) {
      e.preventDefault();
      return;
    }

    if (e.repeat && (key === "Minus" || key === "numpadSubtract" || key === "Delete")) {
      e.preventDefault();
      return;
    }

    if (keyHeld.current.has(key) &&
       (key === "Minus" || key === "numpadSubtract" || key === "Delete")) {
      e.preventDefault();
      return;
    }

    const handler = shortcutsRef.current?.[key];
    if (!handler) return;

    const tag = e.target?.tagName || "";
    const isEditable =
      ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
      e.target?.isContentEditable;

    if (isEditable && !ALWAYS_GLOBAL.has(key)) return;

    if (key === "Minus" || key === "numpadSubtract" || key === "Delete") {
      if (deleteFiredCount.current[key] >= 1) {
        e.preventDefault();
        return;
      }
      deleteFiredCount.current[key] = 1;
      keyHeld.current.add(key);
    }

    e.preventDefault();
    e.stopPropagation();

    if ((key === "Delete" || key === "Minus" || key === "numpadSubtract") && isEditable) {
      e.target.blur();
      requestAnimationFrame(handler);
      return;
    }

    handler();
  }, []);

  const handleKeyUp = useCallback((e) => {
    if (!enabledRef.current) return;
    let key = e.key;
    if (e.key === "-" || e.code === "Minus") key = "Minus";
    if (e.code === "NumpadSubtract")          key = "numpadSubtract";

    keyHeld.current.delete(key);

    if (key === "Minus" || key === "numpadSubtract" || key === "Delete") {
      deleteFiredCount.current[key] = 0;
    }
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