const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load:      ()   => ipcRenderer.invoke('app:load'),
  save:      (s)  => ipcRenderer.invoke('app:save', s),
  setup:     (p)  => ipcRenderer.invoke('app:setup', p),
  login:     (c)  => ipcRenderer.invoke('auth:login', c),
  changePass:(c)  => ipcRenderer.invoke('auth:changePass', c),
  info:      ()   => ipcRenderer.invoke('app:info'),
  revealDB:  ()   => ipcRenderer.invoke('app:revealDB')
});