const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants'); // इम्पोर्ट जोड़ा

module.exports = {
  name: 'mafia',
  aliases: ['mafiagame'],
  description: 'माफिया गेम शुरू करता है! 🎭',
  execute(api, threadID, args, event, botState, isMaster) {
    const command = args[0] ? args[0].toLowerCase() : '';
    botState.mafiaGames = botState.mafiaGames || {};

    if (command === 'start') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! 🕉️', threadID);
      const gameID = Math.random().toString(36).substring(2, 8);
      botState.mafiaGames[gameID] = { players: {}, phase: 'join', active: true, actions: {}, votes: {}, alive: new Set() };
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
      api.sendMessage('🕹️ माफिया गेम शुरू हो गया! जो-जो हिस्सा लेना चाहते हैं, #mafia join लिखो। कम से कम 4 प्लेयर्स होने पर गेम शुरू होगा। 😎', threadID);
    } else if (command === 'join') {
      const gameID = Object.keys(botState.mafiaGames).find(id => botState.mafiaGames[id].phase === 'join' && botState.mafiaGames[id].active);
      if (!gameID) return api.sendMessage('🚫 कोई गेम शुरू नहीं हुआ! #mafia start करो। 🕉️', threadID);
      api.getUserInfo(event.senderID, (err, ret) => {
        if (err) return api.sendMessage('⚠️ यूजर जानकारी लेने में असफल। 🕉️', threadID);
        const name = ret[event.senderID].name || 'Player';
        if (botState.mafiaGames[gameID].players[event.senderID]) {
          return api.sendMessage('🚫 तुम पहले से जॉइन हो चुके हो! 🕉️', threadID);
        }
        botState.mafiaGames[gameID].players[event.senderID] = { name, role: null };
        botState.mafiaGames[gameID].alive.add(event.senderID);
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        api.sendMessage(`✅ @${name}, तुम गेम में शामिल हो गए! अभी ${Object.keys(botState.mafiaGames[gameID].players).length} प्लेयर्स हैं। 🎉`, threadID);
        if (Object.keys(botState.mafiaGames[gameID].players).length >= 4) {
          api.sendMessage('🔔 4+ प्लेयर्स जॉइन हो गए! मास्टर, #mafia begin से शुरू करो। 😎', threadID);
        }
      });
    } else if (command === 'begin') {
      if (!isMaster) return api.sendMessage('🚫 सिर्फ मास्टर गेम शुरू कर सकता है! 🕉️', threadID);
      const gameID = Object.keys(botState.mafiaGames).find(id => botState.mafiaGames[id].phase === 'join' && botState.mafiaGames[id].active);
      if (!gameID || Object.keys(botState.mafiaGames[gameID].players).length < 4) {
        return api.sendMessage('⚠️ कम से कम 4 प्लेयर्स चाहिए! 🕉️', threadID);
      }
      assignRoles(botState, gameID);
      botState.mafiaGames[gameID].phase = 'night';
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
      api.sendMessage('🕹️ गेम शुरू हो गया! सब लोग इस लिंक पर जाकर अपना रोल देख लो: https://shelendr-hinduu-kaa-gulaam-raam-kishor.onrender.com/mafia/' + gameID + '। 5 सेकंड वेट करो, बॉट तुम्हारा UID चेक करके रोल दिखाएगा। 🌙 नाइट फेज शुरू, 3 मिनट में एक्शन चुनो! 😈', threadID);
      setTimeout(() => {
        if (botState.mafiaGames[gameID]?.active) {
          api.sendMessage('🔔 कुछ यूजर्स बाकी हैं, 1 मिनट में लिंक पर जाकर एक्शन चुनो!', threadID);
        }
        setTimeout(() => processNightPhase(api, threadID, gameID, botState), 60000);
      }, 120000);
    } else if (command === 'eliminate') {
      const gameID = Object.keys(botState.mafiaGames).find(id => botState.mafiaGames[id].phase === 'day' && botState.mafiaGames[id].active);
      if (!gameID) return api.sendMessage('🚫 अभी डे फेज नहीं है! 🕉️', threadID);
      const targetID = Object.keys(event.mentions)[0];
      if (!targetID || !botState.mafiaGames[gameID].players[targetID]) {
        return api.sendMessage('⚠️ गलत यूजर! गेम में प्लेयर को मेंशन करो। 🕉️', threadID);
      }
      if (botState.mafiaGames[gameID].votes[event.senderID]) {
        return api.sendMessage('🚫 तुम पहले से वोट कर चुके हो! 🕉️', threadID);
      }
      botState.mafiaGames[gameID].votes[event.senderID] = targetID;
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
      api.getUserInfo([event.senderID, targetID], (err, ret) => {
        if (err) return api.sendMessage('⚠️ नाम लेने में असफल। 🕉️', threadID);
        const senderName = ret[event.senderID].name || 'Player';
        const targetName = ret[targetID].name || 'Player';
        api.sendMessage(`✅ @${senderName}, तुमने @${targetName} को वोट किया! 🎯`, threadID);
      });
    } else if (command === 'stop') {
      const gameID = Object.keys(botState.mafiaGames).find(id => botState.mafiaGames[id].active);
      if (!gameID) return api.sendMessage('🚫 कोई गेम चल नहीं रहा! 🕉️', threadID);
      delete botState.mafiaGames[gameID];
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
      api.sendMessage('🛑 माफिया गेम बंद कर दिया गया! 🕉️', threadID);
    } else {
      api.sendMessage('❌ यूज: #mafia start, #mafia join, #mafia begin, #mafia eliminate @user, #mafia stop 🕉️', threadID);
    }
  }
};

function assignRoles(botState, gameID) {
  const players = Object.keys(botState.mafiaGames[gameID].players);
  const count = players.length;
  const mafiaCount = (count >= 8 && count <= 12) ? 2 : (count >= 4 && count <= 7) ? 1 : 0;
  const roles = [];
  for (let i = 0; i < mafiaCount; i++) roles.push('Mafia');
  roles.push('Doctor');
  roles.push('Detective');
  for (let i = 0; i < count - mafiaCount - 2; i++) roles.push('Villager');
  players.sort(() => Math.random() - 0.5).forEach((id, i) => {
    botState.mafiaGames[gameID].players[id].role = roles[i];
  });
  console.log('[DEBUG] Assigned roles for game ' + gameID);
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
    result += `@${game.players[target].name} मर गया! वो ${game.players[target].role} था।`;
  } else if (target) {
    result += 'Doctor ने बचा लिया! कोई नहीं मरा।';
  } else {
    result += 'कोई नहीं मरा।';
  }
  if (game.actions.detective) {
    const checkedRole = game.players[game.actions.detective].role === 'Mafia' ? 'Mafia है' : 'Mafia नहीं है';
    const detectiveID = Object.keys(game.players).find(id => game.players[id].role === 'Detective');
    api.sendMessage(`🔎 @${game.players[game.actions.detective].name} ${checkedRole}। ग्रुप में रिजल्ट देखो।`, detectiveID);
  }
  game.phase = 'day';
  game.votes = {};
  game.actions = { mafia: [], doctor: null, detective: null };
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
  api.sendMessage(result + '\n☀️ डे फेज शुरू! #mafia eliminate @user से वोट करो (3 मिनट)। 😎', threadID);
  setTimeout(() => {
    if (game.active) {
      const missing = Array.from(game.alive).filter(id => !game.votes[id]);
      if (missing.length > 0) {
        api.sendMessage(`🔔 @${missing.map(id => game.players[id].name).join(', ')}, 20 सेकंड में वोट करो, वरना काउंट नहीं होगा! 🎯`, threadID);
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
      result += `@${game.players[eliminated].name} को वोट से निकाला गया! वो ${game.players[eliminated].role} था।`;
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
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
  api.sendMessage(result, threadID);
}
