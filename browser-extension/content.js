if (window.top === window) {
  const requestMediaSnapshot = () => {
    chrome.runtime.sendMessage({ type: 'poll-media' }).catch(() => {});
  };

  requestMediaSnapshot();
  window.setInterval(requestMediaSnapshot, 1500);
}
