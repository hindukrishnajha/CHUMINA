// config/botState.js
const botState = {
  sessions: {},
  nicknameTimers: {},
  nicknameQueues: {},
  stickerSpam: {},
  lockedGroups: {},
  abuseTargets: {},
  welcomeMessages: [],
  adminList: [],
  autoConvo: false,
  memberCache: {},
  commandCooldowns: {},
  learnedResponses: {},
  eventProcessed: {},
  chatEnabled: {}
};

module.exports = { botState };
