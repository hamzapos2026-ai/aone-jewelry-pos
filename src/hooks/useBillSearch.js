// src/hooks/useBillSearch.js
import { useState, useCallback } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../services/firebase";

export const useBillSearch = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [searchError, setSearchError] = useState("");

  const searchBills = useCallback(async (searchTerm, storeId) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    setSearching(true);
    setSearchError("");
    try {
      // Check if it's a serial number search (001, 002, etc.)
      const isSerialSearch = /^\d{1,3}$/.test(searchTerm.trim());

      let q;
      if (isSerialSearch) {
        // Search by serial number
        const paddedSerial = searchTerm.trim().padStart(3, "0");
        if (storeId) {
          q = query(
            collection(db, "orders"),
            where("storeId", "==", storeId),
            where("serialNo", "==", paddedSerial),
            limit(1)
          );
        } else {
          // If no storeId, search all stores (for superadmin)
          q = query(
            collection(db, "orders"),
            where("serialNo", "==", paddedSerial),
            limit(1)
          );
        }
      } else {
        // Search by customer name or phone
        if (storeId) {
          q = query(
            collection(db, "orders"),
            where("storeId", "==", storeId),
            orderBy("createdAt", "desc"),
            limit(20)
          );
        } else {
          // If no storeId, search all stores (for superadmin)
          q = query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(50)
          );
        }
      }

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by customer name/phone if text search
      if (!isSerialSearch) {
        const filtered = results.filter(
          (bill) =>
            bill.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bill.customer?.phone?.includes(searchTerm)
        );
        setSuggestions(filtered);
        if (filtered.length === 0) {
          setSearchError(`No bills found for "${searchTerm}"`);
        }
      } else {
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError(`Bill "${searchTerm.trim().padStart(3, "0")}" not found`);
        }
      }
    } catch (error) {
      console.error("Bill search error:", error);
      setSuggestions([]);
      setSearchError(`Search failed: ${error.message}`);
    } finally {
      setSearching(false);
    }
  }, []);

  return { suggestions, searching, searchBills, selectedBill, setSelectedBill, searchError, setSearchError };
};