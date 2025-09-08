// utils/nicknameUtils.js
const messageCooldowns = new Map();
const changeCooldown = 20000; // 20 seconds cooldown

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
  sendMessageWithCooldown: (api, threadID, message, cooldown = 20000) => {
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

      api.getThreadInfo(threadID, (err, info) => {
        if (err || !info || !info.adminIDs.some(admin => admin.id === botID)) {
          console.log(`[DEBUG] Bot lacks admin permissions for threadID=${threadID}`);
          return;
        }

        // User-specific lock
        if (botState.lockedNicknames[threadID]?.[changedUserID]) {
          const lockedNickname = botState.lockedNicknames[threadID][changedUserID];
          module.exports.retryNicknameChange(api, threadID, changedUserID, lockedNickname, 2, (success, name) => {
            if (success) {
              botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
              console.log(`[DEBUG] Restored nickname for userID=${changedUserID} to "${lockedNickname}"`);
            } else {
              console.log(`[DEBUG] Failed to restore nickname for userID=${changedUserID}`);
            }
          });
          return;
        }

        // Group-wide lock
        if (botState.nicknameQueues[threadID]?.active) {
          const queue = botState.nicknameQueues[threadID];
          if (!queue.changedUsers.has(changedUserID)) {
            module.exports.retryNicknameChange(api, threadID, changedUserID, queue.nickname, 2, (success, name) => {
              if (success) {
                queue.changedUsers.add(changedUserID);
                botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
                console.log(`[DEBUG] Restored group nickname for userID=${changedUserID} to "${queue.nickname}"`);
              } else {
                console.log(`[DEBUG] Failed to restore group nickname for userID=${changedUserID}`);
              }
            });
          }
          return;
        }

        // Remove nickname mode
        if (botState.removeNicknameActive[threadID]) {
          const isTargeted = !botState.removeNicknameTargets[threadID] || botState.removeNicknameTargets[threadID].has(changedUserID);
          if (isTargeted) {
            module.exports.retryNicknameChange(api, threadID, changedUserID, '', 2, (success, name) => {
              if (success) {
                botState.lastNicknameChange[`${threadID}:${changedUserID}`] = Date.now();
                console.log(`[DEBUG] Removed nickname for userID=${changedUserID}`);
              } else {
                console.log(`[DEBUG] Failed to remove nickname for userID=${changedUserID}`);
              }
            });
          }
        }
      });
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e?.message || 'Unknown error'}`);
    }
  },
  retryNicknameChange: (api, threadID, userID, nickname, retries, callback, delay = 0) => {
    console.log(`[DEBUG] retryNicknameChange called for userID: ${userID}, nickname: ${nickname}, retries: ${retries}, delay: ${delay}`);
    const attempt = () => {
      module.exports.ensureThreadHasMessage(api, threadID, () => {
        api.changeNickname(nickname, threadID, userID, (err) => {
          if (err && retries > 0) {
            console.log(`[DEBUG] Retry ${retries} for userID=${userID}: ${err?.message || 'Unknown error'}`);
            setTimeout(() => module.exports.retryNicknameChange(api, threadID, userID, nickname, retries - 1, callback, delay), 20000);
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
      setTimeout(attempt, delay);
    } else {
      attempt();
    }
  }
};

process.on('exit', () => {
  console.log('[DEBUG] Cleared botState on exit');
});
