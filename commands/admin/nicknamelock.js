// commands/admin/nicknamelock.js
const { processNicknameChange } = require('../../utils/nicknameUtils');

module.exports = {
  name: "nicknamelock",
  execute(api, threadID, args, event, botState, isMaster) {
    console.log(`[DEBUG] handleNicknameLock called: threadID=${threadID}, args=${JSON.stringify(args)}, isMaster=${isMaster}`);
    try {
      if (!isMaster && !botState.adminList.includes(event.senderID)) {
        api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
        return;
      }

      if (!botState.nicknameQueues) botState.nicknameQueues = {};
      if (!botState.nicknameTimers) botState.nicknameTimers = {};
      if (!botState.memberCache) botState.memberCache = {};

      if (args[1] && args[1].toLowerCase() === 'on') {
        const timeArg = args[2] ? parseInt(args[2]) : 10; // डिफॉल्ट 10 सेकंड
        if (isNaN(timeArg) || timeArg < 1) {
          api.sendMessage('उपयोग: #nicknamelock on [time_in_seconds] <nickname> या #nicknamelock off (डिफॉल्ट time: 10)', threadID);
          return;
        }
        const nicknameIndex = args[2] && !isNaN(args[2]) ? 3 : 2;
        const nickname = args.slice(nicknameIndex).join(' ') || 'LockedName';
        const interval = timeArg * 1000; // मिलीसेकंड में कन्वर्ट
        console.log(`[DEBUG] Enabling nickname lock with nickname: ${nickname}, interval: ${interval}ms`);

        const tryFetchThreadInfo = (attempt = 1, maxAttempts = 5) => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info || !info.participantIDs || info.participantIDs.length === 0) {
              console.error(`[ERROR] getThreadInfo failed for thread ${threadID} (attempt ${attempt}):`, err?.message || 'No participantIDs');
              if (attempt < maxAttempts) {
                setTimeout(() => tryFetchThreadInfo(attempt + 1, maxAttempts), Math.pow(2, attempt) * 5000);
              } else {
                const members = botState.memberCache[threadID] ? Array.from(botState.memberCache[threadID]) : [];
                if (members.length === 0) {
                  api.sendMessage('⚠️ कोई ग्रुप मेंबर्स नहीं मिले।', threadID);
                  return;
                }
                initializeNicknameLock(members);
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
            completed: false, // शुरू में false, सबके बाद true
            interval
          };

          if (botState.nicknameQueues[threadID].members.length === 0) {
            api.sendMessage('⚠️ कोई वैलिड ग्रुप मेंबर्स नहीं मिले।', threadID);
            delete botState.nicknameQueues[threadID];
            return;
          }

          api.sendMessage(`🔒 निकनेम लॉक चालू: "${nickname}"। सभी ${botState.nicknameQueues[threadID].members.length} मेंबर्स के निकनेम ${timeArg} सेकंड के गैप से सेट हो जाएंगे।`, threadID);
          setNextNicknameChange(api, botState, threadID, botUserId); // शुरू में चेन शुरू
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
        api.sendMessage('उपयोग: #nicknamelock on [time_in_seconds] <nickname> या #nicknamelock off (डिफॉल्ट time: 10)', threadID);
      }
    } catch (e) {
      console.error(`[ERROR] handleNicknameLock error: ${e.message}`);
      api.sendMessage('⚠️ निकनेम लॉक में गलती।', threadID);
    }
  }
};

// हेल्पर फंक्शन: अगला निकनेम चेंज सेट
function setNextNicknameChange(api, botState, threadID, botUserId) {
  const queue = botState.nicknameQueues[threadID];
  if (!queue || !queue.active || queue.completed) return;

  if (queue.currentIndex >= queue.members.length) {
    queue.completed = true; // सबके निकनेम सेट, रुक जाओ
    console.log(`[DEBUG] Initial nickname setup completed for thread ${threadID}`);
    api.sendMessage('✅ सभी निकनेम लॉक हो गए। अब सिर्फ चेंज होने पर रिस्टोर होगा।', threadID);
    return;
  }

  const targetID = queue.members[queue.currentIndex];
  queue.currentIndex += 1;

  api.changeNickname(queue.nickname, threadID, targetID, (err) => {
    if (err) {
      console.error(`[ERROR] changeNickname failed for ${targetID}: ${err.message}`);
      api.sendMessage('⚠️ निकनेम बदलने में गलती।', threadID);
    } else {
      console.log(`[DEBUG] Changed nickname for ${targetID} to "${queue.nickname}"`);
    }

    botState.nicknameTimers[threadID] = setTimeout(() => {
      setNextNicknameChange(api, botState, threadID, botUserId);
    }, queue.interval);
  });
}
