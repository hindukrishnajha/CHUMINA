module.exports = {
    handleList: (api, threadID, botState) => {
        const activeUsers = Object.keys(botState.sessions).join(', ');
        api.sendMessage(`📜 Active User IDs: ${activeUsers || 'None'}`, threadID);
    }
};
