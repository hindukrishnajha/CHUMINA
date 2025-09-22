const { loadAbuseMessages } = require('../../utils/fileUtils');
const masterReplies = require('../../responses/masterReplies');

module.exports = {
    name: 'loder',
    aliases: ['pel', 'target'],
    execute: (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
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

                        // Simple spam loop without async/await
                        let spamInterval = setInterval(() => {
                            if (!botState.abuseTargets[threadID] || !botState.abuseTargets[threadID][targetID]) {
                                clearInterval(spamInterval);
                                return;
                            }
                            
                            const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                            const mentionTag = `${name.split(' ')[0]}`;
                            
                            api.sendMessage(`${mentionTag} ${randomMsg}`, threadID, (err) => {
                                if (err) {
                                    console.error('[LODER] Send message error:', err);
                                    clearInterval(spamInterval);
                                    delete botState.abuseTargets[threadID][targetID];
                                }
                            });
                            
                        }, 120000); // 2 minutes interval
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
