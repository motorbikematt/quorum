import React, { useState } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegistryContext } from '../context/RegistryContext';
import { type Captain, countCheckedIn } from '../lib/registryUtils';

export function renderWithRegistry(ui: React.ReactElement, initialRegistry: Captain[]) {
  let latestRegistry = initialRegistry;
  
  const TestProvider = ({ children }: { children: React.ReactNode }) => {
    const [registry, setRegistry] = useState(initialRegistry);
    latestRegistry = registry;
    
    // The one place a captain is mutated in tests; mirrors the real provider.
    const applyPatch = (uuid: string, patch: Partial<Captain>) => {
      setRegistry(prev => {
        const updated = prev.map(c => c.uuid === uuid ? { ...c, ...patch } : c);
        // Simulate the real provider's localStorage write so tests can assert on it
        localStorage.setItem('quorumRegistry', JSON.stringify(updated));
        return updated;
      });
    };

    const updateCaptain = (uuid: string, patch: Partial<Captain>) => applyPatch(uuid, patch);
    const updateSyncStatus = (uuid: string, status: number) => applyPatch(uuid, { syncStatus: status });
    
    
    const getCheckedInCount = () => countCheckedIn(registry);
    
    const updatePhone = (uuid: string, phone: string) => applyPatch(uuid, { phone, phoneLast4: phone.slice(-4) });

    return (
      <RegistryContext.Provider value={{ registry, updateCaptain, updateSyncStatus, updatePhone, getCheckedInCount }}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </RegistryContext.Provider>
    );
  };
  
  const utils = render(<TestProvider>{ui}</TestProvider>);
  return { ...utils, getRegistry: () => latestRegistry };
}
