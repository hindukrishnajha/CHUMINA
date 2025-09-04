module.exports = {
    handleKickOut: (api, threadID, args, event, isMaster, MASTER_ID) => {
        console.log(`[DEBUG] handleKickOut called: threadID=${threadID}, args=${JSON.stringify(args)}, event.mentions=${JSON.stringify(event.mentions)}`);
        try {
            if (!event.mentions || Object.keys(event.mentions).length === 0) {
                console.log(`[DEBUG] No mentions provided for kickout in thread ${threadID}`);
                api.sendMessage('Usage: #kickout @user', threadID);
                return;
            }

            const targetID = Object.keys(event.mentions)[0];
            if (targetID === MASTER_ID) {
                console.log(`[DEBUG] Attempted to kick master ${MASTER_ID} in thread ${threadID}`);
                api.sendMessage('🚫 You cannot kick the master!', threadID);
                return;
            }

            api.getThreadInfo(threadID, (err, info) => {
                if (err || !info) {
                    console.error(`[ERROR] getThreadInfo failed for thread ${threadID}:`, err?.message || 'No thread info');
                    api.sendMessage('⚠️ Failed to get group info. Please ensure the bot has admin permissions.', threadID);
                    return;
                }

                if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
                    console.log(`[DEBUG] Bot is not admin in thread ${threadID}`);
                    api.sendMessage('⚠️ Bot must be an admin to use #kickout.', threadID);
                    return;
                }

                api.getUserInfo(targetID, (err, ret) => {
                    if (err || !ret[targetID]) {
                        console.error(`[ERROR] getUserInfo failed for user ${targetID}:`, err?.message || 'No user info');
                        api.sendMessage('⚠️ Failed to get user info.', threadID);
                        return;
                    }

                    const name = ret[targetID].name || 'User';
                    api.removeUserFromGroup(targetID, threadID, (err) => {
                        if (err) {
                            console.error(`[ERROR] Failed to kick user ${targetID} from thread ${threadID}:`, err.message);
                            api.sendMessage(`⚠️ Failed to kick ${name}. Please ensure the bot has admin permissions.`, threadID);
                        } else {
                            console.log(`[DEBUG] Successfully kicked user ${targetID} (${name}) from thread ${threadID}`);
                            api.sendMessage(`✅ ${name} has been kicked from the group!`, threadID);
                        }
                    });
                });
            });
        } catch (e) {
            console.error(`[ERROR] handleKickOut error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ Error in kickout command. Please try again.', threadID);
        }
    }
};
