const { nicknameQueues, nicknameTimers, botState } = require('../config/botState');

module.exports = {
    processNicknameChange: (threadID) => {
        console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
        
        const queue = nicknameQueues[threadID];
        if (!queue || queue.members.length === 0) {
            console.log(`[DEBUG] No nickname queue or empty for thread ${threadID}`);
            return;
        }

        const session = botState.sessions[queue.botUserId];
        if (!session || !session.api || !session.running) {
            console.log(`[DEBUG] No valid session or API for botUserId ${queue.botUserId} in thread ${threadID}`);
            if (session?.cookieContent) {
                console.log(`[DEBUG] Attempting to restart bot session for botUserId ${queue.botUserId}`);
                const { startBot } = require('../../index');
                startBot(queue.botUserId, session.cookieContent, session.prefix, session.adminID);
            }
            return;
        }

        const { api } = session;
        const userID = queue.members[queue.currentIndex];
        console.log(`[DEBUG] Changing nickname for user ${userID} in thread ${threadID} to ${queue.nickname}`);

        api.changeNickname(queue.nickname, threadID, userID, (err) => {
            if (err) {
                console.error(`[ERROR] Nickname change failed for ${userID} in thread ${threadID}:`, err.message);
                if (err.message.includes('not logged in') || err.message.includes('invalid session')) {
                    console.log(`[DEBUG] Attempting to restart bot session for botUserId ${queue.botUserId}`);
                    const { startBot } = require('../../index');
                    startBot(queue.botUserId, session.cookieContent, session.prefix, session.adminID);
                }
            } else {
                console.log(`[DEBUG] Nickname changed for ${userID} in thread ${threadID}`);
            }

            queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;

            if (queue.currentIndex === 0) {
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, queue.interval || 30000);
                api.sendMessage(`✅ All nicknames updated. Starting new loop in ${queue.interval / 1000} seconds...`, threadID);
            } else {
                nicknameTimers[threadID] = setTimeout(() => {
                    module.exports.processNicknameChange(threadID);
                }, queue.interval || 30000);
            }
        });
    }
};
