const { app, BrowserWindow, BrowserView, ipcMain, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(app.getPath('userData'), 'accounts.json');
const NOTES_PATH = path.join(app.getPath('userData'), 'shared-notes.json');
const TAB_BAR_HEIGHT = 44;
const PANEL_WIDTH = 360;

let mainWindow;
let views = {};         // accountId -> BrowserView
let accounts = [];      // [{id, label, color}]
let activeAccountId = null;
let panelOpen = false;
let sharedNotes = { context: '', log: [] };

function loadAccounts() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    accounts = JSON.parse(raw);
  } catch (e) {
    // first run: default to 5 accounts
    accounts = [1, 2, 3, 4, 5].map(n => ({
      id: `claude-${n}`,
      label: `Claude ${n}`,
      color: DEFAULT_COLORS[n - 1],
    }));
    saveAccounts();
  }
}

function saveAccounts() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(accounts, null, 2));
}

function loadNotes() {
  try {
    const raw = fs.readFileSync(NOTES_PATH, 'utf-8');
    sharedNotes = JSON.parse(raw);
  } catch (e) {
    sharedNotes = { context: '', log: [] };
  }
}

function saveNotes() {
  fs.writeFileSync(NOTES_PATH, JSON.stringify(sharedNotes, null, 2));
}

function addLogEntry(action) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  sharedNotes.log.push({ action, time });
  if (sharedNotes.log.length > 200) sharedNotes.log = sharedNotes.log.slice(-200);
  saveNotes();
  sendNotes();
}

function sendNotes() {
  mainWindow.webContents.send('notes-updated', sharedNotes);
}

const DEFAULT_COLORS = ['#e8a33d', '#5fd083', '#7aa8e8', '#e2625b', '#b98ae8', '#5fd0c8', '#e8d35f'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0d1210',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'tabbar.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    sendAccountList();
    sendNotes();
    if (accounts.length > 0) {
      switchToAccount(accounts[0].id);
    }
  });

  mainWindow.on('resize', () => {
    layoutActiveView();
  });
}

function sendAccountList() {
  mainWindow.webContents.send('accounts-updated', {
    accounts,
    activeAccountId,
  });
}

function getOrCreateView(accountId) {
  if (views[accountId]) return views[accountId];

  const view = new BrowserView({
    webPreferences: {
      partition: `persist:${accountId}`, // <-- this is what isolates cookies/storage per account
      contextIsolation: true,
    },
  });

  view.webContents.loadURL('https://claude.ai');

  // Open target="_blank" links (e.g. OAuth popups) in the same view instead of new windows
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  views[accountId] = view;
  return view;
}

function layoutActiveView() {
  if (!activeAccountId || !views[activeAccountId]) return;
  const [w, h] = mainWindow.getContentSize();
  const availableWidth = panelOpen ? w - PANEL_WIDTH : w;
  views[activeAccountId].setBounds({
    x: 0,
    y: TAB_BAR_HEIGHT,
    width: availableWidth,
    height: h - TAB_BAR_HEIGHT,
  });
  views[activeAccountId].setAutoResize({ width: false, height: true });
}

function switchToAccount(accountId) {
  const view = getOrCreateView(accountId);
  const acc = accounts.find(a => a.id === accountId);
  const wasActive = activeAccountId;

  // detach currently shown view (but keep it alive in memory — session stays logged in)
  if (activeAccountId && views[activeAccountId] && views[activeAccountId] !== view) {
    mainWindow.removeBrowserView(views[activeAccountId]);
  }

  activeAccountId = accountId;
  mainWindow.addBrowserView(view);
  layoutActiveView();
  sendAccountList();

  if (wasActive !== accountId && acc) {
    addLogEntry(`Switched to ${acc.label}`);
  }
}

ipcMain.on('switch-account', (event, accountId) => {
  switchToAccount(accountId);
});

ipcMain.on('add-account', (event, label) => {
  const n = accounts.length + 1;
  const id = `claude-${Date.now()}`;
  const color = DEFAULT_COLORS[(n - 1) % DEFAULT_COLORS.length];
  accounts.push({ id, label: label || `Claude ${n}`, color });
  saveAccounts();
  sendAccountList();
  switchToAccount(id);
});

ipcMain.on('remove-account', (event, accountId) => {
  accounts = accounts.filter(a => a.id !== accountId);
  saveAccounts();

  if (views[accountId]) {
    mainWindow.removeBrowserView(views[accountId]);
    views[accountId].webContents.session.clearStorageData();
    delete views[accountId];
  }

  if (activeAccountId === accountId) {
    activeAccountId = null;
    if (accounts.length > 0) switchToAccount(accounts[0].id);
  }
  sendAccountList();
});

ipcMain.on('rename-account', (event, { accountId, label }) => {
  const acc = accounts.find(a => a.id === accountId);
  if (acc) {
    acc.label = label;
    saveAccounts();
    sendAccountList();
  }
});

ipcMain.on('reload-active', () => {
  if (activeAccountId && views[activeAccountId]) {
    views[activeAccountId].webContents.reload();
  }
});

ipcMain.handle('get-active-account', () => activeAccountId);

ipcMain.on('toggle-panel', (event, open) => {
  panelOpen = open;
  layoutActiveView();
});

ipcMain.on('save-context', (event, text) => {
  sharedNotes.context = text;
  saveNotes();
});

ipcMain.handle('get-notes', () => sharedNotes);

ipcMain.on('mark-limit-hit', (event, accountId) => {
  const acc = accounts.find(a => a.id === accountId);
  if (acc) {
    acc.limitHit = true;
    saveAccounts();
    sendAccountList();
    addLogEntry(`${acc.label} hit its session limit`);
  }
});

ipcMain.on('mark-ready', (event, accountId) => {
  const acc = accounts.find(a => a.id === accountId);
  if (acc) {
    acc.limitHit = false;
    saveAccounts();
    sendAccountList();
    addLogEntry(`${acc.label} marked ready again`);
  }
});

app.whenReady().then(() => {
  loadAccounts();
  loadNotes();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
