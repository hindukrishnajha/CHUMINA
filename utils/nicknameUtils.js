module.exports = {
    processNicknameChange: (threadID) => {
        const { nicknameQueues, nicknameTimers, botState } = require('../config/botState');
        console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
        
        const queue = nicknameQueues[threadID];
        if (!queue || queue.members.length === 0) {
            console.log(`[DEBUG] No nickname queue or empty for thread ${threadID}`);
            return;
        }

        const { api } = botState.sessions[queue.botUserId];
        if (!api) {
            console.log(`[DEBUG] No API instance for botUserId ${queue.botUserId} in thread ${threadID}`);
            return;
        }

        const userID = queue.members[queue.currentIndex];
        console.log(`[DEBUG] Changing nickname for user ${userID} in thread ${threadID} to ${queue.nickname}`);

        api.changeNickname(queue.nickname, threadID, userID, (err) => {
            if (err) {
                console.error(`[ERROR] Nickname change failed for ${userID} in thread ${threadID}:`, err.message);
            } else {
                console.log(`[DEBUG] Nickname changed for ${userID} in thread ${threadID}`);
            }

            queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;

            if (queue.currentIndex === 0) {
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, queue.interval || 30000); // Use queue.interval, default to 30 seconds
                api.sendMessage(`✅ All nicknames updated. Starting new loop in ${queue.interval / 1000} seconds...`, threadID);
            } else {
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, queue.interval || 30000); // Use queue.interval, default to 30 seconds
            }
        });
    }
};                    module.exports.processNicknameChange(threadID);
                }, 30000);
            }
        });
    }
};
