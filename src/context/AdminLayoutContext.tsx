'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminLayoutContextType {
  isMaximized: boolean;
  setIsMaximized: (val: boolean | ((prev: boolean) => boolean)) => void;
  toggleMaximize: () => void;
}

const AdminLayoutContext = createContext<AdminLayoutContextType>({
  isMaximized: false,
  setIsMaximized: () => {},
  toggleMaximize: () => {},
});

export function AdminLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isMaximized, setIsMaximized] = useState(false);

  // Restore layout mode preference from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kitchenQueue_admin_maximized');
      if (saved === 'true') {
        setIsMaximized(true);
      }
    } catch (e) {}
  }, []);

  const handleSetIsMaximized = (val: boolean | ((prev: boolean) => boolean)) => {
    setIsMaximized(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('kitchenQueue_admin_maximized', String(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleMaximize = () => {
    handleSetIsMaximized(prev => !prev);
  };

  return (
    <AdminLayoutContext.Provider value={{ isMaximized, setIsMaximized: handleSetIsMaximized, toggleMaximize }}>
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout() {
  return useContext(AdminLayoutContext);
}
