// SocialTrack Extension Auth Bridge: Syncs logged-in session between Web App and Extension
// Runs only on SocialTrack domains (localhost:3000, vercel.app)

(() => {
  function scanAndSyncSession() {
    try {
      // 1. Scan localStorage for Supabase Auth Tokens
      let foundSession = null;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") && key.endsWith("-auth-token"))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.user || parsed.access_token)) {
                foundSession = {
                  user_id: parsed.user?.id || parsed.user_id,
                  email: parsed.user?.email || parsed.email,
                  access_token: parsed.access_token,
                  refresh_token: parsed.refresh_token,
                };
                break;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (foundSession && foundSession.user_id) {
        chrome.runtime.sendMessage({
          type: "SYNC_USER_SESSION",
          session: foundSession,
        });
        // Notify the web page that extension is connected
        window.postMessage(
          {
            type: "SOCIALTRACK_EXTENSION_PONG",
            installed: true,
            connected: true,
            email: foundSession.email,
          },
          "*"
        );
      }
    } catch {
      // Extension context invalidated
    }
  }

  // Listen for explicit ping/sync events from the SocialTrack Web App
  window.addEventListener("message", (event) => {
    if (!event.data || event.source !== window) return;

    if (event.data.type === "SOCIALTRACK_REQUEST_EXTENSION_SYNC") {
      if (event.data.session && event.data.session.user_id) {
        chrome.runtime.sendMessage({
          type: "SYNC_USER_SESSION",
          session: event.data.session,
        });
        window.postMessage(
          {
            type: "SOCIALTRACK_EXTENSION_PONG",
            installed: true,
            connected: true,
            email: event.data.session.email,
          },
          "*"
        );
      } else {
        scanAndSyncSession();
      }
    }

    if (event.data.type === "SOCIALTRACK_EXTENSION_PING") {
      chrome.storage.local.get(["userSession"], (result) => {
        window.postMessage(
          {
            type: "SOCIALTRACK_EXTENSION_PONG",
            installed: true,
            connected: !!result.userSession?.user_id,
            email: result.userSession?.email || null,
          },
          "*"
        );
      });
    }
  });

  // Run initial scan
  scanAndSyncSession();

  // Retry after 1.5s in case session was still hydrating
  setTimeout(scanAndSyncSession, 1500);
})();
