# Quorum User Testing Guide

This guide outlines the end-to-end process for setting up a local testing environment, conducting user tests with real people, and effectively structuring their feedback so we can iterate on the UX.

## Phase 1: Environment Setup

Since Quorum involves both a personal mobile device (for pass generation) and a stationary kiosk (for scanning), you'll need to run the app in a way that multiple devices on your local network can access it.

1. **Start the Local Server with Network Access:**
   Open your terminal in the `D:\vibe\quorum` directory and run:
   ```bash
   npm run dev -- --host
   ```
   *Note: Adding `--host` exposes the Vite server to your local Wi-Fi network.*

2. **Identify Your Local IP:**
   The terminal will output a "Network" URL that looks like `http://192.168.1.X:5173`. Keep this handy.

3. **Set Up the Kiosk (Tablet or Laptop):**
   - Open a browser on the device you want to use as the Kiosk.
   - Navigate to `http://192.168.1.X:5173/#/kiosk`
   - Grant camera permissions when prompted.
   - Ensure the volume is up so you can hear the success/error chimes.

4. **Set Up the Tester's Device (Mobile Phone):**
   - Have the tester connect to the same Wi-Fi network.
   - Have them navigate to `http://192.168.1.X:5173/#/pass` on their smartphone.

5. **Demo Reset (For you):**
   - Open a separate tab to `http://192.168.1.X:5173/#/demo`.
   - Use this page to instantly reset the database between tests.

---

## Phase 2: Test Scenarios

To get the most accurate feedback, assign your tester a "Persona" from the mock registry:
- **Jane Doe** (Zip: **45429**, PIN: **8922**) — Standard check-in
- **John Smith** (Zip: **45440**, PIN: **None yet**) — First-time phone collection 

### Scenario A: The Happy Path
**Goal:** Verify the core value proposition — a frictionless, under-30-second check-in.
1. **Pass Retrieval:** Ask the tester to retrieve their credentials on their phone using their persona's details.
2. **Kiosk Interaction:** Ask them to physically walk up to the Kiosk and check themselves in.
3. **PIN Verification:** They should tap their 4-digit PIN when prompted by the Kiosk.

### Scenario B: The Edge Cases
**Goal:** Observe how the system (and the user) handles friction.
1. **Wrong Info:** Ask them to retrieve a pass using the wrong zip code. (Observe how they recover).
2. **Manual Search:** On the Kiosk, ask them to check in *without* a QR code by using the "Search by Name" fallback.
3. **Admin Lockout:** Have them scan a valid QR code, but purposely enter the wrong PIN 3 times until the screen locks. Ask them what they think they should do next.
4. **Missing Phone Number:** Assign the tester the **John Smith** persona. Ask them to retrieve his pass and scan it. The Kiosk should realize he doesn't have a phone on file and prompt him to enter his full 10-digit cell phone number. Once submitted, it should transition immediately to the standard 4-digit PIN verification to confirm his identity.
5. **Staff Override (For you):** Practice using the "Hidden Tap" admin override (tap the bottom-left corner 3 times) to unlock the screen.

---

## Phase 3: How to Observe

When conducting the test, your behavior as the facilitator is critical.

- **The "Think Aloud" Method:** Ask the user to narrate what they are doing and thinking. *(e.g., "I'm looking for a submit button, but I don't see one...")*
- **Bite Your Tongue:** If they get stuck, do not immediately help them. Wait 10-15 seconds to see if they can recover. The struggle is exactly what we need to observe.
- **Watch the Hands, Not Just the Screen:** Note if they try to tap things that aren't buttons, or if they hold their phone too close/far from the Kiosk camera.

---

## Phase 4: Consolidating & Providing Feedback

When you bring the results back to me, the best way to format the feedback is by categorizing it. This helps me immediately write the code to fix it.

When you're ready, you can paste feedback using this format:

> **1. UX / UI Friction**
> - *Example:* "Users didn't realize the bottom-left corner was the admin override."
> - *Example:* "The camera scan area felt too small, they kept missing it."
> 
> **2. Copy & Clarity**
> - *Example:* "The error message 'No record found' confused them. They thought the app was broken."
> 
> **3. Technical Bugs**
> - *Example:* "On iOS Safari, the camera didn't ask for permissions, it just stayed black."
> 
> **4. Feature Requests**
> - *Example:* "We need a loud beep sound when the QR code successfully registers."

Once you provide this feedback, I can rapidly iterate on the React components, Tailwind styling, and state machines to resolve the issues for the next round of testing.
