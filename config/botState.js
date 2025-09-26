const path = require('path');

const botState = {
  sessions: {}, // Stores user session data (prefix, botID, etc.)
  nicknameTimers: {}, // Timers for nickname changes
  nicknameQueues: {}, // Queues for nickname updates
  stickerSpam: {}, // Tracks sticker spam settings
  lockedGroups: {}, // Stores locked group names
  abuseTargets: {}, // Tracks users targeted for abuse (e.g., roast targets)
  welcomeMessages: [], // Custom welcome messages for groups
  adminList: ['100023807453349'], // Master ID added to ensure proper admin/master handling
  autoConvo: false, // Auto-conversation toggle
  memberCache: {}, // Cache for group member info
  commandCooldowns: {}, // Cooldowns for commands per thread
  learnedResponses: {}, // Learned responses for auto-replies
  eventProcessed: {}, // Tracks processed events to avoid duplicates
  chatEnabled: {} // Tracks chat-enabled threads
};

// Ensure learnedResponses file exists
const fs = require('fs');
const LEARNED_RESPONSES_PATH = path.join(__dirname, '../config/learned_responses.json');
if (!fs.existsSync(LEARNED_RESPONSES_PATH)) {
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({}, null, 2), 'utf8');
}

module.exports = { botState };
