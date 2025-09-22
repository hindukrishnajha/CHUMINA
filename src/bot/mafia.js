// src/bot/mafia.js
const { botState } = require(path.join(__dirname, '../../config/botState'));
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

module.exports = { startMafiaGame, endMafiaGame };
