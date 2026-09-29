// SocialTrack Chrome Extension Configuration
// Public Supabase credentials for client-side API calls
const SOCIALTRACK_CONFIG = {
  SUPABASE_URL: 'https://siwyvnmkutqzhmjmruvn.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_z8_VCiFfUk0W__aYjKCIag_QCc_BJFO',
  WEB_APP_URL: 'http://localhost:3000',
  SYNC_INTERVAL_SECONDS: 30,
  IDLE_THRESHOLD_SECONDS: 60,
  SUPPORTED_PLATFORMS: {
    'youtube.com': 'YouTube',
    'www.youtube.com': 'YouTube',
    'm.youtube.com': 'YouTube',
    'instagram.com': 'Instagram',
    'www.instagram.com': 'Instagram',
    'reddit.com': 'Reddit',
    'www.reddit.com': 'Reddit',
    'old.reddit.com': 'Reddit'
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SOCIALTRACK_CONFIG;
}
