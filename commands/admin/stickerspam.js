
const favoriteStickers = require('../../responses/favoriteStickers');

module.exports = {
  name: "stickerspam",
  aliases: ["send"], // #send को stickerspam का alias बनाया
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] stickerspam called: threadID=${threadID}, args=${JSON.stringify(args)}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.stickerSpam) {
        botState.stickerSpam = {};
      }

      if (args[0] && args[0].toLowerCase() === 'sticker' && args[1] && args[1].toLowerCase() === 'start') { // Fix: args[0]='sticker', args[1]='start'
        if (!args[2] || isNaN(args[2]) || parseInt(args[2]) < 1 || parseInt(args[2]) > 3600) { // Fix: args[2] for time, max 1 hour
          console.log(`[DEBUG] Invalid time parameter: ${args[2]}`);
          api.sendMessage('उपयोग: #stickerspam sticker start <time_in_seconds> (1-3600) या #stickerspam sticker stop', threadID);
          return;
        }

        const timeSeconds = parseInt(args[2]);
        const timeMs = timeSeconds * 1000; // Fix: Correct index
        console.log(`[DEBUG] Starting sticker spam with interval: ${timeMs}ms (${timeSeconds}s)`);

        if (!botState.stickerSpam[threadID]) {
          const stickers = favoriteStickers.favoriteStickers;

          if (!stickers || stickers.length === 0) {
            console.error('[ERROR] No stickers found in favoriteStickers');
            api.sendMessage('⚠️ कोई स्टिकर्स उपलब्ध नहीं हैं। favoriteStickers.js check करो।', threadID);
            return;
          }

          // Added validation and logging for stickers
          const validStickers = stickers.filter(id => typeof id === 'number' && id > 0);
          if (validStickers.length === 0) {
            console.error('[ERROR] No valid sticker IDs found');
            api.sendMessage('⚠️ कोई वैलिड स्टिकर ID नहीं मिला। favoriteStickers.js check करो।', threadID);
            return;
          }
          console.log('[DEBUG] Valid stickers:', validStickers);

          const intervalId = setInterval(() => {
            const randomSticker = validStickers[Math.floor(Math.random() * validStickers.length)];
            console.log(`[DEBUG] Sending sticker ${randomSticker} to thread ${threadID}`);
            api.sendMessage({ sticker: randomSticker }, threadID, (err) => {
              if (err) {
                console.error(`[ERROR] Sticker spam failed for thread ${threadID}:`, err.message);
                api.sendMessage('⚠️ स्टिकर भेजने में गलती। स्पैम रोक रहा हूँ।', threadID);
                clearInterval(intervalId);
                delete botState.stickerSpam[threadID];
              } else {
                console.log(`[DEBUG] Sticker ${randomSticker} sent to thread ${threadID}`);
              }
            });
          }, timeMs); // Every timeMs milliseconds

          botState.stickerSpam[threadID] = {
            interval: intervalId,
            time: timeMs
          };

          api.sendMessage(`✅ Thanks Master! स्टिकर स्पैम शुरू! हर ${timeSeconds} सेकंड में एक स्टिकर भेजा जाएगा। (${timeSeconds}s तक चलेगा। Stop करने के लिए #stickerspam sticker stop)`, threadID);
          
          // Removed incorrect setTimeout
          // Correct auto-stop: Spam runs for timeSeconds seconds
          setTimeout(() => {
            if (botState.stickerSpam[threadID]) {
              clearInterval(botState.stickerSpam[threadID].interval);
              delete botState.stickerSpam[threadID];
              api.sendMessage('⏰ स्टिकर स्पैम समय समाप्त! बंद हो गया।', threadID);
            }
          }, timeSeconds * 1000); // Total duration

        } else {
          console.log(`[DEBUG] Sticker spam already active for thread ${threadID}`);
          api.sendMessage('⚠️ इस थ्रेड में स्टिकर स्पैम पहले से चालू है। Stop पहले करो।', threadID);
        }
      } else if (args[0] && args[0].toLowerCase() === 'sticker' && args[1] && args[1].toLowerCase() === 'stop') { // Fix: args[0]='sticker', args[1]='stop'
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
