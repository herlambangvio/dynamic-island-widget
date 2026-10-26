# Browser Media Bridge

This companion extension sends playback metadata from browser tabs to the Dynamic Island desktop app on `127.0.0.1:47821`.

## Install in Chrome or Edge

1. Start the Dynamic Island desktop app.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this `browser-extension` folder.
5. Allow access to websites, then refresh the page playing media.

It reads the page's Media Session metadata and HTML audio/video elements. Sites that do not expose media metadata may show the page title and website instead. The extension cannot read protected browser pages such as extension stores or browser settings.
