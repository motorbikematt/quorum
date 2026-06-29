# Quorum — Schema Update Handoff (Session 5)

## What changed and why

Four files were updated during an architecture clarification session. No new features were
added. These changes correct the data model to match real-world constraints that were
not known when Phase 1 was built.

---

## Change 1 — `src/lib/registryUtils.ts`: Captain type extended

**Before:**
```ts
precinct: string;
phoneLast4: string;
```

**After:**
```ts
precinct: string;       // canonical SWVF PRECINCT_NAME — e.g. "KETTERING 1-A"
precinctId: string;     // BoE numeric precinct ID — e.g. "5701"
precinctAbbr: string;   // short form for QR payload — e.g. "KET-1A"
phoneLast4: string | null; // null = not yet collected
```

**Why:** Ohio county Boards of Election assign official precinct numbers and short-form
abbreviations. The full PRECINCT_NAME (from the SWVF/parquet) is the canonical identifier
for data joins, but is too long for a QR payload. `precinctAbbr` carries the compact form;
the kiosk displays `precinct` (full name). `phoneLast4` is now nullable because phone
numbers are NOT in the BoE voter file — they come from a separately maintained PII
spreadsheet that is incomplete. A null means "not yet collected," not "blank."

---

## Change 2 — `src/mockRegistry.json`: corrected and extended

**Before:** `precinct` held the abbreviation ("KET-1A"); no `precinctId`/`precinctAbbr`
fields; both records had `phoneLast4` as a string.

**After:** `precinct` holds the canonical SWVF name ("KETTERING 1-A"); both records have
`precinctId` and `precinctAbbr`; John Smith's `phoneLast4` is set to `null` to exercise
the new first-time collection path in the kiosk.

---

## Change 3 — `src/components/PassGenerator.tsx`: QR payload field corrected

**Before:**
```ts
pct: captain.precinct,   // was sending full name into QR
```

**After:**
```ts
pct: captain.precinctAbbr,  // compact form in QR
```

The display copy (`Precinct {captainInfo?.pct}`) still uses `captain.precinct` (full name).
No other changes to PassGenerator.

---

## Change 4 — `src/context/RegistryContext.tsx`: new `updatePhoneLast4` method

Added to the context interface and provider:

```ts
updatePhoneLast4: (uuid: string, phoneLast4: string) => void;
```

Implementation mirrors `updateSyncStatus` — patches the matching record in state and
persists to localStorage. Does not call `flushToGAS` (phone data is local only).

---

## Change 5 — `src/components/Kiosk.tsx`: null-phone collection path

`handleVerify` gained a guard at the top:

```ts
if (scannedCaptain.phoneLast4 === null) {
  if (pin.length === 4) {
    updatePhoneLast4(scannedCaptain.uuid, pin);
    updateSyncStatus(scannedCaptain.uuid, 1);
    setStep('SUCCESS');
    setTimeout(() => reset(), 3000);
  }
  return;
}
```

Without this, a captain with no phone on file would always fail the PIN match, exhaust
their two attempts, and lock — requiring staff override every time. Now the first 4-digit
entry is accepted as both identity confirmation and data collection.

The VERIFYING UI renders different copy depending on `scannedCaptain.phoneLast4 === null`:
- If null: "We don't have a phone number on file for you yet. Enter the last 4 digits of
  your phone to complete check-in and save them for future meetings."
- If set: original "enter the last 4 digits of your registered phone number" copy.

`updatePhoneLast4` is destructured from `useRegistry` alongside `updateSyncStatus`.

---

## Verification

`npx tsc --noEmit` passes clean after all changes. No new dependencies, no new routes,
no new components. The GEMINI_TEST_PROMPT.md test suite will need new cases for the
`phoneLast4 === null` branch — that is a separate task not covered here.
