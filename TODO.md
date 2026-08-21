# Bench Notes — Things to Do at the Computer

This file tracks **open work only**. Once something is built and confirmed
working, it comes off this list entirely — the history lives in git and in
PROJECT_NOTES.md's rationale sections, not here.

## Desktop app — testing (built, halted — see PROJECT_NOTES "Working agreements")
Desktop launches and its existing features haven't been feature-tested.
Per the halt directive, don't fix anything found broken without asking first —
just report it.
- [ ] New entry: text fields, source tags, engine model/code
- [ ] Service Checklist (checkbox + note shows in read-only preview and in
      saved "The Fix" block)
- [ ] Attach from files… / Take photo… (webcam) / delete a photo
- [ ] Close a new/unsaved tab → discard prompt appears
- [ ] Change folder… points storage somewhere new correctly
- [ ] Custom confirm/alert popups (delete, discard, title-required, folder-changed)
- [ ] Delete an entry → disappears from board/stats/filter (tombstone-based)
- [ ] `npm run dist` → build the real `.exe`, run the installer, confirm
      Start Menu + desktop icon
- [ ] Decide the permanent data folder location

## Known gaps — desktop halted, not currently actionable
Desktop's stated future is likely removal, not being brought current — see
PROJECT_NOTES "Working agreements." These are noted so they aren't
rediscovered from scratch if desktop is ever un-halted, not live todos.
- PWA-only fields not on desktop: `status`/`completedAt`, `equipmentCategory`/
  `equipmentBrand`/`engineBrand`/`showAllFields`, `primaryComplaint`. Old/
  synced-in entries without these degrade gracefully today.
- Desktop OneDrive sync not started (needs a device-code flow — embedded
  login windows aren't available in Electron).
- Local filename convention mismatch: desktop's local file is
  `bench_notes_data.json` (underscore), OneDrive's App Folder file is
  `bench-notes-data.json` (hyphen). Harmless while desktop doesn't sync
  through Graph, but pick one before it does.

## Open, not desktop-related
- [ ] Add a `schemaVersion` field to the entry format for future-proofing

## PWA — untested since last built (all verified for syntax only, not tried in a browser)
- [ ] Data-safety pass: force a real sync conflict, confirm baseline doesn't
      go stale and a resolved conflict doesn't regenerate a duplicate
- [ ] Delete a conflict-duplicate entry that shares photos with the kept
      entry — confirm the kept entry's photos survive
- [ ] Save/attach a photo with device storage genuinely low — confirm a
      message shows instead of silent failure
- [ ] "Performed By" (was "Source"): dropdown shows Dad/Brian/Dad-Brian/
      Other, defaults to Dad on a new entry, existing entries tagged
      `experience` now show "Brian" on their card with no data change
      needed, and the Dad-Brian/Other filter chips work
- [ ] Status filter row: confirm the newly-added "Waiting on Quote" chip
      filters correctly alongside the other four

## Mobile PWA
- [ ] Send the link to Dad, test Safari → Share → Add to Home Screen on his iPhone
- [ ] Confirm a deletion tombstone actually removes the entry on a second
      device after both have synced (not yet directly tested)

## Waiver feature — built, pending real-world + legal sign-off
Idaho repair-shop waiver, adapted from the user's own docx — not
Claude-drafted. **Pending the user's attorney reviewing both signing flows
before use with real customers.** PWA only; desktop is halted.
- [ ] Digital signing on a real phone: scroll-to-unlock-checkbox feels right
      in practice, merged text reads naturally with real data
- [ ] "Print for Physical Signature" from an actual phone browser: print/
      save-as-PDF is legible, attaching 2+ photos (front/back) works
- [ ] Delete an entry with attached waiver photos: photos are cleaned up (or
      correctly preserved if a conflict-duplicate still references them)
- [ ] Attorney review of both signing flows (not just the wording — the
      mechanism itself needs sign-off)

## Candidates for removal — outdated code, kept intentionally for now
Revisit later rather than delete blind; move out of this list (and delete
the code) once the reasoning is confirmed, or strike it if a reason to keep
it turns up.
- **PWA "Compress older photos" backfill** (`compressExistingPhotos()`,
  Settings → Backup) — nothing to do today (both real entries already
  compressed), but kept until desktop OneDrive sync exists, since
  desktop-attached photos would start arriving uncompressed once it does.
- **Desktop webcam "Take photo…"** (`getUserMedia`-based, never tested) —
  unlikely to see real use since phone photos are the realistic path, but
  not removed on a guess alone; revisit once desktop's had real use.

## Future idea: QuickBooks invoice export via IIF — not started
Confirmed path: QuickBooks Pro 2014 (Desktop) has no REST API, so export is
an **IIF file** (File → Utilities → Import → IIF Files) — a stable, purely
local format since QuickBooks 2000, not an Intuit-hosted service. An entry's
customer info, parts used, and fix description would map to the IIF's
customer/line-item structure.

Real caveats: the `TRNS`/`SPL` row format is finicky with limited error
checking (can import silently wrong), IIF behavior has drifted release to
release so this needs testing against the actual installed Pro 2014 copy,
it's a manual export/import step each time, and QuickBooks should be backed
up before each import (not easily undoable).

Not urgent — don't build opportunistically without being asked.

## Known rough edges (not urgent)
- Attaching a photo while editing, then hitting Cancel instead of Save,
  leaves that image file on disk unused. Harmless, just a loose end.

---
*Add to this list any time — just tell me what to add or check off.*
