// SocialTrack Background Service Worker (Manifest V3)
// Real-time active tab screen time tracker for YouTube, Instagram, and Reddit

importScripts("config.js");

// Active Tracking State
let activeTracking = {
  platform: null,
  tabId: null,
  isTracking: false,
  lastTickTimestamp: Date.now(),
  currentSessionSeconds: 0,
};

let userSession = null;
let todayUsage = {
  date: getTodayDateString(),
  platforms: {
    YouTube: 0,
    Instagram: 0,
    Reddit: 0,
  },
};

// Pending uncommitted seconds to sync to Supabase
let pendingSyncSeconds = {
  YouTube: 0,
  Instagram: 0,
  Reddit: 0,
};

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

// 1. Initialize State from Storage
chrome.storage.local.get(["userSession", "todayUsage", "pendingSyncSeconds"], (result) => {
  if (result.userSession) {
    userSession = result.userSession;
  }
  const today = getTodayDateString();
  if (result.todayUsage && result.todayUsage.date === today) {
    todayUsage = result.todayUsage;
  } else {
    todayUsage = {
      date: today,
      platforms: { YouTube: 0, Instagram: 0, Reddit: 0 },
    };
    chrome.storage.local.set({ todayUsage });
  }
  if (result.pendingSyncSeconds) {
    pendingSyncSeconds = result.pendingSyncSeconds;
  }
  checkActiveTab();
});

// 2. Identify platform from URL
function detectPlatform(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    for (const [pattern, name] of Object.entries(SOCIALTRACK_CONFIG.SUPPORTED_PLATFORMS)) {
      if (host === pattern || host.endsWith("." + pattern)) {
        return name;
      }
    }
  } catch {
    // invalid URL
  }
  return null;
}

// 3. Start or Pause Tracking
function startTracking(platform, tabId) {
  const now = Date.now();
  if (activeTracking.isTracking && activeTracking.platform === platform && activeTracking.tabId === tabId) {
    return; // Already tracking this tab
  }

  // Flush previous session if switching platforms
  if (activeTracking.isTracking && activeTracking.platform !== platform) {
    pauseTracking();
  }

  activeTracking = {
    platform: platform,
    tabId: tabId,
    isTracking: true,
    lastTickTimestamp: now,
    currentSessionSeconds: 0,
  };

  chrome.action.setBadgeText({ text: "●" });
  chrome.action.setBadgeBackgroundColor({ color: "#a855f7" }); // Purple badge
}

function pauseTracking() {
  if (!activeTracking.isTracking) return;

  const now = Date.now();
  const elapsedSeconds = Math.round((now - activeTracking.lastTickTimestamp) / 1000);

  if (elapsedSeconds > 0 && activeTracking.platform) {
    recordSeconds(activeTracking.platform, elapsedSeconds);
  }

  activeTracking.isTracking = false;
  activeTracking.lastTickTimestamp = now;
  chrome.action.setBadgeText({ text: "" });
}

function recordSeconds(platform, seconds) {
  if (!todayUsage.platforms[platform]) {
    todayUsage.platforms[platform] = 0;
  }
  todayUsage.platforms[platform] += seconds;
  pendingSyncSeconds[platform] = (pendingSyncSeconds[platform] || 0) + seconds;

  // Persist to storage
  chrome.storage.local.set({
    todayUsage: todayUsage,
    pendingSyncSeconds: pendingSyncSeconds,
  });
}

// 4. Inspect Current Active Tab
async function checkActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      pauseTracking();
      return;
    }

    const activeTab = tabs[0];
    const platform = detectPlatform(activeTab.url);

    if (platform) {
      startTracking(platform, activeTab.id);
    } else {
      pauseTracking();
    }
  } catch {
    pauseTracking();
  }
}

// 5. Active Tab Listeners
chrome.tabs.onActivated.addListener(() => {
  checkActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id === tabId) {
        const platform = detectPlatform(tab.url);
        if (platform) {
          startTracking(platform, tabId);
        } else {
          pauseTracking();
        }
      }
    });
  }
});

// 6. Window Focus Listener (Pause if Chrome is minimized or in background)
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseTracking();
  } else {
    checkActiveTab();
  }
});

// 7. Idle Listener (Pause if user walks away from computer)
chrome.idle.setDetectionInterval(SOCIALTRACK_CONFIG.IDLE_THRESHOLD_SECONDS);
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === "idle" || newState === "locked") {
    pauseTracking();
  } else if (newState === "active") {
    checkActiveTab();
  }
});

// 8. Messages from Content Script or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_ACTIVE") {
    if (message.platform) {
      startTracking(message.platform, sender.tab ? sender.tab.id : null);
    }
  } else if (message.type === "PAGE_INACTIVE" || message.type === "PAGE_IDLE") {
    if (activeTracking.tabId === (sender.tab ? sender.tab.id : null)) {
      pauseTracking();
    }
  } else if (message.type === "HEARTBEAT_ACTIVE") {
    if (activeTracking.isTracking && activeTracking.platform) {
      const now = Date.now();
      const elapsed = Math.round((now - activeTracking.lastTickTimestamp) / 1000);
      if (elapsed >= 1) {
        recordSeconds(activeTracking.platform, elapsed);
        activeTracking.currentSessionSeconds += elapsed;
        activeTracking.lastTickTimestamp = now;
      }
    }
  } else if (message.type === "SYNC_USER_SESSION") {
    if (message.session) {
      userSession = message.session;
      chrome.storage.local.set({ userSession });
      // Trigger immediate sync
      syncUsageToSupabase();
    }
  } else if (message.type === "GET_TRACKING_STATUS") {
    sendResponse({
      activeTracking,
      todayUsage,
      userSession,
      pendingSyncSeconds,
    });
    return true;
  } else if (message.type === "MANUAL_SYNC_SUPABASE") {
    syncUsageToSupabase().then((res) => {
      sendResponse(res);
    });
    return true;
  }
});

// 9. Sync Telemetry to Supabase
async function syncUsageToSupabase() {
  if (!userSession || !userSession.user_id) {
    return { success: false, reason: "No user authenticated" };
  }

  const today = getTodayDateString();
  const platformsToSync = Object.entries(todayUsage.platforms);

  for (const [platform, totalSecs] of platformsToSync) {
    if (totalSecs <= 0) continue;
    const totalMinutes = Math.max(1, Math.round(totalSecs / 60));

    try {
      // 1. Check if a log entry already exists today for this user + platform
      const queryUrl = `${SOCIALTRACK_CONFIG.SUPABASE_URL}/rest/v1/usage_logs?user_id=eq.${userSession.user_id}&platform=eq.${encodeURIComponent(platform)}&log_date=eq.${today}&select=id,duration_minutes`;

      const headers = {
        apikey: SOCIALTRACK_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${userSession.access_token || SOCIALTRACK_CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      };

      const checkRes = await fetch(queryUrl, { headers });
      const existingLogs = await checkRes.json();

      if (Array.isArray(existingLogs) && existingLogs.length > 0) {
        // Update existing record
        const logId = existingLogs[0].id;
        await fetch(`${SOCIALTRACK_CONFIG.SUPABASE_URL}/rest/v1/usage_logs?id=eq.${logId}`, {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            duration_minutes: totalMinutes,
            notes: "Synced from SocialTrack Chrome Extension",
          }),
        });
      } else {
        // Insert new record
        await fetch(`${SOCIALTRACK_CONFIG.SUPABASE_URL}/rest/v1/usage_logs`, {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_id: userSession.user_id,
            platform: platform,
            duration_minutes: totalMinutes,
            log_date: today,
            notes: "Synced from SocialTrack Chrome Extension",
          }),
        });
      }

      // Clear pending seconds for this platform
      pendingSyncSeconds[platform] = 0;
    } catch (err) {
      console.error("Supabase sync failed for platform:", platform, err);
    }
  }

  chrome.storage.local.set({ pendingSyncSeconds });
  return { success: true };
}

// 10. Alarm for Periodic Background Sync every 30 seconds
chrome.alarms.create("syncTelemetryAlarm", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncTelemetryAlarm") {
    // If tracking is active, record elapsed tick
    if (activeTracking.isTracking && activeTracking.platform) {
      const now = Date.now();
      const elapsed = Math.round((now - activeTracking.lastTickTimestamp) / 1000);
      if (elapsed >= 1) {
        recordSeconds(activeTracking.platform, elapsed);
        activeTracking.currentSessionSeconds += elapsed;
        activeTracking.lastTickTimestamp = now;
      }
    }
    syncUsageToSupabase();
  }
});
