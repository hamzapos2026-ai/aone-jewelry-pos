import { createContext, useContext, useEffect, useState } from 'react';
import { checkSuperAdminExists } from '../utils/checkSuperAdmin';

const SetupContext = createContext();

export const useSetup = () => {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within SetupProvider');
  }
  return context;
};

export const SetupProvider = ({ children }) => {
  const [setupComplete, setSetupComplete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      console.log('🔄 Checking setup status...');
      const hasSuperAdmin = await checkSuperAdminExists();
      setSetupComplete(hasSuperAdmin);
      console.log('✅ Setup Check Complete:', hasSuperAdmin ? 'Setup Done' : 'Setup Required');
    } catch (error) {
      console.error('❌ Setup Check Failed:', error);
      setSetupComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const markSetupComplete = () => {
    setSetupComplete(true);
    console.log('✅ Setup marked as complete');
  };

  const value = {
    setupComplete,
    loading,
    markSetupComplete,
    checkSetup, // Allow manual re-check
  };

  return (
    <SetupContext.Provider value={value}>
      {children}
    </SetupContext.Provider>
  );
};