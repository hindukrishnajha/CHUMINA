module.exports = {
    handleAutoSpam: (api, threadID, botConfig, userId, broadcast) => {
        try {
            botConfig.autoSpamAccept = !botConfig.autoSpamAccept;
            api.sendMessage(`✅ Auto spam accept ${botConfig.autoSpamAccept ? 'enabled' : 'disabled'}!`, threadID);
            broadcast({
                type: 'settings',
                autoSpamAccept: botConfig.autoSpamAccept,
                autoMessageAccept: botConfig.autoMessageAccept,
                autoConvo: botState.autoConvo,
                userId
            });
        } catch (e) {
            api.sendMessage('Error in autospam.', threadID);
            console.error('Autospam error:', e);
        }
    }
};
