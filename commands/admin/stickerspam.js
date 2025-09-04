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
                    const delay = parseInt(args[2]) * 1000;
                    console.log(`[DEBUG] Starting sticker spam with delay ${delay}ms in thread ${threadID}`);

                    if (botState.stickerSpam[threadID]) {
                        clearInterval(botState.stickerSpam[threadID].interval);
                        console.log(`[DEBUG] Cleared existing sticker spam interval for thread ${threadID}`);
                    }

                    botState.stickerSpam[threadID] = {
                        active: true,
                        interval: setInterval(() => {
                            if (!botState.stickerSpam[threadID]?.active || !botState.sessions[api.getCurrentUserID()]?.running) {
                                console.log(`[DEBUG] Stopping sticker spam for thread ${threadID} due to inactive session`);
                                clearInterval(botState.stickerSpam[threadID].interval);
                                delete botState.stickerSpam[threadID];
                                return;
                            }
                            const stickerID = favoriteStickers.favoriteStickers[Math.floor(Math.random() * favoriteStickers.favoriteStickers.length)];
                            api.sendMessage({ sticker: stickerID }, threadID, (err) => {
                                if (err) {
                                    console.error(`[ERROR] Failed to send sticker in thread ${threadID}:`, err.message);
                                    if (err.message.includes('not logged in') || err.message.includes('invalid session')) {
                                        console.log(`[DEBUG] Attempting to restart bot session for thread ${threadID}`);
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
