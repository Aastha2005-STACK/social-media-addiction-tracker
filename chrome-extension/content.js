// SocialTrack Content Script: Active Tab Visibility & User Interaction Tracker
// Strictly tracks active screen time. NEVER collects passwords, private chats, or page contents.

(() => {
  const hostname = window.location.hostname.toLowerCase();
  let platform = null;

  if (hostname.includes("youtube.com")) {
    platform = "YouTube";
  } else if (hostname.includes("instagram.com")) {
    platform = "Instagram";
  } else if (hostname.includes("reddit.com")) {
    platform = "Reddit";
  }

  if (!platform) return;

  let isPageVisible = !document.hidden && document.visibilityState === "visible";
  let lastUserActivityTime = Date.now();
  let activityHeartbeatInterval = null;
  const IDLE_LIMIT_MS = 60 * 1000; // 60 seconds without interaction

  function notifyBackground(action, extra = {}) {
    try {
      chrome.runtime.sendMessage({
        type: action,
        platform: platform,
        url: window.location.href,
        timestamp: Date.now(),
        ...extra,
      });
    } catch {
      // Extension context invalidated or service worker starting
    }
  }

  // 1. Detect document visibility change (tab switched, minimized, or covered)
  document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden && document.visibilityState === "visible";
    if (isPageVisible) {
      lastUserActivityTime = Date.now();
      notifyBackground("PAGE_ACTIVE", { reason: "visibilitychange_visible" });
    } else {
      notifyBackground("PAGE_INACTIVE", { reason: "visibilitychange_hidden" });
    }
  });

  // 2. Track real user interactions (mouse, scroll, clicks, keypress)
  function onUserActive() {
    lastUserActivityTime = Date.now();
  }

  ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"].forEach((event) => {
    window.addEventListener(event, onUserActive, { passive: true });
  });

  // 3. YouTube/Video specific activity detection (video actively playing)
  function isMediaPlaying() {
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (!v.paused && !v.ended && v.currentTime > 0) {
        return true;
      }
    }
    return false;
  }

  // 4. Periodic heartbeat verifying active state
  activityHeartbeatInterval = setInterval(() => {
    if (!isPageVisible) return;

    const timeSinceLastActivity = Date.now() - lastUserActivityTime;
    const isPlayingVideo = platform === "YouTube" && isMediaPlaying();

    if (timeSinceLastActivity <= IDLE_LIMIT_MS || isPlayingVideo) {
      notifyBackground("HEARTBEAT_ACTIVE", { isPlayingVideo });
    } else {
      notifyBackground("PAGE_IDLE");
    }
  }, 5000);

  // 5. Initial mount notification
  if (isPageVisible) {
    notifyBackground("PAGE_ACTIVE", { reason: "initial_load" });
  }

  // 6. Page unload / navigation away
  window.addEventListener("pagehide", () => {
    clearInterval(activityHeartbeatInterval);
    notifyBackground("PAGE_INACTIVE", { reason: "pagehide" });
  });

  window.addEventListener("beforeunload", () => {
    clearInterval(activityHeartbeatInterval);
    notifyBackground("PAGE_INACTIVE", { reason: "beforeunload" });
  });
})();
