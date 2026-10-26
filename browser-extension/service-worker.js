const MEDIA_ENDPOINT = 'http://127.0.0.1:47821/media';
let lastCommandId = 0;
let lastCommandSucceeded = false;

function readPageMedia() {
  const sessionMetadata = navigator.mediaSession?.metadata;
  const mediaElements = Array.from(document.querySelectorAll('audio, video'));
  const activeElement = mediaElements.find((element) => !element.paused && !element.ended);
  const element = activeElement || mediaElements.find((item) => item.currentSrc || item.src);
  const hasMetadata = Boolean(sessionMetadata?.title || sessionMetadata?.artist || sessionMetadata?.album);
  const hasElement = Boolean(element?.currentSrc || element?.src);

  if (!hasMetadata && !hasElement) {
    return null;
  }

  const duration = Number(element?.duration);
  const position = Number(element?.currentTime);
  const artwork = Array.isArray(sessionMetadata?.artwork)
    ? sessionMetadata.artwork.find((item) => item.src)?.src || ''
    : '';

  return {
    connected: true,
    playing: activeElement ? true : navigator.mediaSession?.playbackState === 'playing',
    title: sessionMetadata?.title || element?.getAttribute('aria-label') || document.title || 'Browser media',
    artist: sessionMetadata?.artist || sessionMetadata?.album || location.hostname,
    source: location.hostname,
    artwork,
    duration: Number.isFinite(duration) ? duration : 0,
    position: Number.isFinite(position) ? position : 0
  };
}

function controlPageMedia(action) {
  const mediaElements = Array.from(document.querySelectorAll('audio, video'));
  const activeElement = mediaElements.find((element) => !element.paused && !element.ended);
  const element = activeElement || mediaElements.find((item) => item.currentSrc || item.src);
  const isPlaying = Boolean(activeElement) || navigator.mediaSession?.playbackState === 'playing';
  const candidates = Array.from(document.querySelectorAll('button, [role="button"], [aria-label], [title]'));
  const visibleCandidates = candidates.filter((candidate) => {
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  const labels = (candidate) => [
    candidate.getAttribute('aria-label'),
    candidate.getAttribute('title'),
    candidate.getAttribute('data-testid'),
    candidate.innerText
  ].filter(Boolean).join(' ').toLowerCase();

  let pattern;
  if (action === 'playPause') {
    const pauseControl = visibleCandidates.find((candidate) => /\bpause\b/.test(labels(candidate)));
    const playControl = visibleCandidates.find((candidate) => /\bplay\b/.test(labels(candidate)));
    if (pauseControl && !playControl) { pauseControl.click(); return true; }
    if (playControl && !pauseControl) { playControl.click(); return true; }
    if (pauseControl && playControl) { (isPlaying ? pauseControl : playControl).click(); return true; }
    if (element && isPlaying) { element.pause(); return true; }
    if (element) { element.play().catch(() => {}); return true; }
    return false;
  } else if (action === 'next') {
    pattern = /\b(next|skip forward)\b|skip-forward/;
  } else if (action === 'previous') {
    pattern = /\b(previous|prev(?:ious)? track|skip back)\b|skip-back/;
  } else {
    return false;
  }

  const control = visibleCandidates.find((candidate) => pattern.test(labels(candidate)));
  if (!control) return false;
  control.click();
  return true;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'poll-media' || !sender.tab?.id) return;

  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: 'MAIN',
    func: readPageMedia
  }).then(async (results) => {
    const media = results?.[0]?.result || {
      connected: false,
      playing: false,
      title: 'No browser media detected',
      artist: 'Start playback in a browser tab',
      source: 'Waiting for browser media',
      artwork: '',
      duration: 0,
      position: 0
    };

    media.tabId = sender.tab.id;
    media.activeTab = Boolean(sender.tab.active);
    media.lastCommandId = lastCommandId;
    media.commandSucceeded = lastCommandSucceeded;

    if (!media.connected && !sender.tab.active) return;

    const response = await fetch(MEDIA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(media)
    });
    if (!response.ok) return;

    const result = await response.json();
    if (result.command) {
      const commandResult = await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id },
        world: 'MAIN',
        func: controlPageMedia,
        args: [result.command.action]
      });
      lastCommandId = result.command.id;
      lastCommandSucceeded = Boolean(commandResult?.[0]?.result);
    }
  }).catch((error) => {
    console.debug('Could not inspect this browser tab for media:', error);
  });
});
