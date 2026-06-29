# Gemini Coding Prompt — Quorum Test Suite

## Your Role

You are a senior engineer writing a Vitest + React Testing Library test suite for a
React 18 + Vite + TypeScript app called **Quorum**. You are not building new features.
You are writing tests only. Do not modify any source file except to add a `src/test/`
directory and update `vite.config.ts` and `package.json` for the test runner.

---

## Project Structure

```
D:\vibe\quorum\
  src/
    mockRegistry.json          — seed data, two Captain records
    context/
      RegistryContext.tsx      — Captain type, localStorage, updateSyncStatus, flushToGAS
    components/
      PassGenerator.tsx        — /pass route: last name + zip lookup, QR generation
      Kiosk.tsx                — /kiosk route: Step state machine, PIN verification
      Numpad.tsx               — custom 10-key PIN pad
      QRScanner.tsx            — html5-qrcode wrapper
  vite.config.ts
  package.json
```

---

## One-Time Setup (apply before writing any test file)

### 1. Install dependencies

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### 2. Update `vite.config.ts`

Add a `test` block inside the existing `defineConfig({...})`:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
},
```

### 3. Update `package.json` scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

### 4. Create `src/test/setup.ts`

```ts
import '@testing-library/jest-dom';

// html5-qrcode opens a camera stream that jsdom cannot provide.
// Mock the entire module so QRScanner renders without errors.
vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
  Html5QrcodeScanType: { SCAN_TYPE_CAMERA: 0 },
}));

// Clear localStorage between every test to prevent state bleed.
beforeEach(() => {
  localStorage.clear();
});
```

---

## The Captain Type (for reference in all tests)

```ts
type Captain = {
  uuid: string;
  firstName: string;
  lastName: string;
  precinct: string;
  zip: string;
  phoneLast4: string;
  status: string;
  syncStatus: number; // 0=Pending 1=Verified 2=StaffOverride 3=Locked
};
```

---

## Test File 1 — `src/test/registry.test.ts`

**What this tests:** Pure logic in `RegistryContext.tsx` that does not require mounting
React — the `getCheckedInCount` calculation and the `flushToGAS` filter. These are the
core data invariants the compliance audit relies on.

**Why these matter:** `getCheckedInCount` drives the live quorum display. If its filter
condition ever drifts — e.g. someone changes `=== 1 || === 2` to `=== 1` — the quorum
counter silently undercounts verified attendees. `flushToGAS` must never send unverified
records (status 0) to the Google Sheet, or the compliance log is corrupted.

**Because these functions are currently inside the React component closure**, you must
extract them into a standalone utility file first. Create `src/lib/registryUtils.ts`
with the following signatures, then import from there in both `RegistryContext.tsx` and
the tests:

```ts
// src/lib/registryUtils.ts

export function countCheckedIn(registry: Captain[]): number {
  // Returns count of records where syncStatus is 1 (Verified) or 2 (Staff Override).
  // Does NOT count 3 (Locked/Pending) — those captains are not present.
}

export function buildGASPayload(registry: Captain[]): GASEvent[] {
  // Filters to syncStatus > 0 only, maps to { uuid, timestamp, syncStatus }.
  // Returns an empty array when all records are still at status 0.
}
```

**Write these tests:**

```
describe('countCheckedIn')
  it('returns 0 when all captains are Pending (syncStatus 0)')
  it('counts Verified (1) captains')
  it('counts Staff Override (2) captains')
  it('counts both Verified and Staff Override together')
  it('does NOT count Locked/Pending Resolution (3) captains')
  it('does NOT count Pending (0) captains even if others are verified')

describe('buildGASPayload')
  it('returns an empty array when all records are syncStatus 0')
  it('includes records with syncStatus 1')
  it('includes records with syncStatus 2')
  it('includes records with syncStatus 3')
  it('excludes records with syncStatus 0')
  it('each output record has uuid, timestamp (number), and syncStatus fields')
  it('timestamp is a Unix epoch integer (not a Date object, not a string)')
```

---

## Test File 2 — `src/test/passGenerator.test.tsx`

**What this tests:** The lookup logic in `PassGenerator.tsx` — specifically that the
registry find uses **both** last name and zip code as factors, and that the QR payload
encodes the correct fields with a future expiry.

**Why these matter:** Before Fix 3, the lookup matched on last name only. If that
regression occurs, any captain can pull any other captain's pass by knowing their last
name — directly violating the anti-proxy bylaw. The expiry test ensures a pass cannot
be reused at a future meeting.

**How to mount:** `PassGenerator` reads from `RegistryContext`. Wrap it in a custom
`TestRegistryProvider` that accepts a `registry` prop and provides it through the same
context shape, bypassing `localStorage`. This avoids test-order dependencies.

```ts
// Utility to use across test files — put in src/test/helpers.tsx
export function renderWithRegistry(ui: React.ReactElement, registry: Captain[]) {
  // Provide a mock RegistryContext with the supplied registry array,
  // a no-op updateSyncStatus, and a getCheckedInCount derived from countCheckedIn().
  // Wrap with MemoryRouter so react-router-dom links resolve.
}
```

**Write these tests:**

```
describe('PassGenerator — lookup')
  it('finds a captain by matching last name AND zip code')
  it('rejects a correct last name with a wrong zip code')
  it('rejects a correct zip code with a wrong last name')
  it('is case-insensitive on last name ("doe" matches "Doe")')
  it('trims whitespace from last name input before matching')
  it('shows an error message when no match is found')
  it('does not show a QR code when the form has not been submitted')

describe('PassGenerator — QR payload')
  it('encodes v_id equal to the matched captain uuid')
  it('encodes pct equal to the matched captain precinct')
  it('encodes exp as a Unix integer greater than Date.now() / 1000')
  it('encodes exp approximately 12 hours (43200 seconds) in the future')
    // Allow ±5 second tolerance for test execution time.

describe('PassGenerator — precincts.info CTA')
  it('shows the activate button after a successful lookup')
  it('interpolates the correct precinct name into the CTA copy')
  it('does not show the activate button before a successful lookup')
```

---

## Test File 3 — `src/test/kiosk.test.tsx`

**What this tests:** The `Kiosk` component state machine — every Step transition that
the compliance flow depends on. The camera scan itself is mocked; tests drive the flow
by calling `handleScan` equivalent logic via the component's rendered UI.

**Why these matter:** The Step machine encodes the anti-proxy enforcement logic. The
off-by-one in the lockout (`newFails >= 2` locks on the second failure, not the third)
is easy to accidentally change to `> 2`, which would allow a third guess. The hidden tap
sequence and admin PIN are the only staff recovery path — if either breaks at a live
event, a locked captain is stuck permanently until the tablet is reloaded.

**How to drive scan events without a camera:** `QRScanner` is already mocked. In your
tests, find the `handleScan` function by rendering `Kiosk` inside a registry provider,
then simulate scanning by calling the `onScan` prop that `Kiosk` passes to `QRScanner`.
You can capture it via the mock:

```ts
import { Html5QrcodeScanner } from 'html5-qrcode';

// After render, the mock will have been constructed. Extract onScan:
// Html5QrcodeScanner is the mock class; its constructor was called with
// the scanner id and config. The render() call receives (onSuccess, onError).
// Capture the onSuccess callback to simulate a scan in tests.
const mockScanner = vi.mocked(Html5QrcodeScanner).mock.instances[0];
const [onScanSuccess] = mockScanner.render.mock.calls[0];
// Now call: onScanSuccess(JSON.stringify(payload)) to simulate a scan.
```

**Write these tests:**

```
describe('Kiosk — idle screen')
  it('renders "Tap to Scan QR Pass" button on mount')
  it('renders "No QR Code? Search by Name" button on mount')
  it('shows the live quorum counter in the header')
  it('quorum counter starts at 0 with all-pending registry')

describe('Kiosk — QR scan flow (happy path)')
  it('transitions to VERIFYING after scanning a valid QR payload')
  it('displays the captain first name and last name in the VERIFYING screen')
  it('displays the captain precinct in the VERIFYING screen')
  it('transitions to SUCCESS after entering the correct phoneLast4 PIN')
  it('increments the quorum counter by 1 after successful verification')
  it('writes syncStatus 1 to localStorage after successful verification')
  it('resets to IDLE after the 3-second SUCCESS timeout')
    // Use vi.useFakeTimers() and vi.runAllTimers() to control setTimeout.

describe('Kiosk — QR expiry check')
  it('rejects a QR payload whose exp is in the past and stays on IDLE')
  it('accepts a QR payload whose exp is in the future')
  it('accepts a QR payload with no exp field (backwards compatibility)')
    // The spec says "if payload.exp && ..." — missing exp should not block.

describe('Kiosk — duplicate scan guard')
  it('blocks a captain with syncStatus 1 from scanning again')
  it('blocks a captain with syncStatus 2 from scanning again')
  it('allows a captain with syncStatus 3 (Locked) to be re-scanned by staff')

describe('Kiosk — PIN failure and lockout')
  it('stays in VERIFYING after one wrong PIN attempt')
  it('clears the PIN display after a wrong attempt')
  it('locks (LOCKED step) after exactly two wrong PIN attempts')
    // This is the critical off-by-one test. Explicitly verify that attempt 1
    // does not lock, and attempt 2 does. Do not skip attempt 1.
  it('writes syncStatus 3 to localStorage when the screen locks')
  it('shows "Staff Assistance Required" text in the LOCKED step')
  it('does NOT increment the quorum counter when the screen locks')

describe('Kiosk — admin override (hidden tap + PIN)')
  it('does not respond to taps in the hidden zone when not in LOCKED step')
  it('transitions to ADMIN_OVERRIDE after exactly 3 taps in the hidden zone')
  it('does not transition to ADMIN_OVERRIDE after only 2 taps')
  it('shows "Admin Mode" banner in ADMIN_OVERRIDE step')
  it('transitions to SUCCESS after entering the correct admin PIN')
  it('writes syncStatus 2 (Staff Override) after admin PIN accepted')
  it('increments the quorum counter after admin PIN accepted')
  it('stays in ADMIN_OVERRIDE and clears PIN after a wrong admin PIN')
  it('resets to IDLE on Cancel Override button click')

describe('Kiosk — manual name search (MANUAL_SEARCH step)')
  it('transitions to MANUAL_SEARCH when "Search by Name" is clicked')
  it('shows no results when fewer than 2 characters are typed')
  it('shows matching captains after typing 2+ characters of last name')
  it('only shows captains with syncStatus 0 (Pending) in search results')
  it('does NOT show captains with syncStatus 1 in search results')
  it('does NOT show captains with syncStatus 3 in search results')
  it('transitions to VERIFYING after selecting a captain from the list')
  it('shows the selected captain name and precinct in VERIFYING after manual select')
  it('is case-insensitive — "do" matches "Doe"')
  it('resets to IDLE on Cancel button click')
```

---

## Test File 4 — `src/test/gasSync.test.ts`

**What this tests:** The `flushToGAS` behavior extracted in `registryUtils.ts`, plus
the `fetch` call behavior — specifically that it never fires when `GAS_ENDPOINT` is
empty, and that it sends only verified records.

**Why these matter:** The GAS endpoint constant defaults to an empty string in the
source. If a future change accidentally sets it to a non-empty default, every page load
starts POSTing. Conversely, if the filter ever sends all records (including status 0),
the Google Sheet compliance log becomes meaningless.

**This file tests the integration between `buildGASPayload` and `fetch`.** Mock `fetch`
globally with `vi.stubGlobal('fetch', vi.fn())`.

```
describe('GAS sync — fetch behavior')
  it('does not call fetch when GAS_ENDPOINT is empty string')
  it('does not call fetch when all records have syncStatus 0')
  it('calls fetch with POST method when verified records exist')
  it('sends only records with syncStatus > 0 in the POST body')
  it('the POST body is valid JSON parseable to an array')
  it('each array element has uuid (string), timestamp (number), syncStatus (number)')
  it('does not throw when fetch rejects (offline — swallowed silently)')
```

---

## Execution Rules for Gemini

1. Write all four test files. Do not skip any named test case — each one has a stated
   reason above. If a test case seems redundant, write it anyway: the redundancy is
   intentional (boundary conditions on the off-by-one are not redundant).

2. Create `src/lib/registryUtils.ts` and move the relevant logic there. Update
   `RegistryContext.tsx` to import from it. Do not change any other source files.

3. Use `vi.useFakeTimers()` in any test that involves `setTimeout` (the 3-second
   SUCCESS reset). Call `vi.runAllTimers()` to advance time, then `vi.useRealTimers()`
   in `afterEach` to restore.

4. Use `vi.spyOn(window, 'alert').mockImplementation(() => {})` globally in `setup.ts`
   to suppress alert dialogs that would block jsdom test execution.

5. The `renderWithRegistry` helper in `src/test/helpers.tsx` must be used in every
   component test. Never import `RegistryProvider` directly in test files — doing so
   would trigger the `localStorage` useEffect and read from the test environment's
   storage instead of the seeded test data.

6. After writing all files, run `npm test` and fix any TypeScript or import errors
   before considering the work done. All tests must pass green.
