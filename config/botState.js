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
    memberCache: {}
};

module.exports = { botState };
