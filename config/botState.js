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
  commandCooldowns: {}, // शुरू में खाली ऑब्जेक्ट
  learnedResponses: {},
  eventProcessed: {},
  chatEnabled: {}
};

module.exports = { botState };
