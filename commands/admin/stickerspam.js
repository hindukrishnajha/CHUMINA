// commands/admin/stickerspam.js
module.exports = {
  name: "stickerspam",
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

      if (args[1] && args[1].toLowerCase() === 'sticker' && args[2] && args[2].toLowerCase() === 'start') {
        if (!args[3] || isNaN(args[3]) || parseInt(args[3]) < 1) {
          console.log(`[DEBUG] Invalid time parameter: ${args[3]}`);
          api.sendMessage('उपयोग: #stickerspam sticker start <time_in_seconds> या #stickerspam sticker stop', threadID);
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
                  api.sendMessage('⚠️ स्टिकर भेजने में गलती। स्पैम रोक रहा हूँ।', threadID);
                  clearInterval(botState.stickerSpam[threadID].interval);
                  delete botState.stickerSpam[threadID];
                } else {
                  console.log(`[DEBUG] Sticker ${randomSticker} sent to thread ${threadID}`);
                }
              });
            }, time),
            time
          };

          api.sendMessage(`✅ स्टिकर स्पैम शुरू! हर ${args[3]} सेकंड में एक स्टिकर भेजा जाएगा।`, threadID);
        } else {
          console.log(`[DEBUG] Sticker spam already active for thread ${threadID}`);
          api.sendMessage('⚠️ इस थ्रेड में स्टिकर स्पैम पहले से चालू है।', threadID);
        }
      } else if (args[1] && args[1].toLowerCase() === 'sticker' && args[2] && args[2].toLowerCase() === 'stop') {
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
        api.sendMessage('उपयोग: #stickerspam sticker start <time_in_seconds> या #stickerspam sticker stop', threadID);
      }
    } catch (e) {
      console.error(`[ERROR] stickerspam error for thread ${threadID}:`, e.message);
      api.sendMessage('⚠️ स्टिकर स्पैम कमांड में गलती।', threadID);
    }
  }
};
