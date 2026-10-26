const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron');
const http = require('http');
const path = require('path');

let mainWindow;
let widgetWindow;
let mediaServer;
let widgetDragOffset = null;
let commandSequence = 0;
let activeMediaTabId = null;
const commandQueue = [];

const state = {
  connected: false,
  playing: false,
  expanded: false,
  title: 'Waiting for browser media',
  artist: 'Install the browser companion extension',
  source: 'Not connected',
  artwork: '',
  position: 0,
  duration: 0,
  controlMessage: '',
  updatedAt: 0
};

function getPayload() {
  return { ...state };
}

function sendState() {
  const payload = getPayload();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state-update', payload);
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('state-update', payload);
  }
}

function sendJson(response, status, data, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store'
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }

  response.writeHead(status, headers);
  response.end(JSON.stringify(data));
}

function isBrowserExtensionOrigin(origin) {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^edge-extension:\/\/[a-p]{32}$/.test(origin);
}

function startMediaServer() {
  mediaServer = http.createServer((request, response) => {
    const origin = request.headers.origin || '';
    if (!isBrowserExtensionOrigin(origin)) {
      sendJson(response, 403, { error: 'Browser extension origin required' });
      return;
    }

    if (request.method === 'OPTIONS' && request.url === '/media') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Private-Network': 'true',
        Vary: 'Origin'
      });
      response.end();
      return;
    }

    if (request.method !== 'POST' || request.url !== '/media') {
      sendJson(response, 404, { error: 'Not found' }, origin);
      return;
    }

    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32768) request.destroy();
    });

    request.on('end', () => {
      try {
        const media = JSON.parse(body);
        const duration = Number(media.duration);
        const position = Number(media.position);

        if (!media.connected && state.connected && Date.now() - state.updatedAt < 10000) {
          sendJson(response, 200, {}, origin);
          return;
        }

        if (media.connected && Number.isInteger(Number(media.tabId))) {
          if (media.activeTab || activeMediaTabId === null) {
            activeMediaTabId = Number(media.tabId);
          }
        }

        const acknowledgedCommandId = Number(media.lastCommandId) || 0;
        if (acknowledgedCommandId > 0) {
          const acknowledgedIndex = commandQueue.findIndex((command) => command.id === acknowledgedCommandId);
          if (acknowledgedIndex !== -1) {
            const [acknowledgedCommand] = commandQueue.splice(acknowledgedIndex, 1);
            state.controlMessage = media.commandSucceeded
              ? `${acknowledgedCommand.action} command sent`
              : `This site did not expose a ${acknowledgedCommand.action} control`;
          }
        }

        state.connected = Boolean(media.connected);
        state.playing = Boolean(media.playing);
        state.title = String(media.title || (state.connected ? 'Unknown title' : 'No browser media detected')).slice(0, 180);
        state.artist = String(media.artist || media.source || (state.connected ? 'Browser media' : 'Start playback in a browser tab')).slice(0, 180);
        state.source = String(media.source || 'Browser').slice(0, 100);
        state.artwork = typeof media.artwork === 'string' && /^https?:\/\//i.test(media.artwork) ? media.artwork.slice(0, 2048) : '';
        state.duration = Number.isFinite(duration) && duration > 0 ? Math.min(duration, 86400) : 0;
        state.position = Number.isFinite(position) && position > 0 ? Math.min(position, state.duration || position) : 0;
        state.updatedAt = Date.now();

        const pendingCommand = Number(media.tabId) === activeMediaTabId
          ? commandQueue.find((command) => command.id > (Number(media.lastCommandId) || 0))
          : null;

        sendState();
        sendJson(response, 200, { command: pendingCommand || null }, origin);
      } catch {
        sendJson(response, 400, { error: 'Invalid media payload' }, origin);
      }
    });
  });

  mediaServer.listen(47821, '127.0.0.1');
}

function createWindows() {
  const widgetWidth = 420;
  const displayBounds = screen.getPrimaryDisplay().bounds;

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow = new BrowserWindow({
    x: displayBounds.x + Math.round((displayBounds.width - widgetWidth) / 2),
    y: displayBounds.y,
    width: widgetWidth,
    height: 220,
    title: 'Dynamic Island Widget',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    movable: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app.html'));
  widgetWindow.loadFile(path.join(__dirname, 'widget.html'));

  sendState();
}

ipcMain.handle('get-state', () => getPayload());
ipcMain.on('widget-drag-start', (event, point) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow !== widgetWindow || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;

  const bounds = targetWindow.getBounds();
  widgetDragOffset = {
    x: bounds.x - Math.round(point.x),
    y: bounds.y - Math.round(point.y)
  };
});
ipcMain.on('widget-drag-move', (event, point) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (targetWindow !== widgetWindow || !widgetDragOffset || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;

  targetWindow.setPosition(
    Math.round(point.x + widgetDragOffset.x),
    Math.round(point.y + widgetDragOffset.y)
  );
});
ipcMain.on('widget-drag-end', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) === widgetWindow) {
    widgetDragOffset = null;
  }
});
ipcMain.handle('show-widget-menu', (event) => {
  const targetWindow = BrowserWindow.fromWebContents(event.sender);
  if (!targetWindow || targetWindow.isDestroyed()) return;

  const menu = Menu.buildFromTemplate([
    {
      label: state.expanded ? 'Collapse widget' : 'Expand widget',
      click: () => {
        state.expanded = !state.expanded;
        sendState();
      }
    },
    {
      label: 'Minimize to taskbar',
      click: () => targetWindow.minimize()
    },
    { type: 'separator' },
    {
      label: 'Quit Dynamic Island Widget',
      click: () => app.quit()
    }
  ]);

  menu.popup({ window: targetWindow });
});
ipcMain.handle('open-extension-folder', () => {
  const extensionPath = app.isPackaged
    ? path.join(process.resourcesPath, 'browser-extension')
    : path.join(__dirname, 'browser-extension');
  return shell.openPath(extensionPath);
});

ipcMain.handle('update-state', (_event, partial) => {
  if (typeof partial.expanded === 'boolean') {
    state.expanded = partial.expanded;
  }
  if (['playPause', 'next', 'previous'].includes(partial.command)) {
    const command = {
      id: ++commandSequence,
      action: partial.command
    };
    commandQueue.push(command);
    state.controlMessage = `Sending ${command.action} command`;
  }

  sendState();
  return getPayload();
});

app.whenReady().then(() => {
  startMediaServer();
  createWindows();

  setInterval(() => {
    if (state.connected && Date.now() - state.updatedAt > 10000) {
      state.connected = false;
      state.playing = false;
      state.title = 'No browser media detected';
      state.artist = 'Start playback in a browser tab';
      state.source = 'Waiting for browser media';
      state.artwork = '';
      state.position = 0;
      state.duration = 0;
      sendState();
    }
  }, 3000).unref();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  mediaServer?.close();
});
