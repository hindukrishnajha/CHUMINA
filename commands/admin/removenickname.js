// Updated removenickname.js
module.exports = {
  name: "removenickname",
  execute(api, threadID, args, event, botState, isMaster) {
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }

    if (!botState.removeNicknameActive) botState.removeNicknameActive = {};
    if (!botState.removeNicknameTargets) botState.removeNicknameTargets = {}; // Specific users for remove mode

    try {
      const botID = api.getCurrentUserID();

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

      if (args[1] === 'stop') {
        if (botState.removeNicknameActive[threadID]) {
          delete botState.removeNicknameActive[threadID];
          if (botState.removeNicknameTargets[threadID]) {
            delete botState.removeNicknameTargets[threadID];
          }
          api.sendMessage('✅ निकनेम हटाने का मोड बंद कर दिया गया!', threadID);
          console.log(`[DEBUG] Remove nickname mode stopped for thread ${threadID}`);
        } else {
          api.sendMessage('⚠️ निकनेम हटाने का मोड चालू नहीं है।', threadID);
        }
        return;
      }

      if (args[1] === '@everyone') {
        // सभी मेंबर्स के निकनेम्स हटाना और मोड एक्टिव करना
        api.sendMessage('🔧 ग्रुप के सभी निकनेम्स हटाने शुरू! कोई नया निकनेम डाला toh bot hata dega.', threadID);
        ensureThreadHasMessage(() => {
          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info) {
              api.sendMessage('❌ थ्रेड जानकारी लेने में असफल।', threadID);
              console.error(`[ERROR] getThreadInfo failed for thread ${threadID}:`, err?.message);
              return;
            }

            const participantIDs = info.participantIDs.filter(id => id !== botID);
            let index = 0;
            const interval = setInterval(() => {
              if (index >= participantIDs.length) {
                clearInterval(interval);
                botState.removeNicknameActive[threadID] = true; // मोड एक्टिव
                api.sendMessage('✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटा दिए गए! नया निकनेम डालने पर bot हटाएगा (#removenickname stop से बंद होगा).', threadID);
                console.log(`[DEBUG] All nicknames removed for thread ${threadID}, mode active`);
                return;
              }

              const userID = participantIDs[index];
              // लॉक हटाना (अगर है तो)
              if (botState.lockedNicknames[threadID]?.[userID]) {
                delete botState.lockedNicknames[threadID][userID];
                console.log(`[DEBUG] Removed nickname lock for ${userID} in thread ${threadID}`);
              }
              // निकनेम हटाना
              api.changeNickname('', threadID, userID, (err) => {
                if (err) {
                  console.error(`[ERROR] Failed to remove nickname for ${userID} in thread ${threadID}:`, err.message);
                } else {
                  console.log(`[DEBUG] Removed nickname for ${userID} in thread ${threadID}`);
                }
              });
              index += 1;
            }, 10000); // 10 सेकंड डिले प्रति यूजर
          });
        });
      } else {
        // सिंगल यूजर का निकनेम हटाना और मोड एक्टिव करना
        let targetID = args[1]?.trim();
        if (event.mentions && Object.keys(event.mentions).length > 0) {
          targetID = Object.keys(event.mentions)[0];
        }

        if (!targetID || isNaN(targetID)) {
          api.sendMessage('उपयोग: #removenickname @user या #removenickname @everyone या #removenickname stop', threadID);
          return;
        }

        if (targetID === botID) {
          api.sendMessage('⚠️ बॉट का खुद का निकनेम नहीं हटाया जा सकता।', threadID);
          return;
        }

        ensureThreadHasMessage(() => {
          api.getUserInfo(targetID, (err, ret) => {
            if (err || !ret?.[targetID]) {
              api.sendMessage('❌ यूजर की जानकारी लेने में असफल।', threadID);
              console.error(`[ERROR] getUserInfo failed for ${targetID}:`, err?.message);
              return;
            }
            const name = ret[targetID].name || 'User';

            api.sendMessage(`🔧 ${name} का निकनेम हटाना शुरू! नया निकनेम डाला toh bot hata dega.`, threadID);

            // लॉक हटाना (अगर है तो)
            if (botState.lockedNicknames[threadID]?.[targetID]) {
              delete botState.lockedNicknames[threadID][targetID];
              console.log(`[DEBUG] Removed nickname lock for ${targetID} in thread ${threadID}`);
            }

            // निकनेम हटाना
            api.changeNickname('', threadID, targetID, (err) => {
              if (err) {
                console.error(`[ERROR] Failed to remove nickname for ${targetID} in thread ${threadID}:`, err.message);
                api.sendMessage(`❌ ${name} का निकनेम हटाने में असफल।`, threadID);
                return;
              }
              if (!botState.removeNicknameTargets[threadID]) {
                botState.removeNicknameTargets[threadID] = new Set();
              }
              botState.removeNicknameTargets[threadID].add(targetID);
              botState.removeNicknameActive[threadID] = true; // मोड एक्टिव
              api.sendMessage(`✅ ${name} (${targetID}) का निकनेम हटा दिया गया! नया निकनेम डाला toh bot hata dega (#removenickname stop से बंद होगा).`, threadID);
              console.log(`[DEBUG] Removed nickname for ${targetID} in thread ${threadID}, mode active for user`);
            });
          });
        });
      }
    } catch (e) {
      console.error(`[ERROR] removenickname error for thread ${threadID}:`, e.message);
      api.sendMessage('❌ removenickname कमांड में त्रुटि।', threadID);
    }
  }
};
