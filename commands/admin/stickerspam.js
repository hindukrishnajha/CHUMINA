module.exports = {
    stickerspam: async (api, event, botState, favoriteStickers) => {
        try {
            const args = event.body.split(' ');
            const threadID = event.threadID;
            const messageID = event.messageID;

            if (!botState.stickerSpam) {
                botState.stickerSpam = {};
                console.error('botState.stickerSpam initialized in stickerspam.js');
            }

            if (args[1] === 'start' && args[2]) {
                if (args[2].toLowerCase() === 'infinite' && args[3]) {
                    const delay = parseInt(args[3]);
                    if (isNaN(delay) || delay < 1) {
                        api.sendMessage('❌ Please provide a valid delay in seconds (minimum 1).', threadID, messageID);
                        return;
                    }

                    if (!botState.stickerSpam[threadID]) {
                        botState.stickerSpam[threadID] = { active: false, count: 0 };
                    }

                    if (botState.stickerSpam[threadID].active) {
                        api.sendMessage('⚠️ Sticker spam already running in this thread!', threadID, messageID);
                        return;
                    }

                    botState.stickerSpam[threadID].active = true;
                    api.sendMessage(`🚀 Starting infinite sticker spam with ${delay} seconds delay! Use #send sticker stop to stop.`, threadID, messageID);

                    const spamLoop = async () => {
                        while (botState.stickerSpam[threadID].active && favoriteStickers.length > 0) {
                            try {
                                const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                                await api.sendMessage({ sticker: stickerID }, threadID);
                                console.log(`Infinite sticker sent to thread ${threadID}: ${stickerID}`);
                                await new Promise(r => setTimeout(r, delay * 1000));
                            } catch (err) {
                                console.error('Infinite sticker spam error:', err);
                                api.sendMessage('⚠️ Error sending sticker in infinite mode. Stopping spam.', threadID);
                                botState.stickerSpam[threadID].active = false;
                                break;
                            }
                        }
                    };

                    spamLoop();
                    return;
                }

                const count = parseInt(args[2]);
                if (isNaN(count) || count < 1 || count > 50) {
                    api.sendMessage('❌ Please provide a valid number of stickers (1-50).', threadID, messageID);
                    return;
                }

                if (!botState.stickerSpam[threadID]) {
                    botState.stickerSpam[threadID] = { active: false, count: 0 };
                }

                if (botState.stickerSpam[threadID].active) {
                    api.sendMessage('⚠️ Sticker spam already running in this thread!', threadID, messageID);
                    return;
                }

                botState.stickerSpam[threadID].active = true;
                botState.stickerSpam[threadID].count = count;

                api.sendMessage(`🚀 Starting sticker spam with ${count} stickers!`, threadID, messageID);

                for (let i = 0; i < count && botState.stickerSpam[threadID].active; i++) {
                    try {
                        const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                        await api.sendMessage({ sticker: stickerID }, threadID);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay between stickers
                    } catch (err) {
                        console.error('Sticker spam error:', err);
                        api.sendMessage('⚠️ Error sending sticker. Stopping spam.', threadID);
                        botState.stickerSpam[threadID].active = false;
                        break;
                    }
                }

                if (botState.stickerSpam[threadID].active) {
                    api.sendMessage('✅ Sticker spam completed!', threadID);
                    botState.stickerSpam[threadID].active = false;
                }
            } else if (args[1] === 'stop') {
                if (botState.stickerSpam[threadID] && botState.stickerSpam[threadID].active) {
                    botState.stickerSpam[threadID].active = false;
                    api.sendMessage('🛑 Sticker spam stopped.', threadID, messageID);
                } else {
                    api.sendMessage('⚠️ No active sticker spam in this thread.', threadID, messageID);
                }
            } else {
                api.sendMessage('Usage: #send sticker start <count> or #send sticker start infinite <delay> or #send sticker stop', threadID, messageID);
            }
        } catch (e) {
            api.sendMessage('⚠️ Error in sticker spam command.', threadID);
            console.error('Sticker spam error:', e);
        }
    }
};
