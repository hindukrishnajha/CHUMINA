const { loadAbuseMessages } = require('../../utils/fileUtils');
const masterReplies = require('../../responses/masterReplies');

module.exports = {
    name: 'loder',
    aliases: ['pel', 'target'],
    execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
        try {
            if (!isMaster) {
                api.sendMessage("🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️", threadID);
                return;
            }

            if (event.mentions && Object.keys(event.mentions).length > 0) {
                const targetID = Object.keys(event.mentions)[0];
                
                // Admin ko target nahi kar sakte
                if (Array.isArray(botState.adminList) && botState.adminList.includes(targetID)) {
                    const randomAdminAbuseReply = masterReplies.adminAbuseReplies.replies[Math.floor(Math.random() * masterReplies.adminAbuseReplies.replies.length)];
                    api.sendMessage(randomAdminAbuseReply, threadID);
                    return;
                }

                if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                }

                const abuseMessages = loadAbuseMessages();
                if (abuseMessages.length === 0) {
                    api.sendMessage("❌ Abuse messages file empty hai!", threadID);
                    return;
                }

                if (!botState.abuseTargets[threadID][targetID]) {
                    botState.abuseTargets[threadID][targetID] = true;
                    
                    api.getUserInfo(targetID, (err, ret) => {
                        if (err || !ret || !ret[targetID]) {
                            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल। 🕉️', threadID);
                            return;
                        }

                        const name = ret[targetID].name || 'User';
                        const randomPelReply = masterReplies.pelCommands.replies[Math.floor(Math.random() * masterReplies.pelCommands.replies.length)];
                        api.sendMessage(randomPelReply, threadID);

                        // Async spam loop with proper error handling
                        const spamLoop = async () => {
                            try {
                                while (botState.abuseTargets[threadID]?.[targetID] && abuseMessages.length > 0) {
                                    if (!botState.abuseTargets[threadID]?.[targetID]) break;
                                    
                                    const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                                    const mentionTag = `${name.split(' ')[0]}`;
                                    await new Promise((resolve, reject) => {
                                        api.sendMessage(`${mentionTag} ${randomMsg}`, threadID, (err) => {
                                            if (err) reject(err);
                                            else resolve();
                                        });
                                    });
                                    
                                    if (!botState.abuseTargets[threadID]?.[targetID]) break;
                                    await new Promise(r => setTimeout(r, 120000)); // 2 minute delay
                                }
                                console.log('[LODER] Spam loop ended for target:', targetID);
                            } catch (err) {
                                console.error('[LODER] Spam loop error:', err.message);
                                delete botState.abuseTargets[threadID][targetID];
                            }
                        };
                        
                        spamLoop();
                    });
                } else {
                    api.sendMessage("✅ यूजर पहले से ही टारगेटेड है! 🕉️", threadID);
                }
            } else {
                api.sendMessage("❌ किसी यूजर को mention करो! 🕉️", threadID);
            }
        } catch (error) {
            console.error('[LODER-ERROR] Command failed:', error);
            api.sendMessage("❌ कमांड execution में error आया! 🕉️", threadID);
        }
    }
};
