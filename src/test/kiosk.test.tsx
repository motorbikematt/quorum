import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRegistry } from './helpers';
import { Kiosk } from '../components/Kiosk';
import { Captain } from '../lib/registryUtils';
import { Html5QrcodeScanner } from 'html5-qrcode';

const initialRegistry: Captain[] = [
  {
    uuid: 'uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    precinct: 'KETTERING 1-A',
    precinctId: '5701',
    precinctAbbr: 'KET-1A',
    zip: '45429',
    phoneLast4: '8922',
    status: 'Active',
    syncStatus: 0,
  },
  {
    uuid: 'uuid-2',
    firstName: 'John',
    lastName: 'Smith',
    precinct: 'KETTERING 1-B',
    precinctId: '5702',
    precinctAbbr: 'KET-1B',
    zip: '45440',
    phoneLast4: '1234',
    status: 'Active',
    syncStatus: 1, // Already verified
  },
  {
    uuid: 'uuid-3',
    firstName: 'Null',
    lastName: 'Phone',
    precinct: 'KETTERING 1-C',
    precinctId: '5703',
    precinctAbbr: 'KET-1C',
    zip: '45450',
    phoneLast4: null,
    status: 'Active',
    syncStatus: 0,
  }
];

function simulateScan(payload: object | string) {
  const mockScanner = vi.mocked(Html5QrcodeScanner).mock.instances[0];
  if (!mockScanner) throw new Error("Html5QrcodeScanner not initialized");
  const onScanSuccess = mockScanner.render.mock.calls[0][0];
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  act(() => {
    onScanSuccess(str);
  });
}

function getValidPayload(uuid = 'uuid-1') {
  return {
    v_id: uuid,
    pct: 'KET-1A',
    exp: Math.floor(Date.now() / 1000) + 3600
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Kiosk — idle screen', () => {
  it('renders "Tap to Scan QR Pass" button on mount', () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    expect(screen.getByRole('button', { name: /tap to scan qr pass/i })).toBeInTheDocument();
  });

  it('renders "No QR Code? Search by Name" button on mount', () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    expect(screen.getByRole('button', { name: /no qr code\? search by name/i })).toBeInTheDocument();
  });

  it('shows the live quorum counter in the header', () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    expect(screen.getByText(/Live Quorum:/i)).toBeInTheDocument();
  });

  it('quorum counter starts at 0 with all-pending registry', () => {
    const registry = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, registry);
    expect(screen.getByText(/Live Quorum: 0 Verified/i)).toBeInTheDocument();
  });
});

describe('Kiosk — QR scan flow (happy path)', () => {
  it('transitions to VERIFYING after scanning a valid QR payload', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.getByText(/Welcome, Captain/i)).toBeInTheDocument();
  });

  it('displays the captain first name and last name in the VERIFYING screen', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.getAllByText(/Jane Doe/i)[0]).toBeInTheDocument();
  });

  it('renders a Numpad for entering PIN', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.getByText(/To verify your identity/i)).toBeInTheDocument();
  });

  it('displays the captain precinct in the VERIFYING screen', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.getByText(/Precinct KETTERING 1-A/i)).toBeInTheDocument();
  });

  it('transitions to SUCCESS after entering the correct phoneLast4 PIN', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    await userEvent.click(screen.getByRole('button', { name: '8' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText(/Verification Complete/i)).toBeInTheDocument();
  });

  it('increments the quorum counter by 1 after successful verification', async () => {
    const registry = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, registry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    await userEvent.click(screen.getByRole('button', { name: '8' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByText(/Live Quorum: 1 Verified/i)).toBeInTheDocument();
  });

  it('writes syncStatus 1 to localStorage after successful verification', async () => {
    const registry = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, registry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    await userEvent.click(screen.getByRole('button', { name: '8' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    const stored = JSON.parse(localStorage.getItem('quorumRegistry')!);
    expect(stored[0].syncStatus).toBe(1);
  });

  it('resets to IDLE after the 3-second SUCCESS timeout', async () => {
    vi.useFakeTimers();
    renderWithRegistry(<Kiosk />, initialRegistry);
    fireEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    
    // We use fireEvent here because userEvent can hang when fake timers are active
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbF = screen.queryByLabelText(/I confirm that I am/i);
      if (cbF && !(cbF).checked) {
        fireEvent.click(cbF);
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    act(() => {
      vi.runAllTimers();
    });
    
    expect(screen.getByRole('button', { name: /tap to scan qr pass/i })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Kiosk — null phone collection path', () => {
  it('displays collection copy if phoneLast4 is null', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload('uuid-3'));
    expect(screen.getByText(/We don't have a phone number on file/i)).toBeInTheDocument();
  });

  it('accepts a 10-digit PIN and SMS consent as the new phone and transitions to SUCCESS', async () => {
    vi.useFakeTimers();
    renderWithRegistry(<Kiosk />, initialRegistry);
    fireEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload('uuid-3'));
    
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: '5' }));
    }
    
    fireEvent.click(screen.getByLabelText(/I confirm this is my personal cell phone number/i));
    {
      const cbF = screen.queryByLabelText(/I confirm that I am/i);
      if (cbF && !(cbF).checked) {
        fireEvent.click(cbF);
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Verification Complete/i)).toBeInTheDocument();
    
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
  });

  it('saves the collected phone and syncStatus 1 to localStorage', async () => {
    vi.useFakeTimers();
    renderWithRegistry(<Kiosk />, initialRegistry);
    fireEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload('uuid-3'));
    
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: '5' }));
    }
    
    fireEvent.click(screen.getByLabelText(/I confirm this is my personal cell phone number/i));
    {
      const cbF = screen.queryByLabelText(/I confirm that I am/i);
      if (cbF && !(cbF).checked) {
        fireEvent.click(cbF);
      }
    }
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    const stored = JSON.parse(localStorage.getItem('quorumRegistry')!);
    const updatedCaptain = stored.find((c: Captain) => c.uuid === 'uuid-3');
    expect(updatedCaptain.phone).toBe('5555555555');
    expect(updatedCaptain.phoneLast4).toBe('5555');
    expect(updatedCaptain.syncStatus).toBe(1);
    
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
  });
});

describe('Kiosk — QR expiry check', () => {
  it('rejects a QR payload whose exp is in the past and stays on IDLE', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    
    const payload = { v_id: 'uuid-1', pct: 'KET-1A', exp: Math.floor(Date.now() / 1000) - 3600 };
    simulateScan(payload);
    
    expect(screen.getByRole('button', { name: /tap to scan qr pass/i })).toBeInTheDocument();
  });

  it('accepts a QR payload whose exp is in the future', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    
    simulateScan(getValidPayload());
    expect(screen.getByText(/Welcome, Captain/i)).toBeInTheDocument();
  });

  it('accepts a QR payload with no exp field (backwards compatibility)', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    
    const payload = { v_id: 'uuid-1', pct: 'KET-1A' };
    simulateScan(payload);
    expect(screen.getByText(/Welcome, Captain/i)).toBeInTheDocument();
  });
});

describe('Kiosk — duplicate scan guard', () => {
  it('blocks a captain with syncStatus 1 from scanning again', async () => {
    const reg = [{ ...initialRegistry[0], syncStatus: 1 }];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.queryByText(/Welcome, Captain/i)).not.toBeInTheDocument();
  });

  it('blocks a captain with syncStatus 2 from scanning again', async () => {
    const reg = [{ ...initialRegistry[0], syncStatus: 2 }];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.queryByText(/Welcome, Captain/i)).not.toBeInTheDocument();
  });

  it('allows a captain with syncStatus 3 (Locked) to be re-scanned by staff', async () => {
    const reg = [{ ...initialRegistry[0], syncStatus: 3 }];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    expect(screen.getByText(/Welcome, Captain/i)).toBeInTheDocument();
  });
});

describe('Kiosk — PIN failure and lockout', () => {
  it('stays in VERIFYING after one wrong PIN attempt', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Welcome, Captain/i)).toBeInTheDocument();
  });

  it('clears the PIN display after a wrong attempt', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('locks (LOCKED step) after exactly two wrong PIN attempts', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.queryByText(/Verification Failed/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Verification Failed/i)).toBeInTheDocument();
  });

  it('writes syncStatus 3 to localStorage when the screen locks', async () => {
    const reg = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    const stored = JSON.parse(localStorage.getItem('quorumRegistry')!);
    expect(stored[0].syncStatus).toBe(3);
  });

  it('shows "Staff Assistance Required" text in the LOCKED step', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Staff Assistance Required/i)).toBeInTheDocument();
  });

  it('does NOT increment the quorum counter when the screen locks', async () => {
    const reg = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
    simulateScan(getValidPayload());
    
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Live Quorum: 0 Verified/i)).toBeInTheDocument();
  });
});

async function triggerLock() {
  await userEvent.click(screen.getByRole('button', { name: /tap to scan qr pass/i }));
  simulateScan(getValidPayload());
  await userEvent.click(screen.getByRole('button', { name: '1' }));
  await userEvent.click(screen.getByRole('button', { name: '1' }));
  await userEvent.click(screen.getByRole('button', { name: '1' }));
  await userEvent.click(screen.getByRole('button', { name: '1' }));
  {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
  
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  await userEvent.click(screen.getByRole('button', { name: '2' }));
  {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('Kiosk — admin override (hidden tap + PIN)', () => {
  it('does not respond to taps in the hidden zone when not in LOCKED step', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50');
    expect(hiddenZone).not.toBeInTheDocument();
  });

  it('transitions to ADMIN_OVERRIDE after exactly 3 taps in the hidden zone', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    expect(screen.getByText(/Admin Mode/i)).toBeInTheDocument();
  });

  it('does not transition to ADMIN_OVERRIDE after only 2 taps', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    expect(screen.queryByText(/Admin Mode/i)).not.toBeInTheDocument();
  });

  it('shows "Admin Mode" banner in ADMIN_OVERRIDE step', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    expect(screen.getByText(/Admin Mode/i)).toBeInTheDocument();
  });

  it('transitions to SUCCESS after entering the correct admin PIN', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Verification Complete/i)).toBeInTheDocument();
  });

  it('writes syncStatus 2 (Staff Override) after admin PIN accepted', async () => {
    const reg = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, reg);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    const stored = JSON.parse(localStorage.getItem('quorumRegistry')!);
    expect(stored[0].syncStatus).toBe(2);
  });

  it('increments the quorum counter after admin PIN accepted', async () => {
    const reg = [{ ...initialRegistry[0] }];
    renderWithRegistry(<Kiosk />, reg);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    await userEvent.click(screen.getByRole('button', { name: '9' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Live Quorum: 1 Verified/i)).toBeInTheDocument();
  });

  it('stays in ADMIN_OVERRIDE and clears PIN after a wrong admin PIN', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    {
      const cbU = screen.queryByLabelText(/I confirm that I am/i);
      if (cbU && !(cbU).checked) {
        await userEvent.click(cbU);
      }
    }
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    
    expect(screen.getByText(/Admin Mode/i)).toBeInTheDocument();
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('resets to IDLE on Cancel Override button click', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await triggerLock();
    
    const hiddenZone = document.querySelector('.absolute.bottom-0.left-0.z-50')!;
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    await userEvent.click(hiddenZone);
    
    await userEvent.click(screen.getByRole('button', { name: /Cancel Override/i }));
    expect(screen.getByRole('button', { name: /tap to scan qr pass/i })).toBeInTheDocument();
  });
});

describe('Kiosk — manual name search (MANUAL_SEARCH step)', () => {
  it('transitions to MANUAL_SEARCH when "Search by Name" is clicked', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    expect(screen.getByPlaceholderText(/Type first letters of last name…/i)).toBeInTheDocument();
  });

  it('shows no results when fewer than 2 characters are typed', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'D');
    expect(screen.getByText(/Type at least 2 letters to search/i)).toBeInTheDocument();
  });

  it('shows matching captains after typing 2+ characters of last name', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'Do');
    expect(screen.getByText(/Doe, Jane/i)).toBeInTheDocument();
  });

  it('shows captains with syncStatus > 0 in search results with a Checked In badge', async () => {
    const reg = [
      { ...initialRegistry[0], lastName: 'Doe', syncStatus: 0 },
      { ...initialRegistry[0], uuid: 'uuid-x', lastName: 'Doe', firstName: 'Jack', syncStatus: 1 }
    ];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'Do');
    
    expect(screen.getByText(/Doe, Jane/i)).toBeInTheDocument();
    expect(screen.getByText(/Doe, Jack/i)).toBeInTheDocument();
    expect(screen.getByText(/Checked In/i)).toBeInTheDocument();
  });

  it('prevents transitioning to VERIFYING if a checked-in captain is clicked in manual search', async () => {
    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const reg = [
      { ...initialRegistry[0], lastName: 'Doe', syncStatus: 1 },
    ];
    renderWithRegistry(<Kiosk />, reg);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'Do');
    
    const btn = screen.getByText(/Doe, Jane/i).closest('button');
    await userEvent.click(btn!);
    
    expect(alertMock).toHaveBeenCalledWith('Captain is already checked in.');
    expect(screen.queryByText(/Welcome, Captain/i)).not.toBeInTheDocument();
    alertMock.mockRestore();
  });

  it('transitions to VERIFYING after selecting a captain from the list', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'Do');
    
    const btn = screen.getByText(/Doe, Jane/i).closest('button');
    await userEvent.click(btn!);
    
    expect(screen.getByText(/Welcome, Captain Jane Doe/i)).toBeInTheDocument();
  });

  it('shows the selected captain name and precinct in VERIFYING after manual select', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'Do');
    
    await userEvent.click(screen.getByText(/Doe, Jane/i).closest('button')!);
    expect(screen.getByText(/Welcome, Captain Jane Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Precinct KETTERING 1-A/i)).toBeInTheDocument();
  });

  it('is case-insensitive — "do" matches "Doe"', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type first letters/i), 'do');
    expect(screen.getByText(/Doe, Jane/i)).toBeInTheDocument();
  });

  it('resets to IDLE on Cancel button click', async () => {
    renderWithRegistry(<Kiosk />, initialRegistry);
    await userEvent.click(screen.getByRole('button', { name: /no qr code\? search by name/i }));
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.getByRole('button', { name: /tap to scan qr pass/i })).toBeInTheDocument();
  });
});
