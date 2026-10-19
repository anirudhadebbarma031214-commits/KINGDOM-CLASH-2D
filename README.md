# Kingdom Clash — Rise of the Realm

A fresh browser-based 2D kingdom strategy game. Built for desktop and mobile browsers; **no APK is produced**.

## Play
Open the GitHub Pages site after the Pages workflow succeeds.

## Current gameplay
- Illustrated kingdom map with clickable building plots
- Castle upgrades, resource gathering, and passive resource production
- Lumber camps, farms, quarries, and barracks
- Footmen and archer training
- Bandit outpost battles with troop losses and rewards
- Local autosave and reset
- Responsive layout for mobile and desktop

## Multiplayer status
Online multiplayer is **not connected** in this build. GitHub Pages hosts static files; a room code by itself cannot synchronize players. A real-time backend (for example, a configured Supabase project with appropriate database policies/realtime enabled) must be connected before claiming live multiplayer works. This prototype intentionally labels that limitation rather than faking online play.

## Deploy
The workflow in `.github/workflows/deploy-pages.yml` publishes the root of `main` using GitHub Pages. If needed, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.

## Save data
Progress is saved in the browser's local storage on the current device. Clearing browser data resets local progress.
