import { useEffect, useCallback } from "react";

const useKeyboardShortcuts = (shortcuts, enabled = true) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled) return;

      // Don't trigger in input fields (except specific keys)
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(
        e.target.tagName
      );
      const allowedInInput = [
        "Escape",
        "F8",
        "Insert",
        "ArrowUp",
        "ArrowDown",
      ];

      if (isInput && !allowedInInput.includes(e.key)) return;

      // Map key codes
      let key = e.key;

      // Handle numpad keys
      if (e.code === "NumpadAdd") key = "numpadAdd";
      else if (e.code === "NumpadSubtract") key = "numpadSubtract";
      else if (e.code === "NumpadMultiply") key = "numpadMultiply";
      else if (e.code === "NumpadDivide") key = "numpadDivide";
      else if (e.code === "Numpad0") key = "numpad0";

      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};

export default useKeyboardShortcuts;