const { ensureThreadHasMessage } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'removenickname',
  aliases: ['removenick'],
  description: 'ग्रुप में निकनेम्स हटाता है या निकनेम रिमूव मोड को मैनेज करता है।',
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] removenickname command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      api.sendMessage('उपयोग: #removenickname on @everyone या #removenickname on @user या #removenickname off या #removenickname off @user', threadID);
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    const targetID = Object.keys(event.mentions)[0] || null;

    if (command === 'on' && args[2] === '@everyone') {
      // Remove nicknames for all members and enable monitoring
      if (!botState.removeNicknameActive[threadID]) {
        botState.removeNicknameActive[threadID] = true;
        botState.removeNicknameTargets[threadID] = null; // null means apply to everyone
        console.log('[DEBUG] removeNicknameActive set to true, targets set to null for threadID=', threadID);
      }

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

          members.forEach((memberID, index) => {
            setTimeout(() => {
              if (botState.removeNicknameActive[threadID]) {
                api.changeNickname('', threadID, memberID, (err) => {
                  if (err) {
                    console.log(`[DEBUG] Error removing nickname for memberID=${memberID}: ${err?.message || 'Unknown error'}`);
                    api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
                  } else {
                    console.log(`[DEBUG] Removed nickname for memberID=${memberID}`);
                  }
                });
              }
            }, index * 10000); // 10 seconds per member
          });
          api.sendMessage('✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटा दिए गए! नया निकनेम डालने पर bot हटाएगा (#removenickname off से बंद होगा).', threadID);
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
        if (!botState.removeNicknameActive[threadID]) {
          botState.removeNicknameActive[threadID] = true;
          botState.removeNicknameTargets[threadID] = new Set();
          console.log('[DEBUG] removeNicknameActive set to true, initialized targets Set for threadID=', threadID);
        }
        botState.removeNicknameTargets[threadID].add(targetID);
        console.log(`[DEBUG] Added userID=${targetID} to removeNicknameTargets`);

        ensureThreadHasMessage(api, threadID, () => {
          api.changeNickname('', threadID, targetID, (err) => {
            if (err) {
              api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
              console.log(`[DEBUG] Error removing nickname for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            } else {
              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम हटा दिया गया! नया निकनेम डाला toh bot हटाएगा (#removenickname off @user से बंद होगा).`, threadID);
              console.log(`[DEBUG] Successfully removed nickname for ${name} (${targetID})`);
            }
          });
        });
      });
    } else if (command === 'off' && !targetID) {
      // Stop remove nickname mode for group
      if (!botState.removeNicknameActive[threadID]) {
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
      if (!botState.removeNicknameTargets[threadID]?.has(targetID)) {
        api.sendMessage('⚠️ इस यूजर के लिए निकनेम रिमूव मोड पहले से बंद है।', threadID);
        console.log(`[DEBUG] Command rejected: No remove nickname target for userID=${targetID}`);
        return;
      }

      botState.removeNicknameTargets[threadID].delete(targetID);
      if (botState.removeNicknameTargets[threadID].size === 0) {
        botState.removeNicknameActive[threadID] = false;
        delete botState.removeNicknameTargets[threadID];
      }
      console.log(`[DEBUG] Removed userID=${targetID} from removeNicknameTargets`);

      api.getUserInfo([targetID], (err, ret) => {
        if (err || !ret || !ret[targetID] || !ret[targetID].name) {
          api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
          console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
          return;
        }
        const name = ret[targetID].name || 'User';
        api.sendMessage(`✅ ${name} (${targetID}) के लिए निकनेम रिमूव मोड बंद कर दिया गया!`, threadID);
        console.log(`[DEBUG] Successfully turned off remove nickname for ${name} (${targetID})`);
      });
    } else {
      api.sendMessage('उपयोग: #removenickname on @everyone या #removenickname on @user या #removenickname off या #removenickname off @user', threadID);
      console.log('[DEBUG] Command rejected: Invalid command');
    }
  }
};
