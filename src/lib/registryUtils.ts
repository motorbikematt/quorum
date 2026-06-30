export type Captain = {
  uuid: string;
  firstName: string;
  lastName: string;
  precinct: string;       // canonical SWVF PRECINCT_NAME — e.g. "KETTERING 1-A"
  precinctId: string;     // BoE numeric precinct ID — e.g. "5701"
  precinctAbbr: string;   // short form for QR payload — e.g. "KET-1A"
  zip: string;
  phone: string | null;   // Full 10-digit phone number
  phoneLast4: string | null; // null = not yet collected; app collects on first check-in
  email: string | null;  // null = not yet collected; required for precincts.info activation
  status: string;
  syncStatus: number; // 0=Pending 1=Verified 2=StaffOverride 3=Locked
};

export type GASEvent = {
  uuid: string;
  timestamp: number;
  syncStatus: number;
};

// Set this to your deployed GAS Web App URL. Leave empty to disable sync.
export const GAS_ENDPOINT = '';

export function countCheckedIn(registry: Captain[]): number {
  return registry.filter(c => c.syncStatus === 1 || c.syncStatus === 2).length;
}

export function buildGASPayload(registry: Captain[]): GASEvent[] {
  const toSync = registry.filter(c => c.syncStatus > 0);
  return toSync.map(c => ({
    uuid: c.uuid,
    timestamp: Math.floor(Date.now() / 1000),
    syncStatus: c.syncStatus,
  }));
}

export const flushToGAS = async (records: Captain[], endpoint = GAS_ENDPOINT) => {
  if (!endpoint) return;
  const payload = buildGASPayload(records);
  if (!payload.length) return;
  
  try {
    await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Offline — will retry on next interval
  }
};
