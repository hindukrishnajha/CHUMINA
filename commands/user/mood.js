module.exports = {
  name: 'mood',
  description: 'Generate a random adult-funny mood status for a user 😎🔥',
  aliases: ['mood'],
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    console.log(`[DEBUG] mood called: threadID=${threadID}, args=${JSON.stringify(args)}, senderID=${event.senderID}`);
    try {
      let targetID;
      let name;
      if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        name = event.mentions[targetID];
        console.log(`[DEBUG] Using mention ID: ${targetID}, name: ${name}`);
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

      if (!name) {
        try {
          console.log(`[DEBUG] Fetching user info for ID: ${targetID}`);
          const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo(targetID, (err, ret) => {
              if (err || !ret || !ret[targetID]) {
                console.error(`[ERROR] Failed to fetch user info: ${err?.message || 'Unknown error'}`);
                reject(new Error('यूजर जानकारी लाने में असफल।'));
              } else {
                resolve(ret[targetID]);
              }
            });
          });
          name = userInfo.name || 'Unknown User';
        } catch (err) {
          console.error(`[ERROR] User info error: ${err.message}`);
          return api.sendMessage(`⚠️ यूजर जानकारी लाने में गलती: ${err.message} 🕉️`, threadID);
        }
      }
      console.log(`[DEBUG] User name: ${name}`);

      // Unicode mapping for Shalender check
      const unicodeMap = {
        '🆂': 'S', '🅷': 'H', '🅰': 'A', '🅻': 'L', '🅴': 'E', '🅽': 'N', '🅳': 'D', '🆁': 'R',
        'Ｓ': 'S', 'Ｈ': 'H', 'Ａ': 'A', 'Ｌ': 'L', 'Ｅ': 'E', 'Ｎ': 'N', 'Ｄ': 'D', 'Ｒ': 'R'
      };
      let normalizedName = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      Object.keys(unicodeMap).forEach(fancy => {
        normalizedName = normalizedName.replace(new RegExp(fancy, 'g'), unicodeMap[fancy]);
      });
      normalizedName = normalizedName.toLowerCase().replace(/[^a-z]/g, '');
      console.log(`[DEBUG] Normalized name: ${normalizedName}`);

      // Check for Shalender or Master ID
      const isShalender = /shalender|shailendra|salender|shalendra/i.test(normalizedName);
      const isMasterID = targetID === '100023807453349';
      let message;
      let mentions;

      if (isShalender || isMasterID) {
        console.log(`[DEBUG] Shalender or Master ID detected: ${name}, ${targetID}`);
        message = `☆✼★━━━━━━━━━━━━★✼☆\n` +
                  `☞︎ @${name} जी का मूड\n` +
                  `मूड: MAHARAJA का मूड, किंग ऑलवेज! 👑🔥\n` +
                  `विशेष टिप्पणी: असली मूड, कोई शक नहीं! 😎\n` +
                  `☆✼★━━━━━━━━━━━━★✼☆`;
        mentions = [{
          tag: `@${name}`,
          id: targetID,
          fromIndex: message.indexOf(`@${name}`)
        }];
      } else {
        const moods = [
          'सनी लियोन का फैन, रात को सपने 18+! 😜🔥',
          'मिया खलीफा का दीवाना, दिल में तूफान! 😎😘',
          'जोहनी सिंस का मूड, रात में धमाल! 😈',
          'Tinder का शेर, स्वाइप में फायर! 🔥',
          '18+ मूड, रात में जादू! 😏',
          'सैवेज लुक, दिल में हुक! 😎',
          'रात का मूड, सनी लियोन का फूड! 😜',
          'प्यार का तड़का, रात में चमका! 😘',
          'जोहनी सिंस का स्टाइल, ग्रुप में जलवा! 🔥',
          'मूड है सैवेज, रात में मज़ा लेज! 😈',
          'सनी लियोन का सपना, रात में अपना! 😏',
          'Tinder का किंग, दिल में ब्लिंग! 😎',
          '18+ का मूड, रात में चालू! 🔥',
          'मिया खलीफा का फैन, रात में प्लान! 😘',
          'जोहनी सिंस का जादू, रात में बिखरू! 😜',
          'सैवेज मूड, दिल में तूफान! 😈',
          'रात का स्टाइल, 18+ का ख्याल! 😎',
          'प्यार का डोज़, रात में लोज़! 😏',
          'सनी लियोन का मूड, रात में धमाल! 🔥',
          'मिया खलीफा का क्रश, दिल में बैश! 😘',
          'जोहनी सिंस का फैन, रात में प्लान! 😜',
          'Tinder का मास्टर, स्वाइप में ब्लास्टर! 😎',
          '18+ का जादू, रात में चालू! 🔥',
          'सैवेज का मूड, दिल में तूफान! 😈',
          'रात का किंग, सनी लियोन का पिंग! 😏',
          'प्यार का तीर, रात में फायर! 😘',
          'जोहनी सिंस का स्टाइल, रात में जलवा! 😜',
          'मिया खलीफा का मूड, दिल में धमाल! 🔥',
          '18+ का स्टेटस, रात में एक्सप्रेस! 😎',
          'सनी लियोन का सपना, रात में अपना! 😏',
          'Tinder का शेर, रात में फायर! 😈',
          'प्यार का नशा, रात में बजा! 😘',
          'जोहनी सिंस का मूड, रात में धमाल! 🔥',
          'मिया खलीफा का फैन, दिल में प्लान! 😜',
          '18+ का स्टाइल, रात में जलवा! 😎',
          'सैवेज मूड, रात में तूफान! 😈',
          'सनी लियोन का क्रश, दिल में बैश! 😏',
          'प्यार का जादू, रात में बिखरू! 🔥',
          'जोहनी सिंस का फैन, रात में प्लान! 😘',
          'Tinder का मास्टर, रात में ब्लास्टर! 😜',
          '18+ का मूड, रात में चालू! 😎',
          'मिया खलीफा का सपना, रात में अपना! 🔥',
          'सैवेज का स्टाइल, रात में जलवा! 😈',
          'प्यार का तड़का, रात में चमका! 😘',
          'सनी लियोन का मूड, दिल में धमाल! 😜',
          'जोहनी सिंस का क्रश, रात में बैश! 😏',
          '18+ का जादू, रात में चालू! 🔥',
          'Tinder का शेर, दिल में फायर! 😎',
          'मिया खलीफा का मूड, रात में धमाल! 😈',
          'प्यार का स्टेटस, रात में एक्सप्रेस! 😘',
          'सनी लियोन का फैन, रात में प्लान! 😜',
          'जोहनी सिंस का स्टाइल, दिल में जलवा! 🔥',
          '18+ का मूड, रात में तूफान! 😎',
          'सैवेज का सपना, रात में अपना! 😏',
          'प्यार का नशा, रात में बजा! 😘',
          'मिया खलीफा का क्रश, दिल में बैश! 🔥',
          'जोहनी सिंस का मूड, रात में धमाल! 😜',
          'सनी लियोन का स्टाइल, रात में जलवा! 😎',
          '18+ का तड़का, रात में चमका! 😈'
        ];
        const emojis = ['🀥', '🀣', '🀦', '🀧', '🀨', '✒️', '𓊆', '𓊇', '𓊈', '𓊉', '𓉘', '𓉝', '𓈖', '📝', '📜', '✍🏻', '🕹️', '🔥', '⚡', '🌟', '😎', '🦁'];
        const decorativeLines = ['✨===✨', '🌟~~~🌟', '🔥---🔥', '⚡***⚡', '🦁~~~🦁', '💫===💫', '🌈---🌈'];
        const emojiSets = ['🌟🔥', '⚡🌈', '🦁😎', '🌸✨', '🔥🎉', '🌟🚀', '💥🌹'];
        const salutations = [
          'का मूड चेक करो!',
          'का मूड धमाका!',
          'के लिए मूड हाजिर!',
          'का स्टाइलिश मूड!',
          'का तगड़ा मूड!'
        ];

        const selectedMood = moods[Math.floor(Math.random() * moods.length)];
        const emoji1 = emojis[Math.floor(Math.random() * emojis.length)];
        const emoji2 = emojis[Math.floor(Math.random() * emojis.length)];
        const selectedDecorativeLine = decorativeLines[Math.floor(Math.random() * decorativeLines.length)];
        const selectedSalutation = salutations[Math.floor(Math.random() * salutations.length)];
        const selectedEmojiSet = emojiSets[Math.floor(Math.random() * emojiSets.length)];

        console.log(`[DEBUG] Selected mood: ${selectedMood}, decorative line: ${selectedDecorativeLine}, salutation: ${selectedSalutation}, emoji set: ${selectedEmojiSet}`);
        message = `${selectedDecorativeLine}\n` +
                  `☞︎ @${name} ${selectedSalutation}\n` +
                  `मूड: ${selectedMood} ${emoji1}${emoji2}\n` +
                  `${selectedEmojiSet}\n` +
                  `${selectedDecorativeLine}`;
        mentions = [{
          tag: `@${name}`,
          id: targetID,
          fromIndex: message.indexOf(`@${name}`)
        }];
      }

      try {
        console.log('[DEBUG] Sending mood message with mention');
        await api.sendMessage({
          body: message,
          mentions: mentions
        }, threadID);
        console.log('[DEBUG] Mood message sent successfully');
      } catch (err) {
        console.error(`[ERROR] Failed to send mood message: ${err.message}`);
        return api.sendMessage(`⚠️ मैसेज भेजने में गलती: ${err.message} 🕉️`, threadID);
      }
    } catch (err) {
      console.error(`[ERROR] Mood command error: ${err.message}`);
      api.sendMessage(`❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID);
    }
  }
};
