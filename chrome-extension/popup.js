// SocialTrack Popup Controller
// Renders active timers, breakdown by supported sites, and connection state

document.addEventListener("DOMContentLoaded", () => {
  const connectionPill = document.getElementById("connectionPill");
  const connectionDot = document.getElementById("connectionDot");
  const connectionText = document.getElementById("connectionText");
  const accountEmail = document.getElementById("accountEmail");

  const activeState = document.getElementById("activeState");
  const pulseIndicator = document.getElementById("pulseIndicator");
  const activeStateText = document.getElementById("activeStateText");
  const activeSite = document.getElementById("activeSite");
  const sessionTimer = document.getElementById("sessionTimer");

  const timeYouTube = document.getElementById("timeYouTube");
  const progressYouTube = document.getElementById("progressYouTube");

  const timeInstagram = document.getElementById("timeInstagram");
  const progressInstagram = document.getElementById("progressInstagram");

  const timeReddit = document.getElementById("timeReddit");
  const progressReddit = document.getElementById("progressReddit");

  const todayTotalLabel = document.getElementById("todayTotalLabel");
  const totalUsageFormatted = document.getElementById("totalUsageFormatted");

  const btnOpenDashboard = document.getElementById("btnOpenDashboard");
  const btnSyncNow = document.getElementById("btnSyncNow");

  let timerInterval = null;
  let sessionSeconds = 0;
  let isCurrentlyTracking = false;

  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  function refreshStatus() {
    chrome.runtime.sendMessage({ type: "GET_TRACKING_STATUS" }, (response) => {
      if (!response) return;

      const { activeTracking, todayUsage, userSession } = response;

      // 1. Connection Status
      if (userSession && userSession.user_id) {
        connectionPill.className = "connection-pill connected";
        connectionDot.textContent = "●";
        connectionText.textContent = "Connected";
        accountEmail.textContent = userSession.email || "SocialTrack User";
      } else {
        connectionPill.className = "connection-pill disconnected";
        connectionDot.textContent = "○";
        connectionText.textContent = "Not Connected";
        accountEmail.textContent = "Login to Web App to Pair";
      }

      // 2. Active Tracking State
      isCurrentlyTracking = !!activeTracking?.isTracking;
      if (isCurrentlyTracking && activeTracking.platform) {
        activeState.className = "active-state active";
        pulseIndicator.className = "pulse-dot";
        activeStateText.textContent = "Tracking Active";
        activeSite.textContent = activeTracking.platform;
        sessionSeconds = activeTracking.currentSessionSeconds || 0;
      } else {
        activeState.className = "active-state paused";
        pulseIndicator.className = "";
        activeStateText.textContent = "Tracking Paused";
        activeSite.textContent = activeTracking?.platform ? `${activeTracking.platform} (Paused)` : "No Supported Site";
      }

      sessionTimer.textContent = formatTime(sessionSeconds);

      // 3. Platform Breakdown
      const ytSecs = todayUsage?.platforms?.YouTube || 0;
      const igSecs = todayUsage?.platforms?.Instagram || 0;
      const rdSecs = todayUsage?.platforms?.Reddit || 0;
      const totalSecs = ytSecs + igSecs + rdSecs;

      timeYouTube.textContent = formatDuration(ytSecs);
      timeInstagram.textContent = formatDuration(igSecs);
      timeReddit.textContent = formatDuration(rdSecs);

      const maxSecs = Math.max(ytSecs, igSecs, rdSecs, 1);
      progressYouTube.style.width = `${Math.min(100, Math.round((ytSecs / maxSecs) * 100))}%`;
      progressInstagram.style.width = `${Math.min(100, Math.round((igSecs / maxSecs) * 100))}%`;
      progressReddit.style.width = `${Math.min(100, Math.round((rdSecs / maxSecs) * 100))}%`;

      const formattedTotal = formatDuration(totalSecs);
      todayTotalLabel.textContent = formattedTotal;
      totalUsageFormatted.textContent = formattedTotal;
    });
  }

  // Live timer tick
  timerInterval = setInterval(() => {
    if (isCurrentlyTracking) {
      sessionSeconds += 1;
      sessionTimer.textContent = formatTime(sessionSeconds);
    }
  }, 1000);

  // Poll state every 3 seconds while popup is open
  const pollInterval = setInterval(refreshStatus, 3000);

  window.addEventListener("unload", () => {
    clearInterval(timerInterval);
    clearInterval(pollInterval);
  });

  // Action Handlers
  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
  });

  btnSyncNow.addEventListener("click", () => {
    btnSyncNow.disabled = true;
    btnSyncNow.innerHTML = "<span>⏳</span> Syncing...";
    chrome.runtime.sendMessage({ type: "MANUAL_SYNC_SUPABASE" }, () => {
      setTimeout(() => {
        btnSyncNow.disabled = false;
        btnSyncNow.innerHTML = "<span>✅</span> Synced!";
        refreshStatus();
        setTimeout(() => {
          btnSyncNow.innerHTML = "<span>🔄</span> Sync Now";
        }, 1500);
      }, 500);
    });
  });

  // Initial load
  refreshStatus();
});
