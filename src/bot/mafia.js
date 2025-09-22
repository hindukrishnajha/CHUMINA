// src/bot/mafia.js
const { botState } = require('../config/botState');

function cleanupMafiaGames() {
  Object.keys(botState.mafiaGames).forEach(gameID => {
    const game = botState.mafiaGames[gameID];
    if (!game.active || (Date.now() - game.lastActivity > 24 * 60 * 60 * 1000)) {
      delete botState.mafiaGames[gameID];
      console.log(`[DEBUG] Cleaned up inactive Mafia game: ${gameID}`);
    }
  });
}

module.exports = { cleanupMafiaGames };
