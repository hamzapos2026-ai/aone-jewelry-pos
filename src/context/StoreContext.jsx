// ======================================================
// StoreContext.jsx
// ======================================================
// Ye context current selected store ko globally manage karta hai
// SuperAdmin multiple stores dekh sakta hai
// Admin/Manager/Biller sirf apna store use karenge
// ======================================================

import { createContext, useContext, useState } from "react";

//  Create Context
const StoreContext = createContext();

// Provider Component
export const StoreProvider = ({ children }) => {

  //  Current active store
  const [store, setStore] = useState(null);

  return (
    <StoreContext.Provider value={{ store, setStore }}>
      {children}
    </StoreContext.Provider>
  );
};

//  Custom Hook
export const useStore = () => useContext(StoreContext);