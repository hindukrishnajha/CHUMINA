const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'mafia',
  description: 'Starts or manages a Mafia game in the group',
  aliases: ['mafiagame'],
  async execute(api, threadID, args, event, botState, isMaster, botID, stopBot, roleTokens) {
    const command = args[0]?.toLowerCase() || '';

    if (command === 'start') {
      // Check if a game is already running
      if (botState.mafiaGames[threadID]) {
        return sendBotMessage(api, '❌ एक माफिया गेम पहले से चल रहा है! पहले इसे खत्म करो। 🕉️', threadID, event.messageID);
      }

      // Fetch group members
      api.getThreadInfo(threadID, async (err, info) => {
        if (err || !info || !info.participantIDs || info.participantIDs.length < 5) {
          return sendBotMessage(api, '⚠️ गेम शुरू करने के लिए कम से कम 5 मेंबर्स चाहिए। 🕉️', threadID, event.messageID);
        }

        const players = info.participantIDs.filter(id => id !== botID && (!botState.mutedUsers[threadID] || !botState.mutedUsers[threadID].includes(id)));
        if (players.length < 5) {
          return sendBotMessage(api, '⚠️ पर्याप्त एक्टिव प्लेयर्स नहीं हैं। 🕉️', threadID, event.messageID);
        }

        // Assign roles
        const shuffledPlayers = players.sort(() => Math.random() - 0.5);
        const numPlayers = players.length;
        const numMafia = Math.floor(numPlayers / 3); // 1 Mafia per 3 players
        const roles = [];
        for (let i = 0; i < numMafia; i++) roles.push('Mafia');
        roles.push('Doctor', 'Detective');
        while (roles.length < numPlayers) roles.push('Civilian');

        // Shuffle roles
        const shuffledRoles = roles.sort(() => Math.random() - 0.5);
        const playerData = await Promise.all(
          shuffledPlayers.map(async (id, index) => {
            const userInfo = await new Promise(resolve => api.getUserInfo(id, (err, ret) => resolve(err ? {} : ret)));
            return { id, name: userInfo[id]?.name || 'Unknown', role: shuffledRoles[index], alive: true };
          })
        );

        // Initialize game state
        botState.mafiaGames[threadID] = {
          phase: 'night',
          players: playerData,
          nightActions: { mafia: null, doctor: null, detective: null },
          dayCount: 1,
        };

        // Generate role links and store tokens
        for (const player of playerData) {
          const token = uuidv4();
          roleTokens[token] = { uid: player.id, role: player.role, threadID };
          botState.playerGame[player.id] = threadID;
          const roleLink = `https://${process.env.RENDER_SERVICE_NAME}.onrender.com/role?token=${token}&uid=${player.id}`;
          try {
            await sendBotMessage(api, `🎭 तुम्हारा रोल चेक करने के लिए इस लिंक पर क्लिक करो: ${roleLink}`, player.id, null);
          } catch (err) {
            console.error(`Failed to send role link to ${player.id}:`, err.message);
          }
        }

        sendBotMessage(api, '🕵️‍♂️ माफिया गेम शुरू हो गया! सभी प्लेयर्स को उनके रोल्स के लिंक्स भेज दिए गए हैं। नाइट फेज शुरू, अपनी चाल चलो! 🌙', threadID, event.messageID);
      });
    } else if (command === 'end') {
      if (!botState.mafiaGames[threadID]) {
        return sendBotMessage(api, '❌ कोई माफिया गेम चल नहीं रहा है। 🕉️', threadID, event.messageID);
      }

      // Clean up game state
      botState.mafiaGames[threadID].players.forEach(player => {
        delete botState.playerGame[player.id];
        Object.keys(roleTokens).forEach(token => {
          if (roleTokens[token].uid === player.id && roleTokens[token].threadID === threadID) {
            delete roleTokens[token];
          }
        });
      });
      delete botState.mafiaGames[threadID];
      sendBotMessage(api, '🛑 माफिया गेम खत्म हो गया। 🕉️', threadID, event.messageID);
    } else {
      sendBotMessage(api, '❌ यूज: #mafia start या #mafia end 🕉️', threadID, event.messageID);
    }
  },

  async handleEvent({ api, event, botState, roleTokens }) {
    const threadID = event.threadID;
    const game = botState.mafiaGames[threadID];
    if (!game || !event.body) return;

    const content = event.body.trim().toLowerCase();
    if (content === 'vote' && game.phase === 'day') {
      const targetID = Object.keys(event.mentions)[0];
      if (!targetID) {
        return sendBotMessage(api, '❌ वोट करने के लिए किसी को मेंशन करो। 🕉️', threadID, event.messageID);
      }

      const target = game.players.find(p => p.id === targetID && p.alive);
      if (!target) {
        return sendBotMessage(api, '❌ गलत टारगेट! सिर्फ जिंदा प्लेयर्स को वोट कर सकते हो। 🕉️', threadID, event.messageID);
      }

      if (!game.votes) game.votes = {};
      game.votes[targetID] = (game.votes[targetID] || 0) + 1;

      sendBotMessage(api, `🗳️ ${target.name} को एक वोट मिला!`, threadID, event.messageID);
      checkDayPhase(api, threadID);
    }
  },

  checkNightActions(api, threadID) {
    const game = botState.mafiaGames[threadID];
    if (!game) return;

    const { mafia, doctor, detective } = game.nightActions;
    if (mafia && (game.players.find(p => p.role === 'Doctor') ? doctor : true) && (game.players.find(p => p.role === 'Detective') ? detective : true)) {
      // Process night actions
      let message = '🌞 डे फेज शुरू!\n';
      let eliminated = null;

      if (mafia !== doctor) {
        const target = game.players.find(p => p.id === mafia);
        if (target) {
          target.alive = false;
          eliminated = target.name;
          message += `💀 ${target.name} को रात में मार दिया गया!\n`;
        }
      } else {
        message += '🛡️ रात में कोई नहीं मरा, डॉक्टर ने बचा लिया!\n';
      }

      if (detective) {
        const detTarget = game.players.find(p => p.id === detective.id);
        if (detTarget) {
          const detPlayer = game.players.find(p => p.role === 'Detective');
          if (detPlayer) {
            sendBotMessage(api, `🕵️‍♂️ डिटेक्टिव को पता चला कि ${detTarget.name} ${detective.role === 'Mafia' ? 'माफिया' : 'नॉन-माफिया'} है।`, detPlayer.id, null);
          }
        }
      }

      // Check game end conditions
      const mafiaCount = game.players.filter(p => p.role === 'Mafia' && p.alive).length;
      const civilianCount = game.players.filter(p => p.role !== 'Mafia' && p.alive).length;

      if (mafiaCount === 0) {
        sendBotMessage(api, '🎉 सिविलियन्स जीत गए! सारे माफिया खत्म हो गए। 🕉️', threadID);
        cleanupGame(threadID, botState, roleTokens);
        return;
      }
      if (mafiaCount >= civilianCount) {
        sendBotMessage(api, '😈 माफिया जीत गया! सिविलियन्स हार गए। 🕉️', threadID);
        cleanupGame(threadID, botState, roleTokens);
        return;
      }

      game.phase = 'day';
      game.nightActions = { mafia: null, doctor: null, detective: null };
      game.votes = {};
      game.dayCount += 1;
      message += '🗳️ अब वोटिंग शुरू! किसी को वोट करने के लिए "vote" लिखकर मेंशन करो।';
      sendBotMessage(api, message, threadID);
    }
  },
};

function sendBotMessage(api, message, threadID, replyToMessageID = null, mentions = []) {
  const randomDelay = Math.floor(Math.random() * 1000) + 1000;
  setTimeout(() => {
    const msgObj = typeof message === 'string' ? { body: message, mentions } : { ...message, mentions };
    if (replyToMessageID) {
      msgObj.messageReply = { messageID: replyToMessageID };
    }
    api.sendMessage(msgObj, threadID, (err, messageInfo) => {
      if (err) {
        console.error(`[SEND-ERROR] Failed to send: ${err.message}`);
      }
    });
  }, randomDelay);
}

function cleanupGame(threadID, botState, roleTokens) {
  botState.mafiaGames[threadID].players.forEach(player => {
    delete botState.playerGame[player.id];
    Object.keys(roleTokens).forEach(token => {
      if (roleTokens[token].uid === player.id && roleTokens[token].threadID === threadID) {
        delete roleTokens[token];
      }
    });
  });
  delete botState.mafiaGames[threadID];
}

function checkDayPhase(api, threadID) {
  const game = botState.mafiaGames[threadID];
  if (!game) return;

  const totalVotes = Object.values(game.votes).reduce((sum, count) => sum + count, 0);
  const alivePlayers = game.players.filter(p => p.alive).length;
  if (totalVotes >= Math.ceil(alivePlayers / 2)) {
    const maxVotes = Math.max(...Object.values(game.votes));
    const eliminatedID = Object.keys(game.votes).find(id => game.votes[id] === maxVotes);
    const eliminated = game.players.find(p => p.id === eliminatedID);

    if (eliminated) {
      eliminated.alive = false;
      sendBotMessage(api, `🗳️ वोटिंग खत्म! ${eliminated.name} को बाहर कर दिया गया।`, threadID);

      // Check game end conditions
      const mafiaCount = game.players.filter(p => p.role === 'Mafia' && p.alive).length;
      const civilianCount = game.players.filter(p => p.role !== 'Mafia' && p.alive).length;

      if (mafiaCount === 0) {
        sendBotMessage(api, '🎉 सिविलियन्स जीत गए! सारे माफिया खत्म हो गए। 🕉️', threadID);
        cleanupGame(threadID, botState, roleTokens);
        return;
      }
      if (mafiaCount >= civilianCount) {
        sendBotMessage(api, '😈 माफिया जीत गया! सिविलियन्स हार गए। 🕉️', threadID);
        cleanupGame(threadID, botState, roleTokens);
        return;
      }

      game.phase = 'night';
      game.nightActions = { mafia: null, doctor: null, detective: null };
      game.votes = {};
      sendBotMessage(api, '🌙 नाइट फेज शुरू! अपनी चाल चलने के लिए रोल लिंक यूज करो।', threadID);

      // Resend role links for alive players
      game.players.filter(p => p.alive).forEach(player => {
        const token = Object.keys(roleTokens).find(t => roleTokens[t].uid === player.id && roleTokens[t].threadID === threadID);
        if (token) {
          const roleLink = `https://${process.env.RENDER_SERVICE_NAME}.onrender.com/role?token=${token}&uid=${player.id}`;
          sendBotMessage(api, `🎭 अपनी चाल चलने के लिए इस लिंक पर क्लिक करो: ${roleLink}`, player.id, null);
        }
      });
    }
  }
                                                                          }
