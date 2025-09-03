module.exports = {
    handleLoder: (api, threadID, args, event, botState, abuseMessages, MASTER_ID) => {
        try {
            if (args[1] === 'target' && args[2] === 'on' && event.mentions) {
                const targetID = Object.keys(event.mentions)[0];
                if (!targetID) return api.sendMessage('Mention a user with @.', threadID);
                if (targetID === MASTER_ID) return api.sendMessage('❌ Cannot target Master ID!', threadID);
                if (!botState.abuseTargets[threadID]) {
                    botState.abuseTargets[threadID] = {};
                }
                botState.abuseTargets[threadID][targetID] = true;

                if (!abuseMessages || abuseMessages.length === 0) {
                    api.sendMessage('❌ Error: abuse.txt is empty or not loaded. Please add abuse messages.', threadID);
                    console.log('Abuse messages empty or not loaded');
                    return;
                }

                api.getUserInfo(targetID, (err, ret) => {
                    if (err) {
                        api.sendMessage('Failed to get target info.', threadID);
                        console.error('UserInfo error for loder:', err);
                        return;
                    }
                    const name = ret?.[targetID]?.name || 'User';
                    api.sendMessage(`🎯 ${name} को टारगेट कर दिया गया है! अब हर 2 मिनट में गालियां आएंगी!`, threadID);
                    console.log(`Target set: ${name} (${targetID}) in thread ${threadID}`);

                    const spamLoop = async () => {
                        while (botState.abuseTargets[threadID]?.[targetID] && abuseMessages.length > 0) {
                            try {
                                const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                                const mentionTag = `@${name.split(' ')[0]}`;
                                await api.sendMessage({
                                    body: `${mentionTag} ${randomMsg}`,
                                    mentions: [{ tag: mentionTag, id: targetID }]
                                }, threadID);
                                console.log(`Abuse sent to ${name} (${targetID}) in thread ${threadID}`);
                                await new Promise(r => setTimeout(r, 120000));
                            } catch (err) {
                                console.error('Abuse loop error:', err);
                                api.sendMessage('⚠️ Error sending abuse message. Retrying in 2 minutes...', threadID);
                                await new Promise(r => setTimeout(r, 120000));
                            }
                        }
                    };

                    spamLoop();
                });
            } else if (args[1] === 'stop') {
                if (botState.abuseTargets[threadID]) {
                    const targets = Object.keys(botState.abuseTargets[threadID]);
                    delete botState.abuseTargets[threadID];

                    if (targets.length > 0) {
                        api.getUserInfo(targets, (err, ret) => {
                            if (err) {
                                api.sendMessage('Failed to get target info.', threadID);
                                console.error('UserInfo error for loder stop:', err);
                                return;
                            }
                            const names = targets.map(id => ret?.[id]?.name || 'User').join(', ');
                            api.sendMessage(`🎯 ${names} को टारगेट से हटा दिया गया है! बच गए ये लोग!`, threadID);
                        });
                    } else {
                        api.sendMessage('No active targets.', threadID);
                    }
                } else {
                    api.sendMessage('No active targets.', threadID);
                }
            } else {
                api.sendMessage(`Usage: ${botState.sessions[threadID]?.prefix || '#'}loder target on @user or ${botState.sessions[threadID]?.prefix || '#'}loder stop`, threadID);
            }
        } catch (e) {
            api.sendMessage('Error in loder command.', threadID);
            console.error('Loder command error:', e);
        }
    }
};
