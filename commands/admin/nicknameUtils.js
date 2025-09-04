module.exports = {
    processNicknameChange: (threadID) => {
        const { nicknameQueues, nicknameTimers, botState } = require('../config/botState');
        const queue = nicknameQueues[threadID];
        if (!queue || queue.members.length === 0) return;

        const { api } = botState.sessions[queue.botUserId];
        if (!api) return;

        const userID = queue.members[queue.currentIndex];

        api.changeNickname(queue.nickname, threadID, userID, (err) => {
            if (err) {
                console.error(`Nickname error for ${userID} in thread ${threadID}:`, err);
            } else {
                console.log(`Nickname changed for ${userID} in thread ${threadID}`);
            }

            queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;

            if (queue.currentIndex === 0) {
                // Infinite loop: Do not clear timers, continue the loop
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, 30000);
                api.sendMessage('✅ All nicknames updated. Starting new loop...', threadID);
            } else {
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, 30000);
            }
        });
    }
};
