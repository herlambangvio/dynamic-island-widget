const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getState: () => ipcRenderer.invoke('get-state'),
  beginWidgetDrag: (point) => ipcRenderer.send('widget-drag-start', point),
  moveWidgetDrag: (point) => ipcRenderer.send('widget-drag-move', point),
  endWidgetDrag: () => ipcRenderer.send('widget-drag-end'),
  showWidgetMenu: () => ipcRenderer.invoke('show-widget-menu'),
  openExtensionFolder: () => ipcRenderer.invoke('open-extension-folder'),
  updateState: (partial) => ipcRenderer.invoke('update-state', partial),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state-update', (_event, state) => callback(state));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  // Intentionally empty; safe preload for future native integrations.
});
