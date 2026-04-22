// src/hooks/useBilling.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { db as firebaseDb } from '../firebase/config';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { localDB } from '../db/localDB';
import { serialNumberManager } from '../utils/serialNumberManager';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';

const INITIAL_ITEM = {
  id: Date.now(),
  product: '',
  qty: 1,
  price: '',
  discount: '',
  discountType: 'fixed', // 'fixed' | 'percent'
  total: 0,
};

const INITIAL_BILL_STATE = {
  items: [{ ...INITIAL_ITEM, id: Date.now() }],
  customer: null,
  billDiscount: '',
  billDiscountType: 'fixed',
  serialNumber: '',
  status: 'draft',
  isLocked: false,
  isSaving: false,
  isSaved: false,
};

export const useBilling = () => {
  const { user, storeId } = useAuth();
  const { settings } = useSettings();
  
  const [billState, setBillState] = useState(INITIAL_BILL_STATE);
  const [saveError, setSaveError] = useState(null);
  const lastSavedSerialRef = useRef(null); // Track last saved to prevent duplicates
  const savingRef = useRef(false); // Prevent concurrent saves

  // ✅ Calculate totals
  const calculateTotals = useCallback((items, billDiscount, billDiscountType) => {
    let totalQty = 0;
    let subtotal = 0;
    let totalItemDiscount = 0;

    const processedItems = items.map(item => {
      const qty = parseFloat(item.qty) || 1;
      const price = parseFloat(item.price) || 0;
      const gross = qty * price;

      let itemDiscountAmt = 0;
      if (item.discount) {
        if (item.discountType === 'percent') {
          itemDiscountAmt = (gross * parseFloat(item.discount)) / 100;
        } else {
          itemDiscountAmt = parseFloat(item.discount) || 0;
        }
      }

      const itemTotal = Math.max(0, gross - itemDiscountAmt);
      totalQty += qty;
      subtotal += itemTotal;
      totalItemDiscount += itemDiscountAmt;

      return { ...item, total: itemTotal, gross, itemDiscountAmt };
    });

    let billDiscountAmt = 0;
    if (billDiscount) {
      if (billDiscountType === 'percent') {
        billDiscountAmt = (subtotal * parseFloat(billDiscount)) / 100;
      } else {
        billDiscountAmt = parseFloat(billDiscount) || 0;
      }
    }

    const finalTotal = Math.max(0, subtotal - billDiscountAmt);
    const totalDiscount = totalItemDiscount + billDiscountAmt;

    return {
      processedItems,
      totalQty,
      subtotal,
      totalItemDiscount,
      billDiscountAmt,
      totalDiscount,
      finalTotal,
    };
  }, []);

  // ✅ Add new item
  const addItem = useCallback((itemData) => {
    setBillState(prev => {
      if (prev.isLocked || prev.isSaved) return prev;
      
      const newItem = {
        id: Date.now() + Math.random(),
        product: itemData.product || '',
        qty: itemData.qty || 1,
        price: itemData.price || '',
        discount: itemData.discount || '',
        discountType: itemData.discountType || 'fixed',
        total: 0,
      };

      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
  }, []);

  // ✅ Update item
  const updateItem = useCallback((itemId, field, value) => {
    setBillState(prev => {
      if (prev.isLocked || prev.isSaved) return prev;
      
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        ),
      };
    });
  }, []);

  // ✅ Delete item
  const deleteItem = useCallback((itemId) => {
    setBillState(prev => {
      if (prev.isLocked || prev.isSaved) return prev;
      
      const newItems = prev.items.filter(item => item.id !== itemId);
      
      // Always keep at least one empty item
      if (newItems.length === 0) {
        return {
          ...prev,
          items: [{ ...INITIAL_ITEM, id: Date.now() }],
        };
      }
      
      return { ...prev, items: newItems };
    });
  }, []);

  // ✅ CLEAR BILL - Fixed
  const clearBill = useCallback(async (reason = 'manual_clear') => {
    setBillState(prev => {
      // Log to cleared data if items exist
      const hasItems = prev.items.some(item => parseFloat(item.price) > 0);
      
      if (hasItems) {
        // Save to clearedData in background
        const { processedItems, finalTotal } = calculateTotals(
          prev.items,
          prev.billDiscount,
          prev.billDiscountType
        );
        
        localDB.clearedData.add({
          items: processedItems,
          customer: prev.customer,
          finalTotal,
          reason,
          clearedAt: new Date().toISOString(),
          syncStatus: 'pending',
          userId: user?.uid,
          storeId,
        }).catch(err => console.error('Error logging cleared data:', err));
      }

      // ✅ Reset to fresh state
      return {
        ...INITIAL_BILL_STATE,
        items: [{ ...INITIAL_ITEM, id: Date.now() }],
        isLocked: false,
        isSaved: false,
        isSaving: false,
      };
    });

    // Reset refs
    lastSavedSerialRef.current = null;
    savingRef.current = false;
    setSaveError(null);
    
    console.log('✅ Bill cleared');
  }, [user, storeId, calculateTotals]);

  // ✅ SET CUSTOMER
  const setCustomer = useCallback((customer) => {
    setBillState(prev => ({
      ...prev,
      customer,
    }));
  }, []);

  // ✅ SET BILL DISCOUNT
  const setBillDiscount = useCallback((discount, type = 'fixed') => {
    setBillState(prev => ({
      ...prev,
      billDiscount: discount,
      billDiscountType: type,
    }));
  }, []);

  // ✅ SAVE BILL - Main fix
  const saveBill = useCallback(async () => {
    // ✅ Prevent duplicate saves
    if (savingRef.current) {
      console.warn('⚠️ Save already in progress');
      return { success: false, error: 'Save in progress' };
    }

    // ✅ Prevent saving already saved bill
    if (billState.isSaved) {
      console.warn('⚠️ Bill already saved');
      return { success: false, error: 'Bill already saved' };
    }

    if (billState.isLocked && billState.isSaved) {
      return { success: false, error: 'Bill already saved' };
    }

    savingRef.current = true;

    setBillState(prev => ({ ...prev, isSaving: true }));
    setSaveError(null);

    try {
      // Calculate final totals
      const totals = calculateTotals(
        billState.items,
        billState.billDiscount,
        billState.billDiscountType
      );

      // Validate bill has items
      const hasValidItems = totals.processedItems.some(
        item => parseFloat(item.price) > 0
      );

      if (!hasValidItems) {
        throw new Error('Bill has no valid items');
      }

      // Generate serial number
      const serialNumber = await serialNumberManager.generateSerial(
        storeId,
        settings
      );

      // Check if this serial was already saved (extra safety)
      if (serialNumber === lastSavedSerialRef.current) {
        throw new Error('Duplicate serial detected');
      }

      // Prepare bill data
      const billData = {
        serialNumber,
        items: totals.processedItems,
        customer: billState.customer || {
          name: settings?.customer?.defaultCustomerName || 'Walking Customer',
          phone: '',
          city: 'Karachi',
          market: '',
        },
        subtotal: totals.subtotal,
        totalItemDiscount: totals.totalItemDiscount,
        billDiscount: parseFloat(billState.billDiscount) || 0,
        billDiscountType: billState.billDiscountType,
        billDiscountAmount: totals.billDiscountAmt,
        totalDiscount: totals.totalDiscount,
        finalTotal: totals.finalTotal,
        totalQty: totals.totalQty,
        storeId,
        userId: user?.uid,
        userName: user?.displayName || user?.email,
        status: settings?.autoApproval?.autoApproval ? 'approved' : 'pending',
        createdAt: new Date().toISOString(),
        isOffline: !navigator.onLine,
      };

      let savedSuccessfully = false;

      // ✅ ONLINE: Save to Firestore directly
      if (navigator.onLine) {
        try {
          const docRef = await addDoc(
            collection(firebaseDb, 'orders'),
            {
              ...billData,
              createdAt: serverTimestamp(),
              syncedAt: serverTimestamp(),
            }
          );

          console.log(`✅ Bill saved online: ${serialNumber} (${docRef.id})`);
          
          // Also save to local as synced (for history)
          await localDB.pendingOrders.add({
            ...billData,
            firestoreId: docRef.id,
            syncStatus: 'synced',
            syncedAt: new Date().toISOString(),
          });

          savedSuccessfully = true;
        } catch (firestoreErr) {
          console.error('Firestore save failed, falling back to offline:', firestoreErr);
          // Fall through to offline save
        }
      }

      // ✅ OFFLINE (or Firestore failed): Save to IndexedDB
      if (!savedSuccessfully) {
        try {
          const localId = await localDB.pendingOrders.add({
            ...billData,
            syncStatus: 'pending',
            localSavedAt: new Date().toISOString(),
          });

          console.log(`✅ Bill saved offline: ${serialNumber} (localId: ${localId})`);
          savedSuccessfully = true;
        } catch (localErr) {
          console.error('❌ Local save also failed:', localErr);
          throw new Error(`Save failed: ${localErr.message}`);
        }
      }

      if (savedSuccessfully) {
        // ✅ Mark as saved and lock
        lastSavedSerialRef.current = serialNumber;
        
        setBillState(prev => ({
          ...prev,
          serialNumber,
          isLocked: true,
          isSaved: true,
          isSaving: false,
          status: billData.status,
        }));

        return { 
          success: true, 
          serialNumber,
          billData,
          isOffline: !navigator.onLine 
        };
      }
    } catch (err) {
      console.error('❌ Save bill error:', err);
      setSaveError(err.message);
      
      setBillState(prev => ({ 
        ...prev, 
        isSaving: false,
        // ✅ Don't lock if save failed
        isLocked: false,
        isSaved: false,
      }));

      return { success: false, error: err.message };
    } finally {
      savingRef.current = false;
    }
  }, [billState, storeId, user, settings, calculateTotals]);

  // ✅ DELETE BILL (with audit log)
  const deleteBill = useCallback(async (reason = 'manual_delete') => {
    const cooldownKey = 'lastDeleteTime';
    const lastDelete = parseInt(sessionStorage.getItem(cooldownKey) || '0');
    const now = Date.now();
    
    if (now - lastDelete < 400) {
      console.warn('Delete cooldown active');
      return false;
    }
    
    sessionStorage.setItem(cooldownKey, now.toString());

    try {
      const totals = calculateTotals(
        billState.items,
        billState.billDiscount,
        billState.billDiscountType
      );

      const hasItems = billState.items.some(item => parseFloat(item.price) > 0);

      if (hasItems) {
        const deleteLog = {
          originalSerial: billState.serialNumber || 'UNSAVED',
          items: totals.processedItems,
          customer: billState.customer,
          finalTotal: totals.finalTotal,
          reason,
          deletedAt: new Date().toISOString(),
          userId: user?.uid,
          storeId,
          syncStatus: navigator.onLine ? 'synced' : 'pending',
        };

        if (navigator.onLine) {
          try {
            await addDoc(collection(firebaseDb, 'deletedBills'), {
              ...deleteLog,
              deletedAt: serverTimestamp(),
            });
          } catch (err) {
            // Save locally if Firestore fails
            await localDB.deletedBills.add({ ...deleteLog, syncStatus: 'pending' });
          }
        } else {
          await localDB.deletedBills.add(deleteLog);
        }
      }

      // ✅ Clear the bill
      await clearBill(reason);
      return true;
    } catch (err) {
      console.error('Delete bill error:', err);
      // Still clear even if logging fails
      await clearBill(reason);
      return true;
    }
  }, [billState, user, storeId, calculateTotals, clearBill]);

  // ✅ START NEW BILL (after lock)
  const startNewBill = useCallback(() => {
    // ✅ Complete reset
    savingRef.current = false;
    lastSavedSerialRef.current = null;
    setSaveError(null);
    
    setBillState({
      ...INITIAL_BILL_STATE,
      items: [{ ...INITIAL_ITEM, id: Date.now() }],
      isLocked: false,
      isSaved: false,
      isSaving: false,
    });
    
    console.log('✅ New bill started');
  }, []);

  // Computed totals
  const totals = calculateTotals(
    billState.items,
    billState.billDiscount,
    billState.billDiscountType
  );

  return {
    // State
    items: totals.processedItems,
    customer: billState.customer,
    billDiscount: billState.billDiscount,
    billDiscountType: billState.billDiscountType,
    serialNumber: billState.serialNumber,
    isLocked: billState.isLocked,
    isSaving: billState.isSaving,
    isSaved: billState.isSaved,
    saveError,
    
    // Totals
    totalQty: totals.totalQty,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    finalTotal: totals.finalTotal,
    billDiscountAmount: totals.billDiscountAmt,

    // Actions
    addItem,
    updateItem,
    deleteItem,
    clearBill,
    deleteBill,
    saveBill,
    startNewBill,
    setCustomer,
    setBillDiscount,
  };
};