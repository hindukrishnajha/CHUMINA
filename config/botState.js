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
  commandCooldowns: {} // commandCooldowns को शुरू में जोड़ा
};

module.exports = { botState };
