// config/botState.js
const botState = {
  sessions: {}, // Bot sessions per user
  learnedResponses: {}, // Learned responses
  mafiaGames: {}, // Mafia game states
  adminList: [], // Admin IDs
  lockedGroups: {}, // Locked group names
  welcomeMessages: [], // Welcome messages
  goodbyeMessages: {
    member: ['{name} चला गया, भाई लोग! 😢'],
    admin: ['{name} को एडमिन ने निकाला! 😈']
  },
  eventProcessed: {}, // Processed events
  commandCooldowns: {}, // Command cooldowns
  roastEnabled: {}, // Roast mode per thread
  roastCooldowns: {}, // Roast cooldowns per user
  roastTargets: {}, // Roast targets
  abuseTargets: {}, // Abuse targets
  mutedUsers: {}, // Muted users
  deleteNotifyEnabled: {}, // Delete notification settings
  chatEnabled: {}, // AI chat settings
  memberCache: {}, // Cache group members
  autoConvo: false // Auto conversation mode
};

module.exports = { botState };
