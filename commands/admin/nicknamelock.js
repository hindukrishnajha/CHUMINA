const { ensureThreadHasMessage, retryNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'nicklock',
  aliases: ['nicknamelock'],
  description: 'लॉक या अनलॉक करता है ग्रुप में निकनेम्स को।',
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] nicklock command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      api.sendMessage('उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user', threadID);
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    let targetID = Object.keys(event.mentions)[0] || null;
    let nickname = '';

    // Parse nickname based on new command structure
    if (targetID && command === 'on') {
      const mentionIndex = args.indexOf(args.find(arg => arg.startsWith('@')));
      if (mentionIndex === -1 || mentionIndex < 2) {
        api.sendMessage('⚠️ कृपया सही फॉर्मेट यूज करें: #nicklock on @user <nickname>', threadID);
        console.log('[DEBUG] Command rejected: Invalid mention format');
        return;
      }
      nickname = args.slice(mentionIndex + 1).join(' ').trim();
    } else if (command === 'on') {
      nickname = args.slice(2).join(' ').trim();
    }

    try {
      if (command === 'on' && !targetID) {
        // Group-wide nickname lock
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid or empty nickname');
          return;
        }

        if (!botState.nicknameQueues) botState.nicknameQueues = {};
        if (!botState.nicknameQueues[threadID]) {
          botState.nicknameQueues[threadID] = {
            active: false,
            nickname: '',
            changedUsers: new Set(),
            interval: 20000,
            botUserId: api.getCurrentUserID()
          };
        }

        botState.nicknameQueues[threadID].active = true;
        botState.nicknameQueues[threadID].nickname = nickname;
        botState.nicknameQueues[threadID].changedUsers.clear();
        console.log(`[DEBUG] Group-wide lock activated: nickname="${nickname}"`);

        ensureThreadHasMessage(api, threadID, () => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs) {
              api.sendMessage('⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।', threadID);
              console.log(`[DEBUG] Error fetching thread info for threadID=${threadID}: ${err?.message || 'Unknown error'}`);
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for group-wide nickname lock`);

            const batchSize = 10;
            for (let i = 0; i < members.length; i += batchSize) {
              setTimeout(() => {
                if (botState.nicknameQueues[threadID]?.active) {
                  members.slice(i, i + batchSize).forEach(memberID => {
                    retryNicknameChange(api, threadID, memberID, nickname, 3, (success) => {
                      if (success) {
                        botState.nicknameQueues[threadID].changedUsers.add(memberID);
                        console.log(`[DEBUG] Set nickname for memberID=${memberID} to "${nickname}"`);
                      }
                    });
                  });
                }
              }, (i / batchSize) * 1000);
            }
            api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। अब 20 सेकंड में निकनेम चेंज होंगे।`, threadID);
          });
        });
      } else if (command === 'on' && targetID) {
        // Specific user nickname lock
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid or empty nickname');
          return;
        }

        if (!botState.lockedNicknames) botState.lockedNicknames = {};
        if (!botState.lockedNicknames[threadID]) botState.lockedNicknames[threadID] = {};

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          botState.lockedNicknames[threadID][targetID] = nickname;
          console.log(`[DEBUG] Locked nickname for userID=${targetID} to "${nickname}"`);

          retryNicknameChange(api, threadID, targetID, nickname, 3, (success) => {
            if (success) {
              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`, threadID);
              console.log(`[DEBUG] Successfully locked nickname for ${name} (${targetID}) to "${nickname}"`);
            } else {
              api.sendMessage('⚠️ निकनेम लॉक करने में असफल। बाद में ट्राई करें।', threadID);
              console.log(`[DEBUG] Error setting nickname for userID=${targetID}`);
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Group-wide nickname unlock
        if (!botState.nicknameQueues?.[threadID]?.active) {
          api.sendMessage('⚠️ निकनेम लॉक पहले से बंद है।', threadID);
          console.log('[DEBUG] Command rejected: Group-wide nickname lock already off');
          return;
        }

        botState.nicknameQueues[threadID].active = false;
        botState.nicknameQueues[threadID].changedUsers.clear();
        if (botState.nicknameTimers?.[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameTimers[threadID];
        }
        delete botState.nicknameQueues[threadID];
        console.log(`[DEBUG] Group-wide nickname lock deactivated and cleared`);
        api.sendMessage('🔓 निकनेम लॉक बंद हो गया।', threadID);
      } else if (command === 'off' && targetID) {
        // Specific user nickname unlock
        if (!botState.lockedNicknames?.[threadID]?.[targetID]) {
          api.sendMessage('⚠️ इस यूजर का निकनेम लॉक नहीं है।', threadID);
          console.log(`[DEBUG] Command rejected: No nickname lock for userID=${targetID}`);
          return;
        }

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          delete botState.lockedNicknames[threadID][targetID];
          if (Object.keys(botState.lockedNicknames[threadID]).length === 0) {
            delete botState.lockedNicknames[threadID];
          }
          console.log(`[DEBUG] Removed nickname lock for userID=${targetID}`);

          retryNicknameChange(api, threadID, targetID, '', 3, (success) => {
            if (success) {
              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम लॉक हटा दिया गया!`, threadID);
              console.log(`[DEBUG] Successfully removed nickname lock for ${name} (${targetID})`);
            } else {
              api.sendMessage('⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।', threadID);
              console.log(`[DEBUG] Error removing nickname for userID=${targetID}`);
            }
          });
        });
      } else {
        api.sendMessage('उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user', threadID);
        console.log('[DEBUG] Command rejected: Invalid command');
      }
    } catch (e) {
      console.error(`[ERROR] nicklock error: ${e.message}`);
      api.sendMessage('⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।', threadID);
    }
  }
};
