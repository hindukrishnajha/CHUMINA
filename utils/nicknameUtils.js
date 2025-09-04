module.exports = {
    processNicknameChange: (threadID) => {
        const { nicknameQueues, nicknameTimers, botState } = require('../config/botState');
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

        api.changeNickname(queue.nickname, threadID, userID, (err) => {
            if (err) {
                console.error(`Nickname error for ${userID} in thread ${threadID}:`, err);
            } else {
                console.log(`Nickname changed for ${userID} in thread ${threadID}`);
            }

            queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;

            if (queue.currentIndex === 0) {
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
    },

    handleNicknameLock: (api, threadID, args, botState, botUserId, processNicknameChange) => {
        try {
            if (args[1] && args[1].toLowerCase() === 'on') {
                const nickname = args.slice(2).join(' ') || 'LockedName';
                if (!botState.nicknameQueues[threadID]) {
                    botState.nicknameQueues[threadID] = { members: [], currentIndex: 0, nickname, botUserId };
                } else {
                    botState.nicknameQueues[threadID].nickname = nickname;
                }

                api.getThreadInfo(threadID, (err, info) => {
                    if (err) {
                        api.sendMessage('⚠️ Error fetching group members.', threadID);
                        console.error('Thread info error:', err);
                        return;
                    }

                    botState.nicknameQueues[threadID].members = info.participantIDs || [];
                    botState.nicknameQueues[threadID].active = true;

                    api.sendMessage(`🔒 Nickname lock enabled with nickname: ${nickname}`, threadID);
                    processNicknameChange(threadID);
                });
            } else if (args[1] && args[1].toLowerCase() === 'off') {
                if (botState.nicknameQueues[threadID]) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameQueues[threadID];
                    delete botState.nicknameTimers[threadID];
                    api.sendMessage('🔓 Nickname lock disabled.', threadID);
                } else {
                    api.sendMessage('⚠️ No active nickname lock in this thread.', threadID);
                }
            } else {
                api.sendMessage('Usage: #nicknamelock on <nickname> or #nicknamelock off', threadID);
            }
        } catch (e) {
            api.sendMessage('⚠️ Error in nickname lock command.', threadID);
            console.error('Nickname lock error:', e);
        }
    }
};
