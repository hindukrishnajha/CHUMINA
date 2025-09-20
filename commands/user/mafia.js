const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'mafia',
  aliases: ['mafiagame'],
  description: 'माफिया गेम शुरू करता है! 🎭',
  execute(api, threadID, args, event, botState, isMaster) {
    const command = args[0] ? args[0].toLowerCase() : '';
    botState.mafiaGames = botState.mafiaGames || {};

    // Cleanup invalid games on command, but preserve join phase
    cleanupMafiaGames(botState);

    if (command === 'start') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! अपनी UID adminList में डालें। 🕉️', threadID);
      if (botState.mafiaGames[threadID]) return api.sendMessage('🚫 पहले से गेम चल रहा है! #mafia stop से बंद करो। 🕉️', threadID);
      botState.mafiaGames[threadID] = { players: {}, phase: 'join', active: true, actions: {}, votes: {}, alive: new Set() };
      try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        console.log(`[DEBUG] Game started for threadID: ${threadID}, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save game state: ${err.message}`);
      }
      try {
        api.sendMessage('🕹️ माफिया गेम शुरू हो गया! जो-जो हिस्सा लेना चाहते हैं, #mafia join लिखो। कम से कम 4 प्लेयर्स होने पर गेम शुरू होगा। 😎', threadID);
      } catch (err) {
        console.error(`[ERROR] Failed to send start message: ${err.message}`);
      }
    } else if (command === 'join') {
      const gameID = threadID;
      if (!botState.mafiaGames[gameID] || botState.mafiaGames[gameID].phase !== 'join') {
        console.log(`[DEBUG] No joinable game for threadID: ${threadID}`);
        return api.sendMessage('🚫 कोई गेम शुरू नहीं हुआ! #mafia start करो। 🕉️', threadID);
      }
      api.getUserInfo(event.senderID, (err, ret) => {
        if (err) {
          console.error(`[ERROR] Failed to fetch user info for ${event.senderID}: ${err.message}`);
          return api.sendMessage('⚠️ यूजर जानकारी लेने में असफल। 🕉️', threadID);
        }
        const name = ret[event.senderID].name || 'Player';
        const sanitizedName = name.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50); // Sanitize name
        if (botState.mafiaGames[gameID].players[event.senderID]) {
          return api.sendMessage('🚫 तुम पहले से जॉइन हो चुके हो! 🕉️', threadID);
        }
        botState.mafiaGames[gameID].players[event.senderID] = { name: sanitizedName, role: null };
        botState.mafiaGames[gameID].alive.add(event.senderID);
        try {
          fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
          console.log(`[DEBUG] Player ${sanitizedName} (${event.senderID}) joined game ${gameID}. Total players: ${Object.keys(botState.mafiaGames[gameID].players).length}`);
        } catch (err) {
          console.error(`[ERROR] Failed to save join state for ${event.senderID}: ${err.message}`);
        }
        try {
          api.sendMessage(
            `✅ @${sanitizedName}, तुम गेम में शामिल हो गए! अभी ${Object.keys(botState.mafiaGames[gameID].players).length} प्लेयर्स हैं। 🎉`,
            threadID,
            null,
            [{ tag: `${sanitizedName}`, id: `${event.senderID}` }]
          );
          if (Object.keys(botState.mafiaGames[gameID].players).length >= 4) {
            api.sendMessage('🔔 4+ प्लेयर्स जॉइन हो गए! मास्टर, #mafia begin से शुरू करो। 😎', threadID);
          }
        } catch (err) {
          console.error(`[ERROR] Failed to send join message for ${event.senderID}: ${err.message}`);
          api.sendMessage(`✅ ${sanitizedName}, तुम गेम में शामिल हो गए! अभी ${Object.keys(botState.mafiaGames[gameID].players).length} प्लेयर्स हैं। 🎉`, threadID);
        }
      });
    } else if (command === 'begin') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! 🕉️', threadID);
      const gameID = threadID;
      const players = botState.mafiaGames[gameID]?.players || {};
      const validPlayers = Object.keys(players).filter(id => players[id] && players[id].name);
      const playerCount = validPlayers.length;
      console.log(`[DEBUG] Begin command for game ${gameID}. Player count: ${playerCount}, Players: ${JSON.stringify(players)}`);
      if (!botState.mafiaGames[gameID] || playerCount < 4) {
        return api.sendMessage(`⚠️ कम से कम 4 प्लेयर्स चाहिए! अभी ${playerCount} वैलिड प्लेयर्स हैं। 🕉️`, threadID);
      }
      assignRoles(botState, gameID);
      botState.mafiaGames[gameID].phase = 'night';
      try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        console.log(`[DEBUG] Game ${gameID} moved to night phase, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save night phase state: ${err.message}`);
      }
      try {
        api.sendMessage(
          '🕹️ गेम शुरू हो गया! सब लोग इस लिंक पर जाकर अपना रोल देख लो: https://shelendr-hinduu-kaa-gulaam-raam-kishor.onrender.com/mafia/' + gameID + '। 5 सेकंड वेट करो, बॉट तुम्हारा UID चेक करके रोल दिखाएगा। 🌙 नाइट फेज शुरू, 3 मिनट में एक्शन चुनो! 😈',
          threadID
        );
      } catch (err) {
        console.error(`[ERROR] Failed to send begin message: ${err.message}`);
      }
      setTimeout(() => {
        if (botState.mafiaGames[gameID]?.active) {
          try {
            api.sendMessage('🔔 कुछ यूजर्स बाकी हैं, 1 मिनट में लिंक पर जाकर एक्शन चुनो!', threadID);
          } catch (err) {
            console.error(`[ERROR] Failed to send reminder message: ${err.message}`);
          }
        }
        setTimeout(() => processNightPhase(api, threadID, gameID, botState), 60000);
      }, 120000);
    } else if (command === 'eliminate') {
      const gameID = threadID;
      if (!botState.mafiaGames[gameID] || botState.mafiaGames[gameID].phase !== 'day') return api.sendMessage('🚫 अभी डे फेज नहीं है! 🕉️', threadID);
      const targetID = Object.keys(event.mentions)[0];
      if (!targetID || !botState.mafiaGames[gameID].players[targetID]) {
        return api.sendMessage('⚠️ गलत यूजर! गेम में प्लेयर को मेंशन करो। 🕉️', threadID);
      }
      if (botState.mafiaGames[gameID].votes[event.senderID]) {
        return api.sendMessage('🚫 तुम पहले से वोट कर चुके हो! 🕉️', threadID);
      }
      botState.mafiaGames[gameID].votes[event.senderID] = targetID;
      try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
      } catch (err) {
        console.error(`[ERROR] Failed to save vote state: ${err.message}`);
      }
      api.getUserInfo([event.senderID, targetID], (err, ret) => {
        if (err) return api.sendMessage('⚠️ नाम लेने में असफल। 🕉️', threadID);
        const senderName = ret[event.senderID].name || 'Player';
        const targetName = ret[targetID].name || 'Player';
        const sanitizedSenderName = senderName.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50);
        const sanitizedTargetName = targetName.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50);
        try {
          api.sendMessage(
            `✅ @${sanitizedSenderName}, तुमने @${sanitizedTargetName} को वोट किया! 🎯`,
            threadID,
            null,
            [{ tag: `${sanitizedSenderName}`, id: `${event.senderID}` }, { tag: `${sanitizedTargetName}`, id: `${targetID}` }]
          );
        } catch (err) {
          console.error(`[ERROR] Failed to send eliminate message: ${err.message}`);
          api.sendMessage(`✅ ${sanitizedSenderName}, तुमने ${sanitizedTargetName} को वोट किया! 🎯`, threadID);
        }
      });
    } else if (command === 'stop') {
      const gameID = threadID;
      if (!botState.mafiaGames[gameID]) return api.sendMessage('🚫 कोई गेम चल नहीं रहा! 🕉️', threadID);
      delete botState.mafiaGames[gameID];
      try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        console.log(`[DEBUG] Game stopped for threadID: ${threadID}, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save stop state: ${err.message}`);
      }
      try {
        api.sendMessage('🛑 माफिया गेम बंद कर दिया गया! 🕉️', threadID);
      } catch (err) {
        console.error(`[ERROR] Failed to send stop message: ${err.message}`);
      }
    } else {
      try {
        api.sendMessage('❌ यूज: #mafia start, #mafia join, #mafia begin, #mafia eliminate @user, #mafia stop 🕉️', threadID);
      } catch (err) {
        console.error(`[ERROR] Failed to send usage message: ${err.message}`);
      }
    }
  }
};

function assignRoles(botState, gameID) {
  const players = Object.keys(botState.mafiaGames[gameID].players).filter(id => botState.mafiaGames[gameID].players[id].name);
  const count = players.length;
  const mafiaCount = (count >= 8 && count <= 12) ? 2 : (count >= 4 && count <= 7) ? 1 : 0;
  const roles = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('Mafia');
  roles.push('Doctor');
  roles.push('Detective');
  for (let i = 0; i < count - mafiaCount - 2; i++) roles.push('Villager');
  roles.sort(() => Math.random() - 0.5);
  players.forEach((id, i) => {
    botState.mafiaGames[gameID].players[id].role = roles[i];
  });
  console.log(`[DEBUG] Assigned roles for game ${gameID}: ${JSON.stringify(roles)}`);
}

function processNightPhase(api, threadID, gameID, botState) {
  const game = botState.mafiaGames[gameID];
  if (!game || !game.active) return;
  let result = '🌙 नाइट फेज खत्म। ';
  let target = null;
  if (game.actions.mafia && game.actions.mafia.length > 0) {
    const voteCounts = {};
    game.actions.mafia.forEach(id => voteCounts[id] = (voteCounts[id] || 0) + 1);
    target = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b, null);
  }
  if (target && target !== game.actions.doctor) {
    game.alive.delete(target);
    const targetName = game.players[target].name || 'Player';
    result += `@${targetName} मर गया! वो ${game.players[target].role} था।`;
  } else if (target) {
    result += 'Doctor ने बचा लिया! कोई नहीं मरा।';
  } else {
    result += 'कोई नहीं मरा।';
  }
  if (game.actions.detective) {
    const checkedRole = game.players[game.actions.detective].role === 'Mafia' ? 'Mafia है' : 'Mafia नहीं है';
    const detectiveID = Object.keys(game.players).find(id => game.players[id].role === 'Detective');
    const checkedName = game.players[game.actions.detective].name || 'Player';
    try {
      api.sendMessage(
        `🔎 @${checkedName} ${checkedRole}। ग्रुप में रिजल्ट देखो।`,
        detectiveID,
        null,
        [{ tag: `${checkedName}`, id: `${game.actions.detective}` }]
      );
    } catch (err) {
      console.error(`[ERROR] Failed to send detective message: ${err.message}`);
      api.sendMessage(`🔎 ${checkedName} ${checkedRole}। ग्रुप में रिजल्ट देखो।`, detectiveID);
    }
  }
  game.phase = 'day';
  game.votes = {};
  game.actions = { mafia: [], doctor: null, detective: null };
  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ERROR] Failed to save night phase state: ${err.message}`);
  }
  console.log(`[DEBUG] Night phase processed for game ${gameID}`);
  try {
    api.sendMessage(result + '\n☀️ डे फेज शुरू! #mafia eliminate @user से वोट करो (3 मिनट)। 😎', threadID);
  } catch (err) {
    console.error(`[ERROR] Failed to send night phase result: ${err.message}`);
  }
  setTimeout(() => {
    if (game.active) {
      const missing = Array.from(game.alive).filter(id => !game.votes[id]);
      if (missing.length > 0) {
        try {
          api.sendMessage(
            `🔔 @${missing.map(id => game.players[id].name).join(', ')}, 20 सेकंड में वोट करो, वरना काउंट नहीं होगा! 🎯`,
            threadID
          );
        } catch (err) {
          console.error(`[ERROR] Failed to send missing votes message: ${err.message}`);
        }
      }
      setTimeout(() => processDayPhase(api, threadID, gameID, botState), 20000);
    }
  }, 160000);
}

function processDayPhase(api, threadID, gameID, botState) {
  const game = botState.mafiaGames[gameID];
  if (!game || !game.active) return;
  let result = '☀️ डे फेज खत्म। ';
  let eliminated = null;
  if (Object.keys(game.votes).length > 0) {
    const voteCounts = {};
    Object.values(game.votes).forEach(id => voteCounts[id] = (voteCounts[id] || 0) + 1);
    eliminated = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b, null);
    if (eliminated) {
      game.alive.delete(eliminated);
      const targetName = game.players[eliminated].name || 'Player';
      result += `@${targetName} को वोट से निकाला गया! वो ${game.players[eliminated].role} था।`;
    }
  } else {
    result += 'कोई वोट नहीं हुआ।';
  }
  const mafiaCount = Array.from(game.alive).filter(id => game.players[id].role === 'Mafia').length;
  const villagerCount = game.alive.size - mafiaCount;
  if (mafiaCount === 0) {
    result += '\n🏆 Villagers जीत गए! 🎉';
    delete botState.mafiaGames[gameID];
  } else if (mafiaCount >= villagerCount) {
    result += '\n🏆 Mafia जीत गए! 😈';
    delete botState.mafiaGames[gameID];
  } else {
    result += '\n🌙 नया नाइट फेज शुरू! लिंक पर जाओ और एक्शन चुनो। 😎';
    game.phase = 'night';
    game.actions = { mafia: [], doctor: null, detective: null };
  }
  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ERROR] Failed to save day phase state: ${err.message}`);
  }
  console.log(`[DEBUG] Day phase processed for game ${gameID}`);
  try {
    api.sendMessage(result, threadID);
  } catch (err) {
    console.error(`[ERROR] Failed to send day phase result: ${err.message}`);
  }
}

function cleanupMafiaGames(botState) {
  Object.keys(botState.mafiaGames).forEach(gameID => {
    const game = botState.mafiaGames[gameID];
    if (!game.active || (game.phase !== 'join' && Object.keys(game.players).length === 0)) {
      delete botState.mafiaGames[gameID];
      console.log(`[DEBUG] Removed inactive or empty game: ${gameID}`);
      return;
    }
    Object.keys(game.players).forEach(playerID => {
      if (!game.players[playerID].name) {
        console.warn(`[DEBUG] Removing invalid player ${playerID} from game ${gameID} due to missing name`);
        delete game.players[playerID];
        game.alive.delete(playerID);
      }
    });
    if (game.phase !== 'join' && Object.keys(game.players).length === 0) {
      delete botState.mafiaGames[gameID];
      console.log(`[DEBUG] Removed empty game after player cleanup: ${gameID}`);
    }
  });
  try {
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ERROR] Failed to save cleanup state: ${err.message}`);
  }
                                       }
