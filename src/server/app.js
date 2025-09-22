// src/server/app.js
const express = require('express');
const path = require('path');
const { botState } = require('../config/botState');
const { sendBotMessage } = require('../bot/message');

function setupExpress(app) {
  // Middleware to parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files for Mafia game
  app.use('/mafia', express.static(path.join(__dirname, '../../public')));

  // Health check endpoint for Render
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Mafia game role view
  app.get('/mafia/:gameID', (req, res) => {
    const gameID = req.params.gameID;
    const userID = req.query.userID;

    if (!botState.mafiaGames[gameID]?.active) {
      return res.status(404).send(`
        <html>
          <body>
            <h1>Game Not Found</h1>
            <p>No active Mafia game found for this ID.</p>
          </body>
        </html>
      `);
    }

    const game = botState.mafiaGames[gameID];
    if (!game.players[userID]) {
      return res.status(403).send(`
        <html>
          <body>
            <h1>Access Denied</h1>
            <p>You are not a player in this game.</p>
          </body>
        </html>
      `);
    }

    const role = game.players[userID].role;
    res.send(`
      <html>
        <head>
          <title>Mafia Game - Role</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            .role { font-size: 24px; color: #d32f2f; }
            .phase { font-size: 18px; margin-top: 20px; }
            .action { margin-top: 20px; }
            select, button { padding: 10px; margin: 5px; }
          </style>
        </head>
        <body>
          <h1>Your Role: <span class="role">${role}</span></h1>
          <p class="phase">Current Phase: ${game.phase} (Day ${game.day})</p>
          <div class="action">
            ${role === 'Mafia' && game.phase === 'night' ? `
              <form action="/mafia/${gameID}/action" method="POST">
                <input type="hidden" name="userID" value="${userID}">
                <select name="targetID">
                  ${Array.from(game.alive)
                    .filter(id => id !== userID)
                    .map(id => `<option value="${id}">${game.players[id].name}</option>`)
                    .join('')}
                </select>
                <button type="submit">Kill</button>
              </form>
            ` : role === 'Doctor' && game.phase === 'night' ? `
              <form action="/mafia/${gameID}/action" method="POST">
                <input type="hidden" name="userID" value="${userID}">
                <select name="targetID">
                  ${Array.from(game.alive)
                    .map(id => `<option value="${id}">${game.players[id].name}</option>`)
                    .join('')}
                </select>
                <button type="submit">Save</button>
              </form>
            ` : role === 'Detective' && game.phase === 'night' ? `
              <form action="/mafia/${gameID}/action" method="POST">
                <input type="hidden" name="userID" value="${userID}">
                <select name="targetID">
                  ${Array.from(game.alive)
                    .filter(id => id !== userID)
                    .map(id => `<option value="${id}">${game.players[id].name}</option>`)
                    .join('')}
                </select>
                <button type="submit">Investigate</button>
              </form>
            ` : game.phase === 'day' ? `
              <form action="/mafia/${gameID}/vote" method="POST">
                <input type="hidden" name="userID" value="${userID}">
                <select name="targetID">
                  ${Array.from(game.alive)
                    .filter(id => id !== userID)
                    .map(id => `<option value="${id}">${game.players[id].name}</option>`)
                    .join('')}
                </select>
                <button type="submit">Vote to Eliminate</button>
              </form>
            ` : `<p>Waiting for next phase...</p>`}
          </div>
        </body>
      </html>
    `);
  });

  // Mafia game action
  app.post('/mafia/:gameID/action', (req, res) => {
    const gameID = req.params.gameID;
    const { userID, targetID } = req.body;

    if (!botState.mafiaGames[gameID]?.active) {
      return res.status(404).send('Game not found');
    }

    const game = botState.mafiaGames[gameID];
    if (!game.players[userID] || !game.alive.has(userID)) {
      return res.status(403).send('You are not a player or are not alive');
    }

    const role = game.players[userID].role;
    if (game.phase !== 'night') {
      return res.status(400).send('Actions can only be performed during the night phase');
    }

    if (role === 'Mafia') {
      game.actions.mafia = [targetID];
      sendBotMessage(
        Object.values(botState.sessions).find(session => session.api)?.api,
        `🕵️‍♂️ माफिया ने ${game.players[targetID].name} को टारगेट किया।`, 
        gameID
      );
    } else if (role === 'Doctor') {
      game.actions.doctor = targetID;
      sendBotMessage(
        Object.values(botState.sessions).find(session => session.api)?.api,
        `🩺 डॉक्टर ने ${game.players[targetID].name} को बचाने का फैसला किया।`, 
        gameID
      );
    } else if (role === 'Detective') {
      const investigatedRole = game.players[targetID].role;
      game.results[userID] = `🔍 ${game.players[targetID].name} का रोल है: ${investigatedRole}`;
      sendBotMessage(
        Object.values(botState.sessions).find(session => session.api)?.api,
        `🔍 डिटेक्टिव ने ${game.players[targetID].name} की जांच की: रोल है ${investigatedRole}`, 
        userID
      );
    }

    res.redirect(`/mafia/${gameID}?userID=${userID}`);
  });

  // Mafia game vote
  app.post('/mafia/:gameID/vote', (req, res) => {
    const gameID = req.params.gameID;
    const { userID, targetID } = req.body;

    if (!botState.mafiaGames[gameID]?.active) {
      return res.status(404).send('Game not found');
    }

    const game = botState.mafiaGames[gameID];
    if (!game.players[userID] || !game.alive.has(userID)) {
      return res.status(403).send('You are not a player or are not alive');
    }

    if (game.phase !== 'day') {
      return res.status(400).send('Voting can only be performed during the day phase');
    }

    if (!game.votes[targetID]) {
      game.votes[targetID] = new Set();
    }
    game.votes[targetID].add(userID);

    const voteCounts = Object.keys(game.votes).map(target => ({
      target,
      count: game.votes[target].size
    }));
    const maxVotes = Math.max(...voteCounts.map(v => v.count));
    const topVoted = voteCounts.find(v => v.count === maxVotes);

    if (topVoted && topVoted.count > game.alive.size / 2) {
      game.alive.delete(topVoted.target);
      sendBotMessage(
        Object.values(botState.sessions).find(session => session.api)?.api,
        `🗳️ ${game.players[topVoted.target].name} को बहुमत से बाहर कर दिया गया! 🕉️`, 
        gameID
      );
      game.votes = {};
      setTimeout(() => require('../bot/mafia').processNightPhase(
        Object.values(botState.sessions).find(session => session.api)?.api,
        gameID
      ), 30000);
    } else {
      sendBotMessage(
        Object.values(botState.sessions).find(session => session.api)?.api,
        `🗳️ ${game.players[userID].name} ने ${game.players[targetID].name} को वोट दिया।`, 
        gameID
      );
    }

    res.redirect(`/mafia/${gameID}?userID=${userID}`);
  });
}

module.exports = { setupExpress };
