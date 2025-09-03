module.exports = {
    handleUid: (api, threadID, args, event) => {
        try {
            if (args[1] && event.mentions) {
                const targetID = Object.keys(event.mentions)[0];
                if (targetID) {
                    api.getUserInfo(targetID, (err, ret) => {
                        if (err) return api.sendMessage('Failed to get user info.', threadID);
                        const name = ret?.[targetID]?.name || 'User';
                        api.sendMessage(`👤 User Name: ${name}\n🆔 User ID: ${targetID}`, threadID);
                    });
                }
            } else {
                api.getUserInfo(event.senderID, (err, ret) => {
                    if (err) return api.sendMessage('Failed to get user info.', threadID);
                    const name = ret?.[event.senderID]?.name || 'You';
                    api.sendMessage(`👤 Your Name: ${name}\n🆔 Your ID: ${event.senderID}`, threadID);
                });
            }
        } catch (e) {
            api.sendMessage('Error in uid.', threadID);
            console.error('Uid error:', e);
        }
    }
};
