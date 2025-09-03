module.exports = {
    handleKick: (api, threadID, args, botState, stopBot) => {
        const targetId = args[1];
        if (botState.sessions[targetId]) {
            stopBot(targetId);
            api.sendMessage(`🚫 Bot for User ID ${targetId} stopped by Shalender Hindu Ji.`, threadID);
        } else {
            api.sendMessage(`❌ No bot running for User ID ${targetId}.`, threadID);
        }
    }
};
