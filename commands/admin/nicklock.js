// commands/admin/nicklock.js
const { ensureThreadHasMessage, retryNicknameChange, sendMessageWithCooldown } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'nicklock',
  aliases: ['nicknamelock'],
  description: 'लॉक या अनलॉक करता है ग्रुप में निकनेम्स को।',
  execute(api, threadID, args, event, botState = {}, isMaster = false) {
    console.log(`[DEBUG] nicklock command: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    botState.adminList = botState.adminList || [];
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      sendMessageWithCooldown(api, threadID, '🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!');
      return;
    }

    if (args.length < 2) {
      sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
      return;
    }

    const command = args[1].toLowerCase();
    let targetID = Object.keys(event.mentions)[0] || null;
    let nickname = '';

    if (targetID && command === 'on') {
      const mentionIndex = args.findIndex(arg => arg.startsWith('@'));
      if (mentionIndex === -1 || mentionIndex < 2) {
        sendMessageWithCooldown(api, threadID, '⚠️ सही फॉर्मेट यूज करें: #nicklock on @user <nickname>');
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
        // Group-wide nickname lock with reduced messages and 20s delay per change
        if (!nickname) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
          return;
        }

        botState.nicknameQueues[threadID] = botState.nicknameQueues[threadID] || {
          active: false,
          nickname: '',
          changedUsers: new Set(),
          interval: 20000, // 20 seconds interval
          botUserId: api.getCurrentUserID()
        };

        botState.nicknameQueues[threadID].active = true;
        botState.nicknameQueues[threadID].nickname = nickname;
        botState.nicknameQueues[threadID].changedUsers.clear();

        ensureThreadHasMessage(api, threadID, () => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs) {
              sendMessageWithCooldown(api, threadID, '⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।');
              return;
            }

            if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम चेंज करने के लिए बॉट को एडमिन परमिशन चाहिए।');
              return;
            }

            const botID = api.getCurrentUserID();
            const members = info.participantIDs.filter(id => id !== botID);
            console.log(`[DEBUG] Processing ${members.length} members for group-wide nickname lock`);

            let i = 0;
            const changeNext = () => {
              if (i >= members.length || !botState.nicknameQueues[threadID]?.active) return;

              const memberID = members[i];
              const lastChange = botState.lastNicknameChange[`${threadID}:${memberID}`] || 0;
              if (Date.now() - lastChange < 20000) { // 20s cooldown per user
                console.log(`[DEBUG] Skipped nickname change for ${memberID} due to cooldown`);
                i++;
                setTimeout(changeNext, 20000);
                return;
              }

              retryNicknameChange(api, threadID, memberID, nickname, 1, (success) => { // Reduced retries to 1 to save memory and API calls
                if (success) {
                  botState.nicknameQueues[threadID].changedUsers.add(memberID);
                  botState.lastNicknameChange[`${threadID}:${memberID}`] = Date.now();
                  console.log(`[DEBUG] Set nickname for memberID=${memberID} to "${nickname}"`);
                }
                i++;
                setTimeout(changeNext, 20000); // 20s delay between changes
              });
            };
            changeNext();
            sendMessageWithCooldown(api, threadID, `🔒 निकनेम लॉक चालू: "${nickname}"। अब धीरे-धीरे निकनेम चेंज होंगे।`); // Only one message
          });
        });
      } else if (command === 'on' && targetID) {
        // Specific user nickname lock
        if (!nickname) {
          sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
          return;
        }

        botState.lockedNicknames[threadID] = botState.lockedNicknames[threadID] || {};

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID]) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            return;
          }

          const name = ret[targetID].name || 'User';
          botState.lockedNicknames[threadID][targetID] = nickname;

          const lastChange = botState.lastNicknameChange[`${threadID}:${targetID}`] || 0;
          if (Date.now() - lastChange < 20000) {
            sendMessageWithCooldown(api, threadID, '⚠️ कूलडाउन: 20 सेकंड बाद ट्राई करें।');
            return;
          }

          retryNicknameChange(api, threadID, targetID, nickname, 1, (success) => {
            if (success) {
              sendMessageWithCooldown(api, threadID, `✅ ${name} का निकनेम "${nickname}" पे लॉक कर दिया गया!`);
              botState.lastNicknameChange[`${threadID}:${targetID}`] = Date.now();
            } else {
              sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक करने में असफल। बाद में ट्राई करें।');
            }
          });
        });
      } else if (command === 'off' && !targetID) {
        // Group-wide unlock
        if (!botState.nicknameQueues?.[threadID]?.active) {
          sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक पहले से बंद है।');
          return;
        }

        botState.nicknameQueues[threadID].active = false;
        botState.nicknameQueues[threadID].changedUsers.clear();
        if (botState.nicknameTimers?.[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameTimers[threadID];
        }
        delete botState.nicknameQueues[threadID];
        sendMessageWithCooldown(api, threadID, '🔓 निकनेम लॉक बंद हो गया।');
      } else if (command === 'off' && targetID) {
        // Specific user unlock
        if (!botState.lockedNicknames?.[threadID]?.[targetID]) {
          sendMessageWithCooldown(api, threadID, '⚠️ इस यूजर का निकनेम लॉक नहीं है।');
          return;
        }

        api.getUserInfo([targetID], (err, ret) => {
          if (err || !ret || !ret[targetID]) {
            sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
            return;
          }
          const name = ret[targetID].name || 'User';
          delete botState.lockedNicknames[threadID][targetID];
          if (Object.keys(botState.lockedNicknames[threadID]).length === 0) {
            delete botState.lockedNicknames[threadID];
          }
          sendMessageWithCooldown(api, threadID, `✅ ${name} का निकनेम लॉक हटा दिया गया!`);
        });
      } else {
        sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
      }
    } catch (e) {
      console.error(`[ERROR] nicklock error: ${e?.message || 'Unknown error'}`);
      sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  }
};
