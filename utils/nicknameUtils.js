// Updated nicknameUtils.js (processNicknameChange)
module.exports = {
  processNicknameChange: (api, event, botState, threadID, botID) => {
    console.log(`[DEBUG] processNicknameChange called for threadID: ${threadID}`);
    try {
      const changedUserID = event.logMessageData.participant_id; // जिसका नाम बदला गया
      if (!changedUserID || changedUserID === botID) {
        console.log(`[DEBUG] Ignoring nickname change for botID ${botID} or invalid userID`);
        return;
      }

      // थ्रेड में कम से कम एक मैसेज भेजने का फंक्शन
      const ensureThreadHasMessage = (callback) => {
        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info || info.messageCount === 0) {
            console.log(`[DEBUG] Thread ${threadID} has no messages, sending dummy message`);
            api.sendMessage('🔧 Initializing nickname change...', threadID, (err) => {
              if (err) {
                console.error(`[ERROR] Failed to send dummy message to thread ${threadID}:`, err.message);
                api.sendMessage('⚠️ थ्रेड में मैसेज भेजने में असफल।', threadID);
                return;
              }
              setTimeout(callback, 1000); // 1 सेकंड वेट करके कॉलबैक
            });
          } else {
            callback();
          }
        });
      };

      // पहले यूजर-विशिष्ट लॉक चेक
      if (botState.lockedNicknames?.[threadID]?.[changedUserID]) {
        const lockedNickname = botState.lockedNicknames[threadID][changedUserID];
        if (event.logMessageData.nickname !== lockedNickname) {
          ensureThreadHasMessage(() => {
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

      // फिर रिमूव निकनेम मोड चेक (ग्रुप-लेवल या स्पेसिफिक यूजर)
      if (botState.removeNicknameActive?.[threadID]) {
        const isTargeted = botState.removeNicknameTargets?.[threadID]?.has(changedUserID) || !botState.removeNicknameTargets[threadID]; // अगर टारगेट्स न हों तो @everyone मानें
        if (isTargeted && event.logMessageData.nickname !== '') {
          ensureThreadHasMessage(() => {
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

      // फिर ग्रुप-लेवल लॉक (पहले जैसा, 30 सेकंड)
      const queue = botState.nicknameQueues[threadID];
      if (queue && queue.active) {
        if (!queue.changedUsers.has(changedUserID) || queue.nickname !== event.logMessageData.nickname) {
          if (!botState.nicknameTimers[threadID]) {
            ensureThreadHasMessage(() => {
              botState.nicknameTimers[threadID] = setTimeout(() => {
                api.changeNickname(queue.nickname, threadID, changedUserID, (err) => {
                  if (err) {
                    console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                  } else {
                    console.log(`[DEBUG] Restored nickname for ${changedUserID} to "${queue.nickname}"`);
                    queue.changedUsers.add(changedUserID);
                  }
                  delete botState.nicknameTimers[threadID];
                });
              }, queue.interval); // 30 सेकंड डिले
            });
          }
        }
      }
    } catch (e) {
      console.error(`[ERROR] processNicknameChange error: ${e.message}`);
    }
  }
};                  console.error(`[ERROR] changeNickname failed for ${changedUserID}: ${err.message}`);
                } else {
                  console.log(`[DEBUG] Restored nickname for ${changedUserID} to "${queue.nickname}"`);
                  queue.changedUsers.add(changedUserID); // अब लॉक माना जाएगा
                }
                delete botState.nicknameTimers[threadID]; // टाइमर हटाओ
              });
            }, queue.interval); // 30 सेकंड डिले
          }
        }
      }
    } catch (e) {
      console.error('[ERROR] processNicknameChange error:', e.message);
    }
  }
};
