// commands/admin/nicknamelock.js
const { ensureThreadHasMessage } = require('../../utils/nicknameUtils');

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

    if (args.length < 2) {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on <nickname> @user या #nicknamelock off या #nicknamelock off @user', threadID);
      console.log('[DEBUG] Command rejected: Insufficient arguments');
      return;
    }

    const command = args[1].toLowerCase();
    let nickname = args.slice(2).join(' ').trim();
    let targetID = null;

    if (event.mentions && Object.keys(event.mentions).length > 0) {
      targetID = Object.keys(event.mentions)[0];
      nickname = args.slice(2, args.length - 1).join(' ').trim();
    }

    if (command === 'on' && !targetID) {
      // Group-wide nickname lock
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
          interval: 20000, // 20 seconds
          botUserId: botState.sessions[event.senderID]?.botID || event.senderID
        };
      }

      botState.nicknameQueues[threadID].active = true;
      botState.nicknameQueues[threadID].nickname = nickname;
      console.log(`[DEBUG] Group-wide lock activated: nickname="${nickname}"`);

      api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। अब 20 सेकंड में निकनेम चेंज होंगे।`, threadID);

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
          }, index * 20000); // 20 seconds per member
        });
      });
    } else if (command === 'on' && targetID) {
      // Specific user nickname lock
      console.log(`[DEBUG] Specific user lock: userID=${targetID}, mention=${args[args.length - 1]}`);
      
      if (!nickname || nickname.length === 0) {
        api.sendMessage('⚠️ कृपया एक वैलिड निकनेम प्रोवाइड करें।', threadID);
        console.log('[DEBUG] Command rejected: Invalid or empty nickname');
        return;
      }
      console.log(`[DEBUG] Nickname extracted: ${nickname}`);

      api.getUserInfo(targetID, (err, ret) => {
        if (err || !ret || !ret[targetID] || !ret[targetID].name) {
          api.sendMessage('⚠️ यूजर जानकारी लाने में असफल।', threadID);
          console.log(`[DEBUG] Error fetching user info for userID=${targetID}: ${err?.message || 'Unknown error'}`);
          return;
        }

        const name = ret[targetID].name || 'User';
        if (!botState.lockedNicknames[threadID]) {
          botState.lockedNicknames[threadID] = {};
        }
        botState.lockedNicknames[threadID][targetID] = nickname;
        console.log(`[DEBUG] Locked nickname for userID=${targetID} to "${nickname}"`);

        api.changeNickname(nickname, threadID, targetID, (err) => {
          if (err) {
            api.sendMessage('⚠️ निकनेम लॉक करने में असफल।', threadID);
            console.log(`[DEBUG] Error setting nickname for userID=${targetID}: ${err?.message || 'Unknown error'}`);
          } else {
            api.sendMessage(`✅ ${name} (${targetID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`, threadID);
            console.log(`[DEBUG] Successfully locked nickname for ${name} (${targetID}) to "${nickname}"`);
          }
        });
      });
    } else if (command === 'off' && args.length === 2) {
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
    } else if (command === 'off' && targetID) {
      // Specific user nickname unlock
      console.log(`[DEBUG] Specific user unlock: userID=${targetID}, mention=${args[2]}`);
      
      if (!botState.lockedNicknames[threadID]?.[targetID]) {
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
        console.log(`[DEBUG] Removed nickname lock for userID=${targetID}`);

        api.changeNickname('', threadID, targetID, (err) => {
          if (err) {
            api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
            console.log(`[DEBUG] Error removing nickname for userID=${targetID}: ${err?.message || 'Unknown error'}`);
          } else {
            api.sendMessage(`✅ ${name} (${targetID}) का निकनेम लॉक हटा दिया गया!`, threadID);
            console.log(`[DEBUG] Successfully removed nickname lock for ${name} (${targetID})`);
          }
        });
      });
    } else {
      api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on <nickname> @user या #nicknamelock off या #nicknamelock off @user', threadID);
      console.log('[DEBUG] Command rejected: Invalid command');
    }
  }
};
