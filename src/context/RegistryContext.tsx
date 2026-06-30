import React, { createContext, useContext, useState, useEffect } from 'react';
import mockData from '../mockRegistry.json';
import { type Captain, countCheckedIn, flushToGAS, GAS_ENDPOINT } from '../lib/registryUtils';


interface RegistryContextType {
  registry: Captain[];
  updateSyncStatus: (uuid: string, status: number) => void;
  updatePhoneLast4: (uuid: string, phoneLast4: string) => void;
  updatePhone: (uuid: string, phone: string) => void;
  getCheckedInCount: () => number;
}

export const RegistryContext = createContext<RegistryContextType | undefined>(undefined);

export const RegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registry, setRegistry] = useState<Captain[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('quorumRegistry');
    if (stored) {
      setRegistry(JSON.parse(stored));
    } else {
      setRegistry(mockData);
      localStorage.setItem('quorumRegistry', JSON.stringify(mockData));
    }
  }, []);


  const updateSyncStatus = (uuid: string, status: number) => {
    setRegistry(prev => {
      const updated = prev.map(c => c.uuid === uuid ? { ...c, syncStatus: status } : c);
      localStorage.setItem('quorumRegistry', JSON.stringify(updated));
      flushToGAS(updated);
      return updated;
    });
  };

  const updatePhoneLast4 = (uuid: string, phoneLast4: string) => {
    setRegistry(prev => {
      const updated = prev.map(c => c.uuid === uuid ? { ...c, phoneLast4 } : c);
      localStorage.setItem('quorumRegistry', JSON.stringify(updated));
      return updated;
    });
  };

  const updatePhone = (uuid: string, phone: string) => {
    setRegistry(prev => {
      const phoneLast4 = phone.slice(-4);
      const updated = prev.map(c => c.uuid === uuid ? { ...c, phone, phoneLast4 } : c);
      localStorage.setItem('quorumRegistry', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (!GAS_ENDPOINT) return;
    const id = setInterval(() => flushToGAS(registry), 30_000);
    return () => clearInterval(id);
  }, [registry]);

  const getCheckedInCount = () => countCheckedIn(registry);

  return (
    <RegistryContext.Provider value={{ registry, updateSyncStatus, updatePhoneLast4, updatePhone, getCheckedInCount }}>
      {children}
    </RegistryContext.Provider>
  );
};

export const useRegistry = () => {
  const context = useContext(RegistryContext);
  if (!context) throw new Error('useRegistry must be used within RegistryProvider');
  return context;
};
