module.exports = {
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
