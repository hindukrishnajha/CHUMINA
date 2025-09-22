// src/bot/mafia.js
const { botState } = require(path.join(__dirname, '../config/botState'));
const { sendBotMessage } = require('./message');

function startMafiaGame(api, threadID, messageID, args) {
  if (botState.mafiaGames[threadID]?.active) {
    sendBotMessage(api, '🚫 पहले से एक माफिया गेम चल रहा है! 🕉️', threadID, messageID);
    return;
  }

  const players = args.map(id => ({ id, role: null, name: `Player_${id}` }));
  if (players.length < 4) {
    sendBotMessage(api, '❌ माफिया गेम के लिए कम से कम 4 प्लेयर्स चाहिए! 🕉️', threadID, messageID);
    return;
  }

  const roles = ['Mafia', 'Doctor', 'Detective', ...Array(players.length - 3).fill('Villager')];
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  const game = {
    active: true,
    players: {},
    alive: new Set(),
    phase: 'night',
    actions: {},
    results: {},
    votes: {},
    day: 0
  };

  players.forEach((player, index) => {
    game.players[player.id] = { role: roles[index], name: player.name };
    game.alive.add(player.id);
  });

  botState.mafiaGames[threadID] = game;

  const gameID = threadID;
  const gameUrl = `https://${process.env.RENDER_SERVICE_NAME}.onrender.com/mafia/${gameID}`;
  sendBotMessage(api, `🎮 माफिया गेम शुरू! अपने रोल देखने के लिए यहाँ जाएँ: ${gameUrl}\nप्लेयर्स: ${players.map(p => p.name).join(', ')} 🕉️`, threadID, messageID);

  console.log(`[MAFIA] Game started in thread ${threadID} with players: ${JSON.stringify(players)}`);

  setTimeout(() => processDayPhase(api, threadID), 180000); // 3 minutes for night phase
}

function processDayPhase(api, threadID) {
  const game = botState.mafiaGames[threadID];
  if (!game || !game.active) return;

  game.phase = 'day';
  game.day += 1;

  const mafiaTarget = game.actions.mafia && game.actions.mafia.length > 0 ? game.actions.mafia[0] : null;
  const doctorSave = game.actions.doctor || null;
  let eliminated = null;

  if (mafiaTarget && mafiaTarget !== doctorSave) {
    game.alive.delete(mafiaTarget);
    eliminated = mafiaTarget;
    sendBotMessage(api, `☠️ ${game.players[mafiaTarget].name || `Player_${mafiaTarget}`} माफिया द्वारा मार दिया गया! 🕉️`, threadID);
  } else if (mafiaTarget && mafiaTarget === doctorSave) {
    sendBotMessage(api, `🩺 ${game.players[mafiaTarget].name || `Player_${mafiaTarget}`} को डॉक्टर ने बचा लिया! 🕉️`, threadID);
  }

  game.actions = {};
  game.results = {};

  const alivePlayers = Array.from(game.alive).map(id => ({ id, name: game.players[id].name }));
  sendBotMessage(api, `🌞 डे फेज ${game.day} शुरू! वोट करें कि किसे बाहर करना है। बचे प्लेयर्स: ${alivePlayers.map(p => p.name).join(', ')} 🕉️`, threadID);

  setTimeout(() => processNightPhase(api, threadID), 180000); // 3 minutes for day phase
}

function processNightPhase(api, threadID) {
  const game = botState.mafiaGames[threadID];
  if (!game || !game.active) return;

  game.phase = 'night';

  const mafiaCount = Object.values(game.players).filter(p => p.role === 'Mafia' && game.alive.has(p.id)).length;
  const villagerCount = Object.values(game.players).filter(p => p.role !== 'Mafia' && game.alive.has(p.id)).length;

  if (mafiaCount === 0) {
    sendBotMessage(api, '🏆 विलेजर्स जीत गए! माफिया खत्म! 🕉️', threadID);
    delete botState.mafiaGames[threadID];
    return;
  } else if (mafiaCount >= villagerCount) {
    sendBotMessage(api, '🏆 माफिया जीत गया! गेम खत्म! 😈', threadID);
    delete botState.mafiaGames[threadID];
    return;
  }

  sendBotMessage(api, `🌙 नाइट फेज ${game.day + 1} शुरू! अपने रोल के हिसाब से एक्शन लें: https://${process.env.RENDER_SERVICE_NAME}.onrender.com/mafia/${threadID} 🕉️`, threadID);
  setTimeout(() => processDayPhase(api, threadID), 180000); // 3 minutes for night phase
}

function endMafiaGame(api, threadID, messageID) {
  if (!botState.mafiaGames[threadID]?.active) {
    sendBotMessage(api, '🚫 कोई माफिया गेम चल नहीं रहा! 🕉️', threadID, messageID);
    return;
  }

  delete botState.mafiaGames[threadID];
  sendBotMessage(api, '🏁 माफिया गेम खत्म हो गया! 🕉️', threadID, messageID);
  console.log(`[MAFIA] Game ended in thread ${threadID}`);
}

module.exports = { startMafiaGame, endMafiaGame, processDayPhase, processNightPhase };
