const { processNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
    handleNicknameLock: (api, threadID, args, botState, botUserId) => {
        console.log(`[DEBUG] handleNicknameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, botUserId=${botUserId}`);
        try {
            // Check botState initialization
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

            // Handle command
            if (args[1] && args[1].toLowerCase() === 'on') {
                if (!args[2] || isNaN(args[2])) {
                    console.log(`[DEBUG] Invalid time parameter: ${args[2]}`);
                    api.sendMessage('Usage: #nicknamelock on <time_in_seconds> <nickname> or #nicknamelock off', threadID);
                    return;
                }
                const time = parseInt(args[2]) * 1000; // Convert seconds to milliseconds
                const nickname = args.slice(3).join(' ') || 'LockedName';
                console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}, time: ${time}ms`);

                // Initialize queue
                botState.nicknameQueues[threadID] = {
                    members: [],
                    currentIndex: 0,
                    nickname,
                    botUserId,
                    active: true,
                    interval: time
                };
                console.log(`[DEBUG] Initialized nickname queue for thread ${threadID}:`, JSON.stringify(botState.nicknameQueues[threadID]));

                // Fetch group members
                api.getThreadInfo(threadID, (err, info) => {
                    if (err) {
                        console.error(`[ERROR] getThreadInfo failed for thread ${threadID}:`, err.message);
                        api.sendMessage('⚠️ Error fetching group members. Ensure bot has admin permissions.', threadID);
                        delete botState.nicknameQueues[threadID];
                        return;
                    }

                    if (!info || !info.participantIDs || info.participantIDs.length === 0) {
                        console.error(`[ERROR] No participantIDs in thread info for thread ${threadID}`);
                        api.sendMessage('⚠️ No group members found or bot lacks access.', threadID);
                        delete botState.nicknameQueues[threadID];
                        return;
                    }

                    botState.nicknameQueues[threadID].members = info.participantIDs.filter(id => id !== botUserId); // Exclude bot
                    console.log(`[DEBUG] Updated nickname queue with ${botState.nicknameQueues[threadID].members.length} members`);

                    api.sendMessage(`🔒 Nickname lock enabled with nickname: ${nickname}. Changing one nickname every ${args[2]} seconds for ${botState.nicknameQueues[threadID].members.length} members.`, threadID);
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
                api.sendMessage('Usage: #nicknamelock on <time_in_seconds> <nickname> or #nicknamelock off', threadID);
            }
        } catch (e) {
            console.error(`[ERROR] handleNicknameLock error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ Error in nickname lock command. Please try again.', threadID);
        }
    }
};
