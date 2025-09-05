module.exports = {
    handleGroupNameLock: (api, threadID, args, event, botState, isMaster) => {
        console.log(`[DEBUG] handleGroupNameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}, senderID=${event.senderID}`);
        try {
            if (!isMaster && !botState.adminList.includes(event.senderID)) {
                api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
                console.log(`[DEBUG] User ${event.senderID} is not master or admin`);
                return;
            }

            if (!botState.lockedGroups) {
                botState.lockedGroups = {};
                console.warn(`[DEBUG] botState.lockedGroups initialized in groupnamelock.js for thread ${threadID}`);
            }

            if (args[1] === 'off') {
                if (botState.lockedGroups[threadID]) {
                    clearInterval(botState.lockedGroups[threadID].interval);
                    delete botState.lockedGroups[threadID];
                    api.sendMessage('🔓 ग्रुप नाम लॉक बंद कर दिया गया।', threadID);
                    console.log(`[DEBUG] Group name lock stopped for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ ग्रुप नाम लॉक पहले से बंद है।', threadID);
                    console.log(`[DEBUG] No active group name lock for thread ${threadID}`);
                }
                return;
            }

            if (args[1] !== 'on' || !args[2]) {
                api.sendMessage('❌ सही फॉर्मेट: #groupnamelock on <name> या #groupnamelock off', threadID);
                console.log(`[DEBUG] Invalid groupnamelock command: ${args.join(' ')}`);
                return;
            }

            const groupName = args.slice(2).join(' ');
            console.log(`[DEBUG] Attempting to lock group name to "${groupName}" for thread ${threadID}`);

            const trySetGroupName = (attempt = 1, maxAttempts = 3) => {
                api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) {
                        console.error(`[ERROR] getThreadInfo failed for thread ${threadID} (attempt ${attempt}):`, err?.message || 'No info returned');
                        if (attempt < maxAttempts) {
                            const delay = Math.pow(2, attempt) * 5000; // Exponential backoff
                            console.log(`[DEBUG] Retrying getThreadInfo in ${delay / 1000} seconds (attempt ${attempt + 1})`);
                            setTimeout(() => trySetGroupName(attempt + 1, maxAttempts), delay);
                            return;
                        }
                        api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल। कृपया बाद में ट्राई करें।', threadID);
                        return;
                    }
                    console.log(`[DEBUG] getThreadInfo succeeded: adminIDs=${JSON.stringify(info.adminIDs)}`);

                    const botID = api.getCurrentUserID();
                    console.log(`[DEBUG] botID=${botID}`);
                    const isBotAdmin = info.adminIDs.some(admin => admin.id === botID);
                    if (!isBotAdmin) {
                        console.error(`[ERROR] Bot ${botID} is not admin in thread ${threadID}`);
                        api.sendMessage('⚠️ ग्रुप नाम लॉक के लिए बॉट को एडमिन परमिशन्स चाहिए।', threadID);
                        return;
                    }

                    if (botState.lockedGroups[threadID]) {
                        console.log(`[DEBUG] Group name lock already active for thread ${threadID}`);
                        api.sendMessage('⚠️ ग्रुप नाम लॉक पहले से चालू है। पहले ऑफ करें।', threadID);
                        return;
                    }

                    api.setTitle(groupName, threadID, (err) => {
                        if (err) {
                            console.error(`[ERROR] setTitle failed for thread ${threadID} (attempt ${attempt}):`, err.message);
                            if (attempt < maxAttempts) {
                                const delay = Math.pow(2, attempt) * 5000;
                                console.log(`[DEBUG] Retrying setTitle in ${delay / 1000} seconds (attempt ${attempt + 1})`);
                                setTimeout(() => trySetGroupName(attempt + 1, maxAttempts), delay);
                                return;
                            }
                            api.sendMessage('⚠️ ग्रुप नाम बदलने में गलती। कृपया बाद में ट्राई करें।', threadID);
                            return;
                        }

                        botState.lockedGroups[threadID] = {
                            name: groupName,
                            interval: setInterval(() => {
                                api.setTitle(groupName, threadID, (err) => {
                                    if (err) {
                                        console.error(`[ERROR] Group name lock interval error for thread ${threadID}:`, err.message);
                                        api.sendMessage('⚠️ ग्रुप नाम लॉक में गलती। लॉक बंद कर रहा हूँ।', threadID);
                                        clearInterval(botState.lockedGroups[threadID].interval);
                                        delete botState.lockedGroups[threadID];
                                    } else {
                                        console.log(`[DEBUG] Group name set to "${groupName}" for thread ${threadID}`);
                                    }
                                });
                            }, 30000)
                        };

                        api.sendMessage(`🔒 ग्रुप नाम लॉक चालू: "${groupName}"। हर 30 सेकंड में नाम बदलता रहेगा।`, threadID);
                        console.log(`[DEBUG] Group name lock enabled for thread ${threadID} with name "${groupName}"`);
                    });
                });
            };

            trySetGroupName();
        } catch (e) {
            console.error(`[ERROR] handleGroupNameLock error for thread ${threadID}:`, e.message, e.stack);
            api.sendMessage('⚠️ ग्रुप नाम लॉक कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
