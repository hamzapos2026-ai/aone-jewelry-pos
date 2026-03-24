// ==========================================
// Cash Service - Cash Flow Management
// ==========================================
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Add Cash Transaction
 */
export const addCashTransaction = async (transactionData) => {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), {
      ...transactionData,
      createdAt: new Date().toISOString(),
    });

    console.log('✅ Transaction added:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('❌ Add transaction error:', error);
    throw error;
  }
};

/**
 * Get All Transactions
 */
export const getAllTransactions = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'transactions'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

/**
 * Get Transactions by Type (income/expense)
 */
export const getTransactionsByType = async (type) => {
  try {
    const q = query(
      collection(db, 'transactions'), 
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching transactions by type:', error);
    throw error;
  }
};

/**
 * Get Transactions by Date Range
 */
export const getTransactionsByDateRange = async (startDate, endDate) => {
  try {
    const q = query(
      collection(db, 'transactions'),
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching transactions by date:', error);
    throw error;
  }
};

/**
 * Update Transaction
 */
export const updateTransaction = async (transactionId, updates) => {
  try {
    await updateDoc(doc(db, 'transactions', transactionId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Transaction updated:', transactionId);
    return { success: true };
  } catch (error) {
    console.error('❌ Update transaction error:', error);
    throw error;
  }
};

/**
 * Delete Transaction
 */
export const deleteTransaction = async (transactionId) => {
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
    console.log('✅ Transaction deleted:', transactionId);
    return { success: true };
  } catch (error) {
    console.error('❌ Delete transaction error:', error);
    throw error;
  }
};

/**
 * Calculate Total Balance
 */
export const calculateBalance = async () => {
  try {
    const transactions = await getAllTransactions();
    
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    return {
      income,
      expense,
      balance: income - expense
    };
  } catch (error) {
    console.error('Error calculating balance:', error);
    throw error;
  }
};