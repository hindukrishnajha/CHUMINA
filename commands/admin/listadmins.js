module.exports = {
    handleListAdmins: (api, threadID, botState) => {
        try {
            if (botState.adminList.length <= 1) {
                api.sendMessage('📜 Only Shalender Hindu Ji is an admin.', threadID);
                return;
            }
            api.getUserInfo(botState.adminList, (err, ret) => {
                if (err || !ret) {
                    api.sendMessage('❌ Failed to get admin info.', threadID);
                    console.error('Listadmins user info error:', err);
                    return;
                }
                const adminNames = botState.adminList.map(id => ret[id]?.name || id).join(', ');
                api.sendMessage(`📜 Current Admins: ${adminNames}`, threadID);
            });
        } catch (e) {
            api.sendMessage('Error in listadmins command.', threadID);
            console.error('Listadmins error:', e);
        }
    }
};
