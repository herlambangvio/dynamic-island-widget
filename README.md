# Dynamic Island Widget

This project is a Windows desktop app based on the HTML mockup. It is packaged as an Electron app and can be built into a Windows installer.

## Requirements

- Node.js 18+ recommended
- npm
- Windows 10/11

## Install

```bash
npm install
```

## Run locally

```bash
npm start
```

## Sync browser media

1. Start the desktop app.
2. In Chrome open `chrome://extensions`; in Edge open `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select this project's `browser-extension` folder.
4. Approve access to websites, then refresh the tab playing media.

The companion extension reads page Media Session metadata and HTML audio/video elements, then sends it to the desktop app on `127.0.0.1`. It works with browser sites that expose media metadata or use standard audio/video elements. It cannot read protected browser pages, and it does not integrate with native desktop players.
In the expanded widget, use the transport buttons to send Play/Pause, Previous, or Next to the active media tab. Play/Pause also falls back to the tab's audio/video element; Previous/Next require labeled controls provided by the site. Right-click the widget for Expand/Collapse, Minimize to taskbar, or Quit.

## Build Windows installer

```bash
npm run build
```

This creates an NSIS `.exe` installer in the `dist` folder.

## Notes

- This is a desktop app, not a native Windows Widgets panel widget.
- It behaves like a floating always-on-top desktop widget window.
- The browser companion must be loaded separately; the installer cannot silently install a browser extension.
- The extension requires permission to inspect websites so it can detect media playback across tabs.
- This is not a native Windows Widgets panel card.
