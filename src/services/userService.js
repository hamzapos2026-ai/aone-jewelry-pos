// ==========================================
// User Service - User Management
// ==========================================
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where 
} from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Create New User (Admin/Manager/Cashier/Biller)
 */
export const createUser = async (userData, createdBy) => {
  try {
    console.log('🔄 Creating user:', userData.email);

    // Create Firebase Auth User
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password
    );

    const user = userCredential.user;

    // Save to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      fullName: userData.fullName,
      email: userData.email,
      role: userData.role,
      phone: userData.phone || '',
      createdBy: createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    });

    console.log('✅ User created:', user.uid);
    return { success: true, userId: user.uid };
  } catch (error) {
    console.error('❌ Create user error:', error);
    throw error;
  }
};

/**
 * Get All Users
 */
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📋 Users loaded:', users.length);
    return users;
  } catch (error) {
    console.error('❌ Get users error:', error);
    throw error;
  }
};

/**
 * Get Users by Role
 */
export const getUsersByRole = async (role) => {
  try {
    const q = query(collection(db, 'users'), where('role', '==', role));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
};

/**
 * Get Single User
 */
export const getUser = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }

    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

/**
 * Update User
 */
export const updateUser = async (userId, updates) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ User updated:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ Update user error:', error);
    throw error;
  }
};

/**
 * Delete User
 */
export const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    console.log('✅ User deleted:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ Delete user error:', error);
    throw error;
  }
};

/**
 * Toggle User Active Status
 */
export const toggleUserStatus = async (userId, isActive) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isActive: isActive,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ User status updated:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    throw error;
  }
};