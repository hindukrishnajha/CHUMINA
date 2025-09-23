// stickerspam.js - Fixed version
// Removed incorrect setTimeout, added retry logic for sticker sending, and enhanced logging. Kept fca-mafiya unchanged.

const favoriteStickers = require('../../responses/favoriteStickers');

module.exports = {
  name: "stickerspam",
  aliases: ["send"],
  async execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] stickerspam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.stickerSpam) {
        botState.stickerSpam = {};
      }

      if (args[0] && args[0].toLowerCase() === 'sticker' && args[1] && args[1].toLowerCase() === 'start') {
        if (!args[2] || isNaN(args[2]) || parseInt(args[2]) < 1 || parseInt(args[2]) > 3600) {
          console.log(`[DEBUG] Invalid time parameter: ${args[2]}`);
          api.sendMessage('उपयोग: #stickerspam sticker start <time_in_seconds> (1-3600) या #stickerspam sticker stop', threadID);
          return;
        }

        const timeSeconds = parseInt(args[2]);
        const timeMs = 1000; // Fixed interval to 1 second to ensure stickers are sent regularly
        console.log(`[DEBUG] Starting sticker spam with interval: ${timeMs}ms, duration: ${timeSeconds}s`);

        if (!botState.stickerSpam[threadID]) {
          const stickers = favoriteStickers.favoriteStickers;

          if (!stickers || stickers.length === 0) {
            console.error('[ERROR] No stickers found in favoriteStickers');
            api.sendMessage('⚠️ कोई स्टिकर्स उपलब्ध नहीं हैं। favoriteStickers.js check करो।', threadID);
            return;
          }

          const validStickers = stickers.filter(id => typeof id === 'number' && id > 0);
          if (validStickers.length === 0) {
            console.error('[ERROR] No valid sticker IDs found');
            api.sendMessage('⚠️ कोई वैलिड स्टिकर ID नहीं मिला। favoriteStickers.js check करो।', threadID);
            return;
          }
          console.log('[DEBUG] Valid stickers:', validStickers);

          // Retry logic for sending stickers
          const sendStickerWithRetry = async (stickerId, threadID, retries = 3) => {
            for (let i = 0; i < retries; i++) {
              try {
                console.log(`[DEBUG] Attempt ${i + 1} to send sticker ${stickerId} to thread ${threadID}`);
                await new Promise((resolve, reject) => {
                  api.sendMessage({ sticker: stickerId }, threadID, (err) => {
                    if (err) return reject(err);
                    resolve();
                  });
                });
                console.log(`[DEBUG] Sticker ${stickerId} sent to thread ${threadID}`);
                return true;
              } catch (error) {
                console.error(`[ERROR] Sticker send failed on attempt ${i + 1}:`, error.message);
                if (i === retries - 1) return false;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
              }
            }
            return false;
          };

          const intervalId = setInterval(async () => {
            const randomSticker = validStickers[Math.floor(Math.random() * validStickers.length)];
            const success = await sendStickerWithRetry(randomSticker, threadID);
            if (!success) {
              console.error(`[ERROR] Failed to send sticker ${randomSticker} after retries`);
              api.sendMessage('⚠️ स्टिकर भेजने में गलती। स्पैम रोक रहा हूँ।', threadID);
              clearInterval(intervalId);
              delete botState.stickerSpam[threadID];
            }
          }, timeMs);

          botState.stickerSpam[threadID] = {
            interval: intervalId,
            time: timeMs
          };

          api.sendMessage(`✅ Thanks Master! स्टिकर स्पैम शुरू! हर 1 सेकंड में एक स्टिकर भेजा जाएगा। (${timeSeconds}s तक चलेगा। Stop करने के लिए #stickerspam sticker stop)`, threadID);
          
          // Correct auto-stop
          setTimeout(() => {
            if (botState.stickerSpam[threadID]) {
              clearInterval(botState.stickerSpam[threadID].interval);
              delete botState.stickerSpam[threadID];
              api.sendMessage('⏰ स्टिकर स्पैम समय समाप्त! बंद हो गया।', threadID);
            }
          }, timeSeconds * 1000);

        } else {
          console.log(`[DEBUG] Sticker spam already active for thread ${threadID}`);
          api.sendMessage('⚠️ इस थ्रेड में स्टिकर स्पैम पहले से चालू है। Stop पहले करो।', threadID);
        }
      } else if (args[0] && args[0].toLowerCase() === 'sticker' && args[1] && args[1].toLowerCase() === 'stop') {
        if (botState.stickerSpam[threadID]) {
          clearInterval(botState.stickerSpam[threadID].interval);
          delete botState.stickerSpam[threadID];
          console.log(`[DEBUG] Sticker spam stopped for thread ${threadID}`);
          api.sendMessage('✅ स्टिकर स्पैम बंद कर दिया गया।', threadID);
        } else {
          console.log(`[DEBUG] No active sticker spam for thread ${threadID}`);
          api.sendMessage('⚠️ इस थ्रेड में कोई स्टिकर स्पैम चालू नहीं है।', threadID);
        }
      } else {
        console.log(`[DEBUG] Invalid sticker spam command: ${args.join(' ')}`);
        api.sendMessage('उपयोग: #stickerspam sticker start <time_in_seconds> (1-3600) या #stickerspam sticker stop', threadID);
      }
    } catch (e) {
      console.error(`[ERROR] stickerspam error for thread ${threadID}:`, e.message);
      api.sendMessage('⚠️ स्टिकर स्पैम कमांड में गलती।', threadID);
    }
  }
};
