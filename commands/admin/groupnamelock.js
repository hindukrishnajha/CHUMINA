module.exports = {
    handleGroupNameLock: (api, threadID, args, botState) => {
        try {
            if (!botState.lockedGroups) {
                botState.lockedGroups = {};
                console.error('botState.lockedGroups initialized in groupnamelock.js');
            }

            if (args[1] === 'on') {
                const groupName = args.slice(2).join(' ');
                if (!groupName) {
                    api.sendMessage('❌ Group name required.', threadID);
                    return;
                }
                botState.lockedGroups[threadID] = groupName;
                api.setTitle(groupName, threadID, (err) => {
                    if (err) {
                        api.sendMessage('⚠️ Failed to lock group name. Ensure bot has admin permissions.', threadID);
                        console.error('setTitle error for thread', threadID, ':', err);
                        return;
                    }
                    api.sendMessage(`🔒 Group name locked: ${groupName}`, threadID);
                    console.log(`Group name locked for thread ${threadID}: ${groupName}`);
                });
            } else if (args[1] === 'off') {
                if (botState.lockedGroups[threadID]) {
                    delete botState.lockedGroups[threadID];
                    api.sendMessage('🔓 Group name unlocked!', threadID);
                    console.log(`Group name unlocked for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ No active group name lock in this thread.', threadID);
                }
            } else {
                api.sendMessage(`Usage: #groupnamelock on/off <name>`, threadID);
            }
        } catch (e) {
            api.sendMessage('⚠️ Error in groupnamelock command.', threadID);
            console.error('Groupnamelock error for thread', threadID, ':', e);
        }
    }
};
