module.exports = {
  name: 'nicknamelock',
  aliases: ['nicklock'],
  description: 'लॉक या अनलॉक करता है ग्रुप में निकनेम्स को।',
  execute(api, threadID, args, event, botState, isMaster) {
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;

    if (!isAdmin) {
      api.sendMessage('🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है!', threadID);
      return;
    }

    if (args.length < 1) {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on @user <nickname> या #nicknamelock off या #nicknamelock @user off', threadID);
      return;
    }

    const command = args[0].toLowerCase();

    if (command === 'on') {
      if (args[1] && args[1].startsWith('@')) {
        // Specific user nickname lock
        const userID = Object.keys(event.mentions)[0];
        if (!userID) {
          api.sendMessage('⚠️ कृपया एक वैलिड यूजर को मेंशन करें।', threadID);
          return;
        }

        // Extract nickname by joining all args after @user
        let nickname = args.slice(2).join(' ').trim();
        // Remove surrounding brackets if present
        if (nickname.startsWith('(') && nickname.endsWith(')')) {
          nickname = nickname.slice(1, -1).trim();
        }
        // Allow Hindi and other Unicode characters, but ensure it's not empty
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          return;
        }

        api.getUserInfo(userID, (err, ret) => {
          if (err || !ret || !ret[userID] || !ret[userID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            return;
          }

          const name = ret[userID].name || 'User';
          if (!botState.lockedNicknames[threadID]) {
            botState.lockedNicknames[threadID] = {};
          }
          botState.lockedNicknames[threadID][userID] = nickname;

          api.changeNickname(nickname, threadID, userID, (err) => {
            if (err) {
              api.sendMessage('⚠️ निकनेम लॉक करने में असफल।', threadID);
            } else {
              api.sendMessage(`✅ ${name} (${userID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`, threadID);
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
        // Allow Hindi and other Unicode characters, but ensure it's not empty
        if (!nickname || nickname.length === 0) {
          api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
          return;
        }

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

        api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। अब 30 सेकंड में निकनेम चेंज होंगे।`, threadID);

        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info || !info.participantIDs) {
            api.sendMessage('⚠️ ग्रुप मेंबर्स की जानकारी लाने में असफल।', threadID);
            return;
          }

          const members = info.participantIDs.filter(id => id !== botState.sessions[event.senderID]?.botID);
          members.forEach((memberID, index) => {
            setTimeout(() => {
              if (botState.nicknameQueues[threadID]?.active) {
                api.changeNickname(nickname, threadID, memberID, (err) => {
                  if (!err) {
                    botState.nicknameQueues[threadID].changedUsers.add(memberID);
                  }
                });
              }
            }, index * 1000);
          });
        });
      }
    } else if (command === 'off') {
      if (args[1] && args[1].startsWith('@')) {
        // Specific user nickname unlock
        const userID = Object.keys(event.mentions)[0];
        if (!userID) {
          api.sendMessage('⚠️ कृपया एक वैलिड यूजर को मेंशन करें।', threadID);
          return;
        }

        if (!botState.lockedNicknames[threadID]?.[userID]) {
          api.sendMessage('⚠️ इस यूजर का निकनेम लॉक नहीं है।', threadID);
          return;
        }

        api.getUserInfo(userID, (err, ret) => {
          if (err || !ret || !ret[userID] || !ret[userID].name) {
            api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
            return;
          }

          const name = ret[userID].name || 'User';
          delete botState.lockedNicknames[threadID][userID];

          // Remove nickname to revert to default
          api.changeNickname('', threadID, userID, (err) => {
            if (err) {
              api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
            } else {
              api.sendMessage(`✅ ${name} (${userID}) का निकनेम लॉक हटा दिया गया!`, threadID);
            }
          });
        });
      } else {
        // Group-wide nickname unlock
        if (!botState.nicknameQueues[threadID]?.active) {
          api.sendMessage('⚠️ निकनेम लॉक पहले से बंद है।', threadID);
          return;
        }

        botState.nicknameQueues[threadID].active = false;
        if (botState.nicknameTimers[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameTimers[threadID];
        }
        api.sendMessage('🔓 निकनेम लॉक बंद हो गया।', threadID);
      }
    } else {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on @user <nickname> या #nicknamelock off या #nicknamelock @user off', threadID);
    }
  }
};
