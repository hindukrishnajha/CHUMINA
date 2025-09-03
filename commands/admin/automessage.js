module.exports = {
    handleAutoMessage: (api, threadID, botConfig, userId, broadcast) => {
        try {
            botConfig.autoMessageAccept = !botConfig.autoMessageAccept;
            api.sendMessage(`✅ Auto message accept ${botConfig.autoMessageAccept ? 'enabled' : 'disabled'}!`, threadID);
            broadcast({
                type: 'settings',
                autoSpamAccept: botConfig.autoSpamAccept,
                autoMessageAccept: botConfig.autoMessageAccept,
                autoConvo: botState.autoConvo,
                userId
            });
        } catch (e) {
            api.sendMessage('Error in automessage.', threadID);
            console.error('Automessage error:', e);
        }
    }
};
