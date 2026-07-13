BENCH NOTES - PWA (Mobile, via GitHub Pages)
================================================

WHAT THIS IS
------------
This version is a Progressive Web App — a real website that installs to
your phone's home screen and works like an app, including offline. It's
built to run on both Android and iPhone from this one set of files.

Storage: your entries and photos live in the phone's browser storage
(IndexedDB), not in any file you can browse to directly. This is
separate from the Electron desktop app's data — nothing syncs between
them yet (that's a planned next step).


WHAT'S IN THIS FOLDER
------------------------
index.html            - the whole app (UI, logic, storage)
manifest.webmanifest   - tells the phone how to install it (name, icon, colors)
service-worker.js      - caches the app so it works with no signal
icons/icon-192.png     - app icon (small)
icons/icon-512.png     - app icon (large, used for splash/install screens)


DEPLOYING TO GITHUB PAGES (ONE-TIME SETUP)
----------------------------------------------
This folder lives inside the main "bench-notes" repo, in the /pwa
subfolder. A GitHub Actions workflow (.github/workflows/deploy-pages.yml
at the repo root) automatically deploys just this folder to GitHub Pages
every time you push a change to it.

1. Push the whole bench-notes repo to GitHub (see the top-level README)

2. In the repo: Settings -> Pages -> under "Build and deployment",
   set Source to "GitHub Actions" (not "Deploy from a branch")

3. Push any change, or trigger the workflow manually from the Actions
   tab. GitHub will give you a URL, something like:
     https://<your-username>.github.io/bench-notes/
   It can take a minute or two to go live the first time.

4. Open that URL on your phone's browser to confirm it loads.


INSTALLING ON YOUR ANDROID PHONE
-------------------------------------
1. Open the URL in Chrome
2. You should see an "Install" button appear in the app itself, or you
   can use Chrome's menu (⋮) -> "Add to Home Screen" / "Install app"
3. It'll appear as a normal app icon from then on


INSTALLING ON DAD'S IPHONE
-------------------------------
1. Open the URL in Safari (must be Safari — this doesn't work from
   Chrome or other browsers on iPhone)
2. Tap the Share icon (square with an arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" - it now behaves like an installed app

The app itself will show a small banner with these same instructions
if it detects it's being viewed on an iPhone outside the installed app.


UPDATING THE APP LATER
---------------------------
Any time you want to push a change: edit the files in this /pwa folder
and push to GitHub. The Actions workflow redeploys automatically within
a minute or two. Anyone with it installed will get the update the next
time they open the app with a connection (the service worker checks for
a new version at that point).


TESTING OFFLINE
--------------------
After installing and opening it at least once with a connection, try
turning on airplane mode and opening the app again — it should open
normally and let you view/add/edit entries. Only a brand new install on
a phone that's never loaded it before needs that first connection.


KNOWN LIMITATIONS OF THIS FIRST VERSION
--------------------------------------------
- No syncing yet between this app, the desktop app, or between multiple
  phones — that's the next planned piece (OneDrive-based sync)
- If you remove a photo while editing and then don't hit Save, the photo
  file is still deleted from storage right away (same tradeoff as the
  desktop app) - not a bug, just how it currently behaves
- Clearing your phone's browser data/cache could still wipe this app's
  storage, though installed PWAs are generally more protected from this
  than a regular open browser tab
