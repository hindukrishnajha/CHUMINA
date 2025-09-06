module.exports = {
  processNicknameChange: (api, event, botState, threadID, botID) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
    try {
      const queue = botState.nicknameQueues[threadID];
      if (!queue || !queue.active) {
        console.log(`[DEBUG] No active nickname queue for thread ${threadID}`);
        return;
      }

      const changedUserID = event.logMessageData.participant_id; // जिसका नाम बदला गया
      if (!changedUserID || changedUserID === botID) return;

      // सिर्फ चेंज होने पर रिस्टोर, अगर पहले से लॉक नाम नहीं है
      if (!queue.changedUsers.has(changedUserID) || queue.nickname !== event.logMessageData.new_nickname) {
        if (!botState.nicknameTimers[threadID]) {
          botState.nicknameTimers[threadID] = setTimeout(() => {
            api.changeNickname(queue.nickname, threadID, changedUserID, (err) => {
              if (err) {
                console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
              } else {
                console.log(`[DEBUG] Restored nickname for ${changedUserID} to "${queue.nickname}"`);
                queue.changedUsers.add(changedUserID); // अब लॉक माना जाएगा
              }
              delete botState.nicknameTimers[threadID]; // टाइमर हटाओ
            });
          }, queue.interval); // 30 सेकंड डिले
        }
      }
    } catch (e) {
      console.error('[ERROR] processNicknameChange error:', e.message);
    }
  }
};
