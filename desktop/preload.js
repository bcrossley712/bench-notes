// preload.js
// Exposes a small, deliberate API (window.api) to the page rather than
// giving it raw Node/filesystem access. Electron's recommended pattern.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadEntries: () => ipcRenderer.invoke('load-entries'),
  saveEntries: (entries) => ipcRenderer.invoke('save-entries', entries),

  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  chooseStorageFolder: () => ipcRenderer.invoke('choose-storage-folder'),

  addPhotos: () => ipcRenderer.invoke('add-photos'),
  saveCapturedPhoto: (dataUrl) => ipcRenderer.invoke('save-captured-photo', dataUrl),
  getPhotoData: (filename) => ipcRenderer.invoke('get-photo-data', filename),
  deletePhoto: (filename) => ipcRenderer.invoke('delete-photo', filename)
});
