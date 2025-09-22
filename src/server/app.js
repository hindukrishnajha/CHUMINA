// src/server/app.js
const express = require('express');
const path = require('path');
const timeout = require('connect-timeout');
const fs = require('fs');
const { botState } = require(path.join(__dirname, '../../config/botState')); // Explicit path

const app = express();
const PORT = process.env.PORT || 3000;

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../views'));

app.use(timeout('60s'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../public')));

// Mafia game routes
app.get('/mafia/:gameID', (req, res) => {
  const gameID = req.params.gameID;
  const game = botState.mafiaGames[gameID];

  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  res.render('loading', { gameID });
});

app.post('/mafia/:gameID/auth', (req, res) => {
  const gameID = req.params.gameID;
  let userID = req.body.userID ? req.body.userID.trim() : '';
  const game = botState.mafiaGames[gameID];

  console.log(`[DEBUG] Auth request: gameID=${gameID}, userID=${userID}, players keys=${JSON.stringify(Object.keys(game.players || {}))}`);

  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID]) {
    return res.render('error', { message: '🚫 गलत UID या यूजर गेम में नहीं है! 🕉️' });
  }

  res.redirect(`/mafia/${gameID}/role?uid=${userID}`);
});

app.get('/mafia/:gameID/role', (req, res) => {
  const gameID = req.params.gameID;
  const userID = req.query.uid;
  const game = botState.mafiaGames[gameID];

  if (!game || !game.active) {
    return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID]) {
    return res.render('error', { message: '🚫 गलत UID या यूजर गेम में नहीं है! 🕉️' });
  }

  const player = game.players[userID];
  const isAlive = game.alive.has(userID);
  const roleActions = {
    Mafia: { action: 'eliminate', description: 'किसी को मारने के लिए चुनें। 😈' },
    Doctor: { action: 'save', description: 'किसी को बचाने के लिए चुनें। 🩺' },
    Detective: { action: 'check', description: 'किसी की भूमिका जाँचने के लिए चुनें। 🔎' },
    Villager: { action: null, description: 'आपका काम यहाँ नहीं, ग्रुप में है। ग्रुप में रहकर अपने दिमाग से पता लगाओ माफिया कौन है और सबको convince करो कि ये माफिया हो सकता है ताकि सब वोट देकर उसे eliminate कर दें। 🧑' }
  };
  const currentAction = roleActions[player.role];

  const validPlayers = Object.keys(game.players)
    .filter(id => id !== userID && game.alive.has(id))
    .map(id => ({ id, name: game.players[id].name || `Player_${id}` }));

  const actionResult = game.results && game.results[userID] ? game.results[userID] : null;

  res.render('role', {
    gameID,
    userID,
    role: player.role,
    name: player.name || `Player_${userID}`,
    isAlive,
    phase: game.phase,
    action: currentAction.action,
    actionDescription: currentAction.description,
    players: validPlayers,
    botState,
    message: actionResult || null
  });
});

app.post('/mafia/:gameID/action', (req, res) => {
  const gameID = req.params.gameID;
  const userID = req.body.userID;
  const targetID = req.body.targetID;
  const game = botState.mafiaGames[gameID];

  if (!game || !game.active) {
    return res.json({ success: false, message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
  }

  if (!userID || !game.players[userID] || !game.alive.has(userID)) {
    return res.json({ success: false, message: '🚫 यूजर गेम में नहीं है या मर चुका है! 🕉️' });
  }

  if (game.phase !== 'night') {
    return res.json({ success: false, message: '🚫 अभी नाइट फेज नहीं है! 🕉️' });
  }

  const player = game.players[userID];
  game.results = game.results || {};

  if (player.role === 'Mafia') {
    game.actions.mafia = game.actions.mafia || [];
    game.actions.mafia.push(targetID);
    game.results[userID] = `😈 तुमने ${game.players[targetID].name || `Player_${targetID}`} को मारने का प्लान बनाया।`;
  } else if (player.role === 'Doctor') {
    game.actions.doctor = targetID;
    game.results[userID] = `🩺 आपने ${game.players[targetID].name || `Player_${targetID}`} को आज रात के लिए save कर दिया। आज माफिया इसे नहीं मार पाएगा।`;
  } else if (player.role === 'Detective') {
    const checkedRole = game.players[targetID].role === 'Mafia' ? 'Mafia है' : 'Mafia नहीं है';
    game.actions.detective = targetID;
    game.results[userID] = `🔎 ${game.players[targetID].name || `Player_${targetID}`} ${checkedRole}।`;
  } else {
    return res.json({ success: false, message: '🚫 गलत एक्शन या रोल! 🕉️' });
  }

  try {
    const fs = require('fs');
    const { LEARNED_RESPONSES_PATH } = require(path.join(__dirname, '../../config/constants'));
    fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
    console.log(`[DEBUG] Action recorded for ${userID} in game ${gameID}`);
  } catch (err) {
    console.error(`[ERROR] Failed to save action state: ${err.message}`);
  }
  res.json({ success: true, message: '✅ एक्शन रजिस्टर हो गया! रिजल्ट नीचे देखें। 🕉️' });
});

app.get('/', (req, res) => {
  if (req.timedout) return res.status(504).send('Server timeout');
  const filePath = path.join(__dirname, '../../index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Cannot GET: index.html not found.');
  }
});

app.get('/health', (req, res) => {
  const firstSession = Object.values(botState.sessions)[0];
  const status = firstSession?.safeMode ? 'SAFE MODE (ID Protected)' : 'active';
  res.status(200).json({
    status: status,
    bot: 'शेलेन्द्र हिन्दू का गुलाम राम किशोर बोट नम्बर 1',
    version: '10.0.0',
    activeSessions: Object.keys(botState.sessions).length
  });
});

app.get('/keepalive', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  return server;
}

module.exports = { startServer };
