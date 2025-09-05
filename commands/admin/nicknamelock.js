module.exports = {
    handleNicknameLock: (api, threadID, args, event, botState, isMaster) => {
        console.log(`[DEBUG] handleNicknameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}`);
        try {
            if (!isMaster && !botState.adminList.includes(event.senderID)) {
                api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
                return;
            }

            if (args[1] === 'off') {
                if (botState.nicknameTimers[threadID]) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameTimers[threadID];
                    delete botState.nicknameQueues[threadID];
                    api.sendMessage('🔓 निकनेम लॉक बंद कर दिया गया।', threadID);
                    console.log(`[DEBUG] Nickname lock stopped for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ निकनेम लॉक पहले से बंद है।', threadID);
                }
                return;
            }

            if (args[1] !== 'on' || !args[2] || isNaN(args[2]) || parseInt(args[2]) < 1 || !args[3]) {
                api.sendMessage('❌ सही फॉर्मेट: #nicknamelock on <time_in_seconds> <nickname> या #nicknamelock off', threadID);
                return;
            }

            const time = parseInt(args[2]) * 1000;
            const nickname = args.slice(3).join(' ');

            api.getThreadInfo(threadID, (err, info) => {
                if (err || !info) {
                    api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
                    return;
                }

                const botID = api.getCurrentUserID();
                const isBotAdmin = info.adminIDs.some(admin => admin.id === botID);
                if (!isBotAdmin) {
                    api.sendMessage('⚠️ निकनेम लॉक के लिए बॉट को एडमिन परमिशन्स चाहिए।', threadID);
                    return;
                }

                const members = info.participantIDs.filter(id => id !== botID);
                if (members.length === 0) {
                    api.sendMessage('⚠️ ग्रुप में कोई मेंबर्स नहीं हैं।', threadID);
                    return;
                }

                botState.nicknameQueues[threadID] = { members, currentIndex: 0, nickname, botUserId: event.senderID, active: true, interval: time };
                api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। हर ${args[2]} सेकंड में मेंबर्स के निकनेम बदलते रहेंगे।`, threadID);
                processNicknameChange(api, { threadID, logMessageType: 'log:user-nickname' }, botState, threadID, botID); // Start the loop
            });
        } catch (e) {
            console.error('[ERROR] handleNicknameLock error:', e.message);
            api.sendMessage('⚠️ निकनेम लॉक कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
                const tryFetchThreadInfo = (attempt = 1, maxAttempts = 5) => {
                    api.getThreadInfo(threadID, (err, info) => {
                        if (err || !info || !info.participantIDs || info.participantIDs.length === 0) {
                            console.error(`[ERROR] getThreadInfo failed for thread ${threadID} (attempt ${attempt}):`, err?.message || 'No participantIDs');
                            if (attempt < maxAttempts) {
                                const delay = Math.pow(2, attempt) * 5000; // Exponential backoff
                                console.log(`Retrying getThreadInfo for thread ${threadID} in ${delay / 1000} seconds (attempt ${attempt + 1})`);
                                setTimeout(() => tryFetchThreadInfo(attempt + 1, maxAttempts), delay);
                            } else {
                                console.log(`[DEBUG] Falling back to memberCache for thread ${threadID}`);
                                const members = botState.memberCache[threadID] ? Array.from(botState.memberCache[threadID]) : [];
                                if (members.length === 0) {
                                    console.log(`[DEBUG] No members in memberCache for thread ${threadID}`);
                                    api.sendMessage('⚠️ कोई ग्रुप मेंबर्स नहीं मिले। कृपया ग्रुप में कुछ मैसेज भेजें ताकि मेंबर लिस्ट बन सके या सुनिश्चित करें कि बॉट को एडमिन परमिशन्स हैं।', threadID);
                                    return;
                                }
                                initializeNicknameLock(members);
                            }
                            return;
                        }

                        console.log(`[DEBUG] getThreadInfo succeeded for thread ${threadID}, participantIDs: ${info.participantIDs}`);
                        botState.memberCache[threadID] = new Set(info.participantIDs);
                        initializeNicknameLock(info.participantIDs);
                    });
                };

                const initializeNicknameLock = (members) => {
                    const botUserId = api.getCurrentUserID();
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
                        api.sendMessage('⚠️ निकनेम लॉक के लिए कोई वैलिड ग्रुप मेंबर्स नहीं मिले।', threadID);
                        delete botState.nicknameQueues[threadID];
                        return;
                    }

                    api.sendMessage(`🔒 निकनेम लॉक चालू: निकनेम "${nickname}"। हर ${args[2]} सेकंड में ${botState.nicknameQueues[threadID].members.length} मेंबर्स के लिए निकनेम बदल रहा हूँ।`, threadID);
                    processNicknameChange(api, threadID, botState);
                };

                tryFetchThreadInfo();
            } else if (args[1] && args[1].toLowerCase() === 'off') {
                if (botState.nicknameQueues[threadID]) {
                    clearTimeout(botState.nicknameTimers[threadID]);
                    delete botState.nicknameQueues[threadID];
                    delete botState.nicknameTimers[threadID];
                    console.log(`[DEBUG] Nickname lock disabled for thread ${threadID}`);
                    api.sendMessage('🔓 निकनेम लॉक बंद कर दिया गया।', threadID);
                } else {
                    console.log(`[DEBUG] No active nickname lock for thread ${threadID}`);
                    api.sendMessage('⚠️ इस थ्रेड में कोई निकनेम लॉक चालू नहीं है।', threadID);
                }
            } else {
                console.log(`[DEBUG] Invalid nicknamelock command: ${args.join(' ')}`);
                api.sendMessage('उपयोग: #nicknamelock on <time_in_seconds> <nickname> या #nicknamelock off', threadID);
            }
        } catch (e) {
            console.error(`[ERROR] handleNicknameLock error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ निकनेम लॉक कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
