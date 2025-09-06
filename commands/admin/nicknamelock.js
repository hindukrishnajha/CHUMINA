const { processNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
  name: "nicknamelock",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] nicknamelock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.nicknameQueues) botState.nicknameQueues = {};
      if (!botState.nicknameTimers) botState.nicknameTimers = {};

      if (args[1] && args[1].toLowerCase() === 'on') {
        const nickname = args.slice(2).join(' ') || 'LockedName';
        const interval = 30000; // 30 सेकंड
        console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}, interval: ${interval}ms`);

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
      } else if (args[1] && args[1].toLowerCase() === 'off') {
        if (botState.nicknameQueues[threadID]) {
          clearTimeout(botState.nicknameTimers[threadID]);
          delete botState.nicknameQueues[threadID];
          delete botState.nicknameTimers[threadID];
          api.sendMessage('🔓 निकनेम लॉक बंद हो गया।', threadID);
        } else {
          api.sendMessage('⚠️ कोई निकनेम लॉक चालू नहीं है।', threadID);
        }
      } else {
        api.sendMessage('उपयोग: #nicknamelock on <nickname> या #nicknamelock off', threadID);
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
    return; // active रहने देगा
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
      setNextNicknameChange(api, botState, threadID, botUserId); // अगला कॉल
    });
  }, queue.interval); // 30 सेकंड डिले
    }
