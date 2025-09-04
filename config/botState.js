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
    memberCache: {} // Cache for group member IDs
};

module.exports = { botState };
