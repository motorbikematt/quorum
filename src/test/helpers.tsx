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
    
    const updateSyncStatus = (uuid: string, status: number) => {
      setRegistry(prev => {
        const updated = prev.map(c => c.uuid === uuid ? { ...c, syncStatus: status } : c);
        // Simulate the real provider's localStorage write so tests can assert on it
        localStorage.setItem('quorumRegistry', JSON.stringify(updated));
        return updated;
      });
    };
    
    const updatePhoneLast4 = (uuid: string, last4: string) => {
      setRegistry(prev => {
        const updated = prev.map(c => c.uuid === uuid ? { ...c, phoneLast4: last4 } : c);
        localStorage.setItem('quorumRegistry', JSON.stringify(updated));
        return updated;
      });
    };
    
    const getCheckedInCount = () => countCheckedIn(registry);
    
    const updatePhone = (uuid: string, phone: string) => {
      setRegistry(prev => {
        const phoneLast4 = phone.slice(-4);
        const updated = prev.map(c => c.uuid === uuid ? { ...c, phone, phoneLast4 } : c);
        localStorage.setItem('quorumRegistry', JSON.stringify(updated));
        return updated;
      });
    };

    const updateEmail = (uuid: string, email: string) => {
      setRegistry(prev => {
        const updated = prev.map(c => c.uuid === uuid ? { ...c, email } : c);
        localStorage.setItem('quorumRegistry', JSON.stringify(updated));
        return updated;
      });
    };

    return (
      <RegistryContext.Provider value={{ registry, updateSyncStatus, updatePhoneLast4, updatePhone, updateEmail, getCheckedInCount }}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </RegistryContext.Provider>
    );
  };
  
  const utils = render(<TestProvider>{ui}</TestProvider>);
  return { ...utils, getRegistry: () => latestRegistry };
}
