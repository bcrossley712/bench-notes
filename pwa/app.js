// ---------- Custom modal (replaces native alert()/confirm()) ----------
function showAlert(message, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalMessage').textContent = message;
    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    const okBtn = document.createElement('button');
    okBtn.className = 'modal-btn confirm';
    okBtn.textContent = opts.okLabel || 'OK';
    okBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(); };
    actions.appendChild(okBtn);
    overlay.classList.add('open');
    okBtn.focus();
  });
}

function showConfirm(message, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalMessage').textContent = message;
    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn cancel';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    cancelBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(false); };
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn confirm' + (opts.danger === false ? '' : ' danger');
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    confirmBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(true); };
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    overlay.classList.add('open');
    confirmBtn.focus();
  });
}

// For genuinely destructive actions where a single accidental tap
// shouldn't be enough — the confirm button stays disabled until the
// person types the exact required word (e.g. "DELETE").
function showTypedConfirm(message, requiredText, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    const overlay = document.getElementById('modalOverlay');
    const msgEl = document.getElementById('modalMessage');
    msgEl.textContent = '';
    msgEl.appendChild(document.createTextNode(message));

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.placeholder = `Type ${requiredText} to confirm`;
    input.style.marginTop = '12px';
    msgEl.appendChild(input);

    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn cancel';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    cancelBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(false); };
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn confirm danger';
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    confirmBtn.disabled = true;
    confirmBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(true); };
    input.oninput = ()=>{ confirmBtn.disabled = (input.value.trim() !== requiredText); };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    overlay.classList.add('open');
    input.focus();
  });
}

// Small helper: JS timestamp -> the local string format <input
// type="datetime-local"> expects.
function toDatetimeLocalValue(ts){
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// For backdating/correcting a timestamp (currently just completedAt) —
// deliberately separate from the normal add/edit form, since this is an
// occasional deliberate override, not something that should sit in the
// everyday editing flow.
function showDateTimePrompt(message, initialTimestamp, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    const overlay = document.getElementById('modalOverlay');
    const msgEl = document.getElementById('modalMessage');
    msgEl.textContent = '';
    msgEl.appendChild(document.createTextNode(message));

    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.value = toDatetimeLocalValue(initialTimestamp || Date.now());
    input.style.marginTop = '12px';
    msgEl.appendChild(input);

    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn cancel';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    cancelBtn.onclick = ()=>{ overlay.classList.remove('open'); resolve(null); };
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn confirm';
    confirmBtn.textContent = opts.confirmLabel || 'Save';
    confirmBtn.onclick = ()=>{
      const val = input.value ? new Date(input.value).getTime() : null;
      overlay.classList.remove('open');
      resolve(val);
    };
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    overlay.classList.add('open');
    input.focus();
  });
}

// ---------- OneDrive sync ----------
// Design (see PROJECT_NOTES.md "Sync plan"): sign in with a single shared
// Microsoft account across all devices; read/write one JSON file inside
// OneDrive's App Folder (Files.ReadWrite.AppFolder scope — this app only
// ever sees its own hidden Apps/Bench Notes folder, nothing else in the
// account). Every sync pulls the remote file, merges it with local data by
// entry id (never a blind overwrite), writes the merged result back to
// both IndexedDB and OneDrive. Local data is always fully usable offline —
// sync is a background add-on, never a requirement to use the app.
//
// Photos sync too (see "Photo sync" below) — individual files in a
// photos/ App Folder subfolder, uploaded/downloaded/cleaned up
// incrementally after entries have merged, not embedded in this same
// JSON. Compression happens at capture time, not here (see "Photo
// compression backfill" below for photos that predate that).

const MSAL_CLIENT_ID = 'a224822b-7b19-40b9-b504-8596a2add3be';
const ONEDRIVE_SCOPES = ['Files.ReadWrite.AppFolder'];
const APP_FOLDER_FILE = 'bench-notes-data.json';
const SYNC_BASELINE_KEY = 'bn_sync_baseline';
const SYNC_LAST_KEY = 'bn_last_synced';

let msalInstance = null;
let syncInProgress = false;

// NOTE: earlier comments/notes described a standalone, unit-tested
// sync-build/mergeEntries.js as the canonical reference this function is
// kept in sync with by hand. Confirmed via full git history that file
// never actually existed in this repo — this is the only copy.
function mergeEntries(localEntries, remoteEntries, baseline){
  baseline = baseline || {};
  const localById = new Map(localEntries.map(e => [e.id, e]));
  const remoteById = new Map(remoteEntries.map(e => [e.id, e]));
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged = [];
  const conflicts = [];
  const newBaseline = {};

  for(const id of allIds){
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if(local && !remote){
      merged.push(local);
      newBaseline[id] = local.updatedAt;
      continue;
    }
    if(remote && !local){
      merged.push(remote);
      newBaseline[id] = remote.updatedAt;
      continue;
    }

    const baselineTime = baseline[id];
    const localChanged = baselineTime === undefined || (local.updatedAt||0) > baselineTime;
    const remoteChanged = baselineTime === undefined || (remote.updatedAt||0) > baselineTime;

    if(local.deleted || remote.deleted){
      const winner = (local.updatedAt||0) >= (remote.updatedAt||0) ? local : remote;
      merged.push(winner);
      newBaseline[id] = winner.updatedAt;
      continue;
    }

    if(localChanged && remoteChanged && (local.updatedAt !== remote.updatedAt)){
      const [newer, older] = (local.updatedAt >= remote.updatedAt) ? [local, remote] : [remote, local];
      // Deterministic, not Date.now()-based: this exact conflict (same
      // older-entry id + the updatedAt it lost with) always produces the
      // same duplicateId. If the merge ever re-runs on inputs that still
      // look like this same disagreement (e.g. a delayed/retried sync),
      // it converges on the same duplicate record instead of minting a
      // brand-new one — no way to tell "already handled this" apart from
      // "this is new" otherwise, since nothing reads conflictOf anywhere.
      const duplicateId = older.id + '-conflict-' + older.updatedAt;
      const duplicate = {
        ...older, id: duplicateId,
        // Card headline now prefers primaryComplaint over title, so the
        // marker has to land on whichever field actually drives it —
        // otherwise a conflict copy could look identical to the entry it
        // duplicates from on the board.
        primaryComplaint: (older.primaryComplaint || older.title || older.customerName || 'Untitled entry') + ' (⚠ sync conflict copy)',
        title: older.title || '',
        conflictOf: newer.id, updatedAt: older.updatedAt
      };
      merged.push(newer, duplicate);
      newBaseline[newer.id] = newer.updatedAt;
      newBaseline[duplicateId] = duplicate.updatedAt;
      conflicts.push({id, keptId: newer.id, duplicateId});
      continue;
    }

    const winner = (local.updatedAt||0) >= (remote.updatedAt||0) ? local : remote;
    merged.push(winner);
    newBaseline[id] = winner.updatedAt;
  }

  return {merged, conflicts, newBaseline};
}

// orderNumber is stamped once at creation as (local max + 1) — computed
// only from what that device can see. Two devices creating NEW entries
// while offline from each other can independently hand out the same
// number to two different entries. mergeEntries() unions by id, so both
// entries survive intact, each still holding the number it was given —
// this is a second pass, run right after mergeEntries() and before the
// merged result is saved/pushed, that finds and fixes those collisions.
//
// Must be deterministic: there's no server to arbitrate, so both devices
// running this on the same merged set have to land on the identical
// resolution independently. Mutates entries in place; returns true if
// anything changed.
function resolveOrderNumberCollisions(entries){
  const byNumber = new Map();
  for(const e of entries){
    if(!e.orderNumber) continue;
    if(!byNumber.has(e.orderNumber)) byNumber.set(e.orderNumber, []);
    byNumber.get(e.orderNumber).push(e);
  }

  let maxNumber = entries.reduce((max, e) => e.orderNumber ? Math.max(max, e.orderNumber) : max, 0);
  let changed = false;

  for(const group of byNumber.values()){
    if(group.length < 2) continue;
    // Deterministic keeper: earliest createdAt keeps the number it was
    // first assigned; ties (shouldn't happen, but just in case) broken
    // by id so both devices agree without needing to compare anything
    // beyond what's already in each entry.
    const sorted = [...group].sort((a, b) => {
      const ca = a.createdAt || 0, cb = b.createdAt || 0;
      if(ca !== cb) return ca - cb;
      return String(a.id).localeCompare(String(b.id));
    });
    // Losers reassigned in that same fixed order, above the current max
    // — so both devices, running this independently on the same merged
    // set, hand out the exact same replacement numbers.
    for(let i = 1; i < sorted.length; i++){
      maxNumber += 1;
      sorted[i].orderNumber = maxNumber;
      changed = true;
    }
  }

  return changed;
}

async function initMsal(){
  try{
    msalInstance = await msal.createStandardPublicClientApplication({
      auth: {
        clientId: MSAL_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
        // Hardcoded, not derived from window.location: the installed PWA's
        // start_url (manifest.webmanifest) is "./index.html", which resolves
        // to a different URL than the bare folder URL registered in Azure —
        // deriving this dynamically caused a redirect_uri mismatch the first
        // time sign-in was tried from the home-screen icon. Must exactly
        // match the SPA redirect URI registered in the Azure app registration.
        redirectUri: 'https://bcrossley712.github.io/bench-notes/'
      },
      cache: { cacheLocation: 'localStorage' } // survives closing/reopening the installed PWA
    });
  }catch(err){
    console.error('MSAL init failed', err);
    setSyncBar('error', 'Sign-in unavailable');
    return;
  }

  let redirectResult = null;
  try{
    redirectResult = await msalInstance.handleRedirectPromise();
  }catch(err){
    console.error('Redirect handling failed', err);
  }

  if(redirectResult && redirectResult.account){
    msalInstance.setActiveAccount(redirectResult.account);
  } else {
    const accounts = msalInstance.getAllAccounts();
    if(accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);
  }

  updateSyncBarForState();
  if(isSignedIn()){
    syncNow(); // on-open sync only — no periodic background timer; also triggered by save/delete/restore and the manual "Sync now" button
  }
}

function isSignedIn(){
  return !!(msalInstance && msalInstance.getActiveAccount());
}

function onSyncButtonClick(){
  if(isSignedIn()){
    syncNow();
  } else {
    signInOneDrive();
  }
}

async function onSyncStatusClick(){
  if(!isSignedIn()) return;
  const ok = await showConfirm('Disconnect OneDrive on this device? Your local entries stay right here — this just stops this device from syncing until you sign in again.', {confirmLabel:'Disconnect', danger:false});
  if(ok) signOutOneDrive();
}

async function signInOneDrive(){
  if(!msalInstance) return;
  try{
    await msalInstance.loginRedirect({ scopes: ONEDRIVE_SCOPES });
    // Page navigates away here; handleRedirectPromise() on reload continues the flow.
  }catch(err){
    console.error('Sign-in failed', err);
    setSyncBar('error', 'Sign-in failed');
  }
}

async function signOutOneDrive(){
  if(!msalInstance) return;
  await msalInstance.logoutRedirect();
}

async function getAccessToken(){
  const account = msalInstance.getActiveAccount();
  if(!account) throw new Error('Not signed in');
  try{
    const result = await msalInstance.acquireTokenSilent({ scopes: ONEDRIVE_SCOPES, account });
    return result.accessToken;
  }catch(err){
    if(err instanceof msal.InteractionRequiredAuthError){
      await msalInstance.acquireTokenRedirect({ scopes: ONEDRIVE_SCOPES });
      return null; // page redirects away
    }
    throw err;
  }
}

// Retries once after the server-specified delay on HTTP 429 (throttled),
// per Microsoft's Graph throttling guidance. Essentially never expected to
// trigger at this app's request volume — cheap correctness to have anyway.
async function graphFetch(url, options){
  let res = await fetch(url, options);
  if(res.status === 429){
    const retryAfter = Number(res.headers.get('Retry-After')) || 2;
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    res = await fetch(url, options);
  }
  return res;
}

async function fetchRemoteFile(){
  const token = await getAccessToken();
  if(!token) return null; // redirecting for interactive auth
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${APP_FOLDER_FILE}:/content`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if(res.status === 404){
    return { entries: [] }; // nothing synced from any device yet
  }
  if(!res.ok){
    throw new Error('OneDrive read failed (' + res.status + ')');
  }
  return await res.json();
}

async function pushRemoteFile(payload){
  const token = await getAccessToken();
  if(!token) return false; // redirecting for interactive auth
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${APP_FOLDER_FILE}:/content`,
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
  if(!res.ok){
    throw new Error('OneDrive write failed (' + res.status + ')');
  }
  return true;
}

// ---------- Photo sync ----------
// Individual files in a photos/ subfolder inside the App Folder (mirrors
// how desktop already stores things locally: JSON + photos folder), not
// embedded in the same JSON as entries. This makes sync incremental — only
// new/changed photos transfer, not the whole photo library every time.
const APP_FOLDER_PHOTOS_PATH = 'photos';
const SIMPLE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // Graph's one-shot upload ceiling
const UPLOAD_CHUNK_SIZE = 3200 * 1024; // 3.2MB — a multiple of 320 KiB as Microsoft recommends

async function listRemotePhotoFilenames(){
  const token = await getAccessToken();
  if(!token) return null;
  let url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${APP_FOLDER_PHOTOS_PATH}:/children?$select=name&$top=200`;
  const names = new Set();
  while(url){
    const res = await graphFetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if(res.status === 404){
      return names; // photos/ folder doesn't exist yet — nothing uploaded from any device so far
    }
    if(!res.ok) throw new Error('OneDrive photo listing failed (' + res.status + ')');
    const data = await res.json();
    (data.value || []).forEach(item => names.add(item.name));
    url = data['@odata.nextLink'] || null;
  }
  return names;
}

async function uploadPhotoBlob(filename, blob){
  const token = await getAccessToken();
  if(!token) return false;
  const path = `${APP_FOLDER_PHOTOS_PATH}/${filename}`;

  if(blob.size <= SIMPLE_UPLOAD_MAX_BYTES){
    const res = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${path}:/content`,
      { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': blob.type || 'image/jpeg' }, body: blob }
    );
    if(!res.ok) throw new Error('Photo upload failed (' + res.status + ')');
    return true;
  }

  // Bigger than the simple-upload ceiling (rare after compression, but
  // possible): chunked upload session instead of a single PUT.
  const sessionRes = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${path}:/createUploadSession`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } })
    }
  );
  if(!sessionRes.ok) throw new Error('Could not start photo upload session (' + sessionRes.status + ')');
  const { uploadUrl } = await sessionRes.json();

  let offset = 0;
  while(offset < blob.size){
    const end = Math.min(offset + UPLOAD_CHUNK_SIZE, blob.size);
    const chunk = blob.slice(offset, end);
    const chunkRes = await graphFetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(end - offset),
        'Content-Range': `bytes ${offset}-${end - 1}/${blob.size}`
      },
      body: chunk
    });
    if(!chunkRes.ok && chunkRes.status !== 202){
      throw new Error('Photo upload chunk failed (' + chunkRes.status + ')');
    }
    offset = end;
  }
  return true;
}

async function downloadPhotoBlob(filename){
  const token = await getAccessToken();
  if(!token) return null;
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${APP_FOLDER_PHOTOS_PATH}/${filename}:/content`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if(!res.ok) throw new Error('Photo download failed (' + res.status + ')');
  return await res.blob();
}

async function deleteRemotePhoto(filename){
  const token = await getAccessToken();
  if(!token) return false;
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${APP_FOLDER_PHOTOS_PATH}/${filename}`,
    { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }
  );
  if(!res.ok && res.status !== 404) throw new Error('Photo delete failed (' + res.status + ')');
  return true;
}

// Called after entries have merged, so `mergedEntries` reflects the final,
// post-merge set of photos[] references across both devices (a tombstoned
// entry already has photos:[] cleared, so its old photos naturally fall out
// of the "referenced" set below and get cleaned up remotely).
async function syncPhotos(mergedEntries){
  const referenced = new Set();
  mergedEntries.forEach(e => (e.photos || []).forEach(id => referenced.add(id)));

  const remoteNames = await listRemotePhotoFilenames();
  if(remoteNames === null) return; // redirected for auth mid-flow

  const localPhotoRecords = await idbGetAll('photos');
  const localById = new Map(localPhotoRecords.map(p => [p.id, p]));

  // Upload: referenced, exists locally, not yet on OneDrive.
  for(const id of referenced){
    const filename = id + '.jpg';
    if(remoteNames.has(filename)) continue;
    const record = localById.get(id);
    if(!record) continue; // referenced but this device doesn't have it — handled by download below
    await uploadPhotoBlob(filename, record.blob);
  }

  // Download: referenced, exists on OneDrive, missing on this device.
  for(const id of referenced){
    const filename = id + '.jpg';
    if(localById.has(id)) continue;
    if(!remoteNames.has(filename)) continue;
    const blob = await downloadPhotoBlob(filename);
    if(blob) await idbPut('photos', { id, blob, mimeType: 'image/jpeg', filename });
  }

  // Clean up: exists on OneDrive, no longer referenced by any surviving entry.
  for(const name of remoteNames){
    const id = name.replace(/\.jpg$/, '');
    if(!referenced.has(id)){
      await deleteRemotePhoto(name);
    }
  }
}

async function syncNow(){
  if(!isSignedIn() || syncInProgress) return;
  syncInProgress = true;
  setSyncBar('syncing', 'Syncing…');
  try{
    const localRaw = await idbGetAll('entries'); // includes tombstones
    const storedBaseline = JSON.parse(localStorage.getItem(SYNC_BASELINE_KEY) || '{}');

    const remotePayload = await fetchRemoteFile();
    if(remotePayload === null){ syncInProgress = false; return; } // redirected for auth

    const { merged, newBaseline } = mergeEntries(localRaw, remotePayload.entries || [], storedBaseline);
    if(resolveOrderNumberCollisions(merged)){
      console.warn('Sync found duplicate work order numbers (likely created offline on two devices) — reassigned automatically.');
    }

    for(const entry of merged){
      await idbPut('entries', entry);
    }

    const pushed = await pushRemoteFile({ entries: merged, syncedAt: Date.now() });
    if(!pushed){ syncInProgress = false; return; } // redirected for auth

    // Entries are now durably merged, saved locally, AND pushed to OneDrive —
    // the baseline must be saved right now, not after photo sync. Photo sync
    // failing (a single flaky upload/download) used to leave the OLD baseline
    // in place despite entries already having moved on, which made the next
    // sync miscompare "changed since baseline" and could manufacture a false
    // conflict/duplicate out of an already-resolved entry. Baseline durability
    // is tied to the entries write, not to photos.
    localStorage.setItem(SYNC_BASELINE_KEY, JSON.stringify(newBaseline));

    try{
      await syncPhotos(merged);
    }catch(photoErr){
      // Don't let a photo hiccup mark the whole sync as failed or roll back
      // the (already-correct) baseline above — entries are the source of
      // truth for conflict detection; photos are best-effort and will pick
      // up any stragglers on the next sync via the normal referenced/local/
      // remote diff in syncPhotos().
      console.error('Photo sync failed (entries already synced)', photoErr);
      localStorage.setItem(SYNC_LAST_KEY, String(Date.now()));
      await loadEntries();
      setSyncBar('error', 'Entries synced — photo sync failed, will retry');
      syncInProgress = false;
      return;
    }

    localStorage.setItem(SYNC_LAST_KEY, String(Date.now()));

    await loadEntries(); // refresh the visible board from IndexedDB
    setSyncBar('synced');
  }catch(err){
    console.error('Sync failed', err);
    setSyncBar('error', 'Sync failed — will retry');
  }finally{
    syncInProgress = false;
  }
}

function formatLastSynced(){
  const raw = localStorage.getItem(SYNC_LAST_KEY);
  if(!raw) return 'Never synced';
  const diffMs = Date.now() - Number(raw);
  const mins = Math.round(diffMs / 60000);
  if(mins < 1) return 'Synced just now';
  if(mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins/60);
  if(hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${Math.round(hrs/24)}d ago`;
}

function setSyncBar(state, message){
  const gearDot = document.getElementById('settingsGearDot');
  const panelDot = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');
  const btn = document.getElementById('syncActionBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');

  gearDot.className = 'dot state-' + state;
  panelDot.className = 'dot state-' + state;
  text.classList.toggle('clickable', state === 'synced');
  // Checked directly rather than trusting `state`: setSyncBar('error', ...)
  // also fires from a *failed* sign-in attempt, when the device was never
  // actually signed in — the button should stay hidden in that case.
  disconnectBtn.style.display = isSignedIn() ? 'inline-block' : 'none';

  if(state === 'synced'){
    text.textContent = formatLastSynced();
    btn.textContent = 'Sync now';
  } else if(state === 'syncing'){
    text.textContent = message || 'Syncing…';
    btn.textContent = 'Sync now';
  } else if(state === 'error'){
    text.textContent = message || 'Sync error';
    btn.textContent = 'Retry';
  } else {
    text.textContent = 'Not signed in';
    btn.textContent = 'Connect OneDrive';
  }
}

function updateSyncBarForState(){
  if(isSignedIn()){
    setSyncBar(localStorage.getItem(SYNC_LAST_KEY) ? 'synced' : 'syncing');
  } else {
    setSyncBar('offline');
  }
}

function openSettings(){
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings(){
  document.getElementById('settingsOverlay').classList.remove('open');
}

function openIconLightbox(){
  document.getElementById('iconLightboxOverlay').classList.add('open');
}
function closeIconLightbox(){
  document.getElementById('iconLightboxOverlay').classList.remove('open');
}

// ---------- IndexedDB ----------
const DB_NAME = 'benchNotesDB';
const DB_VERSION = 1;
let dbPromise = null;

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', {keyPath:'id'});
      if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', {keyPath:'id'});
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
  return dbPromise;
}

async function idbGetAll(storeName){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbPut(storeName, value){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

async function idbDelete(storeName, id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

async function idbGet(storeName, id){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbClear(storeName){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

// ---------- Backup export & restore ----------
function blobToBase64(blob){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onloadend = ()=>resolve(reader.result.split(',')[1]); // strip data: prefix
    reader.onerror = ()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType){
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for(let i=0; i<byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], {type: mimeType || 'image/jpeg'});
}

function triggerRestoreInput(){
  document.getElementById('hiddenRestoreInput').click();
}

// Restoring reuses the exact same merge-by-id logic as OneDrive sync,
// treating the backup file like a remote peer's data with no known
// baseline. That means restoring never blindly overwrites what's already
// on the device — an entry only present in the backup gets added back, an
// entry that exists in both places keeps whichever is newer, and a true
// conflict (same entry, different content, no way to tell which is
// "right") gets preserved as a flagged duplicate instead of silently
// picking one, exactly like a normal sync conflict would.
async function handleRestoreFile(event){
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if(!file) return;

  let payload;
  try{
    payload = JSON.parse(await file.text());
  }catch(err){
    await showAlert("That file doesn't look like a valid Bench Notes backup (couldn't read it as JSON).");
    return;
  }
  if(!payload || !Array.isArray(payload.entries)){
    await showAlert("That file doesn't look like a valid Bench Notes backup (missing an entries list).");
    return;
  }

  const entryWord = payload.entries.length === 1 ? 'entry' : 'entries';
  const ok = await showConfirm(
    `Restore from this backup? It contains ${payload.entries.length} ${entryWord}` +
    (payload.exportedAt ? ` from ${new Date(payload.exportedAt).toLocaleDateString()}` : '') +
    `.\n\nThis merges with what's already on this device — nothing already here gets deleted, and if the same entry differs between the two, both versions are kept so you can review them.`,
    {confirmLabel:'Restore', danger:false}
  );
  if(!ok) return;

  const btn = document.getElementById('restoreBtn');
  const originalLabel = btn.textContent;
  btn.textContent = 'Restoring…';
  btn.disabled = true;
  try{
    const localRaw = await idbGetAll('entries');
    // No baseline: we have no idea what was "last synced" against this
    // backup, so any same-id difference is treated as a genuine conflict
    // rather than assumed to be a one-sided change.
    const { merged, conflicts } = mergeEntries(localRaw, payload.entries, {});
    if(resolveOrderNumberCollisions(merged)){
      console.warn('Restore found duplicate work order numbers — reassigned automatically.');
    }
    for(const entry of merged){
      await idbPut('entries', entry);
    }

    let photosRestored = 0;
    if(Array.isArray(payload.photos)){
      const existingPhotoIds = new Set((await idbGetAll('photos')).map(p=>p.id));
      for(const p of payload.photos){
        if(existingPhotoIds.has(p.id)) continue; // already have this one locally
        if(!p.dataBase64) continue;
        const blob = base64ToBlob(p.dataBase64, p.mimeType);
        await idbPut('photos', {id: p.id, blob, mimeType: p.mimeType || 'image/jpeg', filename: p.filename || (p.id + '.jpg')});
        photosRestored++;
      }
    }

    await loadEntries();
    if(isSignedIn()){
      // Deliberately reset the baseline before syncing: without this, syncNow()
      // would merge against the stale pre-restore baseline, which lets a
      // corrupted-but-newer remote entry silently win and overwrite the very
      // data we just restored. Clearing it forces the same conflict-safe
      // treatment used above (baseline={}) — any real difference between the
      // restored data and what's on OneDrive becomes a flagged duplicate for
      // review, never a silent overwrite in either direction.
      localStorage.setItem(SYNC_BASELINE_KEY, '{}');
      syncNow(); // let the restored data propagate to OneDrive/other devices too
    }

    let message = `Restore complete. ${photosRestored} photo(s) added.`;
    if(conflicts.length > 0){
      message += `\n\n${conflicts.length} entr${conflicts.length===1?'y':'ies'} existed in both places with different content — both versions were kept (look for "⚠ sync conflict copy" in the title) so you can compare and delete whichever you don't need.`;
    }
    await showAlert(message);
  }catch(err){
    console.error('Restore failed', err);
    await showAlert('Restore failed: ' + (err && err.message ? err.message : err));
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}
document.getElementById('hiddenRestoreInput').addEventListener('change', handleRestoreFile);

async function exportAllData(){
  const btn = document.getElementById('exportBtn');
  const originalLabel = btn.textContent;
  btn.textContent = 'Exporting…';
  btn.disabled = true;
  try{
    const allEntries = await idbGetAll('entries');
    const allPhotos = await idbGetAll('photos');
    const photosOut = [];
    for(const p of allPhotos){
      photosOut.push({
        id: p.id,
        filename: p.filename,
        mimeType: p.mimeType,
        dataBase64: await blobToBase64(p.blob)
      });
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'bench-notes-pwa',
      entries: allEntries,
      photos: photosOut
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `bench-notes-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(err){
    console.error('Export failed', err);
    await showAlert('Export failed: ' + (err && err.message ? err.message : err));
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}

// ---------- Photo compression backfill ----------
// Compression (compressImage()) only ever ran at capture time, starting
// with the build that added it — any photo attached before that still sits
// in IndexedDB at its original camera resolution and always will, since
// nothing else ever revisits already-stored photos. This is a one-time,
// on-demand pass that finds those old photos and brings them in line with
// what a new photo would look like today.
async function compressExistingPhotos(){
  const btn = document.getElementById('compressPhotosBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  // Anything already under this is assumed to already be compressed (or
  // was always small) — skip it rather than pay for a second lossy JPEG
  // re-encode for no real size benefit.
  const SKIP_UNDER_BYTES = 700 * 1024;

  try{
    const allPhotos = await idbGetAll('photos');
    const candidates = allPhotos.filter(p => p.blob && p.blob.size > SKIP_UNDER_BYTES);

    if(candidates.length === 0){
      await showAlert('No photos needed compressing — everything already looks compressed.');
      return;
    }

    const ok = await showConfirm(
      `This will recompress ${candidates.length} older photo(s) that predate automatic compression. ` +
      `They'll shrink locally right away` +
      (isSignedIn() ? ', and re-upload to OneDrive to shrink there too.' : '.') +
      ` This can take a little while on a phone — keep the app open until it finishes.`,
      {confirmLabel: 'Compress now', danger: false}
    );
    if(!ok) return;

    let bytesBefore = 0, bytesAfter = 0, uploadFailures = 0;
    for(let i = 0; i < candidates.length; i++){
      const p = candidates[i];
      btn.textContent = `Compressing ${i + 1} of ${candidates.length}…`;
      bytesBefore += p.blob.size;

      let newBlob;
      try{
        newBlob = await compressImage(p.blob);
      }catch(err){
        console.error('Compression failed for photo', p.id, err);
        bytesAfter += p.blob.size; // left unchanged, still counts toward the total
        continue;
      }
      bytesAfter += newBlob.size;

      const filename = p.filename || (p.id + '.jpg');
      await idbPut('photos', {id: p.id, blob: newBlob, mimeType: 'image/jpeg', filename});

      if(isSignedIn()){
        // syncPhotos() alone won't re-upload this: it only uploads photos
        // missing from OneDrive by filename, and this filename already
        // exists remotely (the old, bigger version). Uploading directly
        // overwrites it in place.
        try{
          await uploadPhotoBlob(filename, newBlob);
        }catch(err){
          console.error('Re-upload failed for photo', p.id, err);
          uploadFailures++;
        }
      }
    }

    await loadEntries(); // refresh any cached photo URLs on screen
    const savedMB = ((bytesBefore - bytesAfter) / 1024 / 1024).toFixed(1);
    let message = `Compressed ${candidates.length} photo(s), saving about ${savedMB}MB locally.`;
    if(isSignedIn()){
      message += uploadFailures > 0
        ? ` ${uploadFailures} photo(s) couldn't be re-uploaded to OneDrive — try syncing again later.`
        : ' Re-uploaded the smaller versions to OneDrive too.';
    } else {
      message += ' Sign in and sync to shrink these on OneDrive as well.';
    }
    await showAlert(message);
  }catch(err){
    console.error('Photo compression backfill failed', err);
    await showAlert('Compressing photos failed: ' + (err && err.message ? err.message : err));
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
}

// ---------- Clear local data ----------
// Two deliberate steps, not one click-through: a warning that nudges
// toward exporting first, then a typed "DELETE" confirmation that keeps
// the actual confirm button disabled until the exact word is typed. This
// is destructive and permanent, so a single accidental tap should never
// be enough to trigger it.
async function startClearLocalData(){
  const hasBackedUp = await showConfirm(
    'This permanently deletes every entry and photo stored on THIS DEVICE. ' +
    'It does not affect OneDrive or any other device, but anything not synced ' +
    "yet is gone for good.\n\nHave you exported a backup, just in case?",
    {confirmLabel:'Yes, continue', cancelLabel:'Let me export first', danger:true}
  );
  if(!hasBackedUp) return;

  const reallyDelete = await showTypedConfirm(
    'Last chance — this cannot be undone. Type DELETE below to permanently erase all local entries and photos on this device.',
    'DELETE',
    {confirmLabel:'Clear local data', cancelLabel:'Cancel'}
  );
  if(!reallyDelete) return;

  try{
    await idbClear('entries');
    await idbClear('photos');
    localStorage.removeItem(SYNC_BASELINE_KEY);
    localStorage.removeItem(SYNC_LAST_KEY);
    for(const url of Object.values(photoUrlCache)) URL.revokeObjectURL(url);
    photoUrlCache = {};
    await loadEntries();
    closeSettings();
    await showAlert('Local data cleared.');
  }catch(err){
    console.error('Clear local data failed', err);
    await showAlert('Clearing local data failed: ' + (err && err.message ? err.message : err));
  }
}

// ---------- Cleanup: old tombstones & resolved conflict-duplicate copies ----------
// Deleting an entry only tombstones it (see deleteEntry()) so the deletion
// can propagate to every device first — nothing ever prunes those records
// afterward, so they accumulate in IndexedDB, in every export, and in the
// OneDrive file indefinitely. This is a manual, deliberately conservative
// cleanup: only removes tombstoned entries and conflict-duplicate copies
// untouched for 90+ days, on the assumption that's long enough for every
// device to have synced past them already. Never touches anything visible
// on the board.
const CLEANUP_AGE_MS = 90 * 24 * 60 * 60 * 1000;

async function cleanUpOldRecords(){
  try{
    const all = await idbGetAll('entries');
    const cutoff = Date.now() - CLEANUP_AGE_MS;
    const candidates = all.filter(e => (e.deleted || e.conflictOf) && (e.updatedAt||0) < cutoff);

    if(candidates.length === 0){
      await showAlert('Nothing to clean up — no deleted entries or conflict copies are more than 90 days old yet.');
      return;
    }

    const ok = await showConfirm(
      `This permanently removes ${candidates.length} old deleted/conflict-copy record(s), ` +
      `each untouched for 90+ days. They're already invisible on the board — this just stops ` +
      `them taking up space.\n\n` +
      (isSignedIn()
        ? 'This will also remove them from OneDrive so they stop syncing down to other devices.'
        : "You're not signed in, so this only cleans this device — sign in first if you want it to also clear from OneDrive.") +
      `\n\nOnly do this if your other device(s) have synced recently — one that hasn't synced ` +
      `in months could otherwise still need to see these deletions.`,
      {confirmLabel:'Clean up', cancelLabel:'Cancel', danger:true}
    );
    if(!ok) return;

    const candidateIds = new Set(candidates.map(c => c.id));
    for(const id of candidateIds){
      await idbDelete('entries', id);
    }

    if(isSignedIn()){
      // Deliberately bypasses mergeEntries()/syncNow() here: the normal
      // merge treats "local doesn't have this id" as "hasn't pulled it
      // yet" and would just pull these records back down from OneDrive.
      // Purging permanently means editing the remote file directly to
      // drop the same ids, not merging.
      const remotePayload = await fetchRemoteFile();
      if(remotePayload){
        const surviving = (remotePayload.entries || []).filter(e => !candidateIds.has(e.id));
        await pushRemoteFile({ entries: surviving, syncedAt: Date.now() });
        const baseline = JSON.parse(localStorage.getItem(SYNC_BASELINE_KEY) || '{}');
        for(const id of candidateIds) delete baseline[id];
        localStorage.setItem(SYNC_BASELINE_KEY, JSON.stringify(baseline));
      }
    }

    await loadEntries();
    closeSettings();
    await showAlert(`Removed ${candidates.length} old record(s).`);
  }catch(err){
    console.error('Cleanup failed', err);
    await showAlert('Cleanup failed: ' + (err && err.message ? err.message : err));
  }
}

// ---------- App state ----------
let entries = [];
let categoryFilter = 'all';
let sourceFilter = 'all';
let statusFilter = 'all';
let editingId = null;
let draftPhotos = [];         // array of photo ids attached to entry being edited
let photoUrlCache = {};       // photo id -> object URL

const SOURCE_LABELS = {dad:'From Dad', experience:'My experience', ai:'AI-assisted', manual:'Service manual'};
const STATUS_LABELS = {
  'needs-diagnosis': 'Needs Diagnosis',
  'waiting-quote': 'Waiting on Quote',
  'waiting-parts': 'Waiting on Parts',
  'in-progress': 'In Progress',
  'complete': 'Complete'
};
// Entries saved before this field existed have no `status`. Rather than a
// one-time migration, fall back live: old entries with nothing filled in
// still read as "needs diagnosis" (same heuristic as before), anything
// else defaults to "in progress" rather than guessing it might be done —
// never silently mark old work as Complete without the user saying so.
function getEntryStatus(entry){
  return entry.status || (isNeedsDiagnosis(entry) ? 'needs-diagnosis' : 'in-progress');
}

const CHECKLIST_ITEMS = [
  ['sparkTest','Spark Test'], ['sparkPlug','Spark Plug'], ['compressionTest','Compression Test'],
  ['fuelTank','Fuel Tank'], ['fuelFilter','Fuel Filter'],
  ['airFilter','Air Filter'], ['oilChange','Oil'], ['oilFilter','Oil Filter'],
  ['lubeFrontEnd','Lube Front End'], ['tirePressure','Tire Pressure'], ['cleanDeck','Clean Deck'],
  ['bladeSharpening','Blade Sharpening']
];

// Every category gets this base set regardless of what else it adds.
const CHECKLIST_BASE = ['sparkTest','sparkPlug','compressionTest','fuelTank','airFilter','oilChange'];

// Only categories in this map narrow the checklist down from "everything."
// A blank category, or anything typed in that isn't one of these exact
// names, deliberately falls back to showing every field — narrowing only
// ever happens for a category we actually recognize, never by default.
const CATEGORY_CHECKLIST_EXTRAS = {
  'walk-behind mower': ['cleanDeck','bladeSharpening'],
  'riding mower / zero-turn': ['fuelFilter','oilFilter','lubeFrontEnd','tirePressure','cleanDeck','bladeSharpening'],
  'chainsaw': ['bladeSharpening'],
  'string trimmer': [],
  'blower': [],
  'hedge trimmer': [],
  'tiller': [],
  'generator': [],
  'pressure washer': []
};
const EQUIPMENT_CATEGORY_OPTIONS = [
  'Walk-Behind Mower', 'Riding Mower / Zero-Turn', 'Chainsaw', 'String Trimmer',
  'Blower', 'Hedge Trimmer', 'Tiller', 'Generator', 'Pressure Washer'
];

// Returns which checklist keys should be rendered right now. Never affects
// what's actually saved (see liveChecklistState) — a field hidden here can
// still hold a value underneath and reappears if category changes back or
// "Show all fields" is checked.
function getVisibleChecklistKeys(showAll, category){
  if(showAll) return CHECKLIST_ITEMS.map(([k])=>k);
  const cat = (category||'').trim().toLowerCase();
  const extras = CATEGORY_CHECKLIST_EXTRAS[cat];
  if(cat === '' || extras === undefined) return CHECKLIST_ITEMS.map(([k])=>k); // blank/unrecognized -> show everything
  return [...CHECKLIST_BASE, ...extras];
}

// ---------- View history (back button closes project/photo, not the app) ----------
let sheetIsNewUnsaved = false;
function pushView(view){ history.pushState({view}, ''); }
function applyView(view){
  if(view === 'lightbox'){
    document.getElementById('sheetOverlay').classList.add('open');
    document.getElementById('lightboxOverlay').classList.add('open');
  } else if(view === 'sheet'){
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.getElementById('sheetOverlay').classList.add('open');
  } else {
    document.getElementById('lightboxOverlay').classList.remove('open');
    document.getElementById('sheetOverlay').classList.remove('open');
    editingId = null;
  }
}
window.addEventListener('popstate', async (event)=>{
  const goingTo = (event.state && event.state.view) || 'board';
  const sheetOpen = document.getElementById('sheetOverlay').classList.contains('open');
  if(sheetIsNewUnsaved && goingTo !== 'sheet' && sheetOpen && !document.getElementById('lightboxOverlay').classList.contains('open')){
    // cancel the visual back so we can confirm first
    history.pushState({view:'sheet'}, '');
    const ok = await showConfirm('Discard this new work order? Nothing will be saved.', {confirmLabel:'Discard'});
    if(ok){
      sheetIsNewUnsaved = false;
      history.back();
    }
    return;
  }
  applyView(goingTo);
});

function uid(){ return 'e' + Date.now() + Math.floor(Math.random()*100000); }
function photoId(){ return 'p' + Date.now() + Math.floor(Math.random()*100000); }

async function loadEntries(){
  try{
    // idbGetAll returns tombstones too (deleted:true records) — those exist
    // purely so a future sync can propagate the deletion; the visible app
    // never shows them.
    entries = (await idbGetAll('entries')).filter(e => !e.deleted);
  }catch(e){
    console.error('Load failed', e);
    entries = [];
  }
  await ensureOrderNumbers();
  render();
}

// One-time migration + safety net: every entry gets a permanent orderNumber
// the first time it's seen without one, assigned in creation order so old
// entries keep roughly the numbering they already had. Once set, an
// entry's number never changes again regardless of what else is added/removed.
async function ensureOrderNumbers(){
  const missing = entries.filter(e => !e.orderNumber);
  if(missing.length === 0) return;
  let next = entries.reduce((max,e)=> e.orderNumber ? Math.max(max, e.orderNumber) : max, 0) + 1;
  missing.sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
  for(const entry of missing){
    entry.orderNumber = next++;
    await saveEntryToDB(entry);
  }
}

async function saveEntryToDB(entry){
  await idbPut('entries', entry);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Formats a phone input live as (XXX) XXX-XXXX while typing — strips
// anything that isn't a digit first, so pasted or partially-typed input
// still comes out clean rather than accumulating stray punctuation.
function formatPhoneInput(input){
  const digits = input.value.replace(/\D/g, '').slice(0, 10);
  let formatted = digits;
  if(digits.length > 6){
    formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  } else if(digits.length > 3){
    formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  } else if(digits.length > 0){
    formatted = `(${digits}`;
  }
  input.value = formatted;
  input.setSelectionRange(formatted.length, formatted.length);
}

// Uppercases an input live as-you-type — used for model/serial/code
// fields, where shop convention is all-caps. Preserves cursor position
// (uppercasing doesn't change string length, so this is safe) rather
// than letting the cursor jump to the end on every keystroke.
function uppercaseInput(input){
  const pos = input.selectionStart;
  input.value = input.value.toUpperCase();
  input.setSelectionRange(pos, pos);
}

// Collapses/expands a form-section-title's sibling .collapsible-body.
// Sections always start expanded when the sheet opens (no persisted
// state) — this only toggles for the current open/edit session.
function toggleFormSection(headerEl){
  headerEl.classList.toggle('is-collapsed');
  const body = headerEl.nextElementSibling;
  if(body) body.classList.toggle('is-collapsed');
}

async function getPhotoUrl(id){
  if(photoUrlCache[id]) return photoUrlCache[id];
  const record = await idbGet('photos', id);
  if(!record) return null;
  const url = URL.createObjectURL(record.blob);
  photoUrlCache[id] = url;
  return url;
}

function isNeedsDiagnosis(entry){
  return !entry.title && !entry.causes && !entry.steps && !entry.fix;
}

// ---------- Filters ----------
function setSourceFilter(s){
  sourceFilter = s;
  document.querySelectorAll('#sourceFilters .chip').forEach(c=>c.classList.toggle('active', c.dataset.source === s));
  render();
}

function setStatusFilter(s){
  statusFilter = s;
  document.querySelectorAll('#statusFilters .chip').forEach(c=>c.classList.toggle('active', c.dataset.status === s));
  render();
}

function renderCategoryFilters(){
  const types = Array.from(new Set(entries.map(e=>e.equipmentCategory).filter(Boolean))).sort();
  const wrap = document.getElementById('categoryFilters');
  wrap.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'chip' + (categoryFilter==='all' ? ' active':'');
  allChip.textContent = 'All categories';
  allChip.onclick = ()=>{ categoryFilter='all'; renderCategoryFilters(); render(); };
  wrap.appendChild(allChip);
  types.forEach(t=>{
    const chip = document.createElement('button');
    chip.className = 'chip' + (categoryFilter===t ? ' active':'');
    chip.textContent = t;
    chip.onclick = ()=>{ categoryFilter=t; renderCategoryFilters(); render(); };
    wrap.appendChild(chip);
  });
}

function matchesFilters(entry, q){
  if(categoryFilter !== 'all' && entry.equipmentCategory !== categoryFilter) return false;
  if(sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
  if(statusFilter !== 'all' && getEntryStatus(entry) !== statusFilter) return false;
  if(q){
    const hay = [entry.title, entry.engineBrand, entry.engineModel, entry.engineCode, entry.causes, entry.steps, entry.fix,
      entry.partsUsed, entry.notes, entry.customerName, entry.customerPhone,
      entry.equipmentBrand, entry.equipmentModel, entry.equipmentSerial, entry.equipmentCategory, entry.primaryComplaint, entry.customerRequest,
      ...checklistLines(entry.checklist||{})].join(' ').toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}

// ---------- Board rendering ----------
function render(){
  renderCategoryFilters();
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = entries.filter(e=>matchesFilters(e,q)).sort((a,b)=>b.createdAt - a.createdAt);

  const dadCount = entries.filter(e=>e.source==='dad').length;
  document.getElementById('statLine').innerHTML =
    `${filtered.length}${entries.length!==filtered.length ? ' of ' + entries.length : ''} entries · ${dadCount} from Dad`;

  const board = document.getElementById('board');
  board.innerHTML = '';

  if(entries.length === 0){
    board.innerHTML = `<div class="empty-state">
      <h3>No entries yet</h3>
      <p>Tap the + button to log your first symptom, cause, and fix.</p>
    </div>`;
    return;
  }
  if(filtered.length === 0){
    board.innerHTML = `<div class="empty-state"><h3>Nothing matches</h3><p>Try a different search or clear your filters.</p></div>`;
    return;
  }

  filtered.forEach(entry=>{
    const num = String(entry.orderNumber || 0).padStart(3,'0');
    const hasPhotos = entry.photos && entry.photos.length > 0;
    const status = getEntryStatus(entry);
    const headline = entry.primaryComplaint || entry.title || entry.customerName || 'Untitled entry';
    const card = document.createElement('div');
    card.className = 'tag-card';
    card.onclick = ()=>openDetail(entry.id);
    card.innerHTML = `
      <div class="grommet"></div>
      <div class="tag-num">#${num}</div>
      <div class="source-mark source-${entry.source}">${SOURCE_LABELS[entry.source]||''}</div>
      <div class="status-badge status-${status}">${STATUS_LABELS[status]}</div>
      ${entry.equipmentCategory ? `<div class="category-badge">${escapeHtml(entry.equipmentCategory)}</div>` : ''}
      <h3>${escapeHtml(headline)}</h3>
      ${entry.title && entry.customerName ? `<div class="mono" style="font-size:11.5px; color:var(--ink-soft); margin-bottom:4px;">👤 ${escapeHtml(entry.customerName)}</div>` : ''}
      <div class="preview">${escapeHtml(entry.title || entry.fix || entry.causes || '')}</div>
      ${hasPhotos ? `<div class="card-photo-thumb" data-photo-id="${entry.photos[0]}"><span class="mono photo-count">${entry.photos.length} photo${entry.photos.length>1?'s':''}</span></div>` : ''}
      <div class="tag-footer"><span>${entry.dateAdded||''}</span><span>OPEN →</span></div>
    `;
    board.appendChild(card);
  });

  board.querySelectorAll('.card-photo-thumb').forEach(async (el)=>{
    const url = await getPhotoUrl(el.dataset.photoId);
    if(url) el.style.backgroundImage = `url(${url})`;
  });
}

// ---------- Add/Edit sheet ----------
function openSheet(entry){
  editingId = entry ? entry.id : null;
  sheetIsNewUnsaved = !entry;
  const e = entry || {title:'',engineBrand:'',engineModel:'',engineCode:'',source:'dad',causes:'',steps:'',fix:'',notes:'',photos:[],
    customerName:'',customerPhone:'',equipmentBrand:'',equipmentModel:'',equipmentSerial:'',equipmentCategory:'',dateReceived:'',primaryComplaint:'',customerRequest:'',
    partsUsed:'',checklist:{},status:'needs-diagnosis',showAllFields:false};

  liveChecklistState = {...(e.checklist||{})};

  draftPhotos = entry && entry.photos ? [...entry.photos] : [];

  document.getElementById('sheetContent').innerHTML = `
    <div class="sheet-topbar">
      <button class="sheet-btn muted" onclick="closeSheet()">Cancel</button>
      <h2>${entry ? 'Edit Entry' : 'New Entry'}</h2>
      <button class="sheet-btn" onclick="saveEntry()">Save</button>
    </div>

    <div class="field-row" style="margin:0 16px 16px;">
      <div class="field">
        <label>Status</label>
        <select id="f_status">
          ${Object.entries(STATUS_LABELS).map(([val,label])=>
            `<option value="${val}" ${getEntryStatus(e)===val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Source</label>
        <select id="f_source">
          <option value="dad" ${e.source==='dad'?'selected':''}>From Dad</option>
          <option value="experience" ${e.source==='experience'?'selected':''}>My experience</option>
          <option value="ai" ${e.source==='ai'?'selected':''}>AI-assisted</option>
          <option value="manual" ${e.source==='manual'?'selected':''}>Service manual</option>
        </select>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title collapsible" onclick="toggleFormSection(this)">
        <span>Customer</span><span class="chevron">▾</span>
      </div>
      <div class="collapsible-body">
      <div class="field-row">
        <div class="field">
          <label>Customer Name</label>
          <input type="text" id="f_customerName" placeholder="e.g. Mike Torres" value="${escapeHtml(e.customerName)}">
        </div>
        <div class="field">
          <label>Phone Number</label>
          <input type="text" id="f_customerPhone" placeholder="e.g. (555) 012-3456" value="${escapeHtml(e.customerPhone)}" oninput="formatPhoneInput(this)">
        </div>
      </div>
      <div class="field">
        <label>Date Received</label>
        <input type="date" id="f_dateReceived" value="${escapeHtml(e.dateReceived)}">
      </div>
      <div class="field">
        <label>Primary Complaint <span class="mono" style="color:var(--muted); text-transform:none; letter-spacing:0; font-size:11px;">(this becomes the entry's title on the board)</span></label>
        <input type="text" id="f_primaryComplaint" placeholder="Short summary for the card title, e.g. &quot;won't start&quot;" value="${escapeHtml(e.primaryComplaint||'')}">
      </div>
      <div class="field">
        <label>Request</label>
        <textarea id="f_customerRequest" placeholder="What the customer said, in their words">${escapeHtml(e.customerRequest)}</textarea>
      </div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title collapsible" onclick="toggleFormSection(this)">
        <span>Equipment</span><span class="chevron">▾</span>
      </div>
      <div class="collapsible-body">
      <div class="field">
        <label>Brand</label>
        <input type="text" id="f_equipmentBrand" placeholder="e.g. TORO" value="${escapeHtml(e.equipmentBrand||'')}" oninput="uppercaseInput(this)">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Model</label>
          <input type="text" id="f_equipmentModel" placeholder="e.g. 20370" value="${escapeHtml(e.equipmentModel)}" oninput="uppercaseInput(this)">
        </div>
        <div class="field">
          <label>Serial</label>
          <input type="text" id="f_equipmentSerial" placeholder="e.g. 12345" value="${escapeHtml(e.equipmentSerial)}" oninput="uppercaseInput(this)">
        </div>
      </div>
      <div class="field">
        <label>Category</label>
        <input type="text" id="f_equipmentCategory" list="categoryOptions" placeholder="e.g. Walk-Behind Mower — pick or type your own" value="${escapeHtml(e.equipmentCategory||'')}" oninput="uppercaseInput(this); onCategoryOrShowAllChange();">
        <datalist id="categoryOptions">
          ${EQUIPMENT_CATEGORY_OPTIONS.map(c=>`<option value="${escapeHtml(c)}">`).join('')}
        </datalist>
      </div>
      <div class="form-subsection">
        <div class="form-subsection-title">Engine</div>
        <div class="field">
          <label>Brand</label>
          <input type="text" id="f_engineBrand" placeholder="e.g. BRIGGS" value="${escapeHtml(e.engineBrand||'')}" oninput="uppercaseInput(this)">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Model/Type</label>
            <input type="text" id="f_engineModel" placeholder="e.g. 500" value="${escapeHtml(e.engineModel)}" oninput="uppercaseInput(this)">
          </div>
          <div class="field">
            <label>Code</label>
            <input type="text" id="f_engineCode" placeholder="e.g. 21B807" value="${escapeHtml(e.engineCode)}" oninput="uppercaseInput(this)">
          </div>
        </div>
      </div>
      </div>
    </div>

    <div class="field">
      <label>Photos</label>
      <div class="photo-actions-row">
        <button type="button" class="btn-photo" onclick="triggerPhotoInput()">📷 Take Photo</button>
        <button type="button" class="btn-photo" onclick="triggerLibraryInput()">🖼️ Choose Existing</button>
      </div>
      <div class="photo-field-grid" id="draftPhotoGrid"></div>
    </div>

    <div class="form-section">
      <div class="form-section-title">The Work</div>
      <div class="field"><label>Likely Causes</label><textarea id="f_causes">${escapeHtml(e.causes)}</textarea></div>
      <div class="field"><label>Diagnostic Steps</label><textarea id="f_steps">${escapeHtml(e.steps)}</textarea></div>

      <div class="field">
        <div class="form-section-title collapsible" style="margin-bottom:10px;" onclick="toggleFormSection(this)">
          <span>Service Checklist</span><span class="chevron">▾</span>
        </div>
        <div class="collapsible-body">
        <label class="checklist-check" style="margin-bottom:10px;">
          <input type="checkbox" id="f_showAllFields" ${e.showAllFields?'checked':''} onchange="onCategoryOrShowAllChange()">
          <span>Show all fields</span>
        </label>
        <div id="checklistHiddenHint" class="mono" style="color:var(--muted); font-size:11px; margin-bottom:8px; display:none;"></div>
        <div class="checklist-grid" id="checklistGrid"></div>
        </div>
      </div>

      <div class="field">
        <label>Diagnosis</label>
        <input type="text" id="f_title" placeholder="Cause of primary complaint" value="${escapeHtml(e.title)}">
      </div>

      <div class="field"><label>Parts</label><textarea id="f_partsUsed" placeholder="e.g. AIR FILTER, SPARK PLUG NGK BPR6ES — needed, quoted, or used" oninput="uppercaseInput(this)">${escapeHtml(e.partsUsed)}</textarea></div>

      <div class="field">
        <label>The Fix</label>
        <div id="checklistFixPreview" class="checklist-fix-preview"></div>
        <textarea id="f_fix" placeholder="What fixed the primary complaint">${escapeHtml(e.fix)}</textarea>
      </div>
    </div>

    <div class="field"><label>Notes</label><textarea id="f_notes">${escapeHtml(e.notes)}</textarea></div>
  `;
  pushView('sheet');
  document.getElementById('sheetOverlay').classList.add('open');
  renderDraftPhotoGrid();
  renderChecklistGrid();
  renderChecklistPreview();
}

function closeSheet(){
  history.back();
}

// Holds every checklist key's {checked, note} for the entry currently being
// edited — including keys not currently rendered because the category (or
// "Show all fields" being off) hides them. This is the actual save-time
// source of truth, NOT the DOM: a field hidden by category still keeps
// whatever value it had, and reappears untouched if you switch the
// category back or check "Show all fields."
let liveChecklistState = {};

function currentCategoryValue(){
  const inp = document.getElementById('f_equipmentCategory');
  return inp ? inp.value : '';
}
function currentShowAllValue(){
  const cb = document.getElementById('f_showAllFields');
  return cb ? cb.checked : false;
}

function renderChecklistGrid(){
  const grid = document.getElementById('checklistGrid');
  if(!grid) return;
  const showAll = currentShowAllValue();
  const visibleKeys = getVisibleChecklistKeys(showAll, currentCategoryValue());
  grid.innerHTML = CHECKLIST_ITEMS.filter(([key])=>visibleKeys.includes(key)).map(([key,label])=>{
    const item = liveChecklistState[key] || {checked:false, note:''};
    return `
    <div class="checklist-row">
      <label class="checklist-check">
        <input type="checkbox" id="cl_${key}_checked" ${item.checked?'checked':''} onchange="onChecklistChange('${key}')">
        <span>${label}</span>
      </label>
      <input type="text" id="cl_${key}_note" class="checklist-note" placeholder="note (optional)" value="${escapeHtml(item.note||'')}" oninput="onChecklistChange('${key}')">
    </div>`;
  }).join('');

  const hiddenCount = CHECKLIST_ITEMS.length - visibleKeys.length;
  const hint = document.getElementById('checklistHiddenHint');
  if(hint){
    hint.style.display = hiddenCount > 0 ? 'block' : 'none';
    hint.textContent = hiddenCount > 0
      ? `${hiddenCount} field${hiddenCount===1?'':'s'} hidden for this category — nothing already entered is lost, check "Show all fields" to see them.`
      : '';
  }
}

// Called whenever category text or the show-all-fields checkbox changes.
// Re-renders which rows are visible without touching liveChecklistState,
// so nothing entered in a field that's about to be hidden gets lost.
function onCategoryOrShowAllChange(){
  renderChecklistGrid();
}

function onChecklistChange(key){
  const cb = document.getElementById('cl_'+key+'_checked');
  const note = document.getElementById('cl_'+key+'_note');
  liveChecklistState[key] = { checked: cb ? cb.checked : false, note: note ? note.value.trim() : '' };
  renderChecklistPreview();
}

function getChecklistState(){
  return liveChecklistState;
}

// Builds the "Label - note" lines for currently-checked items. Single source of
// truth used by the edit-form preview, the detail view, and search — never
// written into the editable Fix textarea, so there's nothing to drift out of sync.
function checklistLines(checklistState){
  return CHECKLIST_ITEMS
    .filter(([key])=> checklistState[key] && checklistState[key].checked)
    .map(([key,label])=> `${label} - ${(checklistState[key].note||'').trim() || 'done'}`);
}

function renderChecklistPreview(){
  const el = document.getElementById('checklistFixPreview');
  if(!el) return;
  const lines = checklistLines(getChecklistState());
  el.innerHTML = lines.length
    ? lines.map(l=>`<div class="checklist-fix-line">${escapeHtml(l)}</div>`).join('')
    : '';
  el.style.display = lines.length ? 'block' : 'none';
}

function triggerPhotoInput(){
  document.getElementById('hiddenPhotoInput').click();
}
function triggerLibraryInput(){
  document.getElementById('hiddenLibraryInput').click();
}

// Resize/compress before a photo ever gets stored — a reference photo of an
// engine part doesn't need full 12MP camera resolution, and this benefits
// local IndexedDB storage as much as it does OneDrive sync bandwidth.
async function compressImage(file, maxDimension, quality){
  maxDimension = maxDimension || 1600;
  quality = quality || 0.82;
  try{
    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject)=>{
      const image = new Image();
      image.onload = ()=>resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    let {width, height} = img;
    if(width > maxDimension || height > maxDimension){
      if(width >= height){
        height = Math.round(height * (maxDimension / width));
        width = maxDimension;
      } else {
        width = Math.round(width * (maxDimension / height));
        height = maxDimension;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file; // fall back to the original if canvas encoding somehow fails
  }catch(err){
    console.error('Photo compression failed, using original', err);
    return file;
  }
}

async function handlePhotoFiles(event){
  const files = Array.from(event.target.files || []);
  let failed = 0;
  for(const file of files){
    const id = photoId();
    try{
      const blob = await compressImage(file);
      await idbPut('photos', {id, blob, mimeType: 'image/jpeg', filename: id + '.jpg'});
      draftPhotos.push(id);
    }catch(err){
      console.error('Photo save failed', err);
      failed++;
    }
  }
  event.target.value = '';
  renderDraftPhotoGrid();
  if(failed > 0){
    await showAlert(`${failed} photo(s) couldn't be saved — your device may be low on storage. Any that did save are fine; free up space for the rest.`);
  }
}
document.getElementById('hiddenPhotoInput').addEventListener('change', handlePhotoFiles);
document.getElementById('hiddenLibraryInput').addEventListener('change', handlePhotoFiles);

async function renderDraftPhotoGrid(){
  const grid = document.getElementById('draftPhotoGrid');
  if(!grid) return;
  grid.innerHTML = '';
  for(const id of draftPhotos){
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';
    wrap.innerHTML = `<button type="button" class="remove-x" onclick="event.stopPropagation(); removeDraftPhoto('${id}')">×</button>`;
    wrap.onclick = (ev)=>{ if(ev.target.classList.contains('remove-x')) return; openLightbox(id, draftPhotos, 'draft'); };
    grid.appendChild(wrap);
    const url = await getPhotoUrl(id);
    if(url) wrap.style.backgroundImage = `url(${url})`;
  }
}

async function removeDraftPhoto(id){
  draftPhotos = draftPhotos.filter(p=>p!==id);
  await idbDelete('photos', id);
  delete photoUrlCache[id];
  renderDraftPhotoGrid();
}

async function saveEntry(){
  const title = document.getElementById('f_title').value.trim();
  const customerName = document.getElementById('f_customerName').value.trim();
  if(!title && !customerName){
    await showAlert('Add at least a customer name or a symptom title so you can find this again.');
    return;
  }

  const data = {
    title,
    status: document.getElementById('f_status').value,
    engineBrand: document.getElementById('f_engineBrand').value.trim(),
    engineModel: document.getElementById('f_engineModel').value.trim(),
    engineCode: document.getElementById('f_engineCode').value.trim(),
    source: document.getElementById('f_source').value,
    causes: document.getElementById('f_causes').value.trim(),
    steps: document.getElementById('f_steps').value.trim(),
    fix: document.getElementById('f_fix').value.trim(),
    partsUsed: document.getElementById('f_partsUsed').value.trim(),
    notes: document.getElementById('f_notes').value.trim(),
    photos: [...draftPhotos],
    customerName,
    customerPhone: document.getElementById('f_customerPhone').value.trim(),
    equipmentBrand: document.getElementById('f_equipmentBrand').value.trim(),
    equipmentModel: document.getElementById('f_equipmentModel').value.trim(),
    equipmentSerial: document.getElementById('f_equipmentSerial').value.trim(),
    equipmentCategory: document.getElementById('f_equipmentCategory').value.trim(),
    showAllFields: document.getElementById('f_showAllFields').checked,
    dateReceived: document.getElementById('f_dateReceived').value,
    primaryComplaint: document.getElementById('f_primaryComplaint').value.trim(),
    customerRequest: document.getElementById('f_customerRequest').value.trim(),
    checklist: getChecklistState()
  };

  let entry;
  if(editingId){
    const existing = entries.find(en=>en.id===editingId);
    // Stamp completedAt the moment status becomes Complete; clear it if
    // status moves away from Complete again, since a cleared/reopened
    // entry shouldn't keep showing a stale completion date.
    let completedAt = existing.completedAt || null;
    if(data.status === 'complete' && getEntryStatus(existing) !== 'complete'){
      completedAt = Date.now();
    } else if(data.status !== 'complete'){
      completedAt = null;
    }
    entry = {...existing, ...data, completedAt, updatedAt: Date.now()};
  } else {
    const nextNum = entries.reduce((max,e)=> e.orderNumber ? Math.max(max,e.orderNumber) : max, 0) + 1;
    entry = {
      id: uid(), ...data, completedAt: data.status === 'complete' ? Date.now() : null,
      orderNumber: nextNum, createdAt: Date.now(), updatedAt: Date.now(),
      dateAdded: new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})
    };
  }
  try{
    await saveEntryToDB(entry);
  }catch(err){
    console.error('Save failed', err);
    await showAlert("Couldn't save this entry — your device may be low on storage. Nothing else was affected, but this save didn't go through. Free up some space and try again.");
    return;
  }
  await loadEntries();
  sheetIsNewUnsaved = false;
  closeSheet();
  if(isSignedIn()) syncNow(); // sync trigger point: after every save
}

async function editCompletedDate(id){
  const entry = entries.find(e=>e.id===id);
  if(!entry || !entry.completedAt) return;
  const newTs = await showDateTimePrompt(
    'Set the actual completed date/time for this entry — useful for catching up records after the fact, not needed for day-to-day use.',
    entry.completedAt
  );
  if(newTs === null) return; // cancelled, leave completedAt untouched
  await saveEntryToDB({...entry, completedAt: newTs, updatedAt: Date.now()});
  await loadEntries();
  openDetail(id); // refresh the open detail view with the corrected date
  if(isSignedIn()) syncNow(); // sync trigger point: after every save
}

// ---------- Detail view ----------
function openDetail(id){
  const entry = entries.find(e=>e.id===id);
  if(!entry) return;
  sheetIsNewUnsaved = false;
  const hasPhotos = entry.photos && entry.photos.length > 0;
  document.getElementById('sheetContent').innerHTML = `
    <div class="sheet-topbar">
      <button class="sheet-btn muted" onclick="closeSheet()">Close</button>
      <h2 style="font-size:16px;">${escapeHtml(entry.primaryComplaint || entry.title || entry.customerName || 'Untitled entry')}</h2>
      <span style="width:60px;"></span>
    </div>
    <div class="stat-line" style="padding-left:0;">${SOURCE_LABELS[entry.source]||''} · ${entry.dateAdded||''}</div>
    <div class="status-badge status-${getEntryStatus(entry)}" style="margin-top:2px;">${STATUS_LABELS[getEntryStatus(entry)]}${entry.completedAt ? ' · ' + new Date(entry.completedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ' ' + new Date(entry.completedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) : ''}</div>
    ${entry.completedAt ? `<button class="icon-btn" style="margin:2px 0 0;" onclick="editCompletedDate('${entry.id}')" aria-label="Edit completed date/time" title="Edit completed date/time">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
    </button>` : ''}
    ${(entry.customerName || entry.customerPhone || entry.dateReceived || entry.primaryComplaint || entry.customerRequest) ? `<div class="detail-section"><div class="drawer-label">Customer</div><p>${[
        entry.customerName && escapeHtml(entry.customerName),
        entry.customerPhone && (`<span class="mono" style="color:var(--muted);">Phone:</span> ` + escapeHtml(entry.customerPhone)),
        entry.dateReceived && (`<span class="mono" style="color:var(--muted);">Received:</span> ` + escapeHtml(entry.dateReceived))
      ].filter(Boolean).join('<br>')}</p>${entry.primaryComplaint ? `<p style="margin-top:8px;"><span class="mono" style="color:var(--muted); font-size:11px;">PRIMARY COMPLAINT</span><br>${escapeHtml(entry.primaryComplaint)}</p>` : ''}${entry.customerRequest ? `<p style="margin-top:8px;"><span class="mono" style="color:var(--muted); font-size:11px;">REQUEST</span><br>${escapeHtml(entry.customerRequest)}</p>` : ''}</div>` : ''}
    ${(entry.equipmentModel || entry.equipmentSerial || entry.equipmentCategory || entry.equipmentBrand || entry.engineBrand || entry.engineModel || entry.engineCode) ? `<div class="detail-section"><div class="drawer-label">Equipment</div><p>${[
        entry.equipmentCategory && (`<span class="mono" style="color:var(--muted);">Category:</span> ` + escapeHtml(entry.equipmentCategory)),
        entry.equipmentBrand && (`<span class="mono" style="color:var(--muted);">Brand:</span> ` + escapeHtml(entry.equipmentBrand)),
        entry.equipmentModel && (`<span class="mono" style="color:var(--muted);">Model:</span> ` + escapeHtml(entry.equipmentModel)),
        entry.equipmentSerial && (`<span class="mono" style="color:var(--muted);">SN:</span> ` + escapeHtml(entry.equipmentSerial))
      ].filter(Boolean).join('<br>')}</p>${(entry.engineBrand || entry.engineModel || entry.engineCode) ? `<p style="margin-top:8px;"><span class="mono" style="color:var(--muted); font-size:11px;">ENGINE</span><br>${[
        entry.engineBrand && (`<span class="mono" style="color:var(--muted);">Brand:</span> ` + escapeHtml(entry.engineBrand)),
        entry.engineModel && (`<span class="mono" style="color:var(--muted);">Model/Type:</span> ` + escapeHtml(entry.engineModel)),
        entry.engineCode && (`<span class="mono" style="color:var(--muted);">Code:</span> ` + escapeHtml(entry.engineCode))
      ].filter(Boolean).join('<br>')}</p>` : ''}</div>` : ''}
    ${entry.causes ? `<div class="detail-section"><div class="drawer-label">Likely Causes</div><p>${escapeHtml(entry.causes)}</p></div>` : ''}
    ${entry.steps ? `<div class="detail-section"><div class="drawer-label">Diagnostic Steps</div><p>${escapeHtml(entry.steps)}</p></div>` : ''}
    ${entry.title ? `<div class="detail-section"><div class="drawer-label">Diagnosis</div><p>${escapeHtml(entry.title)}</p></div>` : ''}
    ${(entry.fix || checklistLines(entry.checklist||{}).length) ? (()=>{
        const clLines = checklistLines(entry.checklist||{});
        const combined = [clLines.join('\n'), entry.fix].filter(Boolean).join('\n\n');
        return `<div class="detail-section"><div class="drawer-label">The Fix</div><p>${escapeHtml(combined)}</p></div>`;
      })() : ''}
    ${entry.partsUsed ? `<div class="detail-section"><div class="drawer-label">Parts</div><p>${escapeHtml(entry.partsUsed)}</p></div>` : ''}
    ${entry.notes ? `<div class="detail-section"><div class="drawer-label">Notes</div><p>${escapeHtml(entry.notes)}</p></div>` : ''}
    ${hasPhotos ? `<div class="detail-section"><div class="drawer-label">Photos</div><div class="photo-field-grid" id="detailPhotoGrid"></div></div>` : ''}
    <div class="detail-actions">
      <button class="btn-full delete" onclick="deleteEntry('${entry.id}')">Delete</button>
      <button class="btn-full edit" onclick='openSheet(${JSON.stringify(entry).replace(/'/g,"&#39;")})'>Edit</button>
    </div>
  `;
  pushView('sheet');
  document.getElementById('sheetOverlay').classList.add('open');
  if(hasPhotos) renderDetailPhotoGrid(entry.photos, entry.id);
}

async function renderDetailPhotoGrid(photos, entryId){
  const grid = document.getElementById('detailPhotoGrid');
  if(!grid) return;
  grid.innerHTML = '';
  for(const id of photos){
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';
    wrap.onclick = ()=>openLightbox(id, photos, entryId);
    grid.appendChild(wrap);
    const url = await getPhotoUrl(id);
    if(url) wrap.style.backgroundImage = `url(${url})`;
  }
}

async function deleteEntry(id){
  const ok = await showConfirm("Delete this entry? This can't be undone.", {confirmLabel:'Delete'});
  if(!ok) return;
  const entry = entries.find(e=>e.id===id);
  if(entry){
    if(entry.photos){
      // Photo IDs aren't reserved to one entry — a conflict-duplicate entry
      // (see mergeEntries()) is a copy of an OLDER version of another entry
      // and very often still lists the same photo IDs as the surviving
      // version. Deleting this entry's blobs without checking would
      // silently pull photos out from under whichever other entry still
      // needs them. Build the "still needed elsewhere" set first.
      const stillReferenced = new Set();
      for(const other of entries){
        if(other.id === id) continue;
        (other.photos || []).forEach(pid => stillReferenced.add(pid));
      }
      for(const pid of entry.photos){
        if(stillReferenced.has(pid)) continue; // another entry still needs this blob
        await idbDelete('photos', pid);
        delete photoUrlCache[pid];
      }
    }
    // Tombstone, not a hard delete: keeps a timestamped "deleted" record so
    // the sync merge logic can propagate this deletion to the other device
    // instead of the entry silently reappearing next time they sync.
    entry.deleted = true;
    entry.photos = [];
    entry.updatedAt = Date.now();
    await saveEntryToDB(entry);
  }
  await loadEntries();
  closeSheet();
  if(isSignedIn()) syncNow(); // sync trigger point: after every save (deletion counts)
}

// ---------- Lightbox ----------
let lightboxPhotos = [];
let lightboxIndex = 0;
let lightboxContext = null; // 'draft' or an entry id

async function openLightbox(id, photosList, context){
  lightboxPhotos = photosList || [id];
  lightboxIndex = Math.max(0, lightboxPhotos.indexOf(id));
  lightboxContext = context || null;
  await renderLightboxImage();
  pushView('lightbox');
  document.getElementById('lightboxOverlay').classList.add('open');
}

async function renderLightboxImage(){
  const id = lightboxPhotos[lightboxIndex];
  const url = await getPhotoUrl(id);
  document.getElementById('lightboxImg').src = url || '';
  const multi = lightboxPhotos.length > 1;
  document.getElementById('lightboxCounter').textContent = multi ? `${lightboxIndex+1} / ${lightboxPhotos.length}` : '';
  document.getElementById('lightboxPrev').style.display = multi ? '' : 'none';
  document.getElementById('lightboxNext').style.display = multi ? '' : 'none';
  document.getElementById('lightboxCoverBtn').style.display = (multi && lightboxIndex !== 0) ? '' : 'none';
}

function lightboxPrev(ev){
  ev.stopPropagation();
  lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  renderLightboxImage();
}
function lightboxNext(ev){
  ev.stopPropagation();
  lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
  renderLightboxImage();
}

let lightboxTouchStartX = null;
document.getElementById('lightboxOverlay').addEventListener('touchstart', (ev)=>{
  lightboxTouchStartX = ev.touches[0].clientX;
});
document.getElementById('lightboxOverlay').addEventListener('touchend', (ev)=>{
  if(lightboxTouchStartX === null || lightboxPhotos.length < 2) return;
  const dx = ev.changedTouches[0].clientX - lightboxTouchStartX;
  lightboxTouchStartX = null;
  if(Math.abs(dx) < 40) return;
  dx < 0 ? lightboxNext({stopPropagation(){}}) : lightboxPrev({stopPropagation(){}});
});

async function setCoverPhoto(ev){
  ev.stopPropagation();
  const id = lightboxPhotos[lightboxIndex];
  lightboxPhotos = [id, ...lightboxPhotos.filter(p=>p!==id)];
  lightboxIndex = 0;
  if(lightboxContext === 'draft'){
    draftPhotos = [...lightboxPhotos];
    renderDraftPhotoGrid();
  } else if(lightboxContext){
    const entry = entries.find(e=>e.id===lightboxContext);
    if(entry){
      entry.photos = [...lightboxPhotos];
      entry.updatedAt = Date.now();
      await saveEntryToDB(entry);
      renderDetailPhotoGrid(entry.photos, entry.id);
      render();
    }
  }
  renderLightboxImage();
}

function closeLightbox(){
  history.back();
}

// ---------- Install prompt handling ----------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBtn').style.display = 'inline-block';
});
document.getElementById('installBtn').addEventListener('click', async ()=>{
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
if(isIOS() && !isStandalone()){
  document.getElementById('iosBanner').style.display = 'block';
}

// ---------- Service worker + update detection ----------
let waitingWorker = null;

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').then((reg)=>{
      // Case 1: a new version already finished installing before this
      // page load (e.g. it installed in a background tab earlier).
      if(reg.waiting){
        waitingWorker = reg.waiting;
        showUpdateBanner();
      }
      // Case 2: a new version starts installing while we're here.
      reg.addEventListener('updatefound', ()=>{
        const newWorker = reg.installing;
        if(!newWorker) return;
        newWorker.addEventListener('statechange', ()=>{
          // "installed" + an existing controller means this is an UPDATE,
          // not the very first install (which has no controller yet).
          if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
            waitingWorker = newWorker;
            showUpdateBanner();
          }
        });
      });
    }).catch(err=>console.error('SW registration failed', err));

    // Once the waiting worker takes over, reload so the page actually
    // uses the new version instead of running old code against new cache.
    let alreadyRefreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(alreadyRefreshed) return;
      alreadyRefreshed = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(){
  document.getElementById('updateBanner').style.display = 'flex';
}

function applyUpdate(){
  if(waitingWorker){
    waitingWorker.postMessage({type:'SKIP_WAITING'});
  }
}

// Ask the browser not to auto-evict this app's data under storage pressure.
// Best-effort only — some browsers grant it silently, some prompt, some
// (notably Safari in some configurations) never grant it at all — so this
// is a mitigation, not a guarantee, and failures here are deliberately not
// surfaced to the user since there's no useful action for them to take.
if('storage' in navigator && 'persist' in navigator.storage){
  navigator.storage.persist().catch(()=>{});
}

history.replaceState({view:'board'}, '');
loadEntries();
initMsal();
