# Project Notes — Bench Notes

Read this first if you're picking this project up in a new chat. It's
context for you (the next Claude), not end-user documentation — that
lives in the README files.

## Usage-efficiency expectations for Claude

- **Assume the code in this conversation is current** unless I say otherwise. Don't re-pull the full
  repo/tarball if it's already been fetched this session — re-fetch only when I tell you something
  changed outside our conversation, or at the very start of a new session.
- **Pull or view only what the task touches.** Grep for the specific function/selector/section first,
  then view a targeted range — don't read whole files (or the whole repo) to make a small, well-scoped
  change.
- **Match verification effort to the change.** Only run a test suite (or extend it) when a change
  touches actual logic. Skip it for CSS, copy, layout, or other changes it can't meaningfully verify.
- **Don't build throwaway tooling** (scratch repro files, sandboxes, etc.) to double-check something
  reasoning from the code and docs can already answer — only build a repro when there's a real, otherwise
  unresolvable uncertainty.
- **Keep the project notes file itself lean.** Record current state and the *why* behind decisions, not a
  session-by-session diary of how each bug was found and fixed — that history belongs in git commits, not
  here. If this file starts creeping back up in size, trim it rather than let it compound.
- **Deliver only the files that actually changed**, not a full re-zip of the project.
- **Check in before packaging/shipping** — confirm the plan or show the diff before finalizing files,
  even for a single-file change, unless I've clearly told you to just go ahead.
- **Batch related changes** into one pass rather than iterating file-by-file across separate turns when
  the scope is already clear.

## Working agreements with this user

- **Confirm before starting new builds/changes** — don't just proceed
  on a big feature without checking scope/direction first, especially
  when there's real ambiguity in how to design something.
- **Confirm before packaging/sending files** — and when sending, only
  include the files actually touched by the change, not the whole
  repo. The user uses their own "download all" zip option when they
  want everything.
- **When packaging, include every file touched since the *last*
  package** — not just the files touched in the most recent change.
  If a file was edited a few turns ago and never actually delivered
  (e.g. because packaging was deferred), it's still owed next time
  "package it up" is said. Missed this once already — don't repeat it.
- User's local path: `C:\source\bench-notes` — the repo root.
- User is comfortable with Node/npm tooling; explanations can assume
  that baseline rather than over-explaining basic terminal usage.
- Preference for validating code (syntax checks, etc.) before handing
  it off, and being upfront about anything that couldn't be verified
  in a sandboxed environment (e.g. Electron's actual GUI, real device
  camera/install behavior).

## What this is

A troubleshooting/work-order log for a small engine repair shop, built
so the owner's son can capture 40+ years of his dad's diagnostic
knowledge before his dad retires, and keep building on it afterward.
Two apps, one shared entry format:

- **`/desktop`** — Electron app, Windows, primary editing tool at the
  bench. Direct file storage (no browser storage fragility).
- **`/pwa`** — installed web app (Android + iPhone), deployed via
  GitHub Pages + GitHub Actions. Offline-capable, camera capture for
  photos. Built because the son is on Android and his dad is on
  iPhone — a PWA covers both from one codebase without needing a Mac/
  Xcode for a native iOS build.

See the root `README.md` for repo structure and deployment steps, and
`TODO.md` for the live task list (what's tested, what's not, open
decisions). This file is about *why things are built the way they
are*, so you don't accidentally re-litigate settled decisions.

## Key architectural decisions (and why)

- **One repo, not two.** The two apps share an entry data format on
  purpose — keeping them in one repo makes that shared contract easy
  to see and hard to accidentally drift apart.
- **PWA, not Capacitor/native.** Originally planned as a Capacitor
  Android app. Switched to a PWA once GitHub Pages hosting + an iPhone
  for Dad were both confirmed — a PWA works on both platforms from one
  codebase and needs no Mac/Xcode for iOS.
- **GitHub Actions deploy, not the `/docs`-folder zero-config route.**
  Deliberate choice so folder names could stay sensible (`pwa`,
  `desktop`) instead of a permanently confusing "docs" label.
- **Sync plan (not yet built):** OneDrive-based.
  - The owner's own desktop is already OneDrive-synced → can just
    point the app's "Change folder…" at that local folder, no API
    needed.
  - The shop laptop (Dad's own Microsoft account) and the phone PWA
    both need real OneDrive **API** sync (Microsoft Graph) — no local
    synced folder available to them.
  - Reconciliation strategy: last-save-wins. Acceptable given it's
    just the two of them, usually working together or one at a time.
  - **Not built yet.** This is the next big piece when picked back up.
- **Shared entry schema.** Both apps must read/write identical field
  names so a future sync layer doesn't have to translate between two
  formats. Current entry fields: `title`, `engineModel`, `engineCode`,
  `source`, `causes`, `steps`, `fix`, `partsUsed`, `notes`, `photos[]`,
  `customerName`, `customerPhone`, `equipmentModel`, `equipmentSerial`,
  `dateReceived`, `customerRequest`, `checklist` (object keyed by item
  id, e.g. `sparkTest: {checked, note}` — see `CHECKLIST_ITEMS` in each
  app for the current 13 items), `orderNumber` (permanent, assigned
  once at creation — see note below), `completed`, `createdAt`,
  `dateAdded`. If you add a field to one app, add it to the other at
  the same time.
- **`orderNumber` is assigned once, at creation, and never recomputed.**
  Earlier versions of both apps displayed a work-order number computed
  live from array position, which reshuffled every entry's number
  whenever a new one was added (IndexedDB/JSON array order isn't
  chronological). Both apps now stamp a permanent `orderNumber` on an
  entry the moment it's created, and a one-time migration
  (`ensureOrderNumbers`) backfills it for any entry that predates this
  fix. Never derive the displayed number from array position again.
- **Photo order is meaningful.** `photos[0]` is always the cover/
  thumbnail — both apps rely on this convention instead of a separate
  "cover photo" field, so reordering the array (not adding a new field)
  is how a cover photo gets changed.
- **Intake workflow:** an entry can be saved with just customer info
  (no title required) — matches real shop workflow where the customer
  drops off equipment before any diagnosis has happened. A "Needs
  Diagnosis" badge/filter surfaces these automatically (computed, not
  a stored flag) until a title/causes/steps/fix gets filled in, or the
  entry is marked complete.

## Desktop app specifics

- Data + photos stored via Electron's main process (`main.js`), not
  browser storage — writes to a real JSON file + photos folder in a
  user-configurable location (defaults to AppData, but "Change
  folder…" can point it anywhere, including a OneDrive-synced folder).
- **Tabbed interface** (added in this session): the old popup-modal
  editor was replaced with full-screen tabs. "Board" is a permanently
  pinned, uncloseable tab; each opened work order gets its own
  closable tab. This was a deliberate choice over "Board as just
  another closable tab" — see conversation history if the reasoning
  matters, but short version: never wanted the board to be one
  accidental click away from disappearing.
- **Known limitation:** photos persist correctly per-tab if you switch
  away mid-edit and come back, but typed field values (text) do not —
  switching tabs mid-edit without saving loses in-progress text
  changes on that tab. Full state-preservation across tabs was
  deliberately out of scope to avoid further scope creep; flagged
  clearly to the user, not a bug they're unaware of.
- **Tab-close confirm** only fires for a brand-new, never-saved entry
  (`tab.isNew && tab.mode==='edit'`) — closing a tab mid-edit of an
  *existing* entry still closes silently (same known limitation
  above; not extended to avoid scope creep).
- **Service Checklist** (13 fixed items mirroring the paper work order
  sheet) live-writes into the Fix textarea as items are checked, e.g.
  `Blade Sharpening - done`. Implementation tracks the last-generated
  block (`checklistFixBlock`) so it can find-and-replace just its own
  lines without touching anything the user typed manually below it.
- App launches cleanly via `npm start`. Feature-level testing (entries,
  checklist, photos, tab-close confirm, folder change) and the packaged
  `.exe` install are still outstanding — see `TODO.md` for the exact
  checklist.

## PWA specifics

- Storage is IndexedDB (entries + photo blobs) — no backend, since
  GitHub Pages is static hosting only.
- Camera capture uses `<input type="file" capture="environment">`,
  not `getUserMedia` — more reliable across iOS Safari + Android
  Chrome than a live camera stream.
- **Cache-busting + update banner** (added in this session): the
  GitHub Actions workflow stamps a `__VERSION__` placeholder in
  `service-worker.js` with the deploy's commit hash automatically, so
  every real push forces a fresh cache. The app itself shows a "new
  version available" banner and only reloads when the user taps
  Refresh (not automatically), using the standard
  waiting-worker/postMessage pattern. Do not remove the
  `self.skipWaiting()` omission in the install handler — that's
  intentional, it's what makes the banner flow possible.
- Simpler single-work-order-at-a-time interface (no tabs) — deliberate
  choice given phone screen size; confirmed with the user rather than
  assumed.
- **Back button closes the open entry/photo, not the app.** Uses
  `history.pushState`/`popstate` with a small view stack (board →
  sheet → lightbox). Opening a brand-new unsaved entry sets
  `sheetIsNewUnsaved`; the popstate handler intercepts back on that
  state specifically to confirm discard before actually closing
  (existing/saved entries close on back with no confirm — matches
  desktop's tab-close scope, see below).
- **Photo lightbox** supports prev/next arrows and swipe between all
  of an entry's photos, plus a "Set as cover" action. Cover is not a
  separate field — it just reorders `photos[]` so the chosen photo
  becomes index 0, since both apps already treat `photos[0]` as the
  thumbnail.
- Deployed to GitHub Pages and tested on a real Android phone,
  including home-screen install. Still outstanding: offline/
  airplane-mode test, and getting it in front of Dad's iPhone — see
  `TODO.md`.

## What's realistically next

Check `TODO.md` for the current checklist, but the big remaining piece
architecturally is the OneDrive sync layer described above — that's
the next major build once the user is ready, not yet started.
