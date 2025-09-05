module.exports = {
    processNicknameChange: (api, event, botState, threadID, botID) => {
        console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
        try {
            const queue = botState.nicknameQueues[threadID];
            if (!queue || !queue.active) {
                console.log(`[DEBUG] No active nickname queue for thread ${threadID}`);
                return;
            }

            // मेंबर लिस्ट कैश से लो, अगर नहीं है तो API कॉल करो
            const members = botState.memberCache[threadID]
                ? Array.from(botState.memberCache[threadID])
                : null;

            if (!members) {
                api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) {
                        console.error('[ERROR] getThreadInfo failed for processNicknameChange:', err?.message);
                        api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
                        return;
                    }

                    const isBotAdmin = info.adminIDs.some(admin => admin.id === botID);
                    if (!isBotAdmin) {
                        console.error(`[ERROR] Bot is not admin in thread ${threadID}`);
                        api.sendMessage('⚠️ निकनेम रिस्टोर करने में गलती। बॉट को एडमिन परमिशन्स चाहिए।', threadID);
                        delete botState.nicknameQueues[threadID];
                        return;
                    }

                    botState.memberCache[threadID] = new Set(info.participantIDs);
                    queue.members = info.participantIDs.filter(id => id !== botID);
                    processNickname(queue);
                });
            } else {
                queue.members = members.filter(id => id !== botID);
                processNickname(queue);
            }

            function processNickname(queue) {
                if (queue.currentIndex >= queue.members.length) {
                    queue.currentIndex = 0; // लूप के लिए इंडेक्स रीसेट
                    console.log(`[DEBUG] Reset nickname queue index for thread ${threadID}`);
                }

                const targetID = queue.members[queue.currentIndex];
                queue.currentIndex += 1;

                api.changeNickname(queue.nickname, threadID, targetID, (err) => {
                    if (err) {
                        console.error(`[ERROR] changeNickname failed for user ${targetID} in thread ${threadID}:`, err.message);
                        api.sendMessage('⚠️ निकनेम बदलने में गलती।', threadID);
                    } else {
                        console.log(`[DEBUG] Changed nickname for user ${targetID} to "${queue.nickname}" in thread ${threadID}`);
                    }

                    botState.nicknameTimers[threadID] = setTimeout(() => {
                        processNicknameChange(api, event, botState, threadID, botID);
                    }, queue.interval);
                });
            }
        } catch (e) {
            console.error('[ERROR] processNicknameChange error:', e.message, e.stack);
            api.sendMessage('⚠️ निकनेम लॉक प्रोसेस में गलती।', threadID);
        }
    }
};
