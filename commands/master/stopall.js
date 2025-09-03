module.exports = {
    handleStopAll: (api, threadID, botState, stopBot) => {
        Object.keys(botState.sessions).forEach(id => {
            stopBot(id);
        });
        api.sendMessage('🚫 All bots stopped by Shalender Hindu Ji.', threadID);
    }
};
