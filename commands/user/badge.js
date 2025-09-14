module.exports = {
  name: 'badge',
  description: 'Generate a stylish text-based badge message with creative touches 🌟🔥',
  aliases: ['badge'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    console.log(`[DEBUG] badge called: threadID=${threadID}, args=${JSON.stringify(args)}, senderID=${event.senderID}`);
    try {
      let targetID;
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        console.log(`[DEBUG] Using mention ID: ${targetID}`);
      } else if (args[0] && args[0].startsWith('https://www.facebook.com/')) {
        const profileUrl = args[0];
        const userIDMatch = profileUrl.match(/(\d+)/);
        if (!userIDMatch) {
          console.log('[DEBUG] Invalid profile URL provided');
          return api.sendMessage('🚫 गलत प्रोफाइल लिंक! @mention या सही FB प्रोफाइल लिंक यूज करो। 🕉️', threadID);
        }
        targetID = userIDMatch[0];
        console.log(`[DEBUG] Using profile URL ID: ${targetID}`);
      } else if (event.messageReply && event.messageReply.senderID) {
        targetID = event.messageReply.senderID;
        console.log(`[DEBUG] Using reply sender ID: ${targetID}`);
      } else {
        targetID = event.senderID;
        console.log(`[DEBUG] Using sender ID: ${targetID}`);
      }

      if (!targetID) {
        console.log('[DEBUG] No target ID found');
        return api.sendMessage('🚫 यूजर ID नहीं मिली! @mention, प्रोफाइल लिंक, या रिप्लाई यूज करो। 🕉️', threadID);
      }

      let userInfo;
      try {
        console.log(`[DEBUG] Fetching user info for ID: ${targetID}`);
        userInfo = await new Promise((resolve, reject) => {
          api.getUserInfo(targetID, (err, ret) => {
            if (err || !ret || !ret[targetID]) {
              console.error(`[ERROR] Failed to fetch user info: ${err?.message || 'Unknown error'}`);
              reject(new Error('यूजर जानकारी लाने में असफल।'));
            } else {
              resolve(ret[targetID]);
            }
          });
        });
      } catch (err) {
        console.error(`[ERROR] User info error: ${err.message}`);
        return api.sendMessage(`⚠️ यूजर जानकारी लाने में गलती: ${err.message} 🕉️`, threadID);
      }

      const name = userInfo.name || 'Unknown User';
      console.log(`[DEBUG] User name: ${name}`);

      // Unicode mapping for fancy text
      const unicodeMap = {
        '🆂': 'S', '🅷': 'H', '🅰': 'A', '🅻': 'L', '🅴': 'E', '🅽': 'N', '🅳': 'D', '🆁': 'R',
        'Ｓ': 'S', 'Ｈ': 'H', 'Ａ': 'A', 'Ｌ': 'L', 'Ｅ': 'E', 'Ｎ': 'N', 'Ｄ': 'D', 'Ｒ': 'R'
      };
      // Normalize and clean name
      let normalizedName = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      Object.keys(unicodeMap).forEach(fancy => {
        normalizedName = normalizedName.replace(new RegExp(fancy, 'g'), unicodeMap[fancy]);
      });
      normalizedName = normalizedName.toLowerCase().replace(/[^a-z]/g, '');
      console.log(`[DEBUG] Normalized name: ${normalizedName}`);

      // Check for Shalender or variations
      const isShalender = /shalender|shailendra|salender|shalendra/i.test(normalizedName);
      const isMasterID = targetID === '100023807453349';
      let message;
      let mentions;

      if (isShalender || isMasterID) {
        // Unique message for Shalender or Master ID
        console.log(`[DEBUG] Shalender or Master ID detected: ${name}, ${targetID}`);
        message = `☆✼★━━━━━━━━━━━━★✼☆\n` +
                  `☞︎ @${name} जी की जानकारी\n` +
                  `उपाधि: MAHARAJA 👑\n` +
                  `निकनेम: KING 🤴🏻\n` +
                  `उपाधि धारण किया: किंग जन्मजन्मांतर से किंग है\n` +
                  `उपाधि खुद ही धारण की अपनी काबिलीयत से 🌟🔥..\n` +
                  `विशेष टिप्पणी: असली किंग, कोई शक नहीं! 👑🔥\n` +
                  `☆✼★━━━━━━━━━━━━★✼☆`;
        mentions = [{
          tag: `@${name}`,
          id: targetID,
          fromIndex: message.indexOf(`@${name}`)
        }];
      } else {
        // Random message for other users
        const titles = [
          'KING', 'QUEEN', 'RANDII', 'LAVDII', 'TATTA', 'CHOTA TATTA', 'BDA TATTA',
          'TATTO KA DOST', 'TATTO KA KAAL', 'TATTA KING', 'PORNSTAR', 'MIA KHALIFA',
          'SUNNYLEON', 'DENI DENIAL', 'MAHAMURKH', 'NAMOONA', 'JOKAR', 'NOKAR',
          'MAHISTMATI SHAMRAT', 'GULAAM', 'CHUTIYA', 'CHUTIYO KA RAJA', 'MAHACHUTIYA',
          'NO.1 CHUTIA', '2025 KA FYTR'
        ];
        const emojis = ['🀥', '🀣', '🀦', '🀧', '🀨', '✒️', '𓊆', '𓊇', '𓊈', '𓊉', '𓉘', '𓉝', '𓈖', '📝', '📜', '✍🏻', '🕹️', '🔥', '⚡', '🌟', '😎', '🦁'];
        const modiTitles = ['KING', 'QUEEN', 'MAHAMURKH', 'NAMOONA', 'JOKAR', 'NOKAR', 'GULAAM'];
        const johniTitles = ['RANDII', 'LAVDII', 'PORNSTAR', 'MIA KHALIFA', 'SUNNYLEON', 'DENI DENIAL'];
        const otherProviders = ['डोनाल्ड ट्रम्प', 'लॉरेंस बिश्नोई', 'इमरान हाशमी', 'राज कुंद्रा'];
        const decorativeLines = ['✨===✨', '🌟~~~🌟', '🔥---🔥', '⚡***⚡', '🦁~~~🦁', '💫===💫', '🌈---🌈'];
        const emojiSets = ['🌟🔥', '⚡🌈', '🦁😎', '🌸✨', '🔥🎉', '🌟🚀', '💥🌹'];
        const salutations = [
          'का तगड़ा बैज हाजिर है!',
          'के लिए शानदार उपाधि!',
          'का धमाकेदार बायोडाटा!',
          'के लिए यूनिक बैज तैयार!',
          'का स्टाइलिश बायोडाटा!'
        ];
        const providerTags = {
          'मोदी': '(PM स्वैग!) 😎',
          'जोहनी सिंस': '(पोर्न का बादशाह!) 🔥',
          'डोनाल्ड ट्रम्प': '(अमेरिका का बॉस!) 🇺🇸',
          'लॉरेंस बिश्नोई': '(बॉस का जलवा!) 🦁',
          'इमरान हाशमी': '(रोमांस का किंग!) 😘',
          'राज कुंद्रा': '(बिजनेस का गुरु!) 💰'
        };

        const selectedTitle = titles[Math.floor(Math.random() * titles.length)];
        const emoji1 = emojis[Math.floor(Math.random() * emojis.length)];
        const emoji2 = emojis[Math.floor(Math.random() * emojis.length)];
        const randomYear = Math.floor(Math.random() * (2025 - 2000 + 1)) + 2000;
        const selectedDecorativeLine = decorativeLines[Math.floor(Math.random() * decorativeLines.length)];
        const selectedSalutation = salutations[Math.floor(Math.random() * salutations.length)];
        const selectedEmojiSet = emojiSets[Math.floor(Math.random() * emojiSets.length)];

        // Determine provider
        let provider;
        if (modiTitles.includes(selectedTitle)) {
          provider = 'मोदी';
        } else if (johniTitles.includes(selectedTitle)) {
          provider = 'जोहनी सिंस';
        } else {
          provider = otherProviders[Math.floor(Math.random() * otherProviders.length)];
        }

        console.log(`[DEBUG] Selected decorative line: ${selectedDecorativeLine}, salutation: ${selectedSalutation}, emoji set: ${selectedEmojiSet}`);
        console.log(`[DEBUG] No prefix added for title: ${selectedTitle}`);
        message = `${selectedDecorativeLine}\n` +
                  `☞︎ @${name} ${selectedSalutation}\n` +
                  `उपाधि: ${selectedTitle} ${emoji1}${emoji2}\n` +
                  `निकनेम: ${selectedTitle} ${emoji1}${emoji2}\n` +
                  `उपाधि धारण किया: ${randomYear}\n` +
                  `उपाधि प्रदान करने वाला: ${provider} ने प्रदान की ${providerTags[provider] || ''} ${selectedEmojiSet}\n` +
                  `${selectedDecorativeLine}`;
        mentions = [{
          tag: `@${name}`,
          id: targetID,
          fromIndex: message.indexOf(`@${name}`)
        }];
      }

      try {
        console.log('[DEBUG] Sending badge message with mention');
        await api.sendMessage({
          body: message,
          mentions: mentions
        }, threadID);
        console.log('[DEBUG] Badge message sent successfully');
      } catch (err) {
        console.error(`[ERROR] Failed to send badge message: ${err.message}`);
        return api.sendMessage(`⚠️ मैसेज भेजने में गलती: ${err.message} 🕉️`, threadID);
      }
    } catch (err) {
      console.error(`[ERROR] Badge command error: ${err.message}`);
      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID);
    }
  }
};
