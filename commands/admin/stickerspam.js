const favoriteStickers = require('../../responses/favoriteStickers');

module.exports = {
    stickerspam: (api, threadID, args, botState) => {
        console.log(`[DEBUG] stickerspam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
        try {
            if (!botState.stickerSpam) {
                console.error('[ERROR] botState.stickerSpam is undefined');
                botState.stickerSpam = {};
                api.sendMessage('⚠️ Internal error: Sticker spam state not initialized. Reinitializing...', threadID);
            }

            if (args[1] && args[1].toLowerCase() === 'start') {
                if (args[2] && !isNaN(args[2])) {
                    const delay = parseInt(args[2]) * 1000; // Convert seconds to milliseconds
                    console.log(`[DEBUG] Starting sticker spam with delay ${delay}ms in thread ${threadID}`);

                    if (botState.stickerSpam[threadID]) {
                        clearInterval(botState.stickerSpam[threadID].interval);
                        console.log(`[DEBUG] Cleared existing sticker spam interval for thread ${threadID}`);
                    }

                    botState.stickerSpam[threadID] = {
                        active: true,
                        interval: setInterval(() => {
                            if (!botState.stickerSpam[threadID]?.active) return;
                            const stickerID = favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)];
                            api.sendMessage({ sticker: stickerID }, threadID, (err) => {
                                if (err) {
                                    console.error(`[ERROR] Failed to send sticker in thread ${threadID}:`, err.message);
                                } else {
                                    console.log(`[DEBUG] Sticker ${stickerID} sent in thread ${threadID}`);
                                }
                            });
                        }, delay)
                    };

                    api.sendMessage(`🚀 Sticker spam started! Sending a sticker every ${args[2]} seconds.`, threadID);
                } else {
                    console.log(`[DEBUG] Invalid delay for sticker spam: ${args[2]}`);
                    api.sendMessage('Usage: #send sticker start <time_in_seconds> or #send sticker stop', threadID);
                }
            } else if (args[1] && args[1].toLowerCase() === 'stop') {
                if (botState.stickerSpam[threadID]) {
                    clearInterval(botState.stickerSpam[threadID].interval);
                    delete botState.stickerSpam[threadID];
                    console.log(`[DEBUG] Sticker spam stopped for thread ${threadID}`);
                    api.sendMessage('🛑 Sticker spam stopped.', threadID);
                } else {
                    console.log(`[DEBUG] No active sticker spam for thread ${threadID}`);
                    api.sendMessage('⚠️ No active sticker spam in this thread.', threadID);
                }
            } else {
                console.log(`[DEBUG] Invalid sticker spam command: ${args.join(' ')}`);
                api.sendMessage('Usage: #send sticker start <time_in_seconds> or #send sticker stop', threadID);
            }
        } catch (e) {
            console.error(`[ERROR] stickerspam error for thread ${threadID}:`, e.message);
            api.sendMessage('⚠️ Error in sticker spam command.', threadID);
        }
    }
};                                await api.sendMessage({ sticker: stickerID }, threadID);
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
