module.exports = {
  name: 'nicknamelock',
  aliases: ['nicklock'],
  description: 'लॉक या अनलॉक करता है ग्रुप में निकनेम्स को।',
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] nicknamelock command received: args=${args.join(' ')}, threadID=${threadID}, senderID=${event.senderID}`);
    
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      console.log(`[DEBUG] Command rejected: Sender ${event.senderID} is not admin/master`);
      return;
    }

    if (args.length < 1) {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on @user <nickname> या #nicknamelock off या #nicknamelock @user off', threadID);
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[0].toLowerCase();
    console.log(`[DEBUG] Command parsed: command=${command}`);

    if (command === 'on') {
      if (args[1] && args[1].startsWith('@') && event.mentions && Object.keys(event.mentions).length > 0) {
        // Specific user nickname lock
        const userID = Object.keys(event.mentions)[0];
        console.log(`[DEBUG] Specific user lock: userID=${userID}, mention=${args[1]}`);
        
        if (!userID) {
          api.sendMessage('⚠️ कृपया एक वैलिड यूजर को मेंशन करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid user mention');
          return;
        }

        // Extract nickname by joining all args after @user
        let nickname = args.slice(2).join(' ').trim();
        // Remove surrounding brackets if present
        if (nickname.startsWith('(') && nickname.endsWith(')')) {
          nickname = nickname.slice(1, -1).trim();
        }
        // Validate nickname (allow Hindi and other Unicode characters)
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid or empty nickname');
          return;
        }
        console.log(`[DEBUG] Nickname extracted: ${nickname}`);

        api.getUserInfo(userID, (err, ret) => {
          if (err || !ret || !ret[userID] || !ret[userID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching user info for userID=${userID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[userID].name || 'User';
          if (!botState.lockedNicknames[threadID]) {
            botState.lockedNicknames[threadID] = {};
          }
          botState.lockedNicknames[threadID][userID] = nickname;
          console.log(`[DEBUG] Locked nickname for userID=${userID} to "${nickname}"`);

          api.changeNickname(nickname, threadID, userID, (err) => {
            if (err) {
              api.sendMessage('⚠️ निकनेम लॉक करने में असफल।', threadID);
              console.log(`[DEBUG] Error setting nickname for userID=${userID}: ${err?.message || 'Unknown error'}`);
            } else {
              api.sendMessage(`✅ ${name} (${userID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`, threadID);
              console.log(`[DEBUG] Successfully locked nickname for ${name} (${userID}) to "${nickname}"`);
            }
          });
        });
      } else {
        // Group-wide nickname lock
        let nickname = args.slice(1).join(' ').trim();
        // Remove surrounding brackets if present
        if (nickname.startsWith('(') && nickname.endsWith(')')) {
          nickname = nickname.slice(1, -1).trim();
        }
        // Validate nickname
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid or empty nickname for group-wide lock');
          return;
        }
        console.log(`[DEBUG] Group-wide nickname extracted: ${nickname}`);

        if (!botState.nicknameQueues[threadID]) {
          botState.nicknameQueues[threadID] = {
            active: false,
            nickname: '',
            changedUsers: new Set(),
            interval: 30000,
            botUserId: botState.sessions[event.senderID]?.botID || event.senderID
          };
        }

        botState.nicknameQueues[threadID].active = true;
        botState.nicknameQueues[threadID].nickname = nickname;
        console.log(`[DEBUG] Group-wide lock activated: nickname="${nickname}"`);

        api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। अब 30 सेकंड में निकनेम चेंज होंगे।`, threadID);

        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info || !info.participantIDs) {
            api.sendMessage('⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching thread info for threadID=${threadID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const members = info.participantIDs.filter(id => id !== botState.sessions[event.senderID]?.botID);
          console.log(`[DEBUG] Processing ${members.length} members for group-wide nickname lock`);
          members.forEach((memberID, index) => {
            setTimeout(() => {
              if (botState.nicknameQueues[threadID]?.active) {
                api.changeNickname(nickname, threadID, memberID, (err) => {
                  if (!err) {
                    botState.nicknameQueues[threadID].changedUsers.add(memberID);
                    console.log(`[DEBUG] Set nickname for memberID=${memberID} to "${nickname}"`);
                  } else {
                    console.log(`[DEBUG] Error setting nickname for memberID=${memberID}: ${err?.message || 'Unknown error'}`);
                  }
                });
              }
            }, index * 1000);
          });
        });
      }
    } else if (command === 'off') {
      if (args[1] && args[1].startsWith('@') && event.mentions && Object.keys(event.mentions).length > 0) {
        // Specific user nickname unlock
        const userID = Object.keys(event.mentions)[0];
        console.log(`[DEBUG] Specific user unlock: userID=${userID}, mention=${args[1]}`);
        
        if (!userID) {
          api.sendMessage('⚠️ कृपया एक वैलिड यूजर को मेंशन करें।', threadID);
          console.log('[DEBUG] Command rejected: Invalid user mention');
          return;
        }

        if (!botState.lockedNicknames[threadID]?.[userID]) {
          api.sendMessage('⚠️ इस यूजर का निकनेम लॉक नहीं है।', threadID);
          console.log(`[DEBUG] Command rejected: No nickname lock for userID=${userID}`);
          return;
        }

        api.getUserInfo(userID, (err, ret) => {
          if (err || !ret || !ret[userID] || !ret[userID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            console.log(`[DEBUG] Error fetching user info for userID=${userID}: ${err?.message || 'Unknown error'}`);
            return;
          }

          const name = ret[userID].name || 'User';
          delete botState.lockedNicknames[threadID][userID];
          console.log(`[DEBUG] Removed nickname lock for userID=${userID}`);

          // Remove nickname to revert to default
          api.changeNickname('', threadID, userID, (err) => {
            if (err) {
              api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
              console.log(`[DEBUG] Error removing nickname for userID=${userID}: ${err?.message || 'Unknown error'}`);
            } else {
              api.sendMessage(`✅ ${name} (${userID}) का निकनेम लॉक हटा दिया गया!`, threadID);
              console.log(`[DEBUG] Successfully removed nickname lock for ${name} (${userID})`);
            }
          });
        });
      } else {
        // Group-wide nickname unlock
        if (!botState.nicknameQueues[threadID]?.active) {
          api.sendMessage('⚠️ निकनेम लॉक पहले से बंद है।', threadID);
          console.log('[DEBUG] Command rejected: Group-wide nickname lock already off');
          return;
        }

        botState.nicknameQueues[threadID].active = false;
        if (botState.nicknameTimers[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameTimers[threadID];
          console.log(`[DEBUG] Cleared nickname timer for threadID=${threadID}`);
        }
        api.sendMessage('🔓 निकनेम लॉक बंद हो गया।', threadID);
        console.log('[DEBUG] Group-wide nickname lock deactivated');
      }
    } else {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on @user <nickname> या #nicknamelock off या #nicknamelock @user off', threadID);
      console.log('[DEBUG] Command rejected: Invalid command');
    }
  }
};
