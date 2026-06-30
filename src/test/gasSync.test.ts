import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushToGAS, Captain } from '../lib/registryUtils';

const createCaptain = (syncStatus: number): Captain => ({
  uuid: `uuid-${Math.random()}`,
  firstName: 'Test',
  lastName: 'User',
  precinct: 'TESTING 1',
  precinctId: '0000',
  precinctAbbr: 'T-1',
  zip: '12345',
  phone: '5551230000',
  phoneLast4: '0000',
  email: null,
  status: 'Active',
  syncStatus,
});

describe('GAS sync — fetch behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call fetch when GAS_ENDPOINT is empty string', async () => {
    await flushToGAS([createCaptain(1)], '');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when all records have syncStatus 0', async () => {
    await flushToGAS([createCaptain(0)], 'http://test.local');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls fetch with POST method when verified records exist', async () => {
    await flushToGAS([createCaptain(1)], 'http://test.local');
    expect(global.fetch).toHaveBeenCalledWith('http://test.local', expect.objectContaining({ method: 'POST' }));
  });

  it('sends only records with syncStatus > 0 in the POST body', async () => {
    await flushToGAS([createCaptain(0), createCaptain(1)], 'http://test.local');
    
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(body.length).toBe(1);
    expect(body[0].syncStatus).toBe(1);
  });

  it('the POST body is valid JSON parseable to an array', async () => {
    await flushToGAS([createCaptain(1)], 'http://test.local');
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(Array.isArray(body)).toBe(true);
  });

  it('each array element has uuid (string), timestamp (number), syncStatus (number)', async () => {
    await flushToGAS([createCaptain(1)], 'http://test.local');
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(typeof body[0].uuid).toBe('string');
    expect(typeof body[0].timestamp).toBe('number');
    expect(typeof body[0].syncStatus).toBe('number');
  });

  it('does not throw when fetch rejects (offline — swallowed silently)', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));
    
    await expect(flushToGAS([createCaptain(1)], 'http://test.local')).resolves.toBeUndefined();
  });
});
