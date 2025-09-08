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
  processNicknameChange: (api, threadID, changedUserID, botState) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}, userID: ${changedUserID}`);
    try {
      const botID = api.getCurrentUserID();
      if (!changedUserID || changedUserID === botID) {
        console.log(`[DEBUG] Ignoring nickname change for botID ${botID} or invalid userID`);
        return;
      }

      // User-specific nickname lock
      if (botState.lockedNicknames?.[threadID]?.[changedUserID]) {
        const lockedNickname = botState.lockedNicknames[threadID][changedUserID];
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
        return;
      }

      // Group-wide nickname lock
      if (botState.nicknameQueues?.[threadID]?.active) {
        const queue = botState.nicknameQueues[threadID];
        if (!queue.changedUsers.has(changedUserID)) {
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
        return;
      }

      // Remove nickname mode
      if (botState.removeNicknameActive?.[threadID]) {
        const isTargeted = !botState.removeNicknameTargets[threadID] || botState.removeNicknameTargets[threadID].has(changedUserID);
        if (isTargeted) {
          module.exports.ensureThreadHasMessage(api, threadID, () => {
            api.changeNickname('', threadID, changedUserID, (err) => {
              if (err) {
                console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                api.sendMessage('⚠️ निकनेम हटाने में असफल।', threadID);
              } else {
                console.log(`[DEBUG] Removed nickname for ${changedUserID}`);
                api.getUserInfo(changedUserID, (err, ret) => {
                  const name = ret?.[changedUserID]?.name || 'User';
                  api.sendMessage(`🔒 ${name} का निकनेम हटा दिया गया, क्योंकि रिमूव मोड एक्टिव है!`, threadID);
                });
              }
            });
          });
        }
      }
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e.message}`);
    }
  }
};
