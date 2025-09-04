module.exports = {
    handleNicknameLock: (api, threadID, args, botState, botUserId, processNicknameChange) => {
        console.log(`[DEBUG] handleNicknameLock called for threadID: ${threadID}, args: ${JSON.stringify(args)}, botUserId: ${botUserId}`);
        try {
            if (!botState.nicknameQueues) {
                console.error('[ERROR] botState.nicknameQueues is undefined');
                api.sendMessage('⚠️ Internal error: Nickname queues not initialized.', threadID);
                return;
            }

            if (args[1] && args[1].toLowerCase() === 'on') {
                const nickname = args.slice(2).join(' ') || 'LockedName';
                console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}`);

                if (!botState.nicknameQueues[threadID]) {
                    botState.nicknameQueues[threadID] = { members: [], currentIndex: 0, nickname, botUserId };
                } else {
                    botState.nicknameQueues[threadID].nickname = nickname;
                }

                api.getThreadInfo(threadID, (err, info) => {
                    if (err) {
                        console.error(`[ERROR] getThreadInfo failed for thread ${threadID}:`, err.message);
                        api.sendMessage('⚠️ Error fetching group members. Ensure bot has group access.', threadID);
                        return;
                    }

                    if (!info || !info.participantIDs) {
                        console.error(`[ERROR] No participantIDs in thread info for thread ${threadID}`);
                        api.sendMessage('⚠️ No group members found.', threadID);
                        return;
                    }

                    botState.nicknameQueues[threadID].members = info.participantIDs;
                    botState.nicknameQueues[threadID].active = true;
                    console.log(`[DEBUG] Nickname queue set for thread ${threadID}:`, JSON.stringify(botState.nicknameQueues[threadID]));

                    api.sendMessage(`🔒 Nickname lock enabled with nickname: ${nickname}`, threadID);
                    processNicknameChange(threadID);
                });
            } else if (args[1] && args[1].toLowerCase() === 'off') {
                if (botState.nicknameQueues[threadID]) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameQueues[threadID];
                    delete botState.nicknameTimers[threadID];
                    console.log(`[DEBUG] Nickname lock disabled for thread ${threadID}`);
                    api.sendMessage('🔓 Nickname lock disabled.', threadID);
                } else {
                    console.log(`[DEBUG] No active nickname lock for thread ${threadID}`);
                    api.sendMessage('⚠️ No active nickname lock in this thread.', threadID);
                }
            } else {
                console.log(`[DEBUG] Invalid nicknamelock command: ${args.join(' ')}`);
                api.sendMessage('Usage: #nicknamelock on <nickname> or #nicknamelock off', threadID);
            }
        } catch (e) {
            console.error(`[ERROR] handleNicknameLock error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ Error in nickname lock command.', threadID);
        }
    }
};
