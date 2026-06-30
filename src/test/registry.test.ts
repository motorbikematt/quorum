import { describe, it, expect } from 'vitest';
import { countCheckedIn, buildGASPayload, type Captain } from '../lib/registryUtils';

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

describe('countCheckedIn', () => {
  it('returns 0 when all captains are Pending (syncStatus 0)', () => {
    expect(countCheckedIn([createCaptain(0), createCaptain(0)])).toBe(0);
  });
  
  it('counts Verified (1) captains', () => {
    expect(countCheckedIn([createCaptain(1), createCaptain(0)])).toBe(1);
  });
  
  it('counts Staff Override (2) captains', () => {
    expect(countCheckedIn([createCaptain(2), createCaptain(0)])).toBe(1);
  });
  
  it('counts both Verified and Staff Override together', () => {
    expect(countCheckedIn([createCaptain(1), createCaptain(2)])).toBe(2);
  });
  
  it('does NOT count Locked/Pending Resolution (3) captains', () => {
    expect(countCheckedIn([createCaptain(3)])).toBe(0);
  });
  
  it('does NOT count Pending (0) captains even if others are verified', () => {
    expect(countCheckedIn([createCaptain(1), createCaptain(0)])).toBe(1);
  });
});

describe('buildGASPayload', () => {
  it('returns an empty array when all records are syncStatus 0', () => {
    expect(buildGASPayload([createCaptain(0), createCaptain(0)])).toEqual([]);
  });
  
  it('includes records with syncStatus 1', () => {
    const payload = buildGASPayload([createCaptain(1)]);
    expect(payload.length).toBe(1);
    expect(payload[0].syncStatus).toBe(1);
  });
  
  it('includes records with syncStatus 2', () => {
    const payload = buildGASPayload([createCaptain(2)]);
    expect(payload.length).toBe(1);
    expect(payload[0].syncStatus).toBe(2);
  });
  
  it('includes records with syncStatus 3', () => {
    const payload = buildGASPayload([createCaptain(3)]);
    expect(payload.length).toBe(1);
    expect(payload[0].syncStatus).toBe(3);
  });
  
  it('excludes records with syncStatus 0', () => {
    const payload = buildGASPayload([createCaptain(0), createCaptain(1)]);
    expect(payload.length).toBe(1);
    expect(payload[0].syncStatus).toBe(1);
  });
  
  it('each output record has uuid, timestamp (number), and syncStatus fields', () => {
    const captain = createCaptain(1);
    const payload = buildGASPayload([captain]);
    expect(payload[0]).toHaveProperty('uuid', captain.uuid);
    expect(payload[0]).toHaveProperty('timestamp');
    expect(payload[0]).toHaveProperty('syncStatus', 1);
  });
  
  it('timestamp is a Unix epoch integer (not a Date object, not a string)', () => {
    const payload = buildGASPayload([createCaptain(1)]);
    expect(typeof payload[0].timestamp).toBe('number');
    expect(payload[0].timestamp).toBeGreaterThan(1600000000);
    expect(Number.isInteger(payload[0].timestamp)).toBe(true);
  });
});
