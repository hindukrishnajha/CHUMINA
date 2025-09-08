const { ensureThreadHasMessage, retryNicknameChange, sendMessageWithCooldown } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'nicklock',
  aliases: ['nicknamelock'],
  description: 'लॉक या अनलॉक करता है ग्रुप में निकनेम्स को।',
  execute(api, threadID, args, event, botState = {}, isMaster = false) => {
    console.log(`[DEBUG] nicklock command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    botState.adminList = botState.adminList || [];
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      sendMessageWithCooldown(api, threadID, '🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!');
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    let targetID = Object.keys(event.mentions)[0] || null;
    let nickname = '';

    // Parse nickname
    if (targetID && command === 'on') {
      const mentionIndex = args.indexOf(args.find(arg => arg.startsWith('@')));
      if (mentionIndex === -1 || mentionIndex < 2) {
        sendMessageWithCooldown(api, threadID, '⚠️ कृपया सही फॉर्मेट यूज करें: #nicklock on @user <nickname>');
        console.log('[DEBUG] Command rejected: Invalid mention format');
        return;
      }
      nickname = args.slice(mentionIndex + 1).join(' ').trim();
    } else if (command === 'on') {
      nickname = args.slice(2).join(' ').trim();
    }

    try {
      botState.nicknameQueues = botState.nicknameQueues || {};
      botState.lockedNicknames = botState.lockedNicknames || {};
      botState.lastNicknameChange = botState.lastNicknameChange || {};

      if (command === 'on' && !targetID) {
        // Group-wide nickname lock
        if (!nickname || nickname.length === 0) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
          console.log('[DEBUG] Command rejected: Invalid or empty nickname');
          return;
        }

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
              sendMessageWithCooldown(api, threadID, '⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।');
              console.log(`[DEBUG] Error fetching thread info for threadID=${threadID}: ${err?.message || 'Unknown error'}`);
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for group-wide nickname lock`);

            const batchSize = 5;
            for (let i = 0; i < members.length; i += batchSize) {
              setTimeout(() => {
                if (botState.nicknameQueues[threadID]?.active) {
                  members.slice(i, i + batchSize).forEach(memberID => {
                    const lastChange = botState.lastNicknameChange[`${threadID}:${memberID}`] || 0;
                    if (Date.now() - lastChange < 60000) {
                      console.log(`[DEBUG] Skipped nickname change for ${memberID} due to cooldown`);
                      return;
                    }
                    retryNicknameChange(api, threadID, memberID, nickname, 2, (success) => {
                      if (success) {
                        botState.nicknameQueues[threadID].changedUsers.add(memberID);
                        botState.lastNicknameChange[`${threadID}:${memberID}`] = Date.now();
                        console.log(`[DEBUG] Set nickname for memberID=${memberID} to "${nickname}"`);
                      }
                    });
                  });
                }
              }, (i / batchSize) * 3000); // 3 seconds per batch
            }
            sendMessageWithCooldown(api, threadID, `🔒 निकनेम लॉक चालू: "${nickname}"। अब 20 सेकंड में निकनेम चेंज होंगे।`);
          });
        });
      } else if (command === 'on' && targetID) {
        // Specific user nickname lock
        if (!nickname || nickname.length === 0) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
          console.log('[DEBUG] Command rejected: Invalid or empty nickname');
          return;
        }

        if (!botState.lockedNicknames[threadID]) botState.lockedNicknames[threadID] = {};

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          botState.lockedNicknames[threadID][targetID] = nickname;
          console.log(`[DEBUG] Locked nickname for userID=${targetID} to "${nickname}"`);

          retryNicknameChange(api, threadID, targetID, nickname, 2, (success) => {
            if (success) {
              sendMessageWithCooldown(api, threadID, `✅ ${name} (${targetID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`);
              botState.lastNicknameChange[`${threadID}:${targetID}`] = Date.now();
              console.log(`[DEBUG] Successfully locked nickname for ${name} (${targetID}) to "${nickname}"`);
            } else {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक करने में असफल। बाद में ट्राई करें।');
              console.log(`[DEBUG] Error setting nickname for userID=${targetID}`);
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Group-wide nickname unlock
        if (!botState.nicknameQueues?.[threadID]?.active) {
          sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक पहले से बंद है।');
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
        sendMessageWithCooldown(api, threadID, '🔓 निकनेम लॉक बंद हो गया।');
      } else if (command === 'off' && targetID) {
        // Specific user nickname unlock - No nickname change
        if (!botState.lockedNicknames?.[threadID]?.[targetID]) {
          sendMessageWithCooldown(api, threadID, '⚠️ इस यूजर का निकनेम लॉक नहीं है।');
          console.log(`[DEBUG] Command rejected: No nickname lock for userID=${targetID}`);
          return;
        }

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret || !ret[targetID] || !ret[targetID].name) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[targetID].name || 'User';
          delete botState.lockedNicknames[threadID][targetID];
          if (Object.keys(botState.lockedNicknames[threadID]).length === 0) {
            delete botState.lockedNicknames[threadID];
          }
          console.log(`[DEBUG] Removed nickname lock for userID=${targetID}`);
          sendMessageWithCooldown(api, threadID, `✅ ${name} (${targetID}) का निकनेम लॉक हटा दिया गया!`);
          console.log(`[DEBUG] Successfully removed nickname lock for ${name} (${targetID})`);
        });
      } else {
        sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
        console.log('[DEBUG] Command rejected: Invalid command');
      }
    } catch (e) {
      console.error(`[ERROR] nicklock error: ${e?.message || 'Unknown error'}`);
      sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  }
};
