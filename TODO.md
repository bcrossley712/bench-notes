# Bench Notes — Things to Do at the Computer

_Last updated: PWA deployed and mostly tested; desktop confirmed launching, feature testing not started_

## Repo structure — decided and built
- [x] One repo (`bench-notes`), not two — `/pwa` and `/desktop` subfolders
- [x] GitHub Actions workflow to auto-deploy `/pwa` on push (avoids the
      awkward "must be named /docs" zero-config route)
- [x] Repo is the canonical source now — code lives in git, not zip
      files; the old zip-based handoff process is superseded
- [x] Pushed to GitHub, Pages enabled, PWA is live and deployed

## Desktop app (Electron) — launches, features not yet verified
- [x] Run `npm install` / `npm start` — app window opens and looks right
- [ ] Test creating a new entry (text fields, source tags, engine model/code)
- [ ] Test the Service Checklist (checkbox + note → auto-fills Fix field)
- [ ] Test "Attach from files…" — attach a couple of photos
- [ ] Test "Take photo…" — confirm webcam capture works (if laptop has a webcam)
- [ ] Test deleting a photo from an entry
- [ ] Test closing a new/unsaved tab — confirm the discard prompt appears
- [ ] Test "Change folder…" in the sidebar — try pointing it somewhere new
- [ ] Once happy: run `npm run dist` to build the real `.exe` installer
      (not done yet — still only running via `npm start`, not installed)
- [ ] Run the installer, confirm Start Menu entry + desktop icon work
- [ ] Decide where your permanent data folder should live (see below)

## Decisions to make
- [x] iPhone or Android — Android (you), **iPhone (Dad)** — PWA covers both
- [x] Mobile v1 priority — camera + photos first, sync deferred
- [x] Repo visibility — public repo is fine (entries/photos never touch GitHub —
      they stay in browser storage on each device, only app code is public)
- [ ] One PWA everywhere vs. keep Electron + PWA separate — deferred on purpose;
      build the PWA first, decide after living with both for a while
- [x] Sync architecture — **finalized:**
      - Your desktop (Electron): point "Change folder…" at your existing
        OneDrive-synced folder — no new code, works today
      - Shop laptop (Electron, Dad's own Microsoft account): real OneDrive
        API sync — needs building
      - Phone (PWA): real OneDrive API sync — needs building
      - All three share one canonical file format (see below) so it never
        matters which device saved last
      - Reconciliation: simple last-save-wins is acceptable given it's just
        you and Dad, mostly working together or him solo

## Shared data format (contract between Electron and PWA)
- [x] Customer fields added to both apps identically: customerName,
      customerPhone, equipmentModel, equipmentSerial, dateReceived,
      customerRequest (kept separate from title/symptom, as decided)
- [ ] Define + document: `bench_notes_data.json` (array of entries, same
      field names on both apps) + a `photos/` folder of real image files,
      named to match filenames referenced in the JSON
- [ ] Add a `schemaVersion` field for future-proofing
- [ ] PWA must serialize IndexedDB contents to this exact shape when syncing
      (not its own invented format) — this is the piece that prevents the
      two apps from drifting into different file types over time

## OneDrive API sync — needs building (shop laptop + phone)
- [ ] Register a Microsoft Graph "app" (free, personal Microsoft account
      is fine) to get API access
- [ ] Auth flow: shop laptop and phone each log into Dad's / your own
      Microsoft account respectively, grant access to just the app's data
      (not full OneDrive)
- [ ] Sync trigger points: on app open, after every save, periodically
      while running — feels automatic even though it's app-triggered
      each time, not OS-level like the folder trick
- [ ] Must never block core functionality — local data is always the
      source of truth; sync is a background add-on, not a requirement
      to use the app

## Mobile app — PWA via GitHub Pages — BUILT, DEPLOYED, mostly tested
~~Capacitor + Android Studio plan~~ — dropped. A PWA works on both Android
Chrome and iPhone Safari from one codebase, and avoids needing a Mac/Xcode
for iOS entirely.
- [x] Build the PWA (HTML/JS reused from existing app, camera via
      `<input type="file" capture="environment">`, IndexedDB for storage)
- [x] Add a service worker + app manifest for offline/install support
- [x] Pushed to GitHub, Pages enabled, live and deployed
- [x] Opened on Android phone in Chrome, confirmed it loads
- [x] Tested: add an entry, attach/take a photo, search, filters, delete
- [x] Test installing to home screen (Chrome menu -> Add to Home Screen)
- [ ] Test offline: airplane mode after first load, confirm it still works
- [ ] Send the link to Dad, test Safari -> Share -> Add to Home Screen on his iPhone
- [ ] No sync yet — intentionally offline-only for this first version

## Known rough edges (not urgent, just noted)
- If you attach a photo while editing an entry and then hit Cancel instead
  of Save, that image file stays on disk unused rather than getting cleaned
  up automatically. Harmless, just a loose end.

---
*Add to this list any time — just tell me what to add or check off.*
