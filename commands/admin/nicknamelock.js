module.exports = {
    handleNicknameLock: (api, threadID, args, botID, userId, nicknameTimers, nicknameQueues, processNicknameChange) => {
        try {
            if (args[1] === 'on') {
                const nickname = args.slice(2).join(' ');
                if (!nickname) return api.sendMessage('Nickname missing!', threadID);

                api.getThreadInfo(threadID, (err, info) => {
                    if (err) {
                        api.sendMessage('Failed to get thread info.', threadID);
                        console.error('ThreadInfo error:', err);
                        return;
                    }

                    if (nicknameTimers[threadID]) {
                        clearTimeout(nicknameTimers[threadID]);
                        delete nicknameTimers[threadID];
                    }

                    const members = info.participantIDs.filter(id => id !== botID);
                    nicknameQueues[threadID] = {
                        nickname: nickname,
                        members: members,
                        currentIndex: 0,
                        botUserId: userId
                    };

                    processNicknameChange(threadID);

                    api.sendMessage(
                        `⏳ **Serial Nickname Lock Started!**\n` +
                        `• Changing nicknames one-by-one\n` +
                        `• 30 seconds gap per user\n` +
                        `• Total targets: ${members.length}\n\n` +
                        `Use "${botState.sessions[userId]?.prefix || '#'}nicknamelock off" to stop`,
                        threadID
                    );
                });
            } else if (args[1] === 'off') {
                if (nicknameTimers[threadID]) {
                    clearTimeout(nicknameTimers[threadID]);
                    delete nicknameTimers[threadID];
                    delete nicknameQueues[threadID];
                    api.sendMessage('🔴 Serial Nickname Lock Stopped!', threadID);
                } else {
                    api.sendMessage('No active nickname lock!', threadID);
                }
            } else {
                api.sendMessage(`Usage: ${botState.sessions[userId]?.prefix || '#'}nicknamelock on/off <nickname>`, threadID);
            }
        } catch (e) {
            api.sendMessage('Error in nicknamelock.', threadID);
            console.error('Nicknamelock error:', e);
        }
    }
};
