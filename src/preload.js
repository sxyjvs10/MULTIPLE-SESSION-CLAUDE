const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tabAPI', {
  switchAccount: (id) => ipcRenderer.send('switch-account', id),
  addAccount: (label) => ipcRenderer.send('add-account', label),
  removeAccount: (id) => ipcRenderer.send('remove-account', id),
  renameAccount: (id, label) => ipcRenderer.send('rename-account', { accountId: id, label }),
  reloadActive: () => ipcRenderer.send('reload-active'),
  onAccountsUpdated: (callback) => {
    ipcRenderer.on('accounts-updated', (event, data) => callback(data));
  },

  // shared notes panel
  togglePanel: (open) => ipcRenderer.send('toggle-panel', open),
  saveContext: (text) => ipcRenderer.send('save-context', text),
  getNotes: () => ipcRenderer.invoke('get-notes'),
  onNotesUpdated: (callback) => {
    ipcRenderer.on('notes-updated', (event, data) => callback(data));
  },
  markLimitHit: (id) => ipcRenderer.send('mark-limit-hit', id),
  markReady: (id) => ipcRenderer.send('mark-ready', id),
});
