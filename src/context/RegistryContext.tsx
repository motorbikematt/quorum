import React, { createContext, useContext, useState, useEffect } from 'react';
import mockData from '../mockRegistry.json';
import { type Captain, countCheckedIn, flushToGAS, GAS_ENDPOINT } from '../lib/registryUtils';


interface RegistryContextType {
  registry: Captain[];
  // Generic write path: patch any field(s) of one captain (e.g. a captain
  // supplying their own email). New fields need no new method.
  updateCaptain: (uuid: string, patch: Partial<Captain>) => void;
  updateSyncStatus: (uuid: string, status: number) => void;
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


  // The one place a captain record is mutated: apply a partial patch, persist to
  // localStorage, then optionally run a side effect on the updated registry.
  const applyPatch = (
    uuid: string,
    patch: Partial<Captain>,
    after?: (updated: Captain[]) => void,
  ) => {
    setRegistry(prev => {
      const updated = prev.map(c => c.uuid === uuid ? { ...c, ...patch } : c);
      localStorage.setItem('quorumRegistry', JSON.stringify(updated));
      after?.(updated);
      return updated;
    });
  };

  const updateCaptain = (uuid: string, patch: Partial<Captain>) => applyPatch(uuid, patch);

  // Check-in status also flushes the change to the GAS sync endpoint.
  const updateSyncStatus = (uuid: string, status: number) =>
    applyPatch(uuid, { syncStatus: status }, flushToGAS);

  // Phone carries a derived phoneLast4 (the kiosk PIN second factor).
  const updatePhone = (uuid: string, phone: string) =>
    applyPatch(uuid, { phone, phoneLast4: phone.slice(-4) });

  useEffect(() => {
    if (!GAS_ENDPOINT) return;
    const id = setInterval(() => flushToGAS(registry), 30_000);
    return () => clearInterval(id);
  }, [registry]);

  const getCheckedInCount = () => countCheckedIn(registry);

  return (
    <RegistryContext.Provider value={{ registry, updateCaptain, updateSyncStatus, updatePhone, getCheckedInCount }}>
      {children}
    </RegistryContext.Provider>
  );
};

export const useRegistry = () => {
  const context = useContext(RegistryContext);
  if (!context) throw new Error('useRegistry must be used within RegistryProvider');
  return context;
};
