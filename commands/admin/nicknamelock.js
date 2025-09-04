const { processNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
    handleNicknameLock: (api, threadID, args, botState, botUserId) => {
        console.log(`[DEBUG] handleNicknameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, botUserId=${botUserId}`);
        try {
            if (!botState) {
                console.error('[ERROR] botState is undefined');
                api.sendMessage('⚠️ Internal error: Bot state not initialized.', threadID);
                return;
            }
            if (!botState.nicknameQueues) {
                console.error('[ERROR] botState.nicknameQueues is undefined');
                botState.nicknameQueues = {};
                api.sendMessage('⚠️ Internal error: Nickname queues not initialized. Reinitializing...', threadID);
            }
            if (!botState.nicknameTimers) {
                console.error('[ERROR] botState.nicknameTimers is undefined');
                botState.nicknameTimers = {};
                api.sendMessage('⚠️ Internal error: Nickname timers not initialized. Reinitializing...', threadID);
            }
            if (!botState.memberCache) {
                console.error('[ERROR] botState.memberCache is undefined');
                botState.memberCache = {};
                api.sendMessage('⚠️ Internal error: Member cache not initialized. Reinitializing...', threadID);
            }

            if (args[1] && args[1].toLowerCase() === 'on') {
                if (!args[2] || isNaN(args[2]) || parseInt(args[2]) < 1) {
                    console.log(`[DEBUG] Invalid time parameter: ${args[2]}`);
                    api.sendMessage('Usage: #nicknamelock on <time_in_seconds> <nickname> or #nicknamelock off', threadID);
                    return;
                }
                const time = parseInt(args[2]) * 1000;
                const nickname = args.slice(3).join(' ') || 'LockedName';
                console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}, time: ${time}ms`);

                const tryFetchThreadInfo = (attempt = 1, maxAttempts = 5) => {
                    api.getThreadInfo(threadID, (err, info) => {
                        if (err || !info || !info.participantIDs || info.participantIDs.length === 0) {
                            console.error(`[ERROR] getThreadInfo failed for thread ${threadID} (attempt ${attempt}):`, err?.message || 'No participantIDs');
                            if (attempt < maxAttempts) {
                                console.log(`Retrying getThreadInfo for thread ${threadID} in ${5 * attempt} seconds (attempt ${attempt + 1})`);
                                setTimeout(() => tryFetchThreadInfo(attempt + 1, maxAttempts), 5000 * attempt);
                            } else {
                                console.log(`[DEBUG] Falling back to memberCache for thread ${threadID}`);
                                const members = botState.memberCache[threadID] ? Array.from(botState.memberCache[threadID]) : [];
                                if (members.length === 0) {
                                    console.log(`[DEBUG] No members in memberCache for thread ${threadID}`);
                                    api.sendMessage('⚠️ No group members found. Please send some messages in the group to populate the member list or ensure the bot has admin permissions.', threadID);
                                    return;
                                }
                                initializeNicknameLock(members);
                            }
                            return;
                        }

                        console.log(`[DEBUG] getThreadInfo succeeded for thread ${threadID}, participantIDs: ${info.participantIDs}`);
                        initializeNicknameLock(info.participantIDs);
                    });
                };

                const initializeNicknameLock = (members) => {
                    botState.nicknameQueues[threadID] = {
                        members: members.filter(id => id !== botUserId),
                        currentIndex: 0,
                        nickname,
                        botUserId,
                        active: true,
                        interval: time
                    };
                    console.log(`[DEBUG] Initialized nickname queue for thread ${threadID}:`, JSON.stringify(botState.nicknameQueues[threadID]));

                    if (botState.nicknameQueues[threadID].members.length === 0) {
                        console.error(`[ERROR] No valid members found for nickname lock in thread ${threadID}`);
                        api.sendMessage('⚠️ No valid group members found for nickname lock.', threadID);
                        delete botState.nicknameQueues[threadID];
                        return;
                    }

                    api.sendMessage(`🔒 Nickname lock enabled with nickname: ${nickname}. Changing one nickname every ${args[2]} seconds for ${botState.nicknameQueues[threadID].members.length} members.`, threadID);
                    processNicknameChange(threadID);
                };

                tryFetchThreadInfo();
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
                api.sendMessage('Usage: #nicknamelock on <time_in_seconds> <nickname> or #nicknamelock off', threadID);
            }
        } catch (e) {
            console.error(`[ERROR] handleNicknameLock error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ Error in nickname lock command. Please try again.', threadID);
        }
    }
};
