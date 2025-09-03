module.exports = {
    handleKickout: (api, threadID, args, event, isMaster, MASTER_ID) => {
        try {
            const mention = event.mentions ? Object.keys(event.mentions)[0] : args[1]?.replace('@', '');
            if (mention) {
                if (mention === MASTER_ID) return api.sendMessage('❌ Cannot kick Master ID!', threadID);
                api.getUserInfo(mention, (err, ret) => {
                    if (err || !ret?.[mention]) {
                        api.sendMessage('❌ Failed to get user info.', threadID);
                        return;
                    }
                    const name = ret[mention].name || 'User';
                    api.removeUserFromGroup(mention, threadID, (err) => {
                        if (err) {
                            api.sendMessage('❌ Error kicking user. Ensure bot has admin permissions.', threadID);
                            console.error('Kickout error:', err);
                        } else {
                            api.sendMessage(`🚫 ${name} kicked by ${isMaster ? 'Shalender Hindu Ji' : 'Admin'}.`, threadID);
                        }
                    });
                });
            } else {
                api.sendMessage(`❌ Please mention a user to kick (e.g., ${botState.sessions[threadID]?.prefix || '#'}kickout @user or @user kickout).`, threadID);
            }
        } catch (e) {
            api.sendMessage('Error in kickout command.', threadID);
            console.error('Kickout error:', e);
        }
    }
};
