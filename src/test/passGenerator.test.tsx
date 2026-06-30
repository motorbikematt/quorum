import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRegistry } from './helpers';
import { PassGenerator } from '../components/PassGenerator';
import { Captain } from '../lib/registryUtils';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => React.createElement('div', { 'data-testid': 'qr-code', 'data-value': value })
}));

const mockRegistry: Captain[] = [
  {
    uuid: 'uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    precinct: 'KETTERING 1-A',
    precinctId: '5701',
    precinctAbbr: 'KET-1A',
    zip: '45429',
    phone: '5551238922',
    phoneLast4: '8922',
    email: null,
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
    phone: null,
    phoneLast4: null,
    email: null,
    status: 'Active',
    syncStatus: 0,
  },
];

describe('PassGenerator — lookup', () => {
  it('finds a captain by matching last name AND zip code', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('rejects a correct last name with a wrong zip code', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '99999');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('No record found matching that information.')).toBeInTheDocument();
  });

  it('rejects a correct zip code with a wrong last name', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Smith');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('No record found matching that information.')).toBeInTheDocument();
  });

  it('is case-insensitive on last name ("doe" matches "Doe")', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('trims whitespace from last name input before matching', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), ' Doe ');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows an error message when no match is found', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Nobody');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '00000');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText('No record found matching that information.')).toBeInTheDocument();
  });

  it('does not show a QR code when the form has not been submitted', () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });
});

describe('PassGenerator — QR payload', () => {
  it('encodes v_id equal to the matched captain uuid', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    const qr = screen.getByTestId('qr-code');
    const data = JSON.parse(qr.getAttribute('data-value')!);
    expect(data.v_id).toBe('uuid-1');
  });

  it('encodes pct equal to the matched captain precinctAbbr', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    const qr = screen.getByTestId('qr-code');
    const data = JSON.parse(qr.getAttribute('data-value')!);
    expect(data.pct).toBe('KET-1A');
  });

  it('encodes exp as a Unix integer greater than Date.now() / 1000', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    const qr = screen.getByTestId('qr-code');
    const data = JSON.parse(qr.getAttribute('data-value')!);
    const now = Math.floor(Date.now() / 1000);
    expect(typeof data.exp).toBe('number');
    expect(Number.isInteger(data.exp)).toBe(true);
    expect(data.exp).toBeGreaterThan(now);
  });

  it('encodes exp approximately 12 hours (43200 seconds) in the future', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    const qr = screen.getByTestId('qr-code');
    const data = JSON.parse(qr.getAttribute('data-value')!);
    const targetExp = Math.floor(Date.now() / 1000) + 43200;
    
    expect(Math.abs(data.exp - targetExp)).toBeLessThan(5);
  });
});

describe('PassGenerator — precincts.info CTA', () => {
  let openSpy: any;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('shows the activate button after a successful lookup', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByRole('button', { name: /click here to set a password/i })).toBeInTheDocument();
  });

  it('interpolates the correct precinct name into the CTA copy', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    expect(screen.getByText(/As the representative for KETTERING 1-A/i)).toBeInTheDocument();
  });

  it('does not show the activate button before a successful lookup', () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    expect(screen.queryByRole('button', { name: /click here to set a password/i })).not.toBeInTheDocument();
  });

  it('opens activation URL with correct v_id when clicked', async () => {
    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    await userEvent.click(screen.getByRole('button', { name: /click here to set a password/i }));
    
    expect(openSpy).toHaveBeenCalled();
    const openedUrl = new URL(openSpy.mock.calls[0][0]);
    expect(openedUrl.origin).toBe('https://precincts.info');
    expect(openedUrl.pathname).toBe('/activate');
    expect(openedUrl.searchParams.get('v_id')).toBe('uuid-1');
  });

  it('propagates captainApi parameter to the activation URL if present', async () => {
    vi.stubGlobal('location', new URL('http://localhost:5173/pass?captainApi=http://exsoinc.tailb94e6b.ts.net:8000'));

    renderWithRegistry(<PassGenerator />, mockRegistry);
    await userEvent.type(screen.getByPlaceholderText('e.g. Doe'), 'Doe');
    await userEvent.type(screen.getByPlaceholderText('e.g. 45429'), '45429');
    await userEvent.click(screen.getByText('Retrieve Pass'));
    
    await userEvent.click(screen.getByRole('button', { name: /click here to set a password/i }));
    
    expect(openSpy).toHaveBeenCalled();
    const openedUrl = new URL(openSpy.mock.calls[0][0]);
    expect(openedUrl.searchParams.get('captainApi')).toBe('http://exsoinc.tailb94e6b.ts.net:8000');
  });
});
