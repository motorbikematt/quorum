# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server with HTTPS (self-signed via basicSsl plugin)
npm run build        # tsc type-check + vite build
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run lint         # oxlint
```

Run a single test file:
```bash
npx vitest run src/test/kiosk.test.tsx
```

## Platform Relationship

Quorum is a client application of the `election-data` platform repo (`D:\vibe\election-data`). The platform owns the data pipeline, roster API, captain database, and the seeding tool that generates the real captain registry. Cross-cutting architecture and work documents live there:

- Seeding pipeline, PII architecture, and master work queue: `election-data/local/context/handoffs/HANDOFF_QUORUM_SEEDING.md`
- Officials pipeline and voter match: `election-data/local/context/handoffs/HANDOFF_OFFICIALS_3_VERIFICATION_AND_CONFIDENCE.md`

The interface contract between the two repos is the `Captain[]` JSON array emitted by `election-data/tools/admin/seed_quorum_registry.py` (not yet built). Changes to the `Captain` type here require a coordinated update to the seeder.

## What This App Is

**Quorum** is a static React SPA for in-person precinct captain check-in at Democratic Central Committee meetings. It has three routes:

- `/pass` → `PassGenerator` — Self-service QR pass generation. A captain looks themselves up by last name + zip code, and receives a QR code and a link to activate their `precincts.info` dashboard.
- `/kiosk` → `Kiosk` — The iPad check-in terminal at the event. Scans QR passes (or allows name search), collects phone numbers for first-time attendees, verifies identity via 4-digit PIN (last 4 of phone), and tracks live quorum count.
- `/demo` → `DemoControl` — Clears localStorage and reloads to reseed from `mockRegistry.json`.

## Architecture

### Data Layer

There is no backend server. The entire registry lives in:
1. `src/mockRegistry.json` — seed data, loaded on first visit
2. `localStorage['quorumRegistry']` — persists changes (check-ins, phone collection) for the duration of the event
3. `RegistryContext` (`src/context/RegistryContext.tsx`) — React context that wraps the whole app, initializes from localStorage (falling back to mockRegistry), and exposes mutation functions

The `Captain` type (`src/lib/registryUtils.ts`) is the central data model:

```
syncStatus: 0=Pending | 1=Verified | 2=StaffOverride | 3=Locked
phoneLast4: null means phone has never been collected — triggers COLLECT_PHONE flow
email: string | null — NOT YET ADDED; required for precincts.info activation and account recovery
```

`email` is new scope (2026-06-29). When added: extend COLLECT_PHONE step to also capture email, update `activate.js` if email becomes a required field, and coordinate with the seeder to emit it from the PII spreadsheet.

### GAS Sync

`flushToGAS` POSTs non-pending records to a Google Apps Script endpoint every 30 seconds and immediately on each status change. The `GAS_ENDPOINT` constant in `registryUtils.ts` is an empty string by default — leaving it empty disables sync entirely (safe for dev/demo). Network errors are silently swallowed to handle offline scenarios.

### QR Payload Format

```json
{ "v_id": "<captain uuid>", "pct": "<precinctAbbr>", "exp": <unix_timestamp> }
```

Passes expire 12 hours after generation. The Kiosk checks `exp` at scan time and rejects stale passes.

### Kiosk State Machine

`Kiosk.tsx` implements a `Step` string-union state machine. All transitions happen in one component. Key flows:
- **QR scan / manual search** → VERIFYING (if phone on file) or COLLECT_PHONE (if `phoneLast4 === null`)
- **COLLECT_PHONE** → saves 10-digit phone → VERIFYING
- **VERIFYING** → PIN must match `phoneLast4`; 2 failures → LOCKED (syncStatus=3)
- **LOCKED** → hidden 3-tap zone (bottom-left corner) → ADMIN_OVERRIDE → enter `ADMIN_PIN` → SUCCESS (syncStatus=2)

**Before each real event:** Change `ADMIN_PIN` in `Kiosk.tsx` (currently `'9999'`) and populate `mockRegistry.json` with the real captain list. Do not commit the real registry to a public repo.

### PassGenerator → precincts.info Link

After a successful lookup, PassGenerator shows a CTA button that opens `https://precincts.info/activate?v_id=<uuid>`. A `captainApi` query param (passed in the URL to the pass page) is forwarded to the activation URL — this allows pointing the dashboard at a local/staging API server during development.

## Physical Deployment

The kiosk device is **Android 13** (not iOS/iPad). The Kiosk component runs in Android's Chromium-based WebView/browser, which affects:
- Camera permission prompts differ from Safari — `html5-qrcode` will request camera access via the Android permission dialog on first use.
- CSS viewport behavior: use `min-h-screen` + `overflow-hidden` (already in place) to avoid Android browser chrome causing scroll.
- The `select-none` Tailwind class is important — Android long-press triggers text selection on touch targets otherwise.

The app and its dependencies communicate over a **Tailscale network** (`tailb94e6b.ts.net`):
- Kiosk device: `rabbit-kiosk.tailb94e6b.ts.net` (Android 13)
- Captain API backend (`election-data/serve/roster_api.py`): `exsoinc.tailb94e6b.ts.net:8000`

The `captainApi` URL param routes PassGenerator's activation link and the captain dashboard's roster calls through the Tailnet to the local API server. Example: `?captainApi=http://exsoinc.tailb94e6b.ts.net:8000`.

## Testing Conventions

- `src/test/setup.ts` globally mocks `html5-qrcode` (the camera scanner) and `window.alert`, and clears localStorage before each test.
- `renderWithRegistry(ui, initialRegistry)` (`src/test/helpers.tsx`) renders a component with a fully functional in-memory `RegistryContext` and a `MemoryRouter`. Always use this instead of raw `render`.
- To simulate a QR scan in tests, call `simulateScan(payload)` — it reaches into the mocked `Html5QrcodeScanner` instance and fires its `onScanSuccess` callback directly.
- Use `vi.useFakeTimers()` + `act(() => vi.runAllTimers())` for tests that assert on the 3-second SUCCESS → IDLE timeout. Restore with `vi.useRealTimers()` in cleanup.
- Tests that involve `setTimeout` behavior prefer `fireEvent` over `userEvent` to avoid hangs under fake timers.
