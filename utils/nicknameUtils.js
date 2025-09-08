const messageCooldowns = new Map(); // Cooldown for messages to prevent spam

module.exports = {
  ensureThreadHasMessage: (api, threadID, callback) => {
    api.getThreadInfo(threadID, (err, info) => {
      if (err || !info || info.messageCount === 0) {
        console.log(`[DEBUG] Thread ${threadID} has no messages, sending dummy message`);
        api.sendMessage('🔧 Initializing nickname change...', threadID, (err) => {
          if (err) {
            console.error(`[ERROR] Failed to send dummy message to thread ${threadID}: ${err.message}`);
            return;
          }
          setTimeout(callback, 1000);
        });
      } else {
        callback();
      }
    });
  },
  sendMessageWithCooldown: (api, threadID, message, cooldown = 5000) => {
    const key = `${threadID}:${message}`;
    const lastSent = messageCooldowns.get(key) || 0;
    if (Date.now() - lastSent < cooldown) {
      console.log(`[DEBUG] Skipped message due to cooldown: ${message}`);
      return;
    }
    api.sendMessage(message, threadID);
    messageCooldowns.set(key, Date.now());
    setTimeout(() => messageCooldowns.delete(key), cooldown);
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
        const lastChange = botState.lastNicknameChange?.[`${threadID}:${changedUserID}`] || 0;
        if (Date.now() - lastChange < 10000) {
          console.log(`[DEBUG] Skipped nickname change for ${changedUserID} due to cooldown`);
          return;
        }
        module.exports.retryNicknameChange(api, threadID, changedUserID, lockedNickname, 3, (success, name) => {
          if (success) {
            module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम "${lockedNickname}" पे वापस सेट कर दिया गया!`);
            botState.lastNicknameChange = botState.lastNicknameChange || {};
            botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
          } else {
            module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम रीस्टोर करने में असफल। बाद में ट्राई करें।');
          }
        });
        return;
      }

      // Group-wide nickname lock
      if (botState.nicknameQueues?.[threadID]?.active) {
        const queue = botState.nicknameQueues[threadID];
        if (!queue.changedUsers.has(changedUserID)) {
          const lastChange = botState.lastNicknameChange?.[`${threadID}:${changedUserID}`] || 0;
          if (Date.now() - lastChange < 20000) {
            console.log(`[DEBUG] Skipped group nickname change for ${changedUserID} due to cooldown`);
            return;
          }
          module.exports.retryNicknameChange(api, threadID, changedUserID, queue.nickname, 3, (success, name) => {
            if (success) {
              queue.changedUsers.add(changedUserID);
              module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम "${queue.nickname}" पे वापस सेट कर दिया गया!`);
              botState.lastNicknameChange = botState.lastNicknameChange || {};
              botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
            } else {
              module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम रीस्टोर करने में असफल। बाद में ट्राई करें।');
            }
            delete botState.nicknameTimers?.[threadID];
          }, 20000); // 20 seconds
        }
        return;
      }

      // Remove nickname mode
      if (botState.removeNicknameActive?.[threadID]) {
        const isTargeted = !botState.removeNicknameTargets?.[threadID] || botState.removeNicknameTargets[threadID].has(changedUserID);
        if (isTargeted) {
          const lastChange = botState.lastNicknameChange?.[`${threadID}:${changedUserID}`] || 0;
          if (Date.now() - lastChange < 10000) {
            console.log(`[DEBUG] Skipped nickname removal for ${changedUserID} due to cooldown`);
            return;
          }
          module.exports.retryNicknameChange(api, threadID, changedUserID, '', 3, (success, name) => {
            if (success) {
              module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम हटा दिया गया, क्योंकि रिमूव मोड एक्टिव है!`);
              botState.lastNicknameChange = botState.lastNicknameChange || {};
              botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
            } else {
              module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने में असफल। बाद में ट्राई करें।');
            }
          });
        }
      }
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e.message}`);
      module.exports.sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई, बाद में ट्राई करें।');
    }
  },
  retryNicknameChange: (api, threadID, userID, nickname, retries, callback, delay = 0) => {
    const attempt = () => {
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
    };
    if (delay) {
      botState.nicknameTimers = botState.nicknameTimers || {};
      botState.nicknameTimers[threadID] = setTimeout(attempt, delay);
    } else {
      attempt();
    }
  }
};

// Clear botState on exit
process.on('exit', () => {
  botState.lockedNicknames = {};
  botState.nicknameQueues = {};
  botState.removeNicknameActive = {};
  botState.removeNicknameTargets = {};
  botState.lastNicknameChange = {};
  console.log('[DEBUG] Cleared botState on exit');
});
