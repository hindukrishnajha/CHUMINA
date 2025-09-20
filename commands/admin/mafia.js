const { sendMessageWithCooldown } = require('../../utils/nicknameUtils');

module.exports = {
  name: 'mafia',
  description: 'Mafia game commands',
  aliases: ['ma'],
  execute: async (api, threadID, args, event, botState) => {
    const roles = ['Mafia', 'Doctor', 'Detective', 'Villager'];
    const minPlayers = 4;

    const startGame = async () => {
      if (botState.mafiaGames[threadID]?.active) {
        sendMessageWithCooldown(api, '🚫 पहले से एक गेम चल रहा है! 🕉️', threadID, botState);
        return;
      }

      botState.mafiaGames[threadID] = {
        active: true,
        players: {},
        alive: new Set(),
        phase: 'registration',
        actions: { mafia: [], doctor: null, detective: null },
        votes: {},
        day: 0
      };

      const gameID = threadID;
      const joinLink = `https://${process.env.RENDER_SERVICE_NAME}.onrender.com/mafia/${gameID}`;
      const joinMessage = `🎮 माफिया गेम शुरू हो गया! 🕉️\nजॉइन करने के लिए लिंक: ${joinLink}\n30 सेकंड में रजिस्ट्रेशन बंद हो जाएगा।`;

      try {
        api.getThreadInfo(threadID, async (err, info) => {
          if (err) {
            console.error('Error fetching thread info:', err.message);
            sendMessageWithCooldown(api, '⚠️ ग्रुप जानकारी लाने में गलती। 🕉️', threadID, botState);
            return;
          }

          const participantIDs = info.participantIDs.filter(id => id !== api.getCurrentUserID());
          const mentions = [];
          for (const id of participantIDs) {
            try {
              await new Promise((resolve, reject) => {
                api.getUserInfo(id, (err, ret) => {
                  if (err || !ret[id]) {
                    mentions.push({ tag: `Player_${id}`, id: id.toString() });
                    resolve();
                    return;
                  }
                  const name = ret[id].name || `Player_${id}`;
                  mentions.push({ tag: name, id: id.toString() });
                  resolve();
                });
              });
            } catch (err) {
              console.error(`Error fetching user info for ${id}:`, err.message);
              mentions.push({ tag: `Player_${id}`, id: id.toString() });
            }
          }

          sendMessageWithCooldown(api, joinMessage, threadID, botState, null, mentions, (err, messageInfo) => {
            if (err) {
              console.error('Error sending join message:', err.message);
              sendMessageWithCooldown(api, '⚠️ जॉइन मैसेज भेजने में गलती। 🕉️', threadID, botState);
              return;
            }
            console.log('Join message sent with mentions:', mentions);
          });
        });
      } catch (err) {
        console.error('Error in startGame:', err.message);
        sendMessageWithCooldown(api, '⚠️ गेम शुरू करने में गलती। 🕉️', threadID, botState);
      }

      setTimeout(() => {
        if (!botState.mafiaGames[threadID]?.active) return;

        const players = Object.keys(botState.mafiaGames[threadID].players);
        if (players.length < minPlayers) {
          sendMessageWithCooldown(api, `🚫 कम से कम ${minPlayers} प्लेयर्स चाहिए। गेम रद्द। 🕉️`, threadID, botState);
          delete botState.mafiaGames[threadID];
          return;
        }

        botState.mafiaGames[threadID].alive = new Set(players);
        const shuffledRoles = roles.sort(() => Math.random() - 0.5).slice(0, players.length);
        players.forEach((playerID, index) => {
          botState.mafiaGames[threadID].players[playerID].role = shuffledRoles[index];
        });

        botState.mafiaGames[threadID].phase = 'night';
        botState.mafiaGames[threadID].day = 1;

        sendMessageWithCooldown(api, '🌙 रात का फेज शुरू! सभी प्लेयर्स अपनी भूमिका चेक करें और एक्शन लें। 🕉️', threadID, botState);
      }, 30000);
    };

    const joinGame = (userID, name) => {
      if (!botState.mafiaGames[threadID]?.active || botState.mafiaGames[threadID].phase !== 'registration') {
        sendMessageWithCooldown(api, '🚫 गेम शुरू नहीं हुआ या रजिस्ट्रेशन बंद है। 🕉️', threadID, botState);
        return;
      }

      if (botState.mafiaGames[threadID].players[userID]) {
        sendMessageWithCooldown(api, '🚫 आप पहले से गेम में हैं! 🕉️', threadID, botState);
        return;
      }

      botState.mafiaGames[threadID].players[userID] = { name, role: null };
      sendMessageWithCooldown(api, `${name} गेम में शामिल हो गया! 🕉️`, threadID, botState);
    };

    const stopGame = () => {
      if (!botState.mafiaGames[threadID]?.active) {
        sendMessageWithCooldown(api, '🚫 कोई गेम चल नहीं रहा! 🕉️', threadID, botState);
        return;
      }

      delete botState.mafiaGames[threadID];
      sendMessageWithCooldown(api, '🛑 गेम बंद कर दिया गया। 🕉️', threadID, botState);
    };

    try {
      const subcommand = args[0]?.toLowerCase();
      if (subcommand === 'start') {
        await startGame();
      } else if (subcommand === 'join' && event.mentions && Object.keys(event.mentions).length > 0) {
        const userID = Object.keys(event.mentions)[0];
        const name = event.mentions[userID] || `Player_${userID}`;
        joinGame(userID, name);
      } else if (subcommand === 'stop') {
        stopGame();
      } else {
        sendMessageWithCooldown(api, '❌ यूज: #mafia start | join @user | stop 🕉️', threadID, botState);
      }
    } catch (err) {
      console.error('Mafia command error:', err.message);
      sendMessageWithCooldown(api, `❌ गलती: ${err.message} 🕉️`, threadID, botState);
    }
  }
};
