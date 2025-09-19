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
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 2) {
      sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[0].toLowerCase(); // Fix: args[0] is the subcommand like 'on' or 'off'
    let targetID = Object.keys(event.mentions)[0] || null;
    let nickname = '';

    // Parse nickname correctly
    if (targetID && command === 'on') {
      // If mention present, nickname starts after mention
      const mentionArg = args.find(arg => arg.startsWith('@'));
      const mentionIndex = args.indexOf(mentionArg);
      if (mentionIndex === -1 || mentionIndex < 1) {
        sendMessageWithCooldown(api, threadID, '⚠️ कृपया सही फॉर्मेट यूज करें: #nicklock on @user <nickname>');
        console.log('[DEBUG] Command rejected: Invalid mention format');
        return;
      }
      nickname = args.slice(mentionIndex + 1).join(' ').trim();
    } else if (command === 'on') {
      // No mention, group-wide, nickname from args[1] onwards
      nickname = args.slice(1).join(' ').trim();
    } else if (command === 'off') {
      // For off, no nickname needed
      nickname = '';
    } else {
      sendMessageWithCooldown(api, threadID, '⚠️ गलत कमांड: on या off यूज करें।');
      return;
    }

    try {
      botState.nicknameQueues = botState.nicknameQueues || {};
      botState.lockedNicknames = botState.lockedNicknames || {};
      botState.lastNicknameChange = botState.lastNicknameChange || {};

      // Early admin permission check
      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info) {
          sendMessageWithCooldown(api, threadID, '⚠️ ग्रुप जानकारी लाने में असफल।');
          return;
        }
        if (!info.adminIDs.some(admin => admin.id === api.getCurrentUserID())) {
          sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक करने के लिए बॉट को एडमिन परमिशन चाहिए।');
          console.log('[DEBUG] Bot lacks admin permissions');
          return;
        }

        if (command === 'on' && !targetID) {
          // Group-wide nickname lock
          if (!nickname || nickname.length === 0) {
            sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
            console.log('[DEBUG] Command rejected: Invalid or empty nickname');
            return;
          }

          botState.nicknameQueues[threadID] = {
            active: true,
            nickname: nickname,
            changedUsers: new Set(),
            interval: 20000,
            botUserId: api.getCurrentUserID()
          };
          console.log(`[DEBUG] Group-wide lock activated: nickname="${nickname}"`);

          sendMessageWithCooldown(api, threadID, 'मालिक अब में सबके निकनेम बदल दूंगा आपकी आज्ञा का पालन करना मेरा फर्ज है');

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

              let completed = 0;
              let i = 0;
              const changeNext = () => {
                if (i >= members.length || !botState.nicknameQueues[threadID]?.active) {
                  if (completed === members.length && botState.nicknameQueues[threadID]?.active) {
                    sendMessageWithCooldown(api, threadID, 'मालिक मैंने सब के निकनेम बदल दिए जब तक आपका ये दास है तब तक कोई नहीं बच सकता');
                    console.log('[DEBUG] All nicknames changed for group-wide lock');
                  }
                  return;
                }

                const memberID = members[i];
                const lastChange = botState.lastNicknameChange[`${threadID}:${memberID}`] || 0;
                if (Date.now() - lastChange < 20000) {
                  console.log(`[DEBUG] Skipped nickname change for ${memberID} due to cooldown`);
                  i++;
                  setTimeout(changeNext, 20000);
                  return;
                }

                retryNicknameChange(api, threadID, memberID, nickname, 3, (success) => { // Increased retry to 3 for better handling
                  if (success) {
                    botState.nicknameQueues[threadID].changedUsers.add(memberID);
                    botState.lastNicknameChange[`${threadID}:${memberID}`] = Date.now();
                    console.log(`[DEBUG] Set nickname for memberID=${memberID} to "${nickname}"`);
                    completed++;
                  } else {
                    console.log(`[DEBUG] Failed to set nickname for ${memberID} after retries`);
                  }
                  i++;
                  setTimeout(changeNext, 20000);
                });
              };
              changeNext();
            });
          });
        } else if (command === 'on' && targetID) {
          // Specific user nickname lock
          if (!nickname || nickname.length === 0) {
            sendMessageWithCooldown(api, threadID, '⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।');
            console.log('[DEBUG] Command rejected: Invalid or empty nickname');
            return;
          }

          botState.lockedNicknames[threadID] = botState.lockedNicknames[threadID] || {};

          api.getUserInfo([targetID], (err, ret) => {
            if (err || !ret || !ret[targetID]) {
              sendMessageWithCooldown(api, threadID, '⚠️ यूजर जानकारी लाने में असफल।');
              console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
              return;
            }

            const name = ret[targetID].name || 'User';
            botState.lockedNicknames[threadID][targetID] = nickname;
            console.log(`[DEBUG] Locked nickname for userID=${targetID} to "${nickname}"`);

            const lastChange = botState.lastNicknameChange[`${threadID}:${targetID}`] || 0;
            if (Date.now() - lastChange < 20000) {
              sendMessageWithCooldown(api, threadID, '⚠️ कूलडाउन: 20 सेकंड बाद ट्राई करें।');
              console.log(`[DEBUG] Skipped nickname change for ${targetID} due to cooldown`);
              return;
            }

            retryNicknameChange(api, threadID, targetID, nickname, 3, (success) => { // Increased retry
              if (success) {
                sendMessageWithCooldown(api, threadID, `मालिक आपकी आज्ञा अनुसार मैंने ${name} का निकनेम "${nickname}" पर लॉक कर दिया`);
                botState.lastNicknameChange[`${threadID}:${targetID}`] = Date.now();
                console.log(`[DEBUG] Successfully locked nickname for ${name} (${targetID}) to "${nickname}"`);
              } else {
                sendMessageWithCooldown(api, threadID, '⚠️ निकनेम लॉक करने में असफल (API इश्यू)। बाद में ट्राई करें।');
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
          sendMessageWithCooldown(api, threadID, 'आपका आदेश सर आंखों पर मेरे मालिक');
        } else if (command === 'off' && targetID) {
          // Specific user nickname unlock
          if (!botState.lockedNicknames?.[threadID]?.[targetID]) {
            sendMessageWithCooldown(api, threadID, '⚠️ इस यूजर का निकनेम लॉक नहीं है।');
            console.log(`[DEBUG] Command rejected: No nickname lock for userID=${targetID}`);
            return;
          }

          api.getUserInfo([targetID], (err, ret) => {
            if (err || !ret || !ret[targetID]) {
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
            sendMessageWithCooldown(api, threadID, `मालिक आपके आदेश के कारण मैं ${name} को बख्श रहा निकनेम बदलना बंद`);
          });
        } else {
          sendMessageWithCooldown(api, threadID, 'उपयोग: #nicklock on <nickname> या #nicklock on @user <nickname> या #nicklock off या #nicklock off @user');
          console.log('[DEBUG] Command rejected: Invalid command');
        }
      });
    } catch (e) {
      console.error(`[ERROR] nicklock error: ${e?.message || 'Unknown error'}`);
      sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  }
};
