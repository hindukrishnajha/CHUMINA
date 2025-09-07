module.exports = {
  name: "removenickname",
  execute(api, threadID, args, event, botState, isMaster) {
    const isAdmin = botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      api.sendMessage('🚫 केवल मास्टर या एडमिन इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }

    try {
      const botID = api.getCurrentUserID();

      if (args[1] === '@everyone') {
        // सभी मेंबर्स के निकनेम्स हटाना
        api.getThreadInfo(threadID, (err, info) => {
          if (err || !info) {
            api.sendMessage('❌ थ्रेड जानकारी लेने में असफल।', threadID);
            return;
          }

          const participantIDs = info.participantIDs.filter(id => id !== botID);
          let index = 0;
          const interval = setInterval(() => {
            if (index >= participantIDs.length) {
              clearInterval(interval);
              api.sendMessage('✅ ग्रुप के सभी मेंबर्स के निकनेम्स हटा दिए गए!', threadID);
              return;
            }

            const userID = participantIDs[index];
            // लॉक हटाना (अगर है तो)
            if (botState.lockedNicknames[threadID]?.[userID]) {
              delete botState.lockedNicknames[threadID][userID];
            }
            // निकनेम हटाना
            api.changeNickname('', threadID, userID, (err) => {
              if (err) {
                console.error(`Failed to remove nickname for ${userID} in thread ${threadID}:`, err.message);
              }
            });
            index += 1;
          }, 10000); // 10 सेकंड डिले प्रति यूजर
        });
      } else {
        // सिंगल यूजर का निकनेम हटाना
        let targetID = args[1]?.trim();
        if (event.mentions && Object.keys(event.mentions).length > 0) {
          targetID = Object.keys(event.mentions)[0];
        }

        if (!targetID || isNaN(targetID)) {
          api.sendMessage('उपयोग: #removenickname @user या #removenickname @everyone', threadID);
          return;
        }

        if (targetID === botID) {
          api.sendMessage('⚠️ बॉट का खुद का निकनेम नहीं हटाया जा सकता।', threadID);
          return;
        }

        api.getUserInfo(targetID, (err, ret) => {
          if (err || !ret?.[targetID]) {
            api.sendMessage('❌ यूजर की जानकारी लेने में असफल।', threadID);
            return;
          }
          const name = ret[targetID].name || 'User';

          // लॉक हटाना (अगर है तो)
          if (botState.lockedNicknames[threadID]?.[targetID]) {
            delete botState.lockedNicknames[threadID][targetID];
          }

          // निकनेम हटाना
          api.changeNickname('', threadID, targetID, (err) => {
            if (err) {
              console.error(`Failed to remove nickname for ${targetID} in thread ${threadID}:`, err.message);
              api.sendMessage(`❌ ${name} का निकनेम हटाने में असफल।`, threadID);
              return;
            }
            api.sendMessage(`✅ ${name} (${targetID}) का निकनेम हटा दिया गया!`, threadID);
          });
        });
      }
    } catch (e) {
      console.error(`Removenickname error for thread ${threadID}:`, e.message);
      api.sendMessage('❌ removenickname कमांड में त्रुटि।', threadID);
    }
  }
};
