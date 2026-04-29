/**
 * ✅ Clear all browser cache, localStorage, sessionStorage, IndexedDB
 * Used for debugging, testing, and user reset
 */
export const clearAllCache = async () => {
  try {
    // 1. Clear localStorage
    localStorage.clear();
    console.log("✅ localStorage cleared");

    // 2. Clear sessionStorage
    sessionStorage.clear();
    console.log("✅ sessionStorage cleared");

    // 3. Clear IndexedDB databases
    const dbs = await window.indexedDB.databases?.() || [];
    for (const db of dbs) {
      window.indexedDB.deleteDatabase(db.name);
      console.log(`✅ IndexedDB database '${db.name}' deleted`);
    }

    // 4. Clear Service Worker cache
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
        console.log(`✅ Cache '${cacheName}' deleted`);
      }
    }

    // 5. Clear cookies
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    });
    console.log("✅ Cookies cleared");

    return {
      success: true,
      message: "🧹 All cache cleared successfully! Page will reload...",
    };
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
    return {
      success: false,
      message: `❌ Error clearing cache: ${error.message}`,
    };
  }
};

/**
 * Clear cache and reload page
 */
export const clearCacheAndReload = async () => {
  const result = await clearAllCache();
  console.log(result.message);
  // Reload after short delay
  setTimeout(() => {
    window.location.href = "/";
  }, 500);
};
