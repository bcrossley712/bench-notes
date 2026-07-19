# Bench Notes — Things to Do at the Computer

_Last updated: PWA sign-in tested from a browser tab (worked); a real bug was found and fixed (redirect URI mismatch when launched from the home-screen icon) — still needs testing from the actual icon. Restore/import, a settings panel (gear icon + status dot), and "Clear local data" (typed-confirmation) all built in the PWA. Checklist+Fix now flows as one block in both apps' detail view (was a separate boxed section)._

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
- [ ] Test the Service Checklist (checkbox + note → shows in the read-only
      preview above the Fix field, and appears in "The Fix" on save — fixed
      this session, was previously auto-injecting into the Fix textarea)
- [ ] Test "Attach from files…" — attach a couple of photos
- [ ] Test "Take photo…" — confirm webcam capture works (if laptop has a webcam)
- [ ] Test deleting a photo from an entry
- [ ] Test closing a new/unsaved tab — confirm the discard prompt appears
- [ ] Test "Change folder…" in the sidebar — try pointing it somewhere new
- [ ] Test the custom confirm/alert popups (delete, discard unsaved entry,
      title-required nudge, storage-folder-changed notice) — replaced the
      native browser ones this session
- [ ] Test deleting an entry, confirm the board count / stats / engine
      filter dropdown all correctly stop showing it (tombstone-based
      deletion added this session — deleted entries stay in the underlying
      data for sync purposes but should be invisible everywhere in the UI)
- [x] Detail view's "The Fix" section now flows as one continuous block
      (checklist lines + manual notes together, no bordered box) — matches
      the same change made in the PWA; edit/new-entry forms untouched
      (the checklist preview there has to stay a separate element to avoid
      reintroducing the duplication bug)
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
- [x] Sync architecture — **finalized (see PROJECT_NOTES.md for full detail):**
      - Your desktop (Electron): point "Change folder…" at your existing
        OneDrive-synced folder — no new code, works today
      - Shop laptop + phone (PWA): real OneDrive API sync via Microsoft
        Graph, signed into **your own** Microsoft account on both devices
        (not Dad's own account) — needed so there's one shared file, not
        two separate App Folders
      - Reconciliation: pull-then-merge-then-push, union by entry `id`,
        not last-save-wins whole-file overwrite — see PROJECT_NOTES.md
      - Local-first: every core action works fully offline regardless of
        sign-in state; sync is a background add-on only

## Shared data format (contract between Electron and PWA)
- [x] Customer fields added to both apps identically: customerName,
      customerPhone, equipmentModel, equipmentSerial, dateReceived,
      customerRequest (kept separate from title/symptom, as decided)
- [ ] Define + document: `bench_notes_data.json` (array of entries, same
      field names on both apps) + a `photos/` folder of real image files,
      named to match filenames referenced in the JSON. Note: the OneDrive
      App Folder now mirrors this exact shape (`bench-notes-data.json` +
      `photos/`) for the same reason — see PROJECT_NOTES.md Sync plan
- [ ] Add a `schemaVersion` field for future-proofing
- [ ] PWA must serialize IndexedDB contents to this exact shape when syncing
      (not its own invented format) — this is the piece that prevents the
      two apps from drifting into different file types over time

## OneDrive API sync — PWA built (untested), desktop not started
- [x] Register a Microsoft Graph "app" in Azure Portal — done. Name
      "Bench Notes", Client ID `a224822b-7b19-40b9-b504-8596a2add3be`,
      personal-Microsoft-accounts-only, `Files.ReadWrite.AppFolder` +
      `offline_access` granted, SPA + native redirect URIs added,
      public client flows enabled
- [x] Auth flow (PWA): MSAL redirect flow, signed into **your** Microsoft
      account — built, using vendored `pwa/vendor/msal-browser.min.js`
      (Microsoft deprecated the MSAL CDN, so the actual npm package file
      is committed to the repo instead)
- [x] `updatedAt` field added to entry schema, stamped on every create/edit
- [x] Sync trigger points (PWA): on app open, after every save/delete,
      after restore, and via the manual "Sync now" button — no
      periodic background timer (removed; unnecessary overhead for a
      2-device, low-concurrency setup)
- [x] Merge logic: pull remote → union by entry `id` with local → write
      merged result locally → push merged result back — built, unit-tested
      in `sync-build/mergeEntries.js` before being copied into the app
- [x] Deletion sync: tombstone-based (`deleted:true` + `updatedAt`), not a
      hard delete — competes against edits on the same newer-wins logic
- [x] UI: "last synced" / "not signed in" / "syncing" / error indicator
      (PWA `syncBar`) — tap the status text when signed in to disconnect
- [x] Photo sync (PWA): individual files in a `photos/` App Folder
      subfolder, incremental (only new/changed photos transfer), chunked
      upload for anything over Graph's 4MB simple-upload ceiling
- [x] Photo compression: resize to max 1600px + JPEG re-encode at capture
      time, before storing locally at all — applies to both "Take Photo"
      and "Choose Existing"
- [x] 429/throttling handling: waits for `Retry-After`, retries once
- [x] First real test attempted: sign-in from a regular browser tab
      (`https://bcrossley712.github.io/bench-notes/`) — worked
- [x] **Bug found + fixed:** signing in from the installed home-screen icon
      threw `invalid_request: redirect_uri`. Cause: the manifest's
      `start_url` (`./index.html`) resolves to a different URL than the
      bare folder URL registered in Azure, and the code was deriving the
      redirect URI dynamically instead of using a fixed value. Fixed by
      hardcoding it — see PROJECT_NOTES.md Sync plan for detail
- [ ] **Still needs testing: sign in from the actual installed home-screen
      icon** (not just a browser tab) to fully confirm the fix above —
      this is the specific path that broke
- [ ] Desktop OneDrive sync — **not started.** Needs a device-code flow
      (Electron can't use an embedded login window) instead of the PWA's
      browser redirect — different auth code, but merge/photo-sync logic
      should carry over close to as-is
- [ ] Must never block core functionality — local data is always the
      source of truth; sync is a background add-on, not a requirement
      to use the app (true today — confirm it stays true once desktop
      sync is added)

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
- [x] Detail/edit sheet top bar no longer stays pinned while scrolling (fixed)
- [x] Removed duplicate engine info from the detail header (now shown once,
      under Equipment) (fixed)
- [x] Manual JSON export button added (entries + photos, base64) — backup
      safety net independent of OneDrive (added)
- [x] Restore/import from a backup file added — merges via the same
      merge-by-id logic as OneDrive sync, never a blind overwrite
- [x] Settings panel added: gear icon in header (with a colored status dot
      mirroring sync state) opens a panel with OneDrive / Backup / Danger
      Zone sections — replaced the old always-visible Export button + sync
      bar after feedback that they were too prominent for how rarely
      they're used
- [x] "Clear local data" added, with real friction against an accidental
      tap: a warning step, then a typed "DELETE" confirmation
- [x] OneDrive sync built (see "OneDrive API sync" section above) —
      partially tested, see the redirect URI bug/fix above
- [ ] Test: sign in on your phone **from the home-screen icon specifically**,
      confirm an entry made on phone shows up after syncing on another
      signed-in device (once desktop sync exists, or by checking the raw
      file at onedrive.com/Apps/Bench Notes in the meantime)
- [ ] Test: delete an entry, confirm it disappears on the other device too
      after both have synced
- [ ] Test: take/attach several photos, confirm they show up in the
      OneDrive `Apps/Bench Notes/photos` folder, and confirm file sizes
      look meaningfully smaller than the original camera photos (compression
      working)
- [ ] Test: restore from an exported backup file, confirm entries/photos
      come back and nothing already on the device gets wiped
- [ ] Test: "Clear local data" — confirm the typed-DELETE requirement
      actually blocks the confirm button until typed correctly, and that
      it doesn't touch OneDrive itself
- [ ] Test: custom confirm/alert popups (delete, discard unsaved entry,
      title-required nudge) look right and behave right — replaced the
      native browser ones this session

## Candidates for removal — outdated code, not removed yet
Deliberately kept rather than deleted outright — noted here so it gets
revisited later instead of forgotten, and so nobody re-discovers "why
is this still here" from scratch. Move an item out of this list (and
actually delete the code) once its reasoning below is confirmed, or
strike it if a reason turns up to keep it after all.

- **PWA: "Compress older photos" backfill** (`compressExistingPhotos()`
  in `pwa/app.js`, Settings → Backup). Only exists to catch photos
  that predate capture-time compression — as of this note, the app's
  only 2 real entries are already compressed, including their backups,
  so it currently has nothing to do. Kept for now because desktop
  OneDrive sync isn't built yet, and desktop has no photo compression
  at all — once that sync exists, desktop-attached photos would start
  flowing into the PWA uncompressed, which is exactly what this tool
  cleans up. Revisit once desktop sync is built and its actual photo
  pipeline is known (see next item — if desktop ends up file-select-
  only, its photos should just get compressed the same way the PWA's
  library-picker path already does, and this backfill may end up
  genuinely unneeded rather than just currently idle).
- **Desktop: webcam "Take photo…" capture** (`openCamera()`/
  `closeCamera()`/`capturePhoto()` in `desktop/bench-notes.html`,
  `getUserMedia`-based). Built by an earlier session, never tested
  (see the Desktop app checklist above). Realistically unlikely to see
  real use — photos of small-engine repair work are far more likely to
  get taken on a phone and transferred/selected on the desktop than
  captured live via a laptop's built-in webcam pointed at a workbench.
  "Attach from files…" (file-select) is the realistic desktop photo
  path. Not removed yet since it hasn't actually been confirmed
  unused — revisit once the desktop app has been used for real for a
  while, rather than removing an untested feature purely on a guess.

## Known rough edges (not urgent, just noted)
- If you attach a photo while editing an entry and then hit Cancel instead
  of Save, that image file stays on disk unused rather than getting cleaned
  up automatically. Harmless, just a loose end.

---
*Add to this list any time — just tell me what to add or check off.*
