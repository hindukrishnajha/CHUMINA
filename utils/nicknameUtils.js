// utils/nicknameUtils.js
module.exports = {
  ensureThreadHasMessage: (api, threadID, callback) => {
    api.getThreadInfo(threadID, (err, info) => {
      if (err || !info || info.messageCount === 0) {
        console.log(`[DEBUG] Thread ${threadID} has no messages, sending dummy message`);
        api.sendMessage('🔧 Initializing nickname change...', threadID, (err) => {
          if (err) {
            console.error(`[ERROR] Failed to send dummy message to thread ${threadID}: ${err.message}`);
            api.sendMessage('⚠️ थ्रेड में मैसेज भेजने में असफल।', threadID);
            return;
          }
          setTimeout(callback, 1000);
        });
      } else {
        callback();
      }
    });
  },
  processNicknameChange: (api, event, botState, threadID, botID) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}, participant_id: ${event.logMessageData.participant_id}`);
    try {
      const changedUserID = event.logMessageData.participant_id;
      if (!changedUserID || changedUserID === botID) {
        console.log(`[DEBUG] Ignoring nickname change for botID ${botID} or invalid userID`);
        return;
      }

      // Check user-specific nickname lock
      if (botState.lockedNicknames?.[threadID]?.[changedUserID]) {
        const lockedNickname = botState.lockedNicknames[threadID][changedUserID];
        if (event.logMessageData.nickname !== lockedNickname) {
          module.exports.ensureThreadHasMessage(api, threadID, () => {
            api.changeNickname(lockedNickname, threadID, changedUserID, (err) => {
              if (err) {
                console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                api.sendMessage('⚠️ निकनेम रीस्टोर करने में असफल।', threadID);
              } else {
                console.log(`[DEBUG] Restored nickname for ${changedUserID} to "${lockedNickname}"`);
                api.getUserInfo(changedUserID, (err, ret) => {
                  const name = ret?.[changedUserID]?.name || 'User';
                  api.sendMessage(`🔒 ${name} का निकनेम "${lockedNickname}" पे वापस सेट कर दिया गया!`, threadID);
                });
              }
            });
          });
        }
        return;
      }

      // Check remove nickname mode (group-level or specific user)
      if (botState.removeNicknameActive?.[threadID]) {
        const isTargeted = botState.removeNicknameTargets?.[threadID]?.has(changedUserID) || !botState.removeNicknameTargets[threadID];
        if (isTargeted && event.logMessageData.nickname !== '') {
          module.exports.ensureThreadHasMessage(api, threadID, () => {
            api.changeNickname('', threadID, changedUserID, (err) => {
              if (err) {
                console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
              } else {
                console.log(`[DEBUG] Removed new nickname for ${changedUserID}`);
                api.getUserInfo(changedUserID, (err, ret) => {
                  const name = ret?.[changedUserID]?.name || 'User';
                  api.sendMessage(`🔒 ${name} का निकनेम हटा दिया गया, क्योंकि रिमूव मोड एक्टिव है!`, threadID);
                });
              }
            });
          });
        }
        return;
      }

      // Check group-wide nickname lock
      const queue = botState.nicknameQueues[threadID];
      if (queue && queue.active) {
        if (!queue.changedUsers.has(changedUserID) || queue.nickname !== event.logMessageData.nickname) {
          if (!botState.nicknameTimers[threadID]) {
            module.exports.ensureThreadHasMessage(api, threadID, () => {
              botState.nicknameTimers[threadID] = setTimeout(() => {
                api.changeNickname(queue.nickname, threadID, changedUserID, (err) => {
                  if (err) {
                    console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                    api.sendMessage('⚠️ निकनेम रीस्टोर करने में असफल।', threadID);
                  } else {
                    console.log(`[DEBUG] Restored nickname for ${changedUserID} to "${queue.nickname}"`);
                    queue.changedUsers.add(changedUserID);
                    api.getUserInfo(changedUserID, (err, ret) => {
                      const name = ret?.[changedUserID]?.name || 'User';
                      api.sendMessage(`🔒 ${name} का निकनेम "${queue.nickname}" पे वापस सेट कर दिया गया!`, threadID);
                    });
                  }
                  delete botState.nicknameTimers[threadID];
                });
              }, 20000); // 20 seconds
            });
          }
        }
      }
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e.message}`);
    }
  }
};
