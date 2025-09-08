const { ensureThreadHasMessage, retryNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'removenick',
  aliases: ['removenickname'],
  description: 'ग्रुप में निकनेम्स हटाता है या निकनेम रिमूव मोड को मैनेज करता है।',
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] removenick command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      api.sendMessage('उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user', threadID);
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    const targetID = Object.keys(event.mentions)[0] || null;

    try {
      if (command === 'on' && args[2] === '@everyone') {
        // Remove nicknames for all members and enable monitoring
        if (!botState.removeNicknameActive) botState.removeNicknameActive = {};
        if (!botState.removeNicknameTargets) botState.removeNicknameTargets = {};
        botState.removeNicknameActive[threadID] = true;
        botState.removeNicknameTargets[threadID] = null; // null means apply to everyone
        console.log('[DEBUG] removeNicknameActive set to true, targets set to null for threadID=', threadID);

        ensureThreadHasMessage(api, threadID, () => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs) {
              api.sendMessage('⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।', threadID);
              console.log(`[DEBUG] Error fetching thread info for threadID=${threadID}: ${err?.message || 'Unknown error'}`);
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for remove nickname`);

            const batchSize = 10;
            for (let i = 0; i < members.length; i += batchSize) {
              setTimeout(() => {
                if (botState.removeNicknameActive[threadID]) {
                  members.slice(i, i + batchSize).forEach(memberID => {
                    retryNicknameChange(api, threadID, memberID, '', 3, (success) => {
                      if (success) {
                        console.log(`[DEBUG] Removed nickname for memberID=${memberID}`);
                      }
                    });
                  });
                }
              }, (i / batchSize) * 1000);
            }
            api.sendMessage('✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटा दिए गए! नया निकनेम डालने पर bot हटाएगा (#removenick off से बंद होगा).', threadID);
          });
        });
      } else if (command === 'on' && targetID) {
        // Remove nickname for specific user and enable monitoring
        if (!targetID) {
          api.sendMessage('⚠️ कृपया एक वैलिड यूजर को मेंशन करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid user mention');
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          if (!botState.removeNicknameActive) botState.removeNicknameActive = {};
          if (!botState.removeNicknameTargets) botState.removeNicknameTargets = {};
          if (!botState.removeNicknameActive[threadID]) {
            botState.removeNicknameActive[threadID] = true;
            botState.removeNicknameTargets[threadID] = new Set();
          }
          botState.removeNicknameTargets[threadID].add(targetID);
          console.log(`[DEBUG] Added userID=${targetID} to removeNicknameTargets`);

          retryNicknameChange(api, threadID, targetID, '', 3, (success) => {
            if (success) {
              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम हटा दिया गया! नया निकनेम डाला toh bot हटाएगा (#removenick off @user से बंद होगा).`, threadID);
              console.log(`[DEBUG] Successfully removed nickname for ${name} (${targetID})`);
            } else {
              api.sendMessage('⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।', threadID);
              console.log(`[DEBUG] Error removing nickname for userID=${targetID}`);
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Stop remove nickname mode for group
        if (!botState.removeNicknameActive?.[threadID]) {
          api.sendMessage('⚠️ निकनेम हटाने का मोड पहले से बंद है।', threadID);
          console.log('[DEBUG] Command rejected: removeNicknameActive already false for threadID=', threadID);
          return;
        }

        botState.removeNicknameActive[threadID] = false;
        delete botState.removeNicknameTargets[threadID];
        console.log('[DEBUG] Deactivated remove nickname mode and cleared targets for threadID=', threadID);
        api.sendMessage('✅ निकनेम हटाने का मोड बंद कर दिया गया!', threadID);
      } else if (command === 'off' && targetID) {
        // Stop remove nickname mode for specific user
        if (!botState.removeNicknameTargets?.[threadID]?.has(targetID)) {
          api.sendMessage('⚠️ इस यूजर के लिए निकनेम रिमूव मोड पहले से बंद है।', threadID);
          console.log(`[DEBUG] Command rejected: No remove nickname target for userID=${targetID}`);
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
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
          api.sendMessage(`✅ ${name} (${targetID}) के लिए निकनेम रिमूव मोड बंद कर दिया गया!`, threadID);
          console.log(`[DEBUG] Successfully turned off remove nickname for ${name} (${targetID})`);
        });
      } else {
        api.sendMessage('उपयोग: #removenick on @everyone या #removenick on @user या #removenick off या #removenick off @user', threadID);
        console.log('[DEBUG] Command rejected: Invalid command');
      }
    } catch (e) {
      console.error(`[ERROR] removenick error: ${e.message}`);
      api.sendMessage('⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।', threadID);
    }
  }
};
