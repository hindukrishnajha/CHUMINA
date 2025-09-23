// stickerspam.js - Fixed version for user-defined intervals and better error handling
const favoriteStickers = require('../../responses/favoriteStickers');

module.exports = {
  name: "stickerspam",
  aliases: ["send"],
  async execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] stickerspam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      // Check if user is authorized
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      // Initialize stickerSpam state
      if (!botState.stickerSpam) {
        botState.stickerSpam = {};
      }

      // Handle #send sticker <time> or #stickerspam sticker start <time>
      if ((args[0]?.toLowerCase() === 'sticker' && args[1]?.toLowerCase() === 'start') || 
          (args[0]?.toLowerCase() === 'sticker' && !isNaN(args[1]))) {
        let timeSeconds;

        // Check if command is #send sticker <time> or #stickerspam sticker start <time>
        if (args[0].toLowerCase() === 'sticker' && !isNaN(args[1])) {
          timeSeconds = parseInt(args[1]); // For #send sticker <time>
        } else {
          timeSeconds = parseInt(args[2]); // For #stickerspam sticker start <time>
        }

        // Validate time input
        if (isNaN(timeSeconds) || timeSeconds < 1 || timeSeconds > 3600) {
          console.log(`[DEBUG] Invalid time parameter: ${timeSeconds}`);
          api.sendMessage('उपयोग: #send sticker <time_in_seconds> (1-3600) या #stickerspam sticker stop', threadID);
          return;
        }

        const timeMs = timeSeconds * 1000; // Convert user input to milliseconds for interval
        console.log(`[DEBUG] Starting sticker spam with interval: ${timeMs}ms`);

        // Check if spam is already active
        if (!botState.stickerSpam[threadID]) {
          const stickers = favoriteStickers.favoriteStickers;

          // Validate stickers
          if (!stickers || stickers.length === 0) {
            console.error('[ERROR] No stickers found in favoriteStickers');
            api.sendMessage('⚠️ कोई स्टिकर्स उपलब्ध नहीं हैं। favoriteStickers.js में स्टिकर्स जोड़ें।', threadID);
            return;
          }

          const validStickers = stickers.filter(id => typeof id === 'number' && id > 0);
          if (validStickers.length === 0) {
            console.error('[ERROR] No valid sticker IDs found');
            api.sendMessage('⚠️ कोई वैलिड स्टिकर ID नहीं मिला। favoriteStickers.js में सही IDs डालें।', threadID);
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

          // Start sticker spam
          const intervalId = setInterval(async () => {
            const randomSticker = validStickers[Math.floor(Math.random() * validStickers.length)];
            const success = await sendStickerWithRetry(randomSticker, threadID);
            if (!success) {
              console.error(`[ERROR] Failed to send sticker ${randomSticker} after retries`);
              api.sendMessage(`⚠️ स्टिकर ${randomSticker} भेजने में गलती। कृपया favoriteStickers.js चेक करें या बाद में ट्राई करें।`, threadID);
              clearInterval(intervalId);
              delete botState.stickerSpam[threadID];
            }
          }, timeMs);

          botState.stickerSpam[threadID] = {
            interval: intervalId,
            time: timeMs
          };

          api.sendMessage(`✅ Thanks Master! स्टिकर स्पैम शुरू! हर ${timeSeconds} सेकंड में एक स्टिकर भेजा जाएगा। Stop करने के लिए #stickerspam sticker stop`, threadID);

          // Auto-stop after 1 hour to prevent infinite loops
          setTimeout(() => {
            if (botState.stickerSpam[threadID]) {
              clearInterval(botState.stickerSpam[threadID].interval);
              delete botState.stickerSpam[threadID];
              api.sendMessage('⏰ स्टिकर स्पैम 1 घंटे बाद अपने आप बंद हो गया।', threadID);
            }
          }, 3600 * 1000); // 1 hour max duration

        } else {
          console.log(`[DEBUG] Sticker spam already active for thread ${threadID}`);
          api.sendMessage(`⚠️ इस थ्रेड में पहले से स्टिकर स्पैम चालू है (हर ${botState.stickerSpam[threadID].time / 1000}s)। पहले #stickerspam sticker stop करो।`, threadID);
        }
      } else if (args[0]?.toLowerCase() === 'sticker' && args[1]?.toLowerCase() === 'stop') {
        // Stop sticker spam
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
        api.sendMessage('उपयोग: #send sticker <time_in_seconds> (1-3600) या #stickerspam sticker stop', threadID);
      }
    } catch (e) {
      console.error(`[ERROR] stickerspam error for thread ${threadID}:`, e.message);
      api.sendMessage(`⚠️ स्टिकर स्पैम में गलती: ${e.message}`, threadID);
    }
  }
};
