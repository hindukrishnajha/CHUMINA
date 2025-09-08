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
        module.exports.retryNicknameChange(api, threadID, changedUserID, lockedNickname, 3, (success, name) => {
          if (success) {
            api.sendMessage(`🔒 ${name} का निकनेम "${lockedNickname}" पे वापस सेट कर दिया गया!`, threadID);
          } else {
            api.sendMessage('⚠️ निकनेम रीस्टोर करने में असफल। बाद में ट्राई करें।', threadID);
          }
        });
        return;
      }

      // Group-wide nickname lock
      if (botState.nicknameQueues?.[threadID]?.active) {
        const queue = botState.nicknameQueues[threadID];
        if (!queue.changedUsers.has(changedUserID)) {
          module.exports.retryNicknameChange(api, threadID, changedUserID, queue.nickname, 3, (success, name) => {
            if (success) {
              queue.changedUsers.add(changedUserID);
              api.sendMessage(`🔒 ${name} का निकनेम "${queue.nickname}" पे वापस सेट कर दिया गया!`, threadID);
            } else {
              api.sendMessage('⚠️ निकनेम रीस्टोर करने में असफल। बाद में ट्राई करें।', threadID);
            }
            delete botState.nicknameTimers[threadID];
          }, 20000); // 20 seconds
        }
        return;
      }

      // Remove nickname mode
      if (botState.removeNicknameActive?.[threadID]) {
        const isTargeted = !botState.removeNicknameTargets[threadID] || botState.removeNicknameTargets[threadID].has(changedUserID);
        if (isTargeted) {
          module.exports.retryNicknameChange(api, threadID, changedUserID, '', 3, (success, name) => {
            if (success) {
              api.sendMessage(`🔒 ${name} का निकनेम हटा दिया गया, क्योंकि रिमूव मोड एक्टिव है!`, threadID);
            } else {
              api.sendMessage('⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।', threadID);
            }
          });
        }
      }
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e.message}`);
      api.sendMessage('⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।', threadID);
    }
  },
  retryNicknameChange: (api, threadID, userID, nickname, retries, callback, delay = 0) => {
    if (delay) {
      botState.nicknameTimers[threadID] = setTimeout(() => {
        module.exports.ensureThreadHasMessage(api, threadID, () => {
          api.changeNickname(nickname, threadID, userID, (err) => {
            if (err && retries > 0) {
              console.log(`[DEBUG] Retry ${retries} for userID=${userID}: ${err.message}`);
              setTimeout(() => module.exports.retryNicknameChange(api, threadID, userID, nickname, retries - 1, callback), 5000);
            } else if (err) {
              console.error(`[ERROR] changeNickname failed for ${userID}: ${err.message}`);
              callback(false);
            } else {
              console.log(`[DEBUG] ${nickname ? 'Set' : 'Removed'} nickname for userID=${userID} to "${nickname}"`);
              api.getUserInfo(userID, (err, ret) => {
                const name = ret?.[userID]?.name || 'User';
                callback(true, name);
              });
            }
          });
        });
      }, delay);
    } else {
      module.exports.ensureThreadHasMessage(api, threadID, () => {
        api.changeNickname(nickname, threadID, userID, (err) => {
          if (err && retries > 0) {
            console.log(`[DEBUG] Retry ${retries} for userID=${userID}: ${err.message}`);
            setTimeout(() => module.exports.retryNicknameChange(api, threadID, userID, nickname, retries - 1, callback), 5000);
          } else if (err) {
            console.error(`[ERROR] changeNickname failed for ${userID}: ${err.message}`);
            callback(false);
          } else {
            console.log(`[DEBUG] ${nickname ? 'Set' : 'Removed'} nickname for userID=${userID} to "${nickname}"`);
            api.getUserInfo(userID, (err, ret) => {
              const name = ret?.[userID]?.name || 'User';
              callback(true, name);
            });
          }
        });
      });
    }
  }
};

// Clear botState on exit
process.on('exit', () => {
  botState.lockedNicknames = {};
  botState.nicknameQueues = {};
  botState.removeNicknameActive = {};
  botState.removeNicknameTargets = {};
  console.log('[DEBUG] Cleared botState on exit');
});
