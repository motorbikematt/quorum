# Quorum

Quorum is a specialized event check-in system designed to bridge physical attendance with a digital credentialing pipeline. It consists of a physical iPad Kiosk for scanning passes and a web-based mobile dashboard for captains to generate their credentials and activate their accounts.

## Core Flow

1. **Pass Generation:** Captains visit the Pass Generator on their personal mobile devices, look up their credentials (Name, Zip Code), and receive a secure, time-limited QR code.
2. **Kiosk Check-in:** Captains present their QR code to the Quorum Kiosk iPad.
3. **Identity Verification:** The Kiosk verifies the pass and, if necessary, collects a 10-digit phone number, followed by a mandatory 4-digit PIN (last 4 digits of the phone number) to ensure the person holding the pass is the actual captain.
4. **Dashboard Activation:** Once checked in, the Kiosk instructs captains to tap a button on their phone to activate their digital dashboard, which they complete by verifying their 10-digit phone number.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Running Locally
To start the local development server and expose it to your local network (useful for testing on actual mobile devices):
```bash
npm run dev -- --host
```

### Key Routes
- `/#/kiosk` - The primary physical iPad check-in interface.
- `/#/pass` - The mobile web interface for generating QR passes.
- `/#/demo` - A hidden control panel for resetting the local mock registry during user testing and demonstrations.

## Testing

For comprehensive details on how to conduct user testing, please refer to the `User_Testing_Guide.md` located in the root of this repository.

To run the Vitest test suite:
```bash
npm run test
```
