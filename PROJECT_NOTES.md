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
- **When packaging, include only files changed since the *last actual
  delivery* to the user** — i.e. since files were last handed over via
  download, not since the last git push (those are two different
  events; a file can be delivered for local testing well before it's
  pushed). Don't re-include a file that was already delivered and
  hasn't changed since. Don't drop a file that changed but was never
  actually delivered (e.g. packaging got deferred a few turns back) —
  it's still owed. Tracking what's been delivered vs. pushed is the
  user's own responsibility, not something to log here.
- User's local path: `C:\source\bench-notes` — the repo root.
- User is comfortable with Node/npm tooling; explanations can assume
  that baseline rather than over-explaining basic terminal usage.
- Preference for validating code (syntax checks, etc.) before handing
  it off, and being upfront about anything that couldn't be verified
  in a sandboxed environment (e.g. Electron's actual GUI, real device
  camera/install behavior).
- **Check desktop/PWA parity on every change, and say so either way.**
  Before finalizing a change to one app, explicitly check whether the
  other app needs the same fix/feature, and state the conclusion —
  "no desktop equivalent needed, since desktop doesn't have OneDrive
  sync yet" is a fine answer, silently not mentioning it isn't. Shared
  *data format* parity (add a field to one app, add it to both — see
  "Key architectural decisions" above) is a separate, narrower rule
  from this one: most *behavioral* changes (sync frequency, photo
  compression, restore/import) only apply to whichever app actually
  has that feature built, which today is PWA-only for all three.

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
- **Sync plan — PWA side built, desktop side not started.** OneDrive-based.
  - The owner's own desktop is already OneDrive-synced → can just
    point the app's "Change folder…" at that local folder, no API
    needed.
  - The shop laptop and the phone PWA both need real OneDrive **API**
    sync (Microsoft Graph) — no local synced folder available to them.
    **PWA is built. Desktop is not started** — desktop needs the
    device-code flow instead of a browser redirect, genuinely
    different code, not just a port of the PWA's.
  - **Considered and rejected: a custom backend** (e.g. Cloudflare
    Worker + D1/R2, which the user could host for free on their
    existing Cloudflare domain). Rejected specifically because the
    user has lost data before when apps depended on a backend that
    later became unreachable — a plain file sitting in the user's own
    OneDrive survives even if this app's code breaks entirely; a
    database behind a Worker doesn't offer that same guarantee.
  - **Auth: direct Microsoft OAuth (MSAL), not Auth0.** No third-party
    identity broker or custom backend needed — Microsoft Graph API
    requires signing in with Microsoft's own identity platform
    regardless, so that's used directly. Scope requested:
    `Files.ReadWrite.AppFolder` (narrow — only sees a hidden
    `Apps/Bench Notes` OneDrive folder, not the whole drive) +
    `offline_access` (token refresh).
  - **MSAL library is vendored, not CDN-loaded.** Microsoft deprecated
    the MSAL CDN as of `@azure/msal-browser@3.0`, so the actual npm
    package's browser bundle is committed directly at
    `pwa/vendor/msal-browser.min.js` (loaded via a plain `<script>`
    tag, exposes a global `msal` namespace — `msal.createStandard-
    PublicClientApplication(...)`). Keeps the zero-build-step
    architecture intact; if MSAL ever needs upgrading, re-run
    `npm install @azure/msal-browser` somewhere and copy
    `node_modules/@azure/msal-browser/lib/msal-browser.min.js` over
    the vendored copy.
  - **Azure app registration done.** Personal-Microsoft-account app
    registration, name "Bench Notes", Client ID
    `a224822b-7b19-40b9-b504-8596a2add3be`. SPA platform redirect URI
    `https://bcrossley712.github.io/bench-notes/` (confirm this
    matches your actual GitHub Pages URL if the repo/username ever
    changes) + native/mobile platform redirect for the future desktop
    device-code flow, "Allow public client flows" = Yes,
    `Files.ReadWrite.AppFolder` + `offline_access` delegated
    permissions granted. Authority used in code: `https://login.
    microsoftonline.com/consumers` (correct authority for a
    Personal-Microsoft-accounts-only app registration — `common` or
    `organizations` would be wrong here).
  - **One shared Microsoft account, not one-per-person.** The owner's
    own personal Microsoft account is what gets signed into on *all*
    devices, including Dad's — not Dad's own account. This is
    deliberate: two separate personal accounts would produce two
    separate App Folders with no shared file, breaking the merge
    model below. A single shared account sidesteps needing OneDrive
    folder-sharing permissions across two identities.
  - **Local-first is a hard requirement, not just an implementation
    detail.** Every core action (create/edit entries, checklist,
    photos) works fully offline on whichever device it's on, signed
    in or not. OneDrive sync is a background add-on layered on top,
    never something the app depends on to function. The PWA header
    shows a "last synced" / "not signed in" / "syncing" / error
    indicator (`syncBar` in `pwa/index.html`) so sync state is never
    ambiguous; tapping it when signed in offers to disconnect that
    device.
  - **Reconciliation — built and unit-tested.** Pull-then-merge-then-
    push, every sync, in that order. Merge is a **union by entry
    `id`** (never a whole-file overwrite) — an entry present on only
    one device survives the merge either way. Every entry now stamps
    `updatedAt` on create/edit (added this build — see
    `saveEntry()`/`setCoverPhoto()` in both apps). A true same-entry
    conflict (both devices edited the *same* entry since their last
    common sync) never silently picks a winner — the older version is
    kept as a new entry titled "… (⚠ sync conflict copy)" with a
    `conflictOf` field pointing at the surviving one, so nothing is
    silently discarded.
  - **Deletion is a tombstone, not a removal — built.** `deleteEntry()`
    in both apps sets `deleted: true` + bumps `updatedAt` instead of
    removing the record. The delete competes against edits on the
    same "newer timestamp wins" logic as any other conflict: delete an
    entry and it disappears everywhere on next sync, unless the other
    device edited that same entry more recently than the delete
    happened, in which case the edit wins and the entry survives.
    Desktop keeps tombstones in its `entries[]` array (it's serialized
    wholesale to disk, so removing them from the array would lose them
    on the next save) — visibility is filtered out entirely at
    `matchesFilters()` instead of at load. PWA filters tombstones out
    at `loadEntries()` since IndexedDB is written per-record, not as
    one blob, so the tombstone stays safely in IndexedDB either way.
  - **Canonical merge logic**, tested standalone before being copied
    into the apps: `sync-build/mergeEntries.js` +
    `sync-build/mergeEntries.test.js` (10 scenarios: new-entry-each-
    side, no-op merge, one-sided edits, real conflicts, delete-vs-edit
    ordering, both-sides-delete). This isn't part of either app's
    deployed code — it's a scratch/reference copy for verifying the
    algorithm in Node before hand-copying it into `pwa/index.html`
    (and eventually `desktop/bench-notes.html`). **If the merge logic
    ever needs to change, update `sync-build/mergeEntries.js` first,
    re-run the tests, then copy the verified function into both apps**
    — don't edit the copies in place without re-verifying against this
    test suite, since the whole point is it's easy to get a subtle
    edge case wrong.
  - **Photo sync — built.** Individual files in a `photos/` subfolder
    inside the App Folder (mirrors how desktop already stores things
    locally: JSON + photos folder), not embedded in the entries JSON —
    keeps sync incremental (only new/changed photos transfer) and
    avoids the entries file growing unbounded. Runs after entries have
    merged, using the final merged `photos[]` references to decide
    what to upload (referenced + local + not yet remote), download
    (referenced + remote + not yet local), and delete remotely
    (present remotely but no longer referenced by any surviving
    entry — this is how a tombstoned entry's old photos get cleaned
    up). Simple upload for anything ≤4MB (Graph's ceiling), automatic
    chunked "upload session" for anything larger.
  - **Photo compression — built.** Every photo gets resized to max
    1600px on its longest side and re-encoded as JPEG quality 0.82 at
    capture time (`compressImage()` in `pwa/index.html`), before it's
    ever written to IndexedDB — benefits local storage as much as sync
    bandwidth. Applies identically whether the photo came from the
    camera or the library picker (both inputs share the same
    `handlePhotoFiles()` handler).
  - **429 (throttling) handling — built.** `graphFetch()` wraps every
    Graph API call; on a 429 it waits for the server's `Retry-After`
    delay and retries once. Realistically far below anything Graph
    would ever throttle at this app's request volume (personal 2-user
    usage vs. Graph's ~2000 req/sec ceiling), but cheap correctness to
    have in place regardless.
  - **OneDrive free-tier storage (5GB) isn't a concern here** — the
    user has a 1TB Microsoft 365 plan on the account being used.
    Deliberately did not build a storage-quota warning (asked about,
    declined as unnecessary).
  - Sync trigger points: on app open, after every save/delete,
    and every 5 minutes while the app is open (`initMsal()`/
    `saveEntry()`/`deleteEntry()` in `pwa/index.html`).
  - **First real-world test found a real bug — fixed.** The redirect
    URI was originally computed dynamically from `window.location.
    pathname`. That matched Azure's registered value when typed
    directly into a browser tab, but not when launched from the
    installed home-screen icon — the manifest's `start_url` is
    `./index.html`, which resolves to a different URL than the bare
    folder URL registered in Azure, causing an `invalid_request:
    redirect_uri` error specifically from the installed-icon launch
    path. **Fixed** by hardcoding `redirectUri` to the exact registered
    string (`https://bcrossley712.github.io/bench-notes/`) instead of
    deriving it from wherever the page happened to load. Confirmed
    working from a regular browser tab; **launching from the actual
    home-screen icon still needs to be tried** to fully confirm the fix
    (a browser-tab test doesn't exercise the code path that broke).
  - **Restore/import — built**, alongside export. Reuses the exact
    same merge-by-id logic as OneDrive sync — restoring from a backup
    file never blindly overwrites what's already on the device; same
    conflict-duplicate handling as a normal sync. Lives in the
    Settings panel (see below), not the main UI.
  - **Settings panel — built.** A gear icon in the header (with a
    small colored status dot mirroring sync state — green/orange/
    red/gray — so sync problems stay visible without opening
    anything) replaced the old always-visible Export button and sync
    bar, after the user pushed back on those being too prominent for
    how rarely they're used. Panel has three sections: **OneDrive
    Sync** (status + connect/sync/disconnect), **Backup** (export/
    restore), **Danger Zone** (clear local data).
  - **Clear local data — built**, with real friction against an
    accidental tap: a warning step (nudges toward exporting first),
    then a typed-confirmation step (`showTypedConfirm()` — confirm
    button stays disabled until the exact word "DELETE" is typed).
    PWA-only for now — clears IndexedDB (`entries` + `photos` stores)
    and the local sync baseline. Desktop doesn't have an equivalent
    yet (no sync/backup built there yet to need one).
  - **Not yet tested against a real Microsoft account/browser.** Merge
    logic and photo-compression logic are unit-tested; the actual
    OAuth handshake, live Graph API calls, and redirect behavior have
    only been partially tried (see the redirect URI bug above) — full
    confirmation, including from the installed home-screen icon, is
    still the next real-world test.
  - **Desktop OneDrive sync — not started.** Needs MSAL Node (or an
    equivalent device-code flow: show a code, user enters it at
    microsoft.com/link, poll for token) since Electron can't use an
    embedded login window. The merge/photo-sync logic itself should
    be portable from the PWA almost as-is once auth is wired up.

  names so a future sync layer doesn't have to translate between two
  formats. Current entry fields: `title`, `engineModel`, `engineCode`,
  `source`, `causes`, `steps`, `fix`, `partsUsed`, `notes`, `photos[]`,
  `customerName`, `customerPhone`, `equipmentModel`, `equipmentSerial`,
  `dateReceived`, `customerRequest`, `checklist` (object keyed by item
  id, e.g. `sparkTest: {checked, note}` — see `CHECKLIST_ITEMS` in each
  app for the current 13 items), `orderNumber` (permanent, assigned
  once at creation — see note below), `completed`, `createdAt`,
  `updatedAt` (added this build — stamped on every create/edit, see
  `saveEntry()`; required by the sync merge logic), `dateAdded`.
  Two more fields exist but are conditional/rare, not part of the
  normal shape: `deleted` (tombstone flag, set by `deleteEntry()`,
  see Sync plan above) and `conflictOf` (only present on a sync
  conflict's duplicate copy, points at the id of the entry that won
  the conflict). If you add a field to one app, add it to the other at
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
- **Custom modal, not native `confirm()`/`alert()`.** Both apps use
  `showAlert(message)` / `showConfirm(message, opts)` — themed to
  match the rest of the UI (dark panel, orange top border), return
  Promises so call sites `await` them. There should be zero native
  browser `confirm()`/`alert()` calls left in either app; if you're
  about to add one, use these instead. Same implementation duplicated
  in both apps (`#modalOverlay`/`#modalMessage`/`#modalActions` in the
  HTML, functions near the top of each `<script>` block). **PWA only**
  also has `showTypedConfirm(message, requiredText, opts)` — same
  pattern, but the confirm button stays disabled until the exact
  required word is typed. Currently used for "Clear local data" only;
  reach for it any time an action is destructive enough that a single
  accidental tap shouldn't be sufficient — desktop doesn't have this yet
  since it doesn't have a use for it yet either.

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
  sheet). Checked items render as a read-only preview ("Label - note")
  above the Fix textarea in the **edit/new-entry form** via
  `checklistLines()`/`renderChecklistPreview()` — never written into
  the editable textarea itself, and this part is deliberately staying
  a visually separate, non-editable element (see the parenthetical
  below for why). The Fix textarea holds only manually-typed notes.
  In the **saved/detail view** specifically, checklist lines and
  manual Fix text render as one continuous flowing block of text, no
  visual separation between them (changed this session — used to be a
  bordered/boxed sub-section, the user wanted it to read as one
  natural section instead). Either way nothing is stored pre-combined
  — it's composed fresh at render time, so there's no stale block to
  drift out of sync. Search includes checklist text explicitly since
  it's no longer riding along inside `entry.fix`.
  (Earlier version tracked a `checklistFixBlock` string and tried to
  find-and-replace it in the textarea — fragile, caused duplicate
  entries in the Fix field when the tracked block didn't exactly match
  stored text, e.g. after a note with an embedded line break. Fixed
  in an earlier session; same fix applied to both apps.)
- App launches cleanly via `npm start`. Feature-level testing (entries,
  checklist, photos, tab-close confirm, folder change) and the packaged
  `.exe` install are still outstanding — see `TODO.md` for the exact
  checklist.

## PWA specifics

- Storage is IndexedDB (entries + photo blobs) — no backend, since
  GitHub Pages is static hosting only.
- **Manual JSON export** (added this session): always-visible "Export"
  button in the header (`exportAllData()`). Bundles every entry plus
  all photo blobs (base64-encoded) into one timestamped downloadable
  JSON file — a portable backup independent of OneDrive/Microsoft
  entirely. Added specifically as a safety net before OneDrive sync
  goes in, per the user's past experience losing data to backends that
  became unreachable — see Sync plan above.
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
