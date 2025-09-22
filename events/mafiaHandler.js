const fs = require('fs');
const path = require('path');
const { LEARNED_RESPONSES_PATH } = require('../config/constants');

function renderGamePage(req, res, botState) {
    const gameID = req.params.gameID;
    const game = botState.mafiaGames[gameID];
    
    if (!game || !game.active) {
        return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
    }

    res.render('loading', { gameID });
}

function handleAuth(req, res, botState) {
    const gameID = req.params.gameID;
    let userID = req.body.userID ? req.body.userID.trim() : '';
    const game = botState.mafiaGames[gameID];

    if (!game || !game.active) {
        return res.render('error', { message: '🚫 गेम नहीं मिला या खत्म हो चुका है! 🕉️' });
    }

    if (!userID || !game.players[userID]) {
        return res.render('error', { message: '🚫 गलत UID या यूजर गेम में नहीं है! 🕉️' });
    }

    res.redirect(`/mafia/${gameID}/role?uid=${userID}`);
}

function renderRolePage(req, res, botState) {
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
        Detective: { action: 'check', description: 'किसी की भूमिका जाँचने के लिए चुनें。 🔎' },
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
}

function handleAction(req, res, botState) {
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
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState, null, 2), 'utf8');
        console.log(`[MAFIA] Action recorded for ${userID} in game ${gameID}`);
    } catch (err) {
        console.error(`[MAFIA-ERROR] Failed to save action: ${err.message}`);
    }
    
    res.json({ success: true, message: '✅ एक्शन रजिस्टर हो गया! रिजल्ट नीचे देखें। 🕉️' });
}

module.exports = {
    renderGamePage,
    handleAuth,
    renderRolePage,
    handleAction
};
