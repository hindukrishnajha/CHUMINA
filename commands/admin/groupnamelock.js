module.exports = {
    handleGroupNameLock: (api, threadID, args, botState) => {
        try {
            // Initialize botState.lockedGroups if not present
            if (!botState.lockedGroups) {
                botState.lockedGroups = {};
                console.warn(`botState.lockedGroups initialized in groupnamelock.js for thread ${threadID}`);
            }

            // Validate args
            if (!args[1]) {
                api.sendMessage('❌ Invalid command. Usage: #groupnamelock on/off <name>', threadID);
                return;
            }

            const command = args[1].toLowerCase();
            if (command === 'on') {
                const groupName = args.slice(2).join(' ');
                if (!groupName) {
                    api.sendMessage('❌ Group name required. Usage: #groupnamelock on <name>', threadID);
                    return;
                }

                api.setTitle(groupName, threadID, (err) => {
                    if (err) {
                        api.sendMessage('⚠️ Failed to lock group name. Ensure bot has admin permissions.', threadID);
                        console.error(`setTitle error for thread ${threadID}:`, err.message || err);
                        return;
                    }
                    botState.lockedGroups[threadID] = groupName;
                    api.sendMessage(`🔒 Group name locked: ${groupName}`, threadID);
                    console.log(`Group name locked for thread ${threadID}: ${groupName}`);
                });
            } else if (command === 'off') {
                if (botState.lockedGroups[threadID]) {
                    delete botState.lockedGroups[threadID];
                    api.sendMessage('🔓 Group name unlocked!', threadID);
                    console.log(`Group name unlocked for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ No active group name lock in this thread.', threadID);
                }
            } else {
                api.sendMessage('❌ Invalid command. Usage: #groupnamelock on/off <name>', threadID);
            }
        } catch (e) {
            api.sendMessage('⚠️ Error in groupnamelock command.', threadID);
            console.error(`Groupnamelock error for thread ${threadID}:`, e.message || e);
        }
    }
};
