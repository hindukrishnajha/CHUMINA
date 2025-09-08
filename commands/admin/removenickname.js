const { ensureThreadHasMessage, retryNicknameChange, sendMessageWithCooldown } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'removenick',
  aliases: ['removenickname'],
  description: 'ग्रुप में निकनेम्स हटाता है या निकनेम रिमूव मोड को मैनेज करता है।',
  execute(api, threadID, args, event, botState = {}) => {
    console.log(`[DEBUG] removenick command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    botState.adminList = botState.adminList || [];
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      sendMessageWithCooldown(api, threadID, '🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!');
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      sendMessageWithCooldown(api, threadID, 'उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user');
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    let targetID = Object.keys(event.mentions)[0] || null;

    try {
      botState.removeNicknameActive = botState.removeNicknameActive || {};
      botState.removeNicknameTargets = botState.removeNicknameTargets || {};
      botState.lastNicknameChange = botState.lastNicknameChange || {};

      if (command === 'on' && args[2] === '@everyone') {
        // Remove nicknames for all members and enable monitoring
        botState.removeNicknameActive[threadID] = true;
        botState.removeNicknameTargets[threadID] = null; // null means apply to everyone
        console.log('[DEBUG] removeNicknameActive set to true, targets set to null for threadID=', threadID);

        ensureThreadHasMessage(api, threadID, () => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs) {
              sendMessageWithCooldown(api, threadID, '⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।');
              console.log(`[DEBUG] Error fetching thread info for threadID=${threadID}: ${err?.message || 'Unknown error'}`);
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for remove nickname`);

            const batchSize = 5;
            for (let i = 0; i < members.length; i += batchSize) {
              setTimeout(() => {
                if (botState.removeNicknameActive[threadID]) {
                  members.slice(i, i + batchSize).forEach(memberID => {
                    const lastChange = botState.lastNicknameChange[`${threadID}:${memberID}`] || 0;
                    if (Date.now() - lastChange < 60000) {
                      console.log(`[DEBUG] Skipped nickname removal for ${memberID} due to cooldown`);
                      return;
                    }
                    retryNicknameChange(api, threadID, memberID, '', 2, (success) => {
                      if (success) {
                        botState.lastNicknameChange[`${threadID}:${memberID}`] = Date.now();
                        console.log(`[DEBUG] Removed nickname for memberID=${memberID}`);
                      }
                    });
                  });
                }
              }, (i / batchSize) * 3000); // 3 seconds per batch
            }
            sendMessageWithCooldown(api, threadID, '✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटा दिए गए! नया निकनेम डालने पर bot हटाएगा (#removenick off से बंद होगा).');
          });
        });
      } else if (command === 'on' && targetID) {
        // Remove nickname for specific user and enable monitoring
        if (!targetID) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड यूजर को मेंशन करें।');
          console.log('[DEBUG] Command rejected: Invalid user mention');
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          if (!botState.removeNicknameActive[threadID]) {
            botState.removeNicknameActive[threadID] = true;
            botState.removeNicknameTargets[threadID] = new Set();
          }
          botState.removeNicknameTargets[threadID].add(targetID);
          console.log(`[DEBUG] Added userID=${targetID} to removeNicknameTargets`);

          retryNicknameChange(api, threadID, targetID, '', 2, (success) => {
            if (success) {
              sendMessageWithCooldown(api, threadID, `✅ ${name} (${targetID}) का निकनेम हटा दिया गया! नया निकनेम डाला toh bot हटाएगा (#removenick off @user से बंद होगा).`);
              botState.lastNicknameChange[`${threadID}:${targetID}`] = Date.now();
              console.log(`[DEBUG] Successfully removed nickname for ${name} (${targetID})`);
            } else {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।');
              console.log(`[DEBUG] Error removing nickname for userID=${targetID}`);
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Stop remove nickname mode for group
        if (!botState.removeNicknameActive?.[threadID]) {
          sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने का मोड पहले से बंद है।');
          console.log('[DEBUG] Command rejected: removeNicknameActive already false for threadID=', threadID);
          return;
        }

        botState.removeNicknameActive[threadID] = false;
        delete botState.removeNicknameTargets[threadID];
        console.log('[DEBUG] Deactivated remove nickname mode and cleared targets for threadID=', threadID);
        sendMessageWithCooldown(api, threadID, '✅ निकनेम हटाने का मोड बंद कर दिया गया!');
      } else if (command === 'off' && targetID) {
        // Stop remove nickname mode for specific user
        if (!botState.removeNicknameTargets?.[threadID]?.has(targetID)) {
          sendMessageWithCooldown(api, threadID, '⚠️ इस यूजर के लिए निकनेम रिमूव मोड पहले से बंद है।');
          console.log(`[DEBUG] Command rejected: No remove nickname target for userID=${targetID}`);
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }
          const name = ret[targetID].name || 'User';
          botState.removeNicknameTargets[threadID].delete(targetID);
          if (botState.removeNicknameTargets[threadID].size === 0) {
            botState.removeNicknameActive[threadID] = false;
            delete botState.removeNicknameTargets[threadID];
          }
          console.log(`[DEBUG] Removed userID=${targetID} from removeNicknameTargets`);
          sendMessageWithCooldown(api, threadID, `✅ ${name} (${targetID}) के लिए निकनेम रिमूव मोड बंद कर दिया गया!`);
          console.log(`[DEBUG] Successfully turned off remove nickname for ${name} (${targetID})`);
        });
      } else {
        sendMessageWithCooldown(api, threadID, 'उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user');
        console.log('[DEBUG] Command rejected: Invalid command');
      }
    } catch (e) {
      console.error(`[ERROR] removenick error: ${e?.message || 'Unknown error'}`);
      sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  }
};
