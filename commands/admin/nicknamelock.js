module.exports = {
    handleNicknameLock: (api, threadID, args, botState, userId, processNicknameChange) => {
        try {
            if (!botState.sessions || !botState.nicknameTimers || !botState.nicknameQueues) {
                botState.nicknameTimers = botState.nicknameTimers || {};
                botState.nicknameQueues = botState.nicknameQueues || {};
                console.error('botState.nicknameTimers or nicknameQueues initialized in nicknamelock.js');
            }

            if (args[1] === 'on') {
                const nickname = args.slice(2).join(' ');
                if (!nickname) {
                    api.sendMessage('❌ Nickname missing!', threadID);
                    return;
                }

                const botID = api.getCurrentUserID();
                if (!botID) {
                    api.sendMessage('⚠️ Failed to get bot ID.', threadID);
                    console.error('botID not found for thread', threadID);
                    return;
                }

                api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) {
                        api.sendMessage('⚠️ ग्रुप की जानकारी लोड करने में दिक्कत। कृपया बाद में दोबारा ट्राई करें।', threadID);
                        console.error('ThreadInfo error for thread', threadID, ':', err || 'info is null');
                        return;
                    }
                    if (!info.participantIDs) {
                        api.sendMessage('⚠️ ग्रुप में कोई मेंबर्स नहीं मिले।', threadID);
                        console.error('No participantIDs in info for thread', threadID, ':', info);
                        return;
                    }

                    if (botState.nicknameTimers[threadID]) {
                        clearTimeout(botState.nicknameTimers[threadID]);
                        delete botState.nicknameTimers[threadID];
                    }

                    const members = info.participantIDs.filter(id => id !== botID);
                    botState.nicknameQueues[threadID] = {
                        nickname: nickname,
                        members: members,
                        currentIndex: 0,
                        botUserId: userId
                    };

                    console.log(`Nickname lock started for thread ${threadID}:`, botState.nicknameQueues[threadID]);

                    processNicknameChange(api, threadID, botState);

                    api.sendMessage(
                        `⏳ **Serial Nickname Lock Started!**\n` +
                        `• Changing nicknames one-by-one\n` +
                        `• 30 seconds gap per user\n` +
                        `• Total targets: ${members.length}\n\n` +
                        `Use "#nicknamelock off" to stop`,
                        threadID
                    );
                });
            } else if (args[1] === 'off') {
                if (botState.nicknameTimers[threadID]) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameTimers[threadID];
                    delete botState.nicknameQueues[threadID];
                    api.sendMessage('🔴 Serial Nickname Lock Stopped!', threadID);
                    console.log(`Nickname lock stopped for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ No active nickname lock in this thread.', threadID);
                }
            } else {
                api.sendMessage(`Usage: #nicknamelock on/off <nickname>`, threadID);
            }
        } catch (e) {
            api.sendMessage('⚠️ Error in nicknamelock command.', threadID);
            console.error('Nicknamelock error for thread', threadID, ':', e);
        }
    }
};
