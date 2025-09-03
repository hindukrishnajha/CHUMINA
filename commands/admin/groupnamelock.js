module.exports = {
    handleGroupNameLock: (api, threadID, args, lockedGroups) => {
        try {
            if (args[1] === 'on') {
                const groupName = args.slice(2).join(' ');
                if (!groupName) return api.sendMessage('Group name required.', threadID);
                lockedGroups[threadID] = groupName;
                api.setTitle(groupName, threadID, (err) => {
                    if (err) return api.sendMessage('Failed to lock group name.', threadID);
                    api.sendMessage(`🔒 Group name locked: ${groupName}`, threadID);
                });
            } else if (args[1] === 'off') {
                delete lockedGroups[threadID];
                api.sendMessage('🔓 Group name unlocked!', threadID);
            } else {
                api.sendMessage(`Usage: ${botState.sessions[threadID]?.prefix || '#'}groupnamelock on/off <name>`, threadID);
            }
        } catch (e) {
            api.sendMessage('Error in groupnamelock.', threadID);
            console.error('Groupnamelock error:', e);
        }
    }
};
