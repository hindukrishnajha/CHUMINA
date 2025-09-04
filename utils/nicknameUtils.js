module.exports = {
    processNicknameChange: (api, threadID, botState) => {
        try {
            const queue = botState.nicknameQueues[threadID];
            if (!queue || queue.members.length === 0) {
                delete botState.nicknameTimers[threadID];
                delete botState.nicknameQueues[threadID];
                api.sendMessage('⚠️ No members to change nicknames or queue empty.', threadID);
                console.log(`Nickname queue empty or not found for thread ${threadID}`);
                return;
            }

            if (!botState.sessions[queue.botUserId]) {
                api.sendMessage('⚠️ Bot session not found for user.', threadID);
                console.error('Bot session not found for user', queue.botUserId, 'in thread', threadID);
                return;
            }

            const userID = queue.members[queue.currentIndex];
            const nickname = queue.nickname;

            api.changeNickname(nickname, threadID, userID, (err) => {
                if (err) {
                    api.sendMessage(`⚠️ Failed to change nickname for user ${userID}.`, threadID);
                    console.error(`Nickname change error for user ${userID} in thread ${threadID}:`, err);
                    return;
                }

                console.log(`Nickname changed for user ${userID} in thread ${threadID}: ${nickname}`);
                queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;

                if (queue.currentIndex === 0) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameTimers[threadID];
                    delete botState.nicknameQueues[threadID];
                    api.sendMessage('✅ All nicknames updated successfully!', threadID);
                    console.log(`Nickname change completed for thread ${threadID}`);
                } else {
                    botState.nicknameTimers[threadID] = setTimeout(() => {
                        module.exports.processNicknameChange(api, threadID, botState);
                    }, 30000);
                }
            });
        } catch (e) {
            api.sendMessage('⚠️ Error in nickname change process.', threadID);
            console.error('processNicknameChange error for thread', threadID, ':', e);
        }
    }
};
