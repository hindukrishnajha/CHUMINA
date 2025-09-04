module.exports = {
    stickerspam: (api, threadID, args, botState) => {
        console.log(`[DEBUG] stickerspam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
        try {
            if (!botState.stickerSpam) {
                console.error('[ERROR] botState.stickerSpam is undefined');
                botState.stickerSpam = {};
                api.sendMessage('⚠️ Internal error: Sticker spam not initialized. Reinitializing...', threadID);
            }

            if (args[1] && args[1].toLowerCase() === 'sticker' && args[2] && args[2].toLowerCase() === 'start') {
                if (!args[3] || isNaN(args[3]) || parseInt(args[3]) < 1) {
                    console.log(`[DEBUG] Invalid time parameter: ${args[3]}`);
                    api.sendMessage('Usage: #send sticker start <time_in_seconds> or #send sticker stop', threadID);
                    return;
                }

                const time = parseInt(args[3]) * 1000;
                console.log(`[DEBUG] Starting sticker spam with interval: ${time}ms`);

                if (!botState.stickerSpam[threadID]) {
                    const stickers = [
                        '2278774308795956', '1382932398485004', '100026159055963', '100026159055963'
                    ];

                    botState.stickerSpam[threadID] = {
                        interval: setInterval(() => {
                            const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
                            api.sendMessage({ sticker: randomSticker }, threadID, (err) => {
                                if (err) {
                                    console.error(`[ERROR] Sticker spam failed for thread ${threadID}:`, err.message);
                                    api.sendMessage('⚠️ Error sending sticker. Stopping spam.', threadID);
                                    clearInterval(botState.stickerSpam[threadID].interval);
                                    delete botState.stickerSpam[threadID];
                                } else {
                                    console.log(`[DEBUG] Sticker ${randomSticker} sent to thread ${threadID}`);
                                }
                            });
                        }, time),
                        time
                    };

                    api.sendMessage(`✅ Sticker spam started! Sending a sticker every ${args[3]} seconds.`, threadID);
                } else {
                    console.log(`[DEBUG] Sticker spam already active for thread ${threadID}`);
                    api.sendMessage('⚠️ Sticker spam is already active in this thread.', threadID);
                }
            } else if (args[1] && args[1].toLowerCase() === 'sticker' && args[2] && args[2].toLowerCase() === 'stop') {
                if (botState.stickerSpam[threadID]) {
                    clearInterval(botState.stickerSpam[threadID].interval);
                    delete botState.stickerSpam[threadID];
                    console.log(`[DEBUG] Sticker spam stopped for thread ${threadID}`);
                    api.sendMessage('✅ Sticker spam stopped.', threadID);
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
            api.sendMessage('⚠️ Error in sticker spam command. Please try again.', threadID);
        }
    }
};                                        console.log(`[DEBUG] Attempting to restart bot session for thread ${threadID}`);
                                        const { startBot } = require('../../index');
                                        const session = botState.sessions[api.getCurrentUserID()];
                                        if (session?.cookieContent) {
                                            startBot(api.getCurrentUserID(), session.cookieContent, session.prefix, session.adminID);
                                        }
                                    }
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
};
