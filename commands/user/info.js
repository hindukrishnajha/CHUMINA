module.exports = {
    handleInfo: (api, threadID, args, event) => {
        try {
            let targetID = event.senderID;

            if (args[1] && event.mentions) {
                targetID = Object.keys(event.mentions)[0];
            } else if (event.messageReply) {
                targetID = event.messageReply.senderID;
            }

            if (!targetID) return api.sendMessage('No target user.', threadID);

            api.getUserInfo(targetID, (err, ret) => {
                if (err || !ret?.[targetID]) {
                    return api.sendMessage("Failed to get user info.", threadID);
                }

                const user = ret[targetID];
                const genderMap = {
                    1: 'Female',
                    2: 'Male',
                    3: 'Custom'
                };

                const infoText = `
👤 𝗨𝘀𝗲𝗿 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${user.name}
🆔 ID: ${targetID}
👫 Gender: ${genderMap[user.gender] || 'Unknown'}
📍 Location: ${user.location?.name || 'N/A'}
💬 Bio: ${user.bio || 'N/A'}
💑 Relationship: ${user.relationship_status || 'N/A'}
📅 Profile Created: ${new Date(user.profileCreation * 1000).toLocaleDateString() || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝗧𝗲𝗱 𝗕𝗬: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`;
                api.sendMessage(infoText, threadID);
            });
        } catch (e) {
            api.sendMessage('Error in info.', threadID);
            console.error('Info error:', e);
        }
    }
};
