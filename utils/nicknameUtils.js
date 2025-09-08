// utils/nicknameUtils.js
const messageCooldowns = new Map();
const changeCooldown = 20000; // 20 seconds cooldown for nickname changes

module.exports = {
  ensureThreadHasMessage: (api, threadID, callback) => {
    console.log(`[DEBUG] ensureThreadHasMessage called for threadID: ${threadID}`);
    api.getThreadInfo(threadID, (err, info) => {
      if (err || !info || info.messageCount === 0) {
        console.log(`[DEBUG] Thread ${threadID} has no messages, sending dummy message`);
        api.sendMessage('🔧 Initializing nickname change...', threadID, (err) => {
          if (err) {
            console.error(`[ERROR] Failed to send dummy message to thread ${threadID}: ${err?.message || 'Unknown error'}`);
            return;
          }
          setTimeout(callback, 1000);
        });
      } else {
        callback();
      }
    });
  },
  sendMessageWithCooldown: (api, threadID, message, cooldown = 20000) => { // 20 seconds
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
  processNicknameChange: (api, threadID, changedUserID, botState = {}) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}, userID: ${changedUserID}`);
    try {
      botState.lockedNicknames = botState.lockedNicknames || {};
      botState.nicknameQueues = botState.nicknameQueues || {};
      botState.removeNicknameActive = botState.removeNicknameActive || {};
      botState.removeNicknameTargets = botState.removeNicknameTargets || {};
      botState.lastNicknameChange = botState.lastNicknameChange || {};

      const botID = api.getCurrentUserID();
      if (!changedUserID || changedUserID === botID) {
        console.log(`[DEBUG] Ignoring nickname change for botID ${botID} or invalid userID`);
        return;
      }

      const lastChange = botState.lastNicknameChange[`${threadID}:${changedUserID}`] || 0;
      if (Date.now() - lastChange < changeCooldown) {
        console.log(`[DEBUG] Skipped nickname change for ${changedUserID} due to cooldown`);
        return;
      }

      // Check admin permission once to save calls
      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info || !info.adminIDs.some(admin => admin.id === botID)) {
          module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम चेंज करने के लिए बॉट को एडमिन परमिशन चाहिए।');
          return;
        }

        // User-specific lock
        if (botState.lockedNicknames[threadID]?.[changedUserID]) {
          const lockedNickname = botState.lockedNicknames[threadID][changedUserID];
          module.exports.retryNicknameChange(api, threadID, changedUserID, lockedNickname, 1, (success, name) => {
            if (success) {
              module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम "${lockedNickname}" पे वापस सेट कर दिया गया!`);
              botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
            } else {
              module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम रीस्टोर करने में असफल।');
            }
          });
          return;
        }

        // Group-wide lock
        if (botState.nicknameQueues[threadID]?.active) {
          const queue = botState.nicknameQueues[threadID];
          if (!queue.changedUsers.has(changedUserID)) {
            module.exports.retryNicknameChange(api, threadID, changedUserID, queue.nickname, 1, (success, name) => {
              if (success) {
                queue.changedUsers.add(changedUserID);
                module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम "${queue.nickname}" पे वापस सेट कर दिया गया!`);
                botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
              } else {
                module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम रीस्टोर करने में असफल।');
              }
            });
          }
          return;
        }

        // Remove mode
        if (botState.removeNicknameActive[threadID]) {
          const isTargeted = !botState.removeNicknameTargets[threadID] || botState.removeNicknameTargets[threadID].has(changedUserID);
          if (isTargeted) {
            module.exports.retryNicknameChange(api, threadID, changedUserID, '', 1, (success, name) => {
              if (success) {
                module.exports.sendMessageWithCooldown(api, threadID, `🔒 ${name} का निकनेम हटा दिया गया!`);
                botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
              } else {
                module.exports.sendMessageWithCooldown(api, threadID, '⚠️ निकनेम हटाने में असफल।');
              }
            });
          }
        }
      });
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e?.message || 'Unknown error'}`);
      module.exports.sendMessageWithCooldown(api, threadID, '⚠️ कुछ गड़बड़ हुई।');
    }
  },
  retryNicknameChange: (api, threadID, userID, nickname, retries, callback, delay = 0) => {
    console.log(`[DEBUG] retryNicknameChange called for userID: ${userID}, nickname: ${nickname}, retries: ${retries}, delay: ${delay}`);
    const attempt = () => {
      module.exports.ensureThreadHasMessage(api, threadID, () => {
        api.changeNickname(nickname, threadID, userID, (err) => {
          if (err && retries > 0) {
            console.log(`[DEBUG] Retry ${retries} for userID=${userID}: ${err?.message || 'Unknown error'}`);
            setTimeout(() => module.exports.retryNicknameChange(api, threadID, userID, nickname, retries - 1, callback, delay), 20000); // 20s retry delay
          } else if (err) {
            console.error(`[ERROR] changeNickname failed for ${userID}: ${err?.message || 'Unknown error'}`);
            callback(false);
          } else {
            console.log(`[DEBUG] ${nickname ? 'Set' : 'Removed'} nickname for userID=${userID} to "${nickname}"`);
            api.getUserInfo([userID], (err, ret) => {
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

// Clear botState on exit (already in index.js, but reinforced)
process.on('exit', () => {
  botState.lockedNicknames = {};
  botState.nicknameQueues = {};
  botState.removeNicknameActive = {};
  botState.removeNicknameTargets = {};
  botState.lastNicknameChange = {};
  botState.nicknameTimers = {};
  console.log('[DEBUG] Cleared botState on exit');
});
