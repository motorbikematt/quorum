# Activation Flow Implementation Plan

This document outlines the step-by-step architecture changes required to make the `precincts.info/activate` onboarding flow functional, connecting your Quorum check-in system with your backend canvassing dashboard.

## Overview
Currently, the `/activate` button is a placeholder. To make it real, we need to bridge the context from the Quorum app into the canvassing frontend, and upgrade the Python backend to support per-user authentication.

---

## 1. Updates to Quorum (`quorum` repo)
* **Contextual URLs:** Update the "Activate Your Account" button in `PassGenerator.tsx` to include URL parameters: `https://precincts.info/activate?v_id={captainInfo.uuid}&pct={captainInfo.pct}`. 
* **The Shared Secret:** The Quorum Kiosk currently collects the user's `phoneLast4` PIN during the physical check-in. The activation page will ask the user to enter that same PIN to prove they actually attended the meeting and checked in at the Kiosk.

## 2. Updates to the Backend (`election-data` repo)
Your current backend (`serve/roster_api.py`) relies on a single global `ROSTER_TOKEN`. We need to upgrade it to support individual Captain accounts.
* **Database Schema (`captain_db.py`):**
  * Add a `password_hash` column to the `captains` SQLite table.
  * Add a `v_id` (SOS_VOTERID) column if it's not already acting as the primary key.
* **New API Endpoints (`roster_api.py`):**
  * `POST /activate`: Receives the `v_id`, `phoneLast4`, and `new_password`. Validates the PIN, hashes the password (e.g., using `bcrypt`), saves it to the database, and returns a session token.
  * `POST /login`: Standard login route for returning users.
* **Auth Middleware:** Modify the `_authed()` method to validate individual Captain session tokens, ensuring they can only access walk-lists for their assigned precinct.

## 3. Updates to the Frontend (`election-data` repo)
* **New Page (`docs/activate.html`):** Create the actual webpage that `precincts.info/activate` resolves to.
* **The Form UI:** Build a clean, mobile-friendly form that extracts the `v_id` from the URL and asks for:
  1. The 4-digit PIN they entered at the Kiosk.
  2. New Password.
  3. Confirm Password.
* **Client-Side Logic (`activate.js`):**
  * Validate inputs and submit the `POST /activate` request to your backend.
  * On success, store the returned auth token in `localStorage`.
  * Redirect the user directly into the main `precincts.info` canvassing dashboard so they can start reviewing their roster immediately.
