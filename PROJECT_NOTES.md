# Project Notes — Bench Notes

Read this first if you're picking this project up in a new chat. It's
context for you (the next Claude), not end-user documentation — that
lives in the README files.

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
  formats. Current entry fields: `title`, `engineType`, `source`,
  `causes`, `steps`, `fix`, `notes`, `photos[]`, `customerName`,
  `customerPhone`, `equipmentInfo`, `dateReceived`, `customerRequest`,
  `completed`, `createdAt`, `dateAdded`. If you add a field to one
  app, add it to the other at the same time.
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
- Not yet tested on real Windows hardware as of this note. Check
  `TODO.md`.

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
- Not yet deployed to GitHub Pages or tested on real phones as of this
  note. Check `TODO.md`.

## Working agreements with this user

- **Confirm before starting new builds/changes** — don't just proceed
  on a big feature without checking scope/direction first, especially
  when there's real ambiguity in how to design something.
- **Confirm before packaging/sending files** — and when sending, only
  include the files actually touched by the change, not the whole
  repo. The user uses their own "download all" zip option when they
  want everything.
- User's local path: `C:\source\bench-notes` — the repo root.
- User is comfortable with Node/npm tooling; explanations can assume
  that baseline rather than over-explaining basic terminal usage.
- Preference for validating code (syntax checks, etc.) before handing
  it off, and being upfront about anything that couldn't be verified
  in a sandboxed environment (e.g. Electron's actual GUI, real device
  camera/install behavior).

## What's realistically next

Check `TODO.md` for the current checklist, but the big remaining piece
architecturally is the OneDrive sync layer described above — that's
the next major build once the user is ready, not yet started.
