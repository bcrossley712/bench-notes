# Project Notes — Bench Notes

Read this first if you're picking this project up in a new chat. It's
context for you (the next Claude), not end-user documentation — that
lives in the README files. This file describes *current state and why
things are built the way they are*, not a session-by-session history —
that belongs in git commits. If this file starts creeping back up in
size, trim it rather than let it compound.

## Usage-efficiency expectations for Claude

- **Assume the code in this conversation is current** unless told
  otherwise. Don't re-pull the repo if it's already been fetched this
  session — re-fetch only when told something changed outside the
  conversation, or at the start of a new session.
- **Pull or view only what the task touches.** Grep for the specific
  function/selector/section, then view a targeted range — don't read
  whole files to make a small, well-scoped change.
- **Match verification effort to the change.** Only run/extend a test
  suite when a change touches actual logic; skip it for CSS, copy, or
  layout changes.
- **Don't build throwaway tooling** to double-check something reasoning
  from the code and docs can already answer.
- **Deliver only the files that actually changed**, not a full re-zip.
- **Check in before packaging/shipping** — confirm the plan or show the
  diff before finalizing files, even for a single-file change, unless
  clearly told to just go ahead.
- **Batch related changes** into one pass rather than iterating
  file-by-file across turns once scope is clear.

## Working agreements with this user

- **DO NO FURTHER WORK ON DESKTOP until explicitly asked.** Stated
  intention is to remove `/desktop` entirely — not pulled the trigger
  yet, but no new features, parity fixes, or bug fixes in the meantime.
  Noting a parity gap in passing is fine; proposing or starting to close
  one on desktop is not. When the word is given, actual removal is:
  delete `/desktop`, drop desktop-specific content from README.md/
  PROJECT_NOTES.md/TODO.md, and stop referring to "both apps." Don't do
  any of that preemptively.
- **Confirm before starting new builds/changes**, especially with real
  design ambiguity — answering a scoping question isn't the same as
  agreeing to a build. Placement, flow, and UI mechanics need their own
  confirmation even after intent is clear.
- **Confirm before packaging/sending files.** Include only files touched
  by the change, not the whole repo — the user has their own "download
  all" option for that.
- **Track delivery, not push, when deciding what to include.** Only send
  files changed since they were last actually handed over for download —
  a file can be delivered for local testing before it's pushed to git.
  Don't re-send an unchanged delivered file; don't drop a changed file
  that was never actually delivered.
- User's local path: `C:\source\bench-notes`. Comfortable with Node/npm —
  explanations can assume that baseline.
- Validate code (syntax checks, etc.) before handing it off, and be
  upfront about what can't be verified in a sandbox (Electron's actual
  GUI, real device camera/install behavior).
- **Check desktop/PWA parity on every change and say so either way** —
  currently moot for desktop given the halt above. Shared *data format*
  parity (add a field to one app, add it to both, once desktop is live
  again) is separate from *behavioral* parity (sync frequency, photo
  compression, etc.), which today only applies to whichever app actually
  has that feature — currently PWA-only across the board.

## What this is

A troubleshooting/work-order log for a small engine repair shop, built so
the owner's son can capture 40+ years of his dad's diagnostic knowledge
before his dad retires, and keep building on it afterward. It's
deliberately both a knowledge log (symptom → cause → fix) *and* active
work-order tracking (customer intake, repair status through completion)
in one app — not scope creep to walk back. Entries still work with just a
symptom/cause/fix and nothing else filled in; a future change that seems
to "belong" in a separate, more focused app usually doesn't — this is one
app doing both jobs on purpose.

- **`/desktop`** — Electron app, Windows. Direct file storage. **Halted**,
  likely future removal — see "Working agreements."
- **`/pwa`** — installed web app (Android + iPhone), deployed via GitHub
  Pages + GitHub Actions. Offline-capable, camera capture. Built as a PWA
  (not Capacitor/native) because the son is on Android and his dad is on
  iPhone — one codebase covers both without a Mac/Xcode for iOS.

See the root `README.md` for repo structure and deployment steps, and
`TODO.md` for the live, open-only task list.

## Key architectural decisions

- **One repo, not two.** The two apps share an entry data format on
  purpose — one repo keeps that shared contract visible and hard to
  accidentally drift apart.
- **GitHub Actions deploy**, not the `/docs`-folder zero-config route —
  so folder names can stay sensible (`pwa`, `desktop`).
- **No custom backend** (considered and rejected: e.g. Cloudflare Worker
  + D1/R2). The user has lost data before to backends that became
  unreachable — a plain file in the user's own OneDrive survives even if
  this app's code breaks entirely; a database behind a Worker doesn't.
- **Sync — OneDrive-based, PWA built and tested, desktop not started.**
  - Owner's own desktop: point Electron's "Change folder…" at an
    already-OneDrive-synced local folder — no API needed, works today.
  - Shop laptop + phone (PWA): real OneDrive **API** sync via Microsoft
    Graph — no local synced folder available to them.
  - **Auth: direct Microsoft OAuth (MSAL), not Auth0** — Graph API
    requires Microsoft's own identity platform regardless. Scope:
    `Files.ReadWrite.AppFolder` (only sees a hidden `Apps/Bench Notes`
    folder, not the whole drive) + `offline_access`.
  - MSAL is **vendored**, not CDN-loaded (Microsoft dropped the MSAL CDN
    as of `@azure/msal-browser@3.0`) — committed at
    `pwa/vendor/msal-browser.min.js`. To upgrade: `npm install
    @azure/msal-browser` elsewhere, copy
    `node_modules/@azure/msal-browser/lib/msal-browser.min.js` over it.
  - Azure app registration: personal-Microsoft-account app "Bench Notes",
    Client ID `a224822b-7b19-40b9-b504-8596a2add3be`. SPA redirect URI
    `https://bcrossley712.github.io/bench-notes/` (confirm this still
    matches if the repo/username ever changes) + a native/mobile redirect
    for a future desktop device-code flow. Authority in code:
    `https://login.microsoftonline.com/consumers` (correct for a
    personal-accounts-only registration — `common`/`organizations` would
    be wrong).
  - **One shared Microsoft account**, not one-per-person — the owner's
    own account is signed into on *all* devices, including Dad's. Two
    separate accounts would produce two separate App Folders with no
    shared file, breaking the merge model.
  - **Local-first is a hard requirement.** Every core action works fully
    offline, signed in or not. Sync is a background add-on layered on
    top, never a dependency. PWA header shows a sync-state indicator
    (`syncBar` in `pwa/app.js`).
  - **Reconciliation:** pull → merge → push, every sync. Merge is a
    **union by entry `id`** (never a whole-file overwrite) — an entry on
    only one device survives either way. Every entry stamps `updatedAt`
    on create/edit. A true same-entry conflict (both devices edited it
    since their last common sync) never silently picks a winner — the
    older version is kept as a new entry titled "… (⚠ sync conflict
    copy)" with a `conflictOf` field, so nothing is silently discarded.
  - **Deletion is a tombstone**, not a removal — `deleteEntry()` sets
    `deleted: true` + bumps `updatedAt`. Competes against edits on the
    same newer-timestamp-wins logic as any other conflict. Desktop keeps
    tombstones in its `entries[]` array (serialized wholesale to disk)
    and filters them at render (`matchesFilters()`); PWA filters them at
    `loadEntries()` since IndexedDB is per-record.
  - **Photo sync:** individual files in a `photos/` App Folder subfolder
    (mirrors desktop's local JSON + photos-folder layout), not embedded
    in the entries JSON — keeps sync incremental and the entries file
    from growing unbounded. Chunked upload above Graph's 4MB simple-
    upload ceiling; 429/throttling handled via `Retry-After` + one retry
    (cheap correctness even though real usage is far below Graph's
    ceiling).
  - Sync triggers: on app open, after every save/delete, after restore,
    and the manual "Sync now" button. No periodic background timer —
    removed as unnecessary overhead for a 2-device, low-concurrency shop.
  - **Desktop OneDrive sync is not started.** Needs MSAL Node or an
    equivalent device-code flow (Electron can't use an embedded login
    window). Merge/photo-sync logic should port from the PWA almost
    as-is once auth is wired up.
  - OneDrive free-tier storage isn't a concern — the account in use has a
    1TB Microsoft 365 plan; no storage-quota warning was built
    (considered, declined as unnecessary).
- **`sync-build/mergeEntries.js`, a standalone unit-tested merge
  reference, has never existed in this repo** (checked full git history)
  despite being described in earlier notes as if it were permanent. The
  merge logic that actually runs is the hand-written version live in
  `pwa/app.js`, exercised by real syncing. If a standalone tested
  reference copy is wanted, it needs to be built fresh, not "restored."
- **`orderNumber` was built, then removed entirely.** It was purely
  cosmetic (never used in search/sort/filter/export), and its only other
  code was machinery to keep the display number consistent across
  devices — a collision-resolution pass that once silently renumbered an
  older entry mid-edit. Confirmed with the user it served no function,
  then removed — field, card badge, backfill migration, and collision
  resolver — from both apps. If a "work order number" is wanted again,
  think through whether it's actually needed for something (e.g. paper
  labeling) before rebuilding the same plumbing.
- **Entry fields, both apps, identical names on purpose** (so a sync
  layer never has to translate): `title` (UI-labeled "Diagnosis" in the
  PWA), `primaryComplaint` (PWA-only), `engineBrand`, `engineModel`,
  `engineCode`, `source` (UI-labeled "Performed By" in the PWA — see PWA
  specifics), `causes`, `steps`, `fix`, `partsUsed`
  (UI-labeled "Parts"), `notes`, `photos[]`, `customerName`,
  `customerPhone`, `equipmentBrand`, `equipmentModel`, `equipmentSerial`,
  `equipmentCategory` (PWA-only so far), `dateReceived`,
  `customerRequest`, `checklist` (object keyed by item id, e.g.
  `sparkTest: {checked, note}` — see `CHECKLIST_ITEMS`, currently 12
  items), `showAllFields` (PWA-only), `status` (`needs-diagnosis` /
  `waiting-quote` / `waiting-parts` / `in-progress` / `complete`,
  PWA-only), `completedAt` (PWA-only), `waiver` (PWA-only, object or
  null — see "Waiver feature" below), `completed`, `createdAt`,
  `updatedAt` (required by sync merge), `dateAdded`. Two conditional
  fields: `deleted` (tombstone flag) and `conflictOf` (only on a sync
  conflict's duplicate copy). **If you add a field to one app, add it to
  the other at the same time** — current PWA-only gaps
  (`equipmentCategory`/`equipmentBrand`/`engineBrand`/`showAllFields`/
  `waiting-quote`/`primaryComplaint`/`waiver`) aren't things to actively
  close right now given the desktop halt.
- **Photo order is meaningful** — `photos[0]` is always the cover/
  thumbnail; both apps rely on this instead of a separate cover field.
- **Intake workflow:** an entry can be saved with just customer info, no
  title required — matches the real shop workflow where equipment
  arrives before any diagnosis has happened. A "Needs Diagnosis" badge/
  filter surfaces these automatically (computed, not a stored flag)
  until a title/causes/steps/fix gets filled in, or it's marked complete.
- **Custom modal, not native `confirm()`/`alert()`.** Both apps use
  `showAlert(message)` / `showConfirm(message, opts)` (themed to match
  the UI, return Promises). There should be zero native browser
  `confirm()`/`alert()` calls in either app. **PWA only** also has
  `showTypedConfirm(message, requiredText, opts)` — confirm button stays
  disabled until the exact word is typed; currently used for "Clear
  local data" only, and the right tool for any future destructive action
  that shouldn't be a single accidental tap.

## Desktop app specifics

- Data + photos stored via Electron's main process (`main.js`) — a real
  JSON file + photos folder in a user-configurable location (defaults to
  AppData; "Change folder…" can point anywhere, including a
  OneDrive-synced folder).
- **Tabbed interface.** "Board" is a permanently pinned, uncloseable tab;
  each opened work order gets its own closable tab — deliberate, so the
  board is never one accidental click from disappearing.
- **Known limitation:** photos persist per-tab across switches, but typed
  field text does not — switching tabs mid-edit without saving loses
  in-progress text on that tab. Deliberately out of scope (avoids further
  scope creep); the user knows about it.
- **Tab-close confirm** only fires for a brand-new, never-saved entry —
  closing mid-edit of an *existing* entry closes silently (same known
  limitation, not extended for the same scope reason).
- **Service Checklist** (13 fixed items mirroring the paper work order).
  Checked items render as a read-only preview above the Fix textarea in
  the edit/new-entry form (`checklistLines()`/`renderChecklistPreview()`)
  — never written into the editable textarea itself; the Fix textarea
  holds only manually-typed notes. In the saved/detail view, checklist
  lines and manual Fix text render as one continuous flowing block.
  Nothing is stored pre-combined — composed fresh at render time, so
  there's no stale block to drift out of sync. Search includes checklist
  text explicitly since it doesn't ride along inside `entry.fix`. (An
  earlier approach tried find-and-replace on a tracked
  `checklistFixBlock` string — fragile, caused duplicate Fix entries when
  the tracked block didn't exactly match stored text. Fixed; same fix
  applied to both apps.)
- App launches cleanly via `npm start`. Feature-level testing and the
  packaged `.exe` install are outstanding — see `TODO.md`.

## PWA specifics

- **Repair status** (`status`): `needs-diagnosis` (default) /
  `waiting-quote` / `waiting-parts` / `in-progress` / `complete`, set via
  a dropdown, shown as a color-coded board badge, filterable via status
  chips (`getEntryStatus()`/`STATUS_LABELS`/`saveEntry()`). Replaced the
  old binary `isNeedsDiagnosis()` heuristic, which still runs internally
  as the fallback for entries with no explicit status — don't reintroduce
  a second, parallel status concept. `completedAt` stamps the moment
  status becomes `complete` and clears if it moves away again, so it
  never shows a stale completion date on a reopened entry — deliberately
  auto-stamped with no date/time field in the normal form (the right
  default for the common case). A separate "Edit completed date/time"
  pencil button in the detail view (`editCompletedDate()`/
  `showDateTimePrompt()`) handles backdating/correcting without tempting
  second-guessing during normal use. Completed entries stay on the board
  by default. **Desktop has neither the field nor the UI yet** — see
  TODO.md.
- **Equipment category** (`equipmentCategory`): free-type input with a
  `<datalist>` of 9 starting options (`EQUIPMENT_CATEGORY_OPTIONS`) —
  picking from the list or typing something else both work. Drives which
  Service Checklist fields show (`getVisibleChecklistKeys()`): every
  category gets a base six (`CHECKLIST_BASE`) plus category-specific
  extras (`CATEGORY_CHECKLIST_EXTRAS`). "Electric" is the one exception —
  it defines its entire checklist via `CATEGORY_CHECKLIST_FULL` (Clean
  Deck + Blade Sharpening only, since the combustion-engine base checks
  don't apply). **A blank or unrecognized category always shows every
  field** — narrowing only happens for a category on the known list,
  never by default, so a typo or uncategorized entry never silently
  hides something. A per-entry `showAllFields` toggle overrides narrowing
  entirely regardless of category. Checklist data for a currently-hidden
  field is never lost — `liveChecklistState` holds every key's
  `{checked, note}` independent of which rows are rendered.
- **`source`, UI-labeled "Performed By" (field name unchanged).**
  Reflects the app's shift toward being an active work-order tool, not
  just a knowledge log — the field now tracks who did the work, not
  where the knowledge came from. `SOURCE_LABELS` values: `dad`→"Dad"
  (unchanged), `experience`→**"Brian"** (label-only change, same key —
  existing entries need no data change), plus two new keys/options,
  `dad-brian`→"Dad/Brian" and `other`→"Other" (replacing the old
  `ai`/`manual` options, which had zero real entries using them, so no
  legacy-value fallback was needed). Kept as a single-select
  dropdown rather than checkboxes deliberately — "Dad/Brian" existing as
  its own discrete option only makes sense for single-select; checkboxes
  would make it redundant. Default for a new entry stays `dad`. Card
  badge (`source-mark`) and stat line render `SOURCE_LABELS[entry.source]`
  live at render time, so relabeling here updated every existing card
  immediately with no migration. Status filter chip row also had a
  missing "Waiting on Quote" chip added at the same time (the dropdown/
  badge already had it; the filter chip row didn't).
- **Checklist items** (`CHECKLIST_ITEMS`, 12 items): Fuel Additive was
  removed (recommended verbally, not tracked as a checklist item — old
  entries' `fuelAdditive` data is untouched, just no longer rendered).
  Oil Change is relabeled "Oil" so either "checked" or "changed" fits the
  note.
- **Brand fields:** `equipmentBrand` and `engineBrand`, split out from
  `equipmentModel`/`engineModel` (which used to have the brand typed
  directly into the model field).
- **`title`**, UI-labeled "Diagnosis" (field name unchanged) — no longer
  drives the board title (see `primaryComplaint` below); shows as the
  card's preview line instead, and has its own detail-drawer section
  (between Diagnostic Steps and The Fix). `partsUsed` is labeled "Parts,"
  meant to hold parts still needed/quoted too, not just parts already
  used.
- **`primaryComplaint`** — short, concise summary field in the Customer
  section (e.g. "won't start"), distinct from the longer freeform
  `customerRequest` textarea ("what the customer said," which tends to
  run longer than a title should). Card `<h3>` headline and detail-drawer
  header both read `primaryComplaint || title || customerName ||
  'Untitled entry'`. **PWA-only** — see field list above.
- **Collapsible form sections:** Customer, Equipment, and Service
  Checklist headers in the add/edit sheet are tappable
  (`toggleFormSection()`) to collapse/expand; all three always start
  expanded on open (no persisted state — a per-session scroll-reduction
  convenience). Generic helper, so wrapping additional sections later is
  a one-line change.
- **Add/edit form field order:** Status + Performed By (top row, field
  name still `source`) → Customer →
  Equipment → Photos → "The Work" (Likely Causes, Diagnostic Steps,
  Service Checklist, Diagnosis, Parts, The Fix) → Notes. Photos sit right
  after Equipment since they're usually taken while looking at the
  equipment, not at the end of data entry. Diagnosis (`title`)
  deliberately sits *after* Likely Causes/Diagnostic Steps/Checklist —
  it's the concise conclusion written once the rest is worked through,
  not a first-guess symptom field.
- **Board card:** Category filter chip row (`categoryFilter`/
  `renderCategoryFilters()`) replaced the old Engine filter; card badge
  shows `equipmentCategory` (`.category-badge`, was `.engine-badge`).
  Engine brand/model/code are unchanged everywhere else — still on the
  form, in the detail drawer, and searchable, just off the card/filter
  row. Card preview text (`.preview`) is clamped to 2 lines via
  `-webkit-line-clamp` and pulls from `title || fix || causes` (once
  `primaryComplaint` became the headline, Diagnosis became the natural
  lead-in for "what happened"). `customerRequest` was dropped as a
  fallback since it tends to just restate the complaint in different
  words.
- **Data-safety details, all in `pwa/app.js`:**
  - Sync baseline saves immediately after a successful push, not after
    photo sync completes — a photo-sync failure no longer leaves a stale
    baseline that could manufacture a false conflict on the next sync.
  - Conflict-duplicate IDs are deterministic
    (`olderId-conflict-<older.updatedAt>`), so re-running the merge on
    the same disagreement converges on the same record instead of
    minting a new one each time.
  - `deleteEntry()` never deletes a photo blob another surviving entry
    still references — it builds a set of every photo ID still in use
    first. Matters especially for conflict-duplicate entries, which are
    copies of an older version of another entry and often still list the
    same photo IDs. This same safety check also covers waiver photos.
  - Save/photo-attach failures (e.g. device storage full) show a message
    instead of failing silently.
  - `navigator.storage.persist()` is requested on load (best-effort) to
    reduce the chance of IndexedDB eviction under storage pressure.
  - Settings → Maintenance → "Clean up old deleted entries…"
    (`cleanUpOldRecords()`) removes only tombstoned entries and
    conflict-duplicate copies untouched for 90+ days (`CLEANUP_AGE_MS`),
    warns to confirm other devices have synced recently first, and (when
    signed in) edits the OneDrive file directly to drop the same IDs
    remotely — a normal merge can't distinguish "never had this id" from
    "deliberately removed it" and would just pull the purged records
    back down.
- **`pwa/index.html` + `pwa/style.css` + `pwa/app.js`** — split from a
  single ~1,950-line HTML file once that hurt more than the
  zero-build-step simplicity helped. Plain `<link>`/`<script src>` tags,
  no bundler. `service-worker.js`'s `APP_SHELL` cache list includes both
  — remember this any time a new top-level file gets added, or it won't
  be available offline.
- Storage is IndexedDB (entries + photo blobs) — no backend, since
  GitHub Pages is static-only.
- **Manual JSON export** (`exportAllData()`, Settings → Backup) bundles
  every entry plus all photo blobs (base64) into one timestamped
  downloadable file — a portable backup independent of OneDrive/
  Microsoft entirely, added as a safety net given the user's past
  experience losing data to unreachable backends.
- Camera capture uses `<input type="file" capture="environment">`, not
  `getUserMedia` — more reliable across iOS Safari + Android Chrome than
  a live stream.
- **Cache-busting + update banner:** the GitHub Actions workflow stamps a
  `__VERSION__` placeholder in `service-worker.js` with the deploy's
  commit hash, so every real push forces a fresh cache. The app shows a
  "new version available" banner and only reloads when the user taps
  Refresh — the `self.skipWaiting()` omission in the install handler is
  intentional and required for this flow.
- Single-work-order-at-a-time interface (no tabs) — deliberate given
  phone screen size, confirmed with the user rather than assumed.
- **Back button closes the open entry/photo, not the app** — uses
  `history.pushState`/`popstate` with a small view stack (board → sheet →
  lightbox). Opening a brand-new unsaved entry sets `sheetIsNewUnsaved`;
  back on that state confirms discard first (existing/saved entries close
  on back with no confirm, matching desktop's tab-close scope).
- **Photo lightbox** supports prev/next + swipe between an entry's
  photos, plus "Set as cover" — reorders `photos[]` so the chosen photo
  becomes index 0 (no separate cover field).
- **OneDrive sessions lapse every ~24h by design, not a bug** — Azure's
  SPA redirect-URI app type gets a fixed, non-adjustable ~24-hour refresh
  token lifetime regardless of usage. Once lapsed, `acquireTokenSilent()`
  fails but `isSignedIn()` stays true (only the token expired), so
  syncing quietly stops working with no prompt on its own — hence the
  header "Reconnect OneDrive" button (shown when this device has
  connected before and isn't currently synced/syncing;
  `ONEDRIVE_EVER_CONNECTED_KEY` in localStorage, separate from
  `SYNC_LAST_KEY` so it survives a lapsed token but clears on an
  intentional Disconnect). The alternative — registering as a "public
  client" (native/mobile) app for 90-day rolling tokens — was rejected
  since it requires clunky device-code auth (visit a URL, type a code)
  instead of the current one-tap redirect; not worth it for a
  once-a-day tap.
- **Header is icon-only** — the persistent "BENCH NOTES" `<h1>` was
  dropped once the Reconnect button needed the room; decided the title
  wasn't earning its space for a single-screen app the user already
  knows they're in. Tapping the header icon opens a lightbox
  (`openIconLightbox()`/`closeIconLightbox()`) showing the icon, the
  title, and a short appreciation note in italics ("Knowledge gained
  from dad. Thank you for this wonderful opportunity.") — an easter egg
  for Dad if he ends up using this on his phone.
- **"Electric" equipment category** doesn't get `CHECKLIST_BASE` (those
  are combustion-engine checks) — `CATEGORY_CHECKLIST_FULL` lets a
  category define its entire visible checklist instead of the usual
  base-plus-extras. "Show all fields" still overrides it like any other
  category.
- Deployed to GitHub Pages, tested on a real Android phone including
  home-screen install. Outstanding: offline/airplane-mode test, and
  getting it in front of Dad's iPhone — see `TODO.md`.

## Waiver feature

In-app Idaho repair-shop waiver, adapted from the user's own uploaded/
edited docx — Claude did not draft the legal language. The
digital/paper *mechanisms* (not just the wording) are pending the user's
attorney review before real customers use this.

- Business name (K&M Small Engines) and pricing ($25 diagnostic, $10/day
  storage) are hardcoded constants in `pwa/app.js` (`BUSINESS_NAME`,
  `DIAGNOSTIC_FEE`, `STORAGE_FEE_PER_DAY`), not a Settings field —
  deliberate: the business name is already publicly findable, so
  Settings wasn't protecting anything, and both values are stable enough
  to not need "one more setting to remember to fill in."
- `WAIVER_VERSIONS` is versioned on purpose — an entry's `waiver.version`
  locks in exactly which wording that customer agreed to. **Never edit
  an existing version's text** — bump `CURRENT_WAIVER_VERSION` to a new
  key instead, or every past signature silently stops matching what it
  actually agreed to.
- The text shown while signing (digital) and the text that prints
  (either path) come from the same `buildWaiverText()` call — customer
  name, equipment, serial, date, and reported problem all live-merged
  in, never a generic template shown separately from the specifics. A
  customer should never see two different versions of "their" waiver.
- Placement follows the actual counter workflow: Customer → Equipment →
  **Waiver** → Photos → rest of form. The sign screen is a dedicated
  full-screen view with nothing else of the app reachable while it's
  open (the customer physically holds the phone), and ends with "Thank
  you for trusting us with your equipment!" before returning control.
- Two signing paths, both producing a durable record: **digital**
  (`signatureType:'digital'`, scroll-to-bottom unlocks the agree
  checkbox, typed full name, timestamp) and **physical**
  (`signatureType:'physical'`, `photoIds[]` — plural, since a multi-page
  waiver needs more than one photo; "Print for Physical Signature"
  creates the record immediately with an empty array, so status persists
  as "Printed — attach photo once signed" across the gap between
  printing and getting photos back). Waiver photos reuse the existing
  photo capture/compression pipeline but are tracked separately from
  `entry.photos`, so they surface inside the Waiver section specifically.
- Printing uses `window.print()` + `@media print` CSS scoped to a hidden
  `#printableWaiver` container — no PDF library, consistent with the
  app's zero-build-step architecture; "Save as PDF" from the browser's
  print dialog covers export for free.

## What's realistically next

`TODO.md` is the live, open-only task list — check it, not this section,
for what's actually outstanding. Two things worth stating plainly here
since they're easy to get backwards:

- **OneDrive sync (PWA) is built and tested** — sign-in, merge, photos,
  restore, and disconnect have all been exercised for real. Don't treat
  it as unbuilt.
- **Desktop work is halted, not an open gap to close.** See "Working
  agreements" above — don't propose closing desktop parity gaps or start
  desktop OneDrive sync work.
