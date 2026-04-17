// ==========================================
// Check Super Admin Utility
// ==========================================
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Check if a super admin exists in the system
 * @returns {Promise<boolean>} True if super admin exists
 */
export const checkSuperAdminExists = async () => {
  try {
    console.log('🔍 Checking if super admin exists...');

    // ✅ FIRST: Check localStorage (works offline)
    const localSetup = localStorage.getItem('setupCompleted');
    if (localSetup === 'true') {
      console.log('✅ Setup completed (from localStorage)');
      return true;
    }

    // ❌ LocalStorage says not completed, check Firebase
    console.log('🔄 Checking Firebase for setup status...');

    const systemDoc = await getDoc(doc(db, 'system', 'setup'));

    if (systemDoc.exists()) {
      const data = systemDoc.data();
      const hasSuperAdmin = data.hasSuperAdmin === true;

      // ✅ Store successful Firebase result in localStorage
      if (hasSuperAdmin) {
        localStorage.setItem('setupCompleted', 'true');
      }

      console.log('📋 Super Admin Status:', hasSuperAdmin ? '✅ Exists' : '❌ Not Found');
      console.log('📊 System Data:', data);

      return hasSuperAdmin;
    }

    console.log('⚠️ No system/setup document found - First time setup required');
    return false;

  } catch (error) {
    console.error('❌ Check super admin error:', error.code || error.message);

    // If permission denied, assume no super admin exists yet
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Permission denied - assuming no super admin exists');
      return false;
    }

    // If network unavailable, check localStorage as fallback
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      const localSetup = localStorage.getItem('setupCompleted');
      if (localSetup === 'true') {
        console.log('✅ Setup completed (offline fallback from localStorage)');
        return true;
      }
      console.warn('⚠️ Offline and no local setup record - assuming first time setup');
      return false;
    }

    return false;
  }
};

/**
 * Clear local setup status (for testing/reset purposes)
 */
export const clearLocalSetupStatus = () => {
  localStorage.removeItem('setupCompleted');
  console.log('🗑️ Local setup status cleared');
};

/**
 * Check if current user is super admin
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} True if user is super admin
 */
export const isUserSuperAdmin = async (uid) => {
  if (!uid) return false;

  try {
    const userDoc = await getDoc(doc(db, 'users', uid));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.role === 'superadmin';
    }

    return false;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
};

/**
 * Get super admin details
 * @returns {Promise<Object|null>} Super admin data or null
 */
export const getSuperAdminDetails = async () => {
  try {
    const systemDoc = await getDoc(doc(db, 'system', 'setup'));

    if (systemDoc.exists()) {
      const data = systemDoc.data();

      if (data.hasSuperAdmin && data.superAdminUid) {
        const userDoc = await getDoc(doc(db, 'users', data.superAdminUid));

        if (userDoc.exists()) {
          return {
            uid: data.superAdminUid,
            ...userDoc.data(),
            setupCompletedAt: data.setupCompletedAt,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting super admin details:', error);
    return null;
  }
};

/**
 * Verify super admin by email
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if email belongs to super admin
 */
export const verifySuperAdminEmail = async (email) => {
  try {
    const systemDoc = await getDoc(doc(db, 'system', 'setup'));

    if (systemDoc.exists()) {
      const data = systemDoc.data();
      return data.superAdminEmail?.toLowerCase() === email.toLowerCase();
    }

    return false;
  } catch (error) {
    console.error('Error verifying super admin email:', error);
    return false;
  }
};

export default checkSuperAdminExists;