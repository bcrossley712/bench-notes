BENCH NOTES - ELECTRON DESKTOP APP
====================================

WHAT THIS IS
------------
A real standalone Windows desktop app - no browser, no server window,
no address bar. Your data saves directly to disk via Node's filesystem
access, using Electron's standard main-process/renderer-process split.


PROJECT FILES
-------------
main.js          - the "main process" (plain Node.js, creates the window,
                   reads/writes your data file)
preload.js       - securely exposes save/load functions to the page
bench-notes.html - the app itself (UI, all your existing functionality)
package.json     - project config + electron-builder settings


ONE-TIME SETUP
---------------
This folder lives inside the main "bench-notes" repo, in the /desktop
subfolder. Open a terminal and move into it first:

     cd desktop

You said you're familiar with Node, so the rest will look familiar:

1. Install dependencies:
     npm install

   This pulls down Electron itself and electron-builder (the packager).
   It's a bigger download than a typical npm project (~150-200MB) because
   Electron bundles a full Chromium + Node runtime - that's the tradeoff
   for a standalone app with no external dependencies at runtime.


RUNNING IT IN DEV MODE
------------------------
     npm start

This launches the app in a real window immediately - good for testing
changes to bench-notes.html without building a full installer each time.


BUILDING A REAL INSTALLER (.exe)
-----------------------------------
     npm run dist

This uses electron-builder to produce a Windows installer in the `dist/`
folder - something like:
     dist/Bench Notes Setup 1.0.0.exe

Run that installer once, and it behaves like any other Windows app:
Start Menu entry, uninstaller registered in "Add or Remove Programs",
a real .exe you can pin to the taskbar.

Note: building on a non-Windows machine can still target Windows in most
cases, but building directly on Windows is the most reliable path if you
hit any issues.


WHERE YOUR DATA LIVES
------------------------
By default, your entries and photos save to:
     C:\Users\<you>\AppData\Roaming\Bench Notes\
     ├── bench_notes_data.json
     └── photos\   (attached/captured images)

This is the standard location Windows apps use for per-user data - it's
deliberately outside the Program Files installation, so a regular user
account can always write to it, and reinstalling/updating the app later
won't touch it.

You can change this folder any time from inside the app (sidebar ->
"Change folder…"). This is how phone-to-desktop sync will work later:
point this at a Dropbox, Google Drive, or OneDrive folder, and that
cloud client keeps everything in sync automatically - the app itself
doesn't need to know anything about the cloud service.

To back up manually: copy the whole folder (data file + photos)
somewhere safe. To restore on a new machine: install the app, then
either point "Change folder…" at your backed-up folder, or copy its
contents into the default AppData location before opening the app.


PHOTOS
------
Each entry can have photos attached two ways:
- "Attach from files…" - browse to existing image files (e.g. photos
  already on your computer, or transferred from your phone) and copy
  them in
- "Take photo…" - if your laptop has a webcam, capture one directly

Click any thumbnail to view it full-size. Removing a photo from an
entry deletes its file from the photos folder.


ADDING YOUR OWN ICON (OPTIONAL)
-----------------------------------
Right now the build uses electron-builder's default icon. To use your
own:
1. Create or find a 256x256 .ico file, name it icon.ico, put it in this
   folder
2. In package.json, under "build" -> "win", add:
     "icon": "icon.ico"
3. Rebuild with npm run dist


CUSTOMIZING FURTHER
----------------------
Since this is now a normal Node/Electron project, anything you'd
normally do with a Node app applies - version control with git, adding
a proper app icon, auto-update support later via electron-updater, etc.
The HTML/CSS/JS in bench-notes.html is untouched from before except for
how it saves data, so all your existing entry fields, search, and
filters work exactly the same.
