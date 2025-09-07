// Updated nicknamelock.js
const { processNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
  name: "nicknamelock",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] nicknamelock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}`);
    try {
      const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
      if (!isAdmin) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.nicknameQueues) botState.nicknameQueues = {};
      if (!botState.nicknameTimers) botState.nicknameTimers = {};
      if (!botState.lockedNicknames) botState.lockedNicknames = {};

      // थ्रेड में कम से कम एक मैसेज भेजने का फंक्शन
      const ensureThreadHasMessage = (callback) => {
        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info || info.messageCount === 0) {
            console.log(`[DEBUG] Thread ${threadID} has no messages, sending dummy message`);
            api.sendMessage('🔧 Initializing nickname change...', threadID, (err) => {
              if (err) {
                console.error(`[ERROR] Failed to send dummy message to thread ${threadID}:`, err.message);
                api.sendMessage('⚠️ थ्रेड में मैसेज भेजने में असफल।', threadID);
                return;
              }
              setTimeout(callback, 1000); // 1 सेकंड वेट करके कॉलबैक
            });
          } else {
            callback();
          }
        });
      };

      if (args[1] && args[1].toLowerCase() === 'on') {
        let targetID = null;
        let nickname = null;
        if (event.mentions && Object.keys(event.mentions).length > 0) {
          targetID = Object.keys(event.mentions)[0];
          // निकनेम कमांड के बाद से जॉइन करें (args[2] और आगे)
          nickname = args.slice(2).join(' ') || null;
        }

        if (targetID) {
          // यूजर-विशिष्ट निकनेम लॉक
          ensureThreadHasMessage(() => {
            api.getUserInfo(targetID, (err, ret) => {
              if (err || !ret?.[targetID]) {
                api.sendMessage('❌ यूजर की जानकारी लेने में असफल।', threadID);
                console.error(`[ERROR] getUserInfo failed for ${targetID}:`, err?.message);
                return;
              }
              const name = ret[targetID].name || 'User';

              if (!nickname) {
                api.sendMessage('⚠️ निकनेम प्रोवाइड करें: #nicknamelock on @user <nickname>', threadID);
                return;
              }

              if (!botState.lockedNicknames[threadID]) {
                botState.lockedNicknames[threadID] = {};
              }
              botState.lockedNicknames[threadID][targetID] = nickname;

              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम "${nickname}" पे लॉक कर दिया गया!`, threadID);
              console.log(`[DEBUG] Locked nickname for ${targetID}: "${nickname}" in thread ${threadID}`);

              // तुरंत निकनेम बदलकर लॉक करें
              api.changeNickname(nickname, threadID, targetID, (err) => {
                if (err) {
                  console.error(`[ERROR] changeNickname failed for ${targetID}: ${err.message}`);
                  api.sendMessage('⚠️ निकनेम सेट करने में असफल।', threadID);
                } else {
                  console.log(`[DEBUG] Set nickname for ${targetID} to "${nickname}"`);
                }
              });
            });
          });
        } else {
          // ग्रुप-लेवल लॉक (पहले जैसा, 30 सेकंड टाइमिंग)
          const nickname = args.slice(2).join(' ') || 'LockedName';
          const interval = 30000; // 30 सेकंड
          console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}, interval: ${interval}ms`);

          ensureThreadHasMessage(() => {
            const tryFetchThreadInfo = (attempt = 1, maxAttempts = 5) => {
              api.getThreadInfo(threadID, (err, info) => {
                if (err || !info || !info.participantIDs || info.participantIDs.length === 0) {
                  console.error(`[ERROR] getThreadInfo failed for thread ${threadID} (attempt ${attempt}):`, err?.message || 'No participantIDs');
                  if (attempt < maxAttempts) {
                    setTimeout(() => tryFetchThreadInfo(attempt + 1, maxAttempts), Math.pow(2, attempt) * 5000);
                  } else {
                    api.sendMessage('⚠️ ग्रुप मेंबर्स लोड करने में असफल।', threadID);
                    return;
                  }
                  return;
                }

                botState.memberCache[threadID] = new Set(info.participantIDs);
                initializeNicknameLock(info.participantIDs);
              });
            };

            const initializeNicknameLock = (members) => {
              const botUserId = api.getCurrentUserID();
              botState.nicknameQueues[threadID] = {
                members: members.filter(id => id !== botUserId),
                currentIndex: 0,
                nickname,
                botUserId,
                active: true,
                completed: false,
                changedUsers: new Set(),
                interval
              };

              if (botState.nicknameQueues[threadID].members.length === 0) {
                api.sendMessage('⚠️ कोई वैलिड ग्रुप मेंबर्स नहीं मिले।', threadID);
                delete botState.nicknameQueues[threadID];
                return;
              }

              api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। अब 30 सेकंड में निकनेम चेंज होंगे।`, threadID);
              setNextNicknameChange(api, botState, threadID, botUserId);
            };

            tryFetchThreadInfo();
          });
        }
      } else if (args[1] && args[1].toLowerCase() === 'off') {
        if (botState.nicknameQueues[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameQueues[threadID];
          delete botState.nicknameTimers[threadID];
          api.sendMessage('🔓 निकनेम लॉक बंद हो गया।', threadID);
          console.log(`[DEBUG] Nickname lock disabled for thread ${threadID}`);
        } else {
          api.sendMessage('⚠️ कोई निकनेम लॉक चालू नहीं है।', threadID);
        }
      } else if (args[1] && event.mentions && Object.keys(event.mentions).length > 0 && args[2] && args[2].toLowerCase() === 'off') {
        const targetID = Object.keys(event.mentions)[0];
        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret?.[targetID]) {
            api.sendMessage('❌ यूजर की जानकारी लेने में असफल।', threadID);
            console.error(`[ERROR] getUserInfo failed for ${targetID}:`, err?.message);
            return;
          }
          const name = ret[targetID].name || 'User';

          if (botState.lockedNicknames[threadID]?.[targetID]) {
            delete botState.lockedNicknames[threadID][targetID];
            api.sendMessage(`✅ ${name} (${targetID}) का निकनेम लॉक हटा दिया गया!`, threadID);
            console.log(`[DEBUG] Removed nickname lock for ${targetID} in thread ${threadID}`);
          } else {
            api.sendMessage(`⚠️ ${name} का कोई निकनेम लॉक नहीं है।`, threadID);
          }
        });
      } else {
        api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock on @user <nickname> या #nicknamelock off या #nicknamelock @user off', threadID);
      }
    } catch (e) {
      console.error(`[ERROR] nicknamelock error: ${e.message}`);
      api.sendMessage('⚠️ निकनेम लॉक में गलती।', threadID);
    }
  }
};

function setNextNicknameChange(api, botState, threadID, botUserId) {
  const queue = botState.nicknameQueues[threadID];
  if (!queue || !queue.active) return;

  if (queue.currentIndex >= queue.members.length) {
    if (!queue.completed) {
      queue.completed = true;
      console.log(`[DEBUG] Initial nickname setup completed for thread ${threadID}`);
      api.sendMessage('✅ सबके निकनेम बदल गए हैं। अब सिर्फ चेंज होने पर रिस्टोर होगा।', threadID);
    }
    return;
  }

  const targetID = queue.members[queue.currentIndex];
  if (queue.changedUsers.has(targetID)) {
    queue.currentIndex += 1;
    botState.nicknameTimers[threadID] = setTimeout(() => {
      setNextNicknameChange(api, botState, threadID, botUserId);
    }, queue.interval);
    return;
  }

  botState.nicknameTimers[threadID] = setTimeout(() => {
    api.changeNickname(queue.nickname, threadID, targetID, (err) => {
      if (err) {
        console.error(`[ERROR] changeNickname failed for ${targetID}: ${err.message}`);
        api.sendMessage('⚠️ निकनेम बदलने में गलती।', threadID);
      } else {
        console.log(`[DEBUG] Changed nickname for ${targetID} to "${queue.nickname}"`);
        queue.changedUsers.add(targetID);
      }
      queue.currentIndex += 1;
      setNextNicknameChange(api, botState, threadID, botUserId);
    });
  }, queue.interval); // 30 सेकंड डिले
}
