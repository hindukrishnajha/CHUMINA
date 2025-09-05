module.exports = {
    handleGroupNameLock: (api, threadID, args, event, botState, isMaster) => {
        console.log(`[DEBUG] handleGroupNameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}`);
        try {
            if (!isMaster && !botState.adminList.includes(event.senderID)) {
                api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
                return;
            }

            if (args[1] === 'off') {
                if (botState.lockedGroups[threadID]) {
                    clearInterval(botState.lockedGroups[threadID].interval);
                    delete botState.lockedGroups[threadID];
                    api.sendMessage('🔓 ग्रुप नाम लॉक बंद कर दिया गया।', threadID);
                    console.log(`[DEBUG] Group name lock stopped for thread ${threadID}`);
                } else {
                    api.sendMessage('⚠️ ग्रुप नाम लॉक पहले से बंद है।', threadID);
                }
                return;
            }

            if (args[1] !== 'on' || !args[2]) {
                api.sendMessage('❌ सही फॉर्मेट: #groupnamelock on <name> या #groupnamelock off', threadID);
                return;
            }

            const groupName = args.slice(2).join(' ');

            api.getThreadInfo(threadID, (err, info) => {
                if (err || !info) {
                    api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
                    return;
                }

                const botID = api.getCurrentUserID();
                const isBotAdmin = info.adminIDs.some(admin => admin.id === botID);
                if (!isBotAdmin) {
                    api.sendMessage('⚠️ ग्रुप नाम लॉक के लिए बॉट को एडमिन परमिशन्स चाहिए।', threadID);
                    return;
                }

                if (botState.lockedGroups[threadID]) {
                    api.sendMessage('⚠️ ग्रुप नाम लॉक पहले से चालू है। पहले ऑफ करें।', threadID);
                    return;
                }

                api.setTitle(groupName, threadID, (err) => {
                    if (err) {
                        api.sendMessage('⚠️ ग्रुप नाम बदलने में गलती।', threadID);
                        return;
                    }

                    botState.lockedGroups[threadID] = {
                        name: groupName,
                        interval: setInterval(() => {
                            api.setTitle(groupName, threadID, (err) => {
                                if (err) {
                                    console.error('[ERROR] Group name lock interval error:', err.message);
                                }
                            });
                        }, 30000) // हर 30 सेकंड में नाम बदलता रहेगा
                    };

                    api.sendMessage(`🔒 ग्रुप नाम लॉक चालू: "${groupName}"। हर 30 सेकंड में नाम बदलता रहेगा।`, threadID);
                    console.log(`[DEBUG] Group name lock enabled for thread ${threadID} with name "${groupName}"`);
                });
            });
        } catch (e) {
            console.error('[ERROR] handleGroupNameLock error:', e.message);
            api.sendMessage('⚠️ ग्रुप नाम लॉक कमांड में गलती। कृपया फिर से ट्राई करें।', threadID);
        }
    }
};
