const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
  name: 'mafia',
  aliases: ['mafiagame'],
  description: 'माफिया गेम शुरू करता है! 🎭',
  execute(api, threadID, args, event, botState, isMaster) {
    const command = args[0] ? args[0].toLowerCase() : '';
    botState.mafiaGames = botState.mafiaGames || {};

    if (command === 'start') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! अपनी UID adminList में डालें। 🕉️', threadID);
      if (botState.mafiaGames[threadID]) return api.sendMessage('🚫 पहले से गेम चल रहा है! #mafia stop से बंद करो। 🕉️', threadID);
      botState.mafiaGames[threadID] = { players: {}, phase: 'join', active: true, actions: {}, votes: {}, alive: new Set(), results: {} };
      try {
        const game = botState.mafiaGames[threadID];
        const originalAlive = game.alive;
        game.alive = Array.from(originalAlive);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        game.alive = originalAlive;
        console.log(`[DEBUG] Game started for threadID: ${threadID}, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save start state: ${err.message}`);
        api.sendMessage('⚠️ सर्वर त्रुटि: गेम शुरू नहीं हो सका। बाद में फिर ट्राई करें। 🕉️', threadID);
      }
      const joinLink = `https://${process.env.RENDER_SERVICE_NAME || 'your-render-service'}.onrender.com/mafia/${threadID}?t=${Date.now()}`;
      try {
        api.sendMessage(
          `🕹️ माफिया गेम शुरू हो गया! जो-जो हिस्सा लेना चाहते हैं, #mafia join लिखो। कम से कम 4 प्लेयर्स होने पर गेम शुरू होगा। 😎\nजॉइन लिंक: ${joinLink}`,
          threadID
        );
      } catch (err) {
        console.error(`[ERROR] Failed to send start message: ${err.message}`);
      }
    } else if (command === 'join') {
      const gameID = threadID;
      if (!botState.mafiaGames[gameID] || botState.mafiaGames[gameID].phase !== 'join') {
        console.log(`[DEBUG] No joinable game for threadID: ${threadID}`);
        return api.sendMessage('🚫 कोई गेम शुरू नहीं हुआ! #mafia start करो। 🕉️', threadID);
      }
      api.getUserInfo([event.senderID], (err, ret) => {
        if (err || !ret || !ret[event.senderID]) {
          console.error(`[ERROR] Failed to fetch user info for ${event.senderID}: ${err?.message || 'Unknown error'}`);
          const name = `Player_${event.senderID}`;
          if (botState.mafiaGames[gameID].players[event.senderID]) {
            return api.sendMessage('🚫 तुम पहले से जॉइन हो चुके हो! 🕉️', threadID);
          }
          botState.mafiaGames[gameID].players[event.senderID] = { name, role: null };
          botState.mafiaGames[gameID].alive.add(event.senderID);
          saveStateAndSendJoinMessage(api, threadID, gameID, botState, name, event.senderID);
        } else {
          const name = ret[event.senderID].name || `Player_${event.senderID}`;
          if (botState.mafiaGames[gameID].players[event.senderID]) {
            return api.sendMessage('🚫 तुम पहले से जॉइन हो चुके हो! 🕉️', threadID);
          }
          botState.mafiaGames[gameID].players[event.senderID] = { name, role: null };
          botState.mafiaGames[gameID].alive.add(event.senderID);
          saveStateAndSendJoinMessage(api, threadID, gameID, botState, name, event.senderID);
        }
      });
    } else if (command === 'begin') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! 🕉️', threadID);
      const gameID = threadID;
      const players = botState.mafiaGames[gameID]?.players || {};
      const playerCount = Object.keys(players).length;
      console.log(`[DEBUG] Begin command for game ${gameID}. Player count: ${playerCount}, Players: ${JSON.stringify(players)}`);
      if (!botState.mafiaGames[gameID] || playerCount < 4) {
        return api.sendMessage(`⚠️ कम से कम 4 प्लेयर्स चाहिए! अभी ${playerCount} प्लेयर्स हैं। 🕉️`, threadID);
      }
      assignRoles(botState, gameID);
      botState.mafiaGames[gameID].phase = 'night';
      try {
        const game = botState.mafiaGames[gameID];
        const originalAlive = game.alive;
        game.alive = Array.from(originalAlive);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        if (!fs.existsSync(LEARNED_RESPONSES_PATH)) {
          console.error('[ERROR] State file not found after save!');
        }
        game.alive = originalAlive;
        console.log(`[DEBUG] Game ${gameID} moved to night phase, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save night phase state: ${err.message}`);
        api.sendMessage('⚠️ सर्वर त्रुटि: गेम शुरू नहीं हो सका। बाद में फिर ट्राई करें। 🕉️', threadID);
      }
      const joinLink = `https://${process.env.RENDER_SERVICE_NAME || 'your-render-service'}.onrender.com/mafia/${gameID}?t=${Date.now()}`;
      try {
        api.sendMessage(
          `🕹️ गेम शुरू हो गया! सब लोग इस लिंक पर जाकर अपना रोल देख लो: ${joinLink}\n5 सेकंड वेट करो, बॉट तुम्हारा UID चेक करके रोल दिखाएगा। 🌙 नाइट फेज शुरू, 3 मिनट में एक्शन चुनो! 😈`,
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
      if (!botState.mafiaGames[gameID] || botState.mafiaGames[gameID].phase !== 'day') {
        return api.sendMessage('🚫 अभी डे फेज नहीं है! 🕉️', threadID);
      }
      // चेक करें कि वोटर गेम में जॉइन किया हुआ है
      if (!botState.mafiaGames[gameID].players[event.senderID]) {
        return api.sendMessage('🚫 तुम गेम में जॉइन नहीं हो! पहले #mafia join करो। 🕉️', threadID);
      }
      let targetID = Object.keys(event.mentions)[0];
      // अगर मेंशन नहीं है, तो args से UID या नाम पढ़ें
      if (!targetID) {
        const potentialTarget = args.slice(1).join(' ').trim();
        if (!potentialTarget) {
          return api.sendMessage('⚠️ गलत यूजर! #mafia eliminate @user, UID, या नाम लिखो। 🕉️', threadID);
        }
        // UID से मैच करें
        if (/^\d+$/.test(potentialTarget)) {
          targetID = potentialTarget;
        } else {
          // नाम से फजी मैच करें (case-insensitive)
          for (const id in botState.mafiaGames[gameID].players) {
            if (botState.mafiaGames[gameID].players[id].name.toLowerCase().includes(potentialTarget.toLowerCase())) {
              targetID = id;
              break;
            }
          }
        }
      }
      if (!targetID || !botState.mafiaGames[gameID].players[targetID]) {
        return api.sendMessage('⚠️ गलत यूजर! गेम में प्लेयर को मेंशन, UID, या नाम लिखो। 🕉️', threadID);
      }
      if (botState.mafiaGames[gameID].votes[event.senderID]) {
        return api.sendMessage('🚫 तुम पहले से वोट कर चुके हो! 🕉️', threadID);
      }
      botState.mafiaGames[gameID].votes[event.senderID] = targetID;
      try {
        const game = botState.mafiaGames[gameID];
        const originalAlive = game.alive;
        game.alive = Array.from(originalAlive);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        game.alive = originalAlive;
        console.log(`[DEBUG] Vote recorded for ${event.senderID} against ${targetID}`);
      } catch (err) {
        console.error(`[ERROR] Failed to save vote state: ${err.message}`);
      }
      api.getUserInfo([event.senderID, targetID], (err, ret) => {
        if (err || !ret || !ret[event.senderID] || !ret[targetID]) {
          console.error(`[ERROR] Failed to fetch user info for sender ${event.senderID} or target ${targetID}: ${err?.message || 'Unknown error'}`);
          const senderName = botState.mafiaGames[gameID].players[event.senderID]?.name || `Player_${event.senderID}`;
          const targetName = botState.mafiaGames[gameID].players[targetID]?.name || `Player_${targetID}`;
          const voteMessage = `✅ ${senderName}, तुमने ${targetName} को वोट किया! 🎯`;
          try {
            api.sendMessage(voteMessage, threadID);
          } catch (err) {
            console.error(`[ERROR] Failed to send fallback eliminate message: ${err.message}`);
          }
        } else {
          const senderName = ret[event.senderID].name || `Player_${event.senderID}`;
          const targetName = ret[targetID].name || `Player_${targetID}`;
          const voteMessage = `✅ ${senderName}, तुमने ${targetName} को वोट किया! 🎯`;
          try {
            api.sendMessage(voteMessage, threadID);
          } catch (err) {
            console.error(`[ERROR] Failed to send eliminate message: ${err.message}`);
          }
        }
      });
    } else if (command === 'stop') {
      const gameID = threadID;
      if (!botState.mafiaGames[gameID]) return api.sendMessage('🚫 कोई गेम चल नहीं चल रहा! 🕉️', threadID);
      delete botState.mafiaGames[gameID];
      try {
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        console.log(`[DEBUG] Game stopped for threadID: ${threadID}, state saved`);
      } catch (err) {
        console.error(`[ERROR] Failed to save stop state: ${err.message}`);
      }
      cleanupMafiaGames(botState);
      try {
        api.sendMessage('🛑 माफिया गेम बंद कर दिया गया! 🕉️', threadID);
      } catch (err) {
        console.error(`[ERROR] Failed to send stop message: ${err.message}`);
      }
    } else {
      try {
        api.sendMessage('❌ यूज: #mafia start, #mafia join, #mafia begin, #mafia eliminate @user/UID/नाम, #mafia stop 🕉️', threadID);
      } catch (err) {
        console.error(`[ERROR] Failed to send usage message: ${err.message}`);
      }
    }
  }
};

function saveStateAndSendJoinMessage(api, threadID, gameID, botState, name, senderID) {
  const game = botState.mafiaGames[gameID];
  if (!game || !game.players[senderID]) {
    console.error(`[ERROR] Game or player not found for threadID: ${gameID}, senderID: ${senderID}`);
    return api.sendMessage('⚠️ गेम में त्रुटि! फिर से #mafia join ट्राई करें। 🕉️', threadID);
  }
  try {
    const originalAlive = game.alive;
    game.alive = Array.from(originalAlive);
    const backupPath = LEARNED_RESPONSES_PATH + '.backup';
    fs.writeFileSync(backupPath, JSON.stringify(botState, null, 2), 'utf8'); // Backup first
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    if (!fs.existsSync(LEARNED_RESPONSES_PATH)) {
      console.error('[ERROR] State file not found after save! Using backup.');
      fs.copyFileSync(backupPath, LEARNED_RESPONSES_PATH);
    }
    game.alive = originalAlive;
    console.log(`[DEBUG] Player ${name} (${senderID}) joined game ${gameID}. Total players: ${Object.keys(botState.mafiaGames[gameID].players).length}, players keys: ${JSON.stringify(Object.keys(game.players))}`);
  } catch (err) {
    console.error(`[ERROR] Failed to save join state for ${senderID}: ${err.message}`);
    api.sendMessage('⚠️ सर्वर त्रुटि: जॉइन नहीं हो सका। बाद में फिर ट्राई करें। 🕉️', threadID);
  }
  const playerCount = Object.keys(botState.mafiaGames[gameID].players).length;
  const joinMessage = `✅ ${name}, तुम गेम में शामिल हो गए! अभी ${playerCount} प्लेयर्स हैं। 🎉`;
  try {
    api.sendMessage(joinMessage, threadID);
    if (playerCount >= 4) {
      api.sendMessage('🔔 4+ प्लेयर्स जॉइन हो गए! मास्टर, #mafia begin से शुरू करो। 😎', threadID);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to send join message for ${senderID}: ${err.message}`);
  }
}

function assignRoles(botState, gameID) {
  const players = Object.keys(botState.mafiaGames[gameID].players).filter(id => botState.mafiaGames[gameID].players[id].name);
  const count = players.length;
  const mafiaCount = count >= 8 && count <= 12 ? 2 : count >= 4 && count <= 7 ? 1 : 0;
  const roles = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('Mafia');
  roles.push('Doctor');
  roles.push('Detective');
  for (let i = 0; i < count - mafiaCount - 2; i++) roles.push('Villager');
  roles.sort(() => Math.random() - 0.5);
  players.forEach((id, i) => {
    botState.mafiaGames[gameID].players[id].role = roles[i] || 'Villager'; // Fallback to Villager if undefined
    console.log(`[DEBUG] Assigned role ${roles[i]} to player ${id}`);
  });
  console.log(`[DEBUG] Assigned roles for game ${gameID}: ${JSON.stringify(roles)}`);
}

function processNightPhase(api, threadID, gameID, botState) {
  const game = botState.mafiaGames[gameID];
  if (!game || !game.active) {
    console.log(`[DEBUG] Game ${gameID} not found or inactive`);
    return api.sendMessage('⚠️ गेम नहीं मिला या खत्म हो चुका है! 🕉️', threadID);
  }
  let result = '🌙 नाइट फेज खत्म। ';
  let target = null;
  if (game.actions.mafia && game.actions.mafia.length > 0) {
    const voteCounts = {};
    game.actions.mafia.forEach(id => voteCounts[id] = (voteCounts[id] || 0) + 1);
    target = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b, null);
  }
  if (target && target !== game.actions.doctor) {
    game.alive.delete(target);
    const targetName = game.players[target].name || `Player_${target}`;
    result += `${targetName} मर गया! वो ${game.players[target].role || 'Unknown'} था।`;
  } else if (target) {
    result += 'Doctor ने बचा लिया! कोई नहीं मरा।';
  } else {
    result += 'कोई नहीं मरा।';
  }
  if (game.actions.detective) {
    const checkedRole = game.players[game.actions.detective].role === 'Mafia' ? 'Mafia है' : 'Mafia नहीं है';
    const detectiveID = Object.keys(game.players).find(id => game.players[id].role === 'Detective');
    const checkedName = game.players[game.actions.detective].name || `Player_${game.actions.detective}`;
    game.results = game.results || {};
    game.results[detectiveID] = `🔎 ${checkedName} ${checkedRole}`;
    try {
      api.sendMessage(`🔎 ${checkedName} ${checkedRole}।`, detectiveID);
    } catch (err) {
      console.error(`[ERROR] Failed to send detective message: ${err.message}`);
    }
  }
  game.phase = 'day';
  game.votes = {};
  game.actions = { mafia: [], doctor: null, detective: null };
  try {
    const originalAlive = game.alive;
    game.alive = Array.from(originalAlive);
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    game.alive = originalAlive;
  } catch (err) {
    console.error(`[ERROR] Failed to save night phase state: ${err.message}`);
    api.sendMessage('⚠️ सर्वर त्रुटि: गेम स्टेट सेव नहीं हो सका। 🕉️', threadID);
  }
  console.log(`[DEBUG] Night phase processed for game ${gameID}`);
  try {
    api.sendMessage(result + '\n☀️ डे फेज शुरू! #mafia eliminate @user/UID/नाम से वोट करो (3 मिनट)। 😎', threadID);
  } catch (err) {
    console.error(`[ERROR] Failed to send night phase result: ${err.message}`);
  }
  setTimeout(() => {
    if (game.active) {
      const missing = Array.from(game.alive).filter(id => !game.votes[id]);
      if (missing.length > 0) {
        const missingNames = missing.map(id => game.players[id].name || `Player_${id}`).join(', ');
        try {
          api.sendMessage(`🔔 ${missingNames}, 20 सेकंड में वोट करो, वरना काउंट नहीं होगा! 🎯`, threadID);
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
  if (!game || !game.active) {
    console.log(`[DEBUG] Game ${gameID} not found or inactive`);
    return api.sendMessage('⚠️ गेम नहीं मिला या खत्म हो चुका है! 🕉️', threadID);
  }
  let result = '☀️ डे फेज खत्म। ';
  let eliminated = null;
  if (Object.keys(game.votes).length > 0) {
    const voteCounts = {};
    Object.values(game.votes).forEach(id => voteCounts[id] = (voteCounts[id] || 0) + 1);
    eliminated = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b, null);
    if (eliminated) {
      game.alive.delete(eliminated);
      const eliminatedName = game.players[eliminated].name || `Player_${eliminated}`;
      result += `${eliminatedName} को वोट से निकाला गया! वो ${game.players[eliminated].role || 'Unknown'} था।`;
    }
  } else {
    result += 'कोई वोट नहीं हुआ।';
  }
  const mafiaCount = Array.from(game.alive).filter(id => game.players[id].role === 'Mafia').length;
  const villagerCount = game.alive.size - mafiaCount;
  if (mafiaCount === 0) {
    result += '\n🏆 Villagers जीत गए! 🎉';
    let rolesList = '\nसभी प्लेयर्स के रोल:\n';
    Object.entries(game.players).forEach(([id, player]) => {
      rolesList += `${player.name || `Player_${id}`}: ${player.role || 'Unknown'}\n`;
    });
    result += rolesList;
    delete botState.mafiaGames[gameID];
    cleanupMafiaGames(botState);
  } else if (mafiaCount >= villagerCount) {
    result += '\n🏆 Mafia जीत गए! 😈';
    let rolesList = '\nसभी प्लेयर्स के रोल:\n';
    Object.entries(game.players).forEach(([id, player]) => {
      rolesList += `${player.name || `Player_${id}`}: ${player.role || 'Unknown'}\n`;
    });
    result += rolesList;
    delete botState.mafiaGames[gameID];
    cleanupMafiaGames(botState);
  } else {
    result += '\n🌙 नया नाइट फेज शुरू! लिंक पर जाओ और एक्शन चुनो। 😎';
    game.phase = 'night';
    game.actions = { mafia: [], doctor: null, detective: null };
    game.results = {};
    const joinLink = `https://${process.env.RENDER_SERVICE_NAME || 'your-render-service'}.onrender.com/mafia/${gameID}?t=${Date.now()}`;
    try {
      api.sendMessage(
        `🌙 नया नाइट फेज शुरू! इस लिंक पर जाकर 3 मिनट में एक्शन चुनो: ${joinLink} 😈`,
        threadID
      );
    } catch (err) {
      console.error(`[ERROR] Failed to send new night phase message: ${err.message}`);
    }
    setTimeout(() => {
      if (botState.mafiaGames[gameID]?.active) {
        try {
          api.sendMessage('🔔 कुछ यूजर्स बाकी हैं, 1 मिनट में लिंक पर जाकर एक्शन चुनो!', threadID);
        } catch (err) {
          console.error(`[ERROR] Failed to send reminder message: ${err.message}`);
        }
        setTimeout(() => processNightPhase(api, threadID, gameID, botState), 60000);
      }
    }, 120000);
  }
  try {
    const originalAlive = game.alive;
    game.alive = Array.from(originalAlive);
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    game.alive = originalAlive;
  } catch (err) {
    console.error(`[ERROR] Failed to save day phase state: ${err.message}`);
    api.sendMessage('⚠️ सर्वर त्रुटि: गेम स्टेट सेव नहीं हो सका। 🕉️', threadID);
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
    if (!game || !game.active || (game.phase !== 'join' && Object.keys(game.players).length === 0)) {
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
    Object.keys(botState.mafiaGames).forEach(gameID => {
      const game = botState.mafiaGames[gameID];
      if (game && game.alive instanceof Set) {
        game.alive = Array.from(game.alive);
      }
    });
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    Object.keys(botState.mafiaGames).forEach(gameID => {
      const game = botState.mafiaGames[gameID];
      if (game && Array.isArray(game.alive)) {
        game.alive = new Set(game.alive);
      }
    });
  } catch (err) {
    console.error(`[ERROR] Failed to save cleanup state: ${err.message}`);
  }
          }
