const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const store = require('./database');

let win;
const hashPass = (pass, salt) => crypto.createHash('sha256').update(`${salt}::${pass}`).digest('hex');
const makeUser = (name, username, password, role = 'admin') => {
  const salt = crypto.randomBytes(12).toString('hex');
  return { name, username, role, salt, hash: hashPass(password, salt) };
};

function createWindow() {
  win = new BrowserWindow({
    width: 1380, height: 860, minWidth: 1024, minHeight: 700,
    backgroundColor: '#12161b', autoHideMenuBar: true, title: 'معدن‌بان',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  store.init(app.getPath('userData'));
  store.audit('app-start');

  /* داده و احراز هویت */
  ipcMain.handle('app:load', () => ({ settings: store.kvGet('settings'), data: store.kvGet('data') }));
  ipcMain.handle('app:save', (e, state) => { store.kvSet('settings', state.settings); store.kvSet('data', state.data); return true; });
  ipcMain.handle('app:setup', (e, { mine, admin }) => {
    const settings = { mine, users: [makeUser(admin.name, admin.username, admin.password)], createdAt: new Date().toISOString() };
    store.kvSet('settings', settings); store.audit('mine-setup', mine.name); return settings;
  });
  ipcMain.handle('auth:login', (e, { username, password }) => {
    const s = store.kvGet('settings'); if (!s || !s.users) return null;
    const u = s.users.find(x => x.username === username);
    if (!u || hashPass(password, u.salt) !== u.hash) { store.audit('login-fail', username); return null; }
    store.audit('login-ok', username);
    return { name: u.name, username: u.username, role: u.role };
  });
  ipcMain.handle('auth:changePass', (e, { current, next }) => {
    const s = store.kvGet('settings'); const u = s && s.users && s.users[0];
    if (!u || hashPass(current, u.salt) !== u.hash) return false;
    s.users[0] = makeUser(u.name, u.username, next, u.role);
    store.kvSet('settings', s); store.audit('pass-change'); return true;
  });
  ipcMain.handle('app:info', () => ({ dbPath: store.getDbPath(), version: app.getVersion(), platform: process.platform }));
  ipcMain.handle('app:revealDB', () => shell.showItemInFolder(store.getDbPath()));

  /* ═══ خروجی PDF (موتور چاپ داخلی Electron — کاملاً آفلاین) ═══ */
  ipcMain.handle('export:pdf', async (e, { html, title }) => {
    try {
      const w = new BrowserWindow({
        show: false, width: 900, height: 1200,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
      });
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      await new Promise(r => setTimeout(r, 350));   // انتظار برای رندر کامل
      const pdf = await w.webContents.printToPDF({
        pageSize: 'A4', printBackground: true,
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      });
      w.destroy();
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'ذخیره گزارش PDF',
        defaultPath: path.join(app.getPath('documents'), (title || 'گزارش') + '.pdf'),
        filters: [{ name: 'PDF File', extensions: ['pdf'] }]
      });
      if (canceled || !filePath) return { ok: false };
      fs.writeFileSync(filePath, pdf);
      store.audit('pdf-export', title || '');
      return { ok: true, filePath };
    } catch (err) { return { ok: false, msg: String(err) }; }
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
