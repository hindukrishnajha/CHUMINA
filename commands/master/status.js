module.exports = {
    handleStatus: (api, threadID, botState) => {
        const activeBots = Object.keys(botState.sessions).length;
        api.sendMessage(`📊 Active bots: ${activeBots}`, threadID);
    }
};
