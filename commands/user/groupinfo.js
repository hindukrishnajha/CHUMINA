module.exports = {
    handleGroupInfo: (api, threadID, lockedGroups, nicknameQueues) => {
        try {
            api.getThreadInfo(threadID, (err, info) => {
                if (err || !info) return api.sendMessage('Failed to get group info.', threadID);

                const adminList = info.adminIDs?.map(admin => admin.id) || [];

                api.getUserInfo(info.participantIDs, (err, users) => {
                    if (err) users = {};

                    const infoText = `
📌 𝗚𝗿𝗼𝘂𝗽 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${info.threadName || 'N/A'}
🆔 ID: ${threadID}
👥 Members: ${info.participantIDs?.length || 0}
👑 Admins: ${adminList.length}
🔒 Name Lock: ${lockedGroups[threadID] ? '✅' : '❌'}
🔒 Nickname Lock: ${nicknameQueues[threadID] ? '✅' : '❌'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝗧𝗲𝗱 𝗕𝗬: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`;
                    api.sendMessage(infoText, threadID);
                });
            });
        } catch (e) {
            api.sendMessage('Error in group info.', threadID);
            console.error('Group info error:', e);
        }
    }
};
