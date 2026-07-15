# Bench Notes — Things to Do at the Computer

_Last updated: repo structure finalized_

## Repo structure — decided and built
- [x] One repo (`bench-notes`), not two — `/pwa` and `/desktop` subfolders
- [x] GitHub Actions workflow to auto-deploy `/pwa` on push (avoids the
      awkward "must be named /docs" zero-config route)
- [ ] `bench-notes-repo.zip` is now the canonical local folder to keep in
      sync — treat the separate `bench-notes-pwa.zip` /
      `bench-notes-electron.zip` as superseded
- [ ] Push to GitHub, then set Settings -> Pages -> Source to
      "GitHub Actions" (one-time)

## Desktop app (Electron) — not yet tested
- [ ] Unzip `bench-notes-electron.zip` somewhere permanent (not Downloads)
- [ ] Run `npm install` (first time only — downloads Electron, ~150-200MB)
- [ ] Run `npm start` — confirm the app window opens and looks right
- [ ] Test creating a new entry (text fields, source tags, engine type)
- [ ] Test "Attach from files…" — attach a couple of photos
- [ ] Test "Take photo…" — confirm webcam capture works (if laptop has a webcam)
- [ ] Test deleting a photo from an entry
- [ ] Test "Change folder…" in the sidebar — try pointing it somewhere new
- [ ] Once happy: run `npm run dist` to build the real `.exe` installer
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

## Mobile app — PWA via GitHub Pages — BUILT, ready to deploy/test
~~Capacitor + Android Studio plan~~ — dropped. A PWA works on both Android
Chrome and iPhone Safari from one codebase, and avoids needing a Mac/Xcode
for iOS entirely.
- [x] Build the PWA (HTML/JS reused from existing app, camera via
      `<input type="file" capture="environment">`, IndexedDB for storage)
- [x] Add a service worker + app manifest for offline/install support
- [ ] Unzip `bench-notes-pwa.zip`, upload the 5 items to a new GitHub repo
      (keep the `icons/` folder structure intact)
- [ ] Enable GitHub Pages in repo Settings (Deploy from branch, root folder)
- [ ] Open the resulting URL on your Android phone in Chrome, confirm it loads
- [ ] Test: add an entry, attach/take a photo, search, filters, delete
- [ ] Test installing to home screen (Chrome menu -> Add to Home Screen)
- [ ] Test offline: airplane mode after first load, confirm it still works
- [ ] Send the link to Dad, test Safari -> Share -> Add to Home Screen on his iPhone
- [ ] No sync yet — intentionally offline-only for this first version

## Known rough edges (not urgent, just noted)
- If you attach a photo while editing an entry and then hit Cancel instead
  of Save, that image file stays on disk unused rather than getting cleaned
  up automatically. Harmless, just a loose end.

## Once mobile planning is done
- [ ] Review the mobile app plan together and approve direction
- [ ] Only then: build the mobile project (nothing built yet — ideas only until you say go)

---
*Add to this list any time — just tell me what to add or check off.*
