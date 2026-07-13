// main.js
// The "main process" - plain Node.js, full filesystem access.
// Handles the app window, entry data, and now photo storage too.

const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

// --- Storage location is configurable, not hardcoded ---
// Default: the standard per-user AppData folder.
// Later, pointing this at a Dropbox/Google Drive/OneDrive folder is how
// phone <-> desktop sync happens - that cloud client keeps the folder in
// sync for you, this app doesn't need to know or care.
let dataDir = app.getPath('userData');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.dataDir && fs.existsSync(cfg.dataDir)) {
        dataDir = cfg.dataDir;
      }
    }
  } catch (err) {
    console.error('Failed to load config, using default folder:', err);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ dataDir }, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

function dataFilePath() {
  return path.join(dataDir, 'bench_notes_data.json');
}

function photosDirPath() {
  return path.join(dataDir, 'photos');
}

function ensurePhotosDir() {
  const dir = photosDirPath();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    title: 'Bench Notes',
    backgroundColor: '#1A1A1C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile('bench-notes.html');
}

// --- Entry data ---

ipcMain.handle('load-entries', async () => {
  try {
    const file = dataFilePath();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    return [];
  } catch (err) {
    console.error('Failed to load entries:', err);
    return [];
  }
});

ipcMain.handle('save-entries', async (event, entries) => {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFilePath(), JSON.stringify(entries, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    console.error('Failed to save entries:', err);
    return { ok: false, error: err.message };
  }
});

// --- Storage location ---

ipcMain.handle('get-storage-info', async () => {
  return { dataDir };
});

ipcMain.handle('choose-storage-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder to store Bench Notes data',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, dataDir };
  }
  dataDir = result.filePaths[0];
  ensurePhotosDir();
  saveConfig();
  return { ok: true, dataDir };
});

// --- Photos ---

const EXT_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp'
};

function uniquePhotoName(ext) {
  return `photo_${Date.now()}_${Math.floor(Math.random() * 100000)}${ext}`;
}

ipcMain.handle('add-photos', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Attach photos',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
  });
  if (result.canceled) return [];

  const dir = ensurePhotosDir();
  const saved = [];
  for (const srcPath of result.filePaths) {
    try {
      const ext = path.extname(srcPath).toLowerCase() || '.jpg';
      const filename = uniquePhotoName(ext);
      fs.copyFileSync(srcPath, path.join(dir, filename));
      saved.push(filename);
    } catch (err) {
      console.error('Failed to copy photo:', srcPath, err);
    }
  }
  return saved;
});

ipcMain.handle('save-captured-photo', async (event, dataUrl) => {
  try {
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error('Invalid image data');
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const ext = mime === 'image/png' ? '.png' : '.jpg';
    const dir = ensurePhotosDir();
    const filename = uniquePhotoName(ext);
    fs.writeFileSync(path.join(dir, filename), buffer);
    return { ok: true, filename };
  } catch (err) {
    console.error('Failed to save captured photo:', err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-photo-data', async (event, filename) => {
  try {
    const filePath = path.join(photosDirPath(), filename);
    const ext = path.extname(filename).toLowerCase();
    const mime = EXT_MIME[ext] || 'image/jpeg';
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Failed to read photo:', filename, err);
    return null;
  }
});

ipcMain.handle('delete-photo', async (event, filename) => {
  try {
    const filePath = path.join(photosDirPath(), filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true };
  } catch (err) {
    console.error('Failed to delete photo:', filename, err);
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  loadConfig();
  ensurePhotosDir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
