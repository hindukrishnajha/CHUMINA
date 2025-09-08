// commands/admin/removenick.js
const { ensureThreadHasMessage, retryNicknameChange, sendMessageWithCooldown } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'removenick',
  aliases: ['removenickname'],
  description: 'ग्रुप में निकनेम्स हटाता है या निकनेम रिमूव मोड को मैनेज करता है।',
  execute(api, threadID, args, event, botState = {}, isMaster = false) {
    console.log(`[DEBUG] removenick command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    botState.adminList = botState.adminList || [];
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      sendMessageWithCooldown(api, threadID, '🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!');
      return;
    }

    if (args.length < 2) {
      sendMessageWithCooldown(api, threadID, 'उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user');
      return;
    }

    const command = args[1].toLowerCase();
    let targetID = Object.keys(event.mentions)[0] || null;

    try {
      botState.removeNicknameActive = botState.removeNicknameActive || {};
      botState.removeNicknameTargets = botState.removeNicknameTargets || {};
      botState.lastNicknameChange = botState.lastNicknameChange || {};

      if (command === 'on' && args[2] === '@everyone') {
        // Remove nicknames for all with 20s delay per change and one message
        botState.removeNicknameActive[threadID] = true;
        botState.removeNicknameTargets[threadID] = null;

        ensureThreadHasMessage(api, threadID, () => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs) {
              sendMessageWithCooldown(api, threadID, '⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।');
              return;
            }

            if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने के लिए बॉट को एडमिन परमिशन चाहिए।');
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for remove nickname`);

            let i = 0;
            const removeNext = () => {
              if (i >= members.length || !botState.removeNicknameActive[threadID]) return;

              const memberID = members[i];
              const lastChange = botState.lastNicknameChange[`${threadID}:${memberID}`] || 0;
              if (Date.now() - lastChange < 20000) {
                console.log(`[DEBUG] Skipped nickname removal for ${memberID} due to cooldown`);
                i++;
                setTimeout(removeNext, 20000);
                return;
              }

              retryNicknameChange(api, threadID, memberID, '', 1, (success) => {
                if (success) {
                  botState.lastNicknameChange[`${threadID}:${memberID}`] = Date.now();
                  console.log(`[DEBUG] Removed nickname for memberID=${memberID}`);
                }
                i++;
                setTimeout(removeNext, 20000); // 20s delay
              });
            };
            removeNext();
            sendMessageWithCooldown(api, threadID, '✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटाने शुरू हो गए! (#removenick off से बंद होगा).'); // Only one message
          });
        });
      } else if (command === 'on' && targetID) {
        // Specific user remove
        if (!targetID) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड यूजर को मेंशन करें।');
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID]) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            return;
          }

          const name = ret[targetID].name || 'User';
          if (!botState.removeNicknameActive[threadID]) {
            botState.removeNicknameActive[threadID] = true;
            botState.removeNicknameTargets[threadID] = new Set();
          }
          botState.removeNicknameTargets[threadID].add(targetID);

          const lastChange = botState.lastNicknameChange[`${threadID}:${targetID}`] || 0;
          if (Date.now() - lastChange < 20000) {
            sendMessageWithCooldown(api, threadID, '⚠️ कूलडाउन: 20 सेकंड बाद ट्राई करें।');
            return;
          }

          retryNicknameChange(api, threadID, targetID, '', 1, (success) => {
            if (success) {
              sendMessageWithCooldown(api, threadID, `✅ ${name} का निकनेम हटा दिया गया! (#removenick off @user से बंद होगा).`);
              botState.lastNicknameChange[`${threadID}:${targetID}`] = Date.now();
            } else {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।');
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Stop for group
        if (!botState.removeNicknameActive?.[threadID]) {
          sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने का मोड पहले से बंद है।');
          return;
        }

        botState.removeNicknameActive[threadID] = false;
        delete botState.removeNicknameTargets[threadID];
        sendMessageWithCooldown(api, threadID, '✅ निकनेम हटाने का मोड बंद कर दिया गया!');
      } else if (command === 'off' && targetID) {
        // Stop for specific user
        if (!botState.removeNicknameTargets?.[threadID]?.has(targetID)) {
          sendMessageWithCooldown(api, threadID, '⚠️ इस यूजर के लिए निकनेम रिमूव मोड पहले से बंद है।');
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID]) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            return;
          }
          const name = ret[targetID].name || 'User';
          botState.removeNicknameTargets[threadID].delete(targetID);
          if (botState.removeNicknameTargets[threadID].size === 0) {
            botState.removeNicknameActive[threadID] = false;
            delete botState.removeNicknameTargets[threadID];
          }
          sendMessageWithCooldown(api, threadID, `✅ ${name} के लिए निकनेम रिमूव मोड बंद कर दिया गया!`);
        });
      } else {
        sendMessageWithCooldown(api, threadID, 'उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user');
      }
    } catch (e) {
      console.error(`[ERROR] removenick error: ${e?.message || 'Unknown error'}`);
      sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  }
};
