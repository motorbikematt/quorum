# Quorum Project-Scoped Instructions

These rules apply specifically to the Quorum check-in client application.

## Linear Authentication Flows
The Quorum check-in and activation user journey must remain strictly linear. Never implement branching user flows for authentication.
1. **Web Activation** always requires a full 10-digit phone number as MFA.
2. **Kiosk Check-in** always resolves to the standard 4-digit PIN verification step (even if a phone number was just collected via the `COLLECT_PHONE` step).
