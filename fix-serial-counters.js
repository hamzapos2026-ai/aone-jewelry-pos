// ==========================================
// Fix Serial Counters
// Reset serial counters to 0001 or scan & sync
// Run: node fix-serial-counters.js [--reset]
// ==========================================

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// Firebase configuration (same as your app)
const firebaseConfig = {
  apiKey: "AIzaSyAE6RdGG5S8eIgUoFafar2IYuXkj0Wp4so",
  authDomain: "posnew-87a68.firebaseapp.com",
  projectId: "posnew-87a68",
  storageBucket: "posnew-87a68.appspot.com",
  messagingSenderId: "398537246776",
  appId: "1:398537246776:web:c1a171225b9c0742fdfecd",
  measurementId: "G-RGEVJ4W4LS",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get mode from CLI arg
const mode = process.argv[2]?.toLowerCase() || "--sync";
const shouldReset = mode === "--reset";

// ─── Extract number from serial ───────────────────────────────────────────────
const extractNum = (serial = "") => {
  if (!serial) return 0;
  // Handle: "0045", "OFF-PC1-012"
  const m = serial.match(/^(\d+)$/);
  if (m) return parseInt(m[1], 10);
  // Numeric tail
  const m2 = serial.match(/(\d+)$/);
  return m2 ? parseInt(m2[1], 10) : 0;
};

// ─── Fix counters for a store ─────────────────────────────────────────────────
async function fixCounterForStore(storeId) {
  console.log(`\n📊 Processing store: "${storeId}"`);

  try {
    // Scan all orders for this store
    const q = query(
      collection(db, "orders"),
      where("storeId", "==", storeId)
    );
    const snap = await getDocs(q);

    let maxSerial = 0;
    let onlineCount = 0;
    let offlineCount = 0;

    console.log(`   Found ${snap.docs.length} orders`);

    snap.docs.forEach((d) => {
      const data = d.data();
      const serialNo = data.serialNo || data.billSerial || "";
      const num = extractNum(serialNo);
      const source = data.source || "unknown";

      if (num > maxSerial) maxSerial = num;
      if (source === "online") onlineCount++;
      if (source === "offline") offlineCount++;
    });

    // Determine the new counter value
    const newCounterValue = shouldReset ? 0 : maxSerial;

    console.log(`   Max serial found: ${maxSerial}`);
    console.log(`   Online: ${onlineCount}, Offline: ${offlineCount}`);
    console.log(`   Setting counter to: ${newCounterValue}`);

    // ── Update the counter ───────────────────────────────────────────────
    const counterRef = doc(db, "counters", `serial_${storeId}`);

    await setDoc(
      counterRef,
      {
        lastSerial: newCounterValue,
        storeId,
        updatedAt: serverTimestamp(),
        fixedAt: new Date().toISOString(),
        fixedBy: "fix-serial-counters-script",
        mode: shouldReset ? "reset-to-0001" : "sync-from-max",
        totalOrdersScanned: snap.docs.length,
      },
      { merge: true }
    );

    const nextSerial = String(newCounterValue + 1).padStart(4, "0");
    console.log(`   ✅ Counter set to ${newCounterValue}`);
    console.log(`   Next bill will be: ${nextSerial}`);

    return { storeId, newCounterValue, nextSerial, success: true };
  } catch (err) {
    console.error(`   ❌ Error for store "${storeId}":`, err.message);
    return { storeId, success: false, error: err.message };
  }
}

// ─── Main: Fix all stores ────────────────────────────────────────────────────
async function fixAllCounters() {
  const modeStr = shouldReset ? "RESET TO 0001" : "SYNC FROM MAX";
  console.log(`🔧 Starting Serial Counter ${modeStr}...\n`);

  try {
    // Get all unique storeIds from orders
    const ordersSnap = await getDocs(collection(db, "orders"));
    const storeIds = new Set();

    ordersSnap.docs.forEach((d) => {
      const storeId = d.data().storeId || "default";
      storeIds.add(storeId);
    });

    if (storeIds.size === 0) {
      console.log("⚠️  No orders found in Firebase");
      process.exit(0);
    }

    console.log(`Found ${storeIds.size} unique store(s): ${Array.from(storeIds).join(", ")}\n`);

    // Fix each store
    const results = [];
    for (const storeId of storeIds) {
      const result = await fixCounterForStore(storeId);
      results.push(result);
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log(`✅ ${modeStr} COMPLETE\n`);
    results.forEach((r) => {
      if (r.success) {
        console.log(
          `   "${r.storeId}": Counter = ${r.newCounterValue} → next = ${r.nextSerial}`
        );
      } else {
        console.log(`   "${r.storeId}": FAILED - ${r.error}`);
      }
    });

    console.log("\n📝 Next steps:");
    console.log("   1. Reload both localhost (localhost:5173) and online");
    console.log("   2. Verify bill serials now start from " + (shouldReset ? "0001" : "correct number"));
    console.log("   3. New bills will be sequential across all instances");
    console.log("   4. Both environments share the same Firebase database ✓");
    console.log("\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
}

// Run it
fixAllCounters();
