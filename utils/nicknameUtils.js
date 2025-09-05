// utils/nicknameUtils.js
module.exports = {
  processNicknameChange: (api, event, botState, threadID, botID) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
    try {
      const queue = botState.nicknameQueues[threadID];
      if (!queue || !queue.active) {
        console.log(`[DEBUG] No active nickname queue for thread ${threadID}`);
        return;
      }

      const changedUserID = event.logMessageData.participant_id; // चेंज हुए यूजर
      if (!changedUserID || changedUserID === botID) return; // बॉट को इग्नोर

      const members = botState.memberCache[threadID] ? Array.from(botState.memberCache[threadID]) : [];
      if (members.length === 0) {
        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info) {
            console.error('[ERROR] getThreadInfo failed:', err?.message);
            api.sendMessage('⚠️ ग्रुप जानकारी लाने में असफल।', threadID);
            return;
          }
          botState.memberCache[threadID] = new Set(info.participantIDs);
          restoreNickname(changedUserID);
        });
      } else {
        restoreNickname(changedUserID);
      }

      function restoreNickname(targetID) {
        api.changeNickname(queue.nickname, threadID, targetID, (err) => {
          if (err) {
            console.error(`[ERROR] changeNickname failed for ${targetID}: ${err.message}`);
            api.sendMessage('⚠️ निकनेम रिस्टोर में गलती।', threadID);
          } else {
            console.log(`[DEBUG] Restored nickname for ${targetID} to "${queue.nickname}"`);
            api.sendMessage(`🔒 निकनेम रिस्टोर हो गया: "${queue.nickname}" (यूजर ने चेंज किया था)`, threadID);
          }
        });
      }
    } catch (e) {
      console.error('[ERROR] processNicknameChange error:', e.message);
      api.sendMessage('⚠️ निकनेम रिस्टोर में गलती।', threadID);
    }
  }
};
