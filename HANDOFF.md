# Quorum — Phase 1 Bug-Fix Handoff

## Context

This is a React 18 + Vite + TypeScript + TailwindCSS SPA located at `D:\vibe\quorum`.
It is a two-route app: `/pass` (captain generates a QR meeting pass) and `/kiosk`
(staff tablet scans passes and verifies identity).

The core UX and architecture are complete and working. This prompt addresses **six specific
defects** identified against the Phase 1 spec. Do not refactor, add features, or touch
anything outside the files listed. Fix only what is described.

---

## File Map

```
src/
  App.tsx                        — routing (HashRouter)
  mockRegistry.json              — seed data
  context/
    RegistryContext.tsx          — Captain type, localStorage state, updateSyncStatus
  components/
    PassGenerator.tsx            — /pass route
    Kiosk.tsx                    — /kiosk route, Step state machine
    Numpad.tsx                   — custom 10-key PIN pad
    QRScanner.tsx                — html5-qrcode wrapper
Code.gs                          — Google Apps Script backend stub
```

---

## Fix 1 — QR expiry is never validated at the kiosk

**File:** `src/components/Kiosk.tsx`  
**Location:** `handleScan` function, after `JSON.parse(data)` succeeds

**Problem:** The QR payload includes an `exp` field (Unix seconds, +12h from generation time)
but the kiosk never checks it. An expired pass scans successfully.

**Fix:** After parsing the payload and before looking up the captain, reject expired passes:

```ts
const now = Math.floor(Date.now() / 1000);
if (payload.exp && now > payload.exp) {
  alert('This pass has expired. Please visit precincts.info/pass to generate a new one.');
  reset();
  return;
}
```

Insert this block immediately after `if (payload.v_id) {` opens, before the
`registry.find(...)` call.

---

## Fix 2 — Manual name search is a stub

**File:** `src/components/Kiosk.tsx`  
**Problem:** The "No QR Code? Search by Name" text is an unstyled `<p>` tag with no
handler. This is the only recovery path when a captain has no QR code. It must work.

**Fix:** Add a new step to the `Step` type and implement a simple filtered list UI.

### 2a — Extend the Step type

```ts
type Step = 'IDLE' | 'SCANNING' | 'MANUAL_SEARCH' | 'VERIFYING' | 'SUCCESS' | 'LOCKED' | 'ADMIN_OVERRIDE';
```

### 2b — Wire the link

Replace the current `<p>` tag:
```tsx
<p className="text-blue-600 font-semibold text-2xl underline cursor-pointer hover:text-blue-800 transition-colors">
  No QR Code? Search by Name
</p>
```
With a proper button:
```tsx
<button
  onClick={() => setStep('MANUAL_SEARCH')}
  className="text-blue-600 font-semibold text-2xl underline hover:text-blue-800 transition-colors"
>
  No QR Code? Search by Name
</button>
```

### 2c — Add `searchQuery` state

At the top of the `Kiosk` component, alongside existing state:
```ts
const [searchQuery, setSearchQuery] = useState('');
```

### 2d — Add the MANUAL_SEARCH step UI

Add this block in the main content area alongside the other `{step === '...'}` blocks.
It filters the registry by the first characters of last name (case-insensitive) and,
on selection, transitions directly to `VERIFYING` just like the QR scan flow does:

```tsx
{step === 'MANUAL_SEARCH' && (
  <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 border border-slate-200 animate-in zoom-in-95 duration-300">
    <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">Search by Name</h2>
    <input
      type="text"
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      placeholder="Type first letters of last name…"
      autoFocus
      className="w-full p-4 text-2xl border-2 border-slate-300 rounded-xl mb-6 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
    />
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {searchQuery.length >= 2
        ? registry
            .filter(c =>
              c.lastName.toLowerCase().startsWith(searchQuery.trim().toLowerCase()) &&
              c.syncStatus === 0
            )
            .map(c => (
              <button
                key={c.uuid}
                onClick={() => {
                  setScannedCaptain(c);
                  setSearchQuery('');
                  setStep('VERIFYING');
                  setPin('');
                }}
                className="w-full text-left p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors"
              >
                <span className="text-xl font-bold text-slate-800">{c.lastName}, {c.firstName}</span>
                <span className="ml-3 text-slate-500 font-medium">Precinct {c.precinct}</span>
              </button>
            ))
        : <p className="text-slate-400 text-center text-lg">Type at least 2 letters to search.</p>
      }
    </div>
    <button onClick={() => { setSearchQuery(''); reset(); }} className="mt-8 text-slate-500 font-bold text-xl hover:text-slate-700 w-full text-center">
      Cancel
    </button>
  </div>
)}
```

Also reset `searchQuery` in the existing `reset()` function:
```ts
const reset = () => {
  setStep('IDLE');
  setScannedCaptain(null);
  setPin('');
  setFailCount(0);
  setHiddenTapCount(0);
  setSearchQuery('');   // add this line
};
```

---

## Fix 3 — Zip code is collected but never used as a lookup factor

**File:** `src/components/PassGenerator.tsx`  
**File:** `src/mockRegistry.json`  
**File:** `src/context/RegistryContext.tsx`

**Problem:** The form collects Zip Code but `handleSubmit` matches on `lastName` only.
Two captains with the same last name collide. The field implies a second factor but
provides no security.

### 3a — Add `zip` to the Captain type

In `src/context/RegistryContext.tsx`, add `zip` to the `Captain` type:
```ts
export type Captain = {
  uuid: string;
  firstName: string;
  lastName: string;
  precinct: string;
  zip: string;        // add this field
  phoneLast4: string;
  status: string;
  syncStatus: number;
};
```

### 3b — Add `zip` to `mockRegistry.json`

Update both mock records to include realistic zip codes:
```json
[
  {
    "uuid": "OH-123456",
    "firstName": "Jane",
    "lastName": "Doe",
    "precinct": "KET-1A",
    "zip": "45429",
    "phoneLast4": "8922",
    "status": "Active",
    "syncStatus": 0
  },
  {
    "uuid": "OH-789012",
    "firstName": "John",
    "lastName": "Smith",
    "precinct": "KET-1B",
    "zip": "45440",
    "phoneLast4": "1234",
    "status": "Active",
    "syncStatus": 0
  }
]
```

### 3c — Use both fields in the lookup

In `src/components/PassGenerator.tsx`, replace the current `registry.find`:
```ts
// before:
const captain = registry.find(c => c.lastName.toLowerCase() === lastName.trim().toLowerCase());

// after:
const captain = registry.find(
  c =>
    c.lastName.toLowerCase() === lastName.trim().toLowerCase() &&
    c.zip === zipCode.trim()
);
```

---

## Fix 4 — Locked captains are invisible to staff

**File:** `src/context/RegistryContext.tsx`  
**File:** `src/components/Kiosk.tsx`

**Problem:** When a captain hits 2 PIN failures and the kiosk locks, their `syncStatus`
stays at `0` (Pending). Staff have no way to identify who is in the failed queue — they
must remember verbally. The spec describes a "Resolution Queue" for reconciling failed
check-ins.

**Fix:** Write `syncStatus: 3` (Locked / Pending Resolution) when the screen locks,
so staff can filter the registry for records needing attention.

### 4a — Document the new status value

In `src/context/RegistryContext.tsx`, update the comment on `syncStatus`:
```ts
syncStatus: number; // 0 = Pending, 1 = Verified, 2 = Staff Override, 3 = Locked/Pending Resolution
```

### 4b — Write syncStatus 3 on lockout

In `src/components/Kiosk.tsx`, in `handleVerify`, where `newFails >= 2` triggers the
lock, add the status write:
```ts
if (newFails >= 2) {
  if (scannedCaptain) {
    updateSyncStatus(scannedCaptain.uuid, 3);  // mark as Locked in registry
  }
  setStep('LOCKED');
}
```

### 4c — Exclude syncStatus 3 from the "already checked in" guard

In `handleScan`, the guard currently blocks re-scanning anyone not at status 0.
A locked captain (status 3) should be re-scannable by staff after resolution.
Update the guard:
```ts
// before:
if (captain.syncStatus !== 0) {
  alert('Captain is already checked in.');

// after:
if (captain.syncStatus === 1 || captain.syncStatus === 2) {
  alert('Captain is already checked in.');
```

---

## Fix 5 — GAS sync is never triggered from the client

**File:** `src/context/RegistryContext.tsx`  
**File:** `Code.gs` (no changes needed — the server-side stub is correct)

**Problem:** `Code.gs` is ready to accept POST batches, but the React app never calls it.
The quorum counter is local-only; two tablets diverge immediately. The GAS URL must be
configured and the context must flush verified records on a background interval.

**Fix:** Add a configurable GAS endpoint constant and a flush function that POSTs all
`syncStatus > 0` records to the sheet. Wire it on an interval and after every status update.

### 5a — Add the GAS URL constant

At the top of `src/context/RegistryContext.tsx`, before the type definitions:
```ts
// Set this to your deployed GAS Web App URL. Leave empty to disable sync.
const GAS_ENDPOINT = '';
```

### 5b — Add the flush function inside `RegistryProvider`

Inside the `RegistryProvider` component body, after `updateSyncStatus`:
```ts
const flushToGAS = async (records: Captain[]) => {
  if (!GAS_ENDPOINT) return;
  const toSync = records.filter(c => c.syncStatus > 0);
  if (!toSync.length) return;
  const payload = toSync.map(c => ({
    uuid: c.uuid,
    timestamp: Math.floor(Date.now() / 1000),
    syncStatus: c.syncStatus,
  }));
  try {
    await fetch(GAS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (_) {
    // Offline — will retry on next interval
  }
};
```

### 5c — Call flush after every status update

At the end of `updateSyncStatus`, after `setRegistry(...)`, add:
```ts
const updateSyncStatus = (uuid: string, status: number) => {
  setRegistry(prev => {
    const updated = prev.map(c => c.uuid === uuid ? { ...c, syncStatus: status } : c);
    localStorage.setItem('quorumRegistry', JSON.stringify(updated));
    flushToGAS(updated);   // add this line
    return updated;
  });
};
```

### 5d — Also flush on a 30-second interval (catches missed POSTs after connectivity restores)

Add a second `useEffect` in `RegistryProvider`, after the existing one:
```ts
useEffect(() => {
  if (!GAS_ENDPOINT) return;
  const id = setInterval(() => flushToGAS(registry), 30_000);
  return () => clearInterval(id);
}, [registry]);
```

---

## Fix 6 — Admin PIN is hardcoded to a well-known value

**File:** `src/components/Kiosk.tsx`

**Problem:** The admin override PIN `9999` is hardcoded in the source. Anyone who reads
the repo can override any check-in. For a Phase 1 prototype this is acceptable, but the
constant should be extracted so it can be changed before a live event without hunting
through component logic.

**Fix:** Extract it to a named constant at the top of `Kiosk.tsx`, outside the component:

```ts
// Change before each event. Do not commit the real value to a public repo.
const ADMIN_PIN = '9999';
```

Then replace the hardcoded string in `handleAdminVerify`:
```ts
// before:
if (pin === '9999' && scannedCaptain) {

// after:
if (pin === ADMIN_PIN && scannedCaptain) {
```

---

## Execution Order

Apply fixes in this order to avoid TypeScript errors cascading:

1. **Fix 3a** — add `zip` to `Captain` type in `RegistryContext.tsx`
2. **Fix 3b** — add `zip` to `mockRegistry.json`
3. **Fix 3c** — update `PassGenerator.tsx` lookup
4. **Fix 1** — add expiry check in `Kiosk.tsx handleScan`
5. **Fix 4** — add `syncStatus: 3`, update guard, update comment in `Kiosk.tsx` + `RegistryContext.tsx`
6. **Fix 2** — add `MANUAL_SEARCH` step in `Kiosk.tsx` (largest change, do last)
7. **Fix 5** — add GAS flush in `RegistryContext.tsx`
8. **Fix 6** — extract `ADMIN_PIN` constant in `Kiosk.tsx`

After all fixes, run `npm run build` and verify no TypeScript errors. Then clear
`localStorage` (DevTools → Application → Clear Storage) and run through the full
happy path: generate a pass at `/pass`, scan it at `/kiosk`, enter the correct PIN,
confirm the quorum counter increments.

---

## What this prompt does NOT touch

- `QRScanner.tsx` — no changes needed
- `Numpad.tsx` — no changes needed
- `App.tsx` — no changes needed
- `Code.gs` — no changes needed (Fix 5 only adds the client call)
- CSS, Tailwind config, Vite config, `tsconfig` — no changes needed
- The precincts.info CTA copy or URL — intentionally left as-is

Do not introduce new dependencies, new routes, or new components beyond what is
described above.
