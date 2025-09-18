const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');
const { MASTER_ID } = require('../../config/constants');

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function getAlivePlayers(game) {
  return game.players.filter(p => p.alive);
}

function formatPlayerList(game) {
  let alive = getAlivePlayers(game);
  return alive.length > 0 ? alive.map((p, i) => `${i + 1}) ${p.name}`).join("\n") : "कोई खिलाड़ी जीवित नहीं।";
}

function checkGameEnd(game) {
  let alive = getAlivePlayers(game);
  let mafiaCount = alive.filter(p => p.role === "Mafia" || p.role === "Werewolf").length;
  let villagerCount = alive.filter(p => p.role !== "Mafia" && p.role !== "Werewolf").length;
  if (mafiaCount === 0) return "विलेजर जीते! सारे माफिया मर गए।";
  if (mafiaCount >= villagerCount) return "माफिया जीता! उनकी संख्या विलेजरों से ज्यादा है।";
  return null;
}

module.exports = {
  name: 'mafia',
  description: "Mafia Game with Advanced Features",
  execute: async (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
    const senderID = event.senderID;
    const command = args[0]?.toLowerCase();
    const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || senderID === MASTER_ID);

    if (["begin", "next", "endvote", "stop", "reveal"].includes(command) && !isAdmin) {
      return api.sendMessage("🚫 यह कमांड सिर्फ एडमिन्स के लिए है! 🕉️", threadID);
    }

    let game = botState.mafiaGames[threadID];
    if (!game) {
      if (["start", "join", "status"].includes(command)) {
        if (command !== "start") return api.sendMessage("❌ कोई गेम नहीं चल रहा। #mafia start से शुरू करो।", threadID);
      } else {
        return api.sendMessage("❌ कोई गेम नहीं चल रहा।", threadID);
      }
    }

    if (command === "start") {
      if (game && game.active) {
        return api.sendMessage("❌ गेम पहले से चल रहा है! #mafia stop यूज करो।", threadID);
      }
      botState.mafiaGames[threadID] = {
        active: true,
        players: [],
        phase: "join",
        round: 0,
        mafiaKills: 0,
        mafiaTarget: null,
        doctorTarget: null,
        detectiveTarget: null,
        witchPoison: null,
        witchHeal: null,
        witchPoisonUsed: false,
        witchHealUsed: false,
        bodyguardTarget: null,
        mafiaChatID: null,
        votes: {},
        revealRoles: true,
        jokerFakeKill: null,
        jokerFakeKillUsed: false,
        log: [],
      };
      game = botState.mafiaGames[threadID];
      api.sendMessage("🎭 माफिया गेम शुरू! #mafia join टाइप करके शामिल हो। कम से कम 4 खिलाड़ी चाहिए।", threadID);
      return;
    }

    if (command === "join" && game.phase === "join") {
      if (game.players.find(p => p.id === senderID)) {
        return api.sendMessage("❌ तुम पहले से गेम में हो।", threadID);
      }
      api.getUserInfo(senderID, (err, ret) => {
        if (err || !ret || !ret[senderID]) {
          return api.sendMessage("⚠️ यूजर जानकारी नहीं मिली।", threadID);
        }
        const name = ret[senderID].name || "Unknown";
        game.players.push({ id: senderID, name, role: null, alive: true });
        api.sendMessage(`✅ ${name} गेम में शामिल हुआ!`, threadID);
      });
      return;
    }

    if (command === "begin" && game.phase === "join") {
      if (game.players.length < 4) {
        return api.sendMessage("❌ कम से कम 4 खिलाड़ी चाहिए।", threadID);
      }

      let playerCount = game.players.length;
      let mafiaCount = Math.floor(playerCount / 4);
      let doctorCount = Math.floor(playerCount / 5);
      let detectiveCount = playerCount >= 5 ? 1 : 0;
      let jokerCount = 1;
      let witchCount = playerCount > 10 ? 1 : 0;
      let bodyguardCount = playerCount > 15 ? 1 : 0;

      let shuffled = shuffle(game.players);
      let index = 0;
      // Assign Werewolf if possible
      for (let i = 0; i < mafiaCount; i++) {
        let role = (i === 0 && mafiaCount >= 2) ? "Werewolf" : "Mafia";
        shuffled[index++].role = role;
      }
      for (let i = 0; i < doctorCount; i++) shuffled[index++].role = "Doctor";
      if (detectiveCount) shuffled[index++].role = "Detective";
      if (witchCount) shuffled[index++].role = "Witch";
      if (bodyguardCount) shuffled[index++].role = "Bodyguard";
      if (jokerCount) shuffled[index++].role = "Joker";
      shuffled.slice(index).forEach(p => p.role = "Villager");

      // Store player game association
      game.players.forEach(p => {
        botState.playerGame[p.id] = threadID;
      });

      // Mafia/Werewolf chat
      if (mafiaCount > 1) {
        let mafiaIDs = game.players.filter(p => p.role === "Mafia" || p.role === "Werewolf").map(p => p.id);
        api.createChat(mafiaIDs, "Mafia Secret Chat", (err, chatThreadID) => {
          if (!err) {
            game.mafiaChatID = chatThreadID;
            api.sendMessage("☠️ माफिया, यहाँ रणनीति बनाओ और `/kill <नंबर>` से टारगेट चुनो।", chatThreadID);
          }
        });
      }

      // Send roles via PM
      for (let p of game.players) {
        let msg = `🎭 तुम्हारा रोल: ${p.role}\n\n`;
        if (p.role === "Mafia" || p.role === "Werewolf") msg += "☠️ /kill <नंबर> यूज करो।\n";
        if (p.role === "Doctor") msg += "💉 /save <नंबर> यूज करो।\n";
        if (p.role === "Detective") msg += "🔍 /check <नंबर> यूज करो।\n";
        if (p.role === "Witch") msg += "🧙‍♀️ /poison <नंबर> (एक बार) और /heal <नंबर> (एक बार) यूज करो।\n";
        if (p.role === "Bodyguard") msg += "🛡️ /protect <नंबर> यूज करो।\n";
        if (p.role === "Joker") msg += "🤡 तुम जोकर हो! वोट से निकलवाओ और जीतो। सावधान, माफिया तुम्हें मार सकता है! /fakekill <नंबर> (एक बार) यूज करो।\n";
        msg += "\nजीवित खिलाड़ी:\n" + formatPlayerList(game);
        api.sendMessage(msg, p.id);
        if (p.role === "Joker") {
          let randomJokerMsg = ["जोकर, आज किसे बेवकूफ बनाएगा? 🤡", "जोकर, वोट्स इकट्ठा करो, जीत तुम्हारी है! 😎"];
          api.sendMessage(randomJokerMsg[Math.floor(Math.random() * randomJokerMsg.length)], p.id);
        }
      }

      game.phase = "night";
      game.round = 1;
      api.sendMessage("🌙 नाइट 1 शुरू! माफिया, डॉक्टर, डिटेक्टिव, जादूगरनी, बॉडीगार्ड, जोकर अपने इनबॉक्स चेक करें।", threadID);
      setTimeout(() => {
        if (game.phase === "night") {
          api.sendMessage("⏰ नाइट टाइम खत्म! ऑटो रिजल्ट प्रोसेस हो रहा है।", threadID);
          module.exports.execute(api, threadID, ["next"], event, botState, isMaster, botID, stopBot);
        }
      }, 60000); // 60 seconds
      return;
    }

    if (command === "next" && game.phase === "night") {
      let killedPlayers = Array.isArray(game.mafiaTarget) ? game.mafiaTarget : [game.mafiaTarget];
      if (game.witchPoison) killedPlayers.push(game.witchPoison);
      let saved = game.doctorTarget || game.witchHeal;
      let msg = `🌙 नाइट ${game.round} रिजल्ट:\n`;

      // Bodyguard check
      if (game.bodyguardTarget && killedPlayers.includes(game.bodyguardTarget)) {
        let bodyguard = game.players.find(p => p.role === "Bodyguard");
        bodyguard.alive = false;
        killedPlayers = killedPlayers.filter(id => id !== game.bodyguardTarget);
        msg += `🛡️ बॉडीगार्ड ने ${game.players.find(p => p.id === game.bodyguardTarget).name} को बचा लिया, लेकिन खुद मर गया!\n`;
      }

      // Joker fakekill check
      if (game.jokerFakeKill && killedPlayers.includes(game.jokerFakeKill)) {
        killedPlayers = killedPlayers.filter(id => id !== game.jokerFakeKill);
        msg += `🤡 जोकर ने किल फेल कर दिया! (फेक किल सफल)\n`;
      }

      let killed = killedPlayers.filter(id => id && id !== saved);
      killed.forEach(id => {
        let killedPlayer = game.players.find(p => p.id === id);
        if (killedPlayer) {
          killedPlayer.alive = false;
          game.log.push(`☠️ राउंड ${game.round}: ${killedPlayer.name} मारा गया`);
          game.mafiaKills++;
          msg += `💀 माफिया ने ${killedPlayer.name} को मार दिया!${game.revealRoles ? ` (${killedPlayer.role} था)` : ""}\n`;
        }
      });
      if (killedPlayers.length > 0 && killed.length === 0) {
        msg += `💉 ${game.players.find(p => p.id === saved).name} को बचाया गया!\n`;
      }
      if (!killedPlayers.length) {
        msg += "कोई नहीं मरा।\n";
      }

      // Reset night targets
      game.mafiaTarget = null;
      game.doctorTarget = null;
      game.detectiveTarget = null;
      game.witchPoison = null;
      game.witchHeal = null;
      game.bodyguardTarget = null;
      game.jokerFakeKill = null;
      game.jokerFakeKillUsed = true; // Mark as used if applied

      let gameEnd = checkGameEnd(game);
      if (gameEnd) {
        msg += `\n🎮 गेम ओवर: ${gameEnd}\n`;
        msg += `📜 गेम लॉग:\n${game.log.join("\n")}\n`;
        msg += `🏆 माफिया किल्स: ${game.mafiaKills}`;
        let winners;
        if (gameEnd.includes("विलेजर")) {
          winners = getAlivePlayers(game).filter(p => p.role !== "Mafia" && p.role !== "Werewolf");
        } else {
          winners = getAlivePlayers(game).filter(p => p.role === "Mafia" || p.role === "Werewolf");
        }
        winners.forEach(p => {
          botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + 5;
        });
        game.players.filter(p => p.role === "Mafia" || p.role === "Werewolf").forEach(p => {
          botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + game.mafiaKills * 10;
        });
        // Save leaderboard and jokerWins
        botState.learnedResponses.leaderboard = botState.leaderboard;
        botState.learnedResponses.jokerWins = botState.jokerWins;
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
        let leaderboardMsg = `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).slice(0, 10).map(([id, points]) => {
          let name = game.players.find(p => p.id === id)?.name || id;
          return `${name}: ${points} पॉइंट्स`;
        }).join("\n")}`;
        msg += leaderboardMsg;
        // Stop game
        game.players.forEach(p => delete botState.playerGame[p.id]);
        delete botState.mafiaGames[threadID];
        api.sendMessage(msg, threadID);
        return;
      }

      game.phase = "day";
      msg += `\n☀️ डे ${game.round} शुरू!\nजीवित खिलाड़ी:\n${formatPlayerList(game)}\nचर्चा करें और #mafia vote <नंबर> से वोट करें।`;
      api.sendMessage(msg, threadID);
      setTimeout(() => {
        if (game.phase === "day") {
          api.sendMessage("⏰ डे टाइम खत्म! ऑटो वोट रिजल्ट प्रोसेस हो रहा है।", threadID);
          module.exports.execute(api, threadID, ["endvote"], event, botState, isMaster, botID, stopBot);
        }
      }, 60000);
      return;
    }

    if ((command === "vote" || command === "doublevote") && game.phase === "day") {
      let choice = args[1];
      let target = null;
      let alive = getAlivePlayers(game);
      if (choice) {
        if (!isNaN(choice)) {
          target = alive[parseInt(choice) - 1];
        } else {
          target = alive.find(p => p.name.toLowerCase() === choice.toLowerCase() || p.id === choice);
        }
      }
      if (!target) return api.sendMessage("❌ गलत टारगेट। जीवित लिस्ट देखो।", threadID);

      let voteCount = 1;
      let isDouble = command === "doublevote";
      if (isDouble && game.players.find(p => p.id === senderID).role !== "Joker") {
        return api.sendMessage("🚫 सिर्फ जोकर doublevote कर सकता है! #mafia vote <नंबर> यूज करो।", threadID);
      }
      if (isDouble) voteCount = 2;

      api.getUserInfo(senderID, (err, ret) => {
        if (err || !ret || !ret[senderID]) {
          return api.sendMessage("⚠️ यूजर जानकारी नहीं मिली।", threadID);
        }
        const voterName = ret[senderID].name || "Unknown";
        game.votes[target.id] = (game.votes[target.id] || 0) + voteCount;
        let voteType = isDouble ? "डबल वोट" : "वोट";
        api.sendMessage(`${voteType} दिया ${voterName} ने ${target.name} को! कुल वोट्स: ${game.votes[target.id]}`, threadID);
      });
      return;
    }

    if (command === "endvote" && game.phase === "day") {
      let maxVotes = 0;
      let eliminated = null;
      for (let id in game.votes) {
        if (game.votes[id] > maxVotes) {
          maxVotes = game.votes[id];
          eliminated = game.players.find(p => p.id === id);
        }
      }
      let aliveCount = getAlivePlayers(game).length;
      let msg = `☀️ डे ${game.round} वोटिंग रिजल्ट:\n`;
      if (eliminated && maxVotes > aliveCount / 2) {
        eliminated.alive = false;
        game.log.push(`🗳️ राउंड ${game.round}: ${eliminated.name} वोट से निकाला गया`);
        msg += `💀 वोट से ${eliminated.name} को निकाला गया!${game.revealRoles ? ` (${eliminated.role} था)` : ""}\n`;
        if (eliminated.role === "Joker") {
          msg += `🤡 हा हा! ${eliminated.name} जोकर था और उसने सबको बेवकूफ बनाया! जोकर जीत गया, गेम ओवर!\n`;
          msg += `📜 गेम लॉग:\n${game.log.join("\n")}\n`;
          msg += `🏆 माफिया किल्स: ${game.mafiaKills}`;
          botState.leaderboard[eliminated.id] = (botState.leaderboard[eliminated.id] || 0) + 20;
          botState.jokerWins[eliminated.id] = (botState.jokerWins[eliminated.id] || 0) + 1;
          if (botState.jokerWins[eliminated.id] === 3) {
            msg += `\n👑 ${eliminated.name} जोकर किंग बन गया! 🤡`;
          }
          // Save
          botState.learnedResponses.leaderboard = botState.leaderboard;
          botState.learnedResponses.jokerWins = botState.jokerWins;
          fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
          let leaderboardMsg = `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).slice(0, 10).map(([id, points]) => {
            let name = game.players.find(p => p.id === id)?.name || id;
            return `${name}: ${points} पॉइंट्स`;
          }).join("\n")}`;
          msg += leaderboardMsg;
          // Stop game
          game.players.forEach(p => delete botState.playerGame[p.id]);
          delete botState.mafiaGames[threadID];
          api.sendMessage(msg, threadID);
          return;
        }
      } else {
        msg += `🛡️ कोई बहुमत नहीं मिला, कोई नहीं निकला।\n`;
      }

      let gameEnd = checkGameEnd(game);
      if (gameEnd) {
        msg += `\n🎮 गेम ओवर: ${gameEnd}\n`;
        msg += `📜 गेम लॉग:\n${game.log.join("\n")}\n`;
        msg += `🏆 माफिया किल्स: ${game.mafiaKills}`;
        let winners;
        if (gameEnd.includes("विलेजर")) {
          winners = getAlivePlayers(game).filter(p => p.role !== "Mafia" && p.role !== "Werewolf");
        } else {
          winners = getAlivePlayers(game).filter(p => p.role === "Mafia" || p.role === "Werewolf");
        }
        winners.forEach(p => {
          botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + 5;
        });
        game.players.filter(p => p.role === "Mafia" || p.role === "Werewolf").forEach(p => {
          botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + game.mafiaKills * 10;
        });
        // Save
        botState.learnedResponses.leaderboard = botState.leaderboard;
        botState.learnedResponses.jokerWins = botState.jokerWins;
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
        let leaderboardMsg = `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).slice(0, 10).map(([id, points]) => {
          let name = game.players.find(p => p.id === id)?.name || id;
          return `${name}: ${points} पॉइंट्स`;
        }).join("\n")}`;
        msg += leaderboardMsg;
        // Stop game
        game.players.forEach(p => delete botState.playerGame[p.id]);
        delete botState.mafiaGames[threadID];
        api.sendMessage(msg, threadID);
        return;
      }

      game.votes = {};
      game.round++;
      game.phase = "night";
      api.sendMessage(`🌙 नाइट ${game.round} शुरू!\nजीवित खिलाड़ी:\n${formatPlayerList(game)}`, threadID);
      setTimeout(() => {
        if (game.phase === "night") {
          api.sendMessage("⏰ नाइट टाइम खत्म! ऑटो रिजल्ट प्रोसेस हो रहा है।", threadID);
          module.exports.execute(api, threadID, ["next"], event, botState, isMaster, botID, stopBot);
        }
      }, 60000);
      return;
    }

    if (command === "reveal" && isAdmin) {
      game.revealRoles = args[1]?.toLowerCase() === "on";
      api.sendMessage(`🕵️‍♂️ रोल रिवील ${game.revealRoles ? "चालू" : "बंद"} कर दिया गया।`, threadID);
      return;
    }

    if (command === "stop") {
      if (!game.active) {
        return api.sendMessage("❌ कोई गेम नहीं चल रहा।", threadID);
      }
      game.players.forEach(p => delete botState.playerGame[p.id]);
      delete botState.mafiaGames[threadID];
      api.sendMessage("🛑 माफिया गेम बंद।", threadID);
      return;
    }

    if (command === "status") {
      if (!game.active) {
        return api.sendMessage("❌ कोई गेम नहीं चल रहा।", threadID);
      }
      let msg = `🎭 माफिया गेम स्टेटस:\nफेज: ${game.phase}\nराउंड: ${game.round}\nजीवित खिलाड़ी:\n${formatPlayerList(game)}\nमाफिया किल्स: ${game.mafiaKills}`;
      api.sendMessage(msg, threadID);
      return;
    }

    api.sendMessage("❌ गलत कमांड। यूज: #mafia [start|join|begin|next|vote <नंबर>|doublevote <नंबर>|endvote|stop|status|reveal on/off]", threadID);
  },
  handleEvent: async ({ api, event, botState }) => {
    const senderID = event.senderID;
    const body = event.body?.trim();
    if (!body || event.threadID === senderID) return; // Only PM (!isGroup)

    const gameThread = botState.playerGame[senderID];
    if (!gameThread) return;

    const game = botState.mafiaGames[gameThread];
    if (!game || !game.active || game.phase !== "night") return;

    let player = game.players.find(p => p.id === senderID && p.alive);
    if (!player) return;

    let args = body.split(" ");
    let cmd = args[0].toLowerCase();
    let choice = args[1];

    let target = null;
    if (choice) {
      let alive = getAlivePlayers(game);
      if (!isNaN(choice)) {
        target = alive[parseInt(choice) - 1];
      } else {
        target = alive.find(p => p.name.toLowerCase() === choice.toLowerCase() || p.id === choice);
      }
      if (!target) return api.sendMessage("❌ गलत टारगेट। जीवित लिस्ट चेक करो।", senderID);
    }

    if ((player.role === "Mafia" || player.role === "Werewolf") && cmd === "/kill") {
      if (player.role === "Werewolf" && game.round % 3 === 0 && args[2]) {
        let target2Id = args[2];
        let target2 = getAlivePlayers(game).find(p => p.id === target2Id || p.name.toLowerCase() === target2Id.toLowerCase());
        if (target && target2 && target.id !== target2.id) {
          game.mafiaTarget = [target.id, target2.id];
          api.sendMessage(`🐺 वेयरवुल्फ ने ${target.name} और ${target2.name} को चुना।`, senderID);
          return;
        } else {
          return api.sendMessage("❌ दो अलग टारगेट चुनो।", senderID);
        }
      } else if (target) {
        game.mafiaTarget = target.id;
        api.sendMessage(`☠️ ${player.role} ने ${target.name} को चुना।`, senderID);
      } else {
        return api.sendMessage("❌ टारगेट चुनो: /kill <नंबर या नाम>", senderID);
      }
    } else if (player.role === "Doctor" && cmd === "/save") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.doctorTarget = target.id;
      api.sendMessage(`💉 डॉक्टर ने ${target.name} को बचाने की कोशिश की।`, senderID);
    } else if (player.role === "Detective" && cmd === "/check") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.detectiveTarget = target.id;
      let targetPlayer = game.players.find(p => p.id === target.id);
      let result = (targetPlayer.role === "Mafia" || targetPlayer.role === "Werewolf")
        ? `❌ ${target.name} माफिया है!`
        : `✅ ${target.name} माफिया नहीं है।`;
      api.sendMessage(`🔍 डिटेक्टिव रिजल्ट: ${result}`, senderID);
    } else if (player.role === "Witch" && cmd === "/poison" && !game.witchPoisonUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.witchPoison = target.id;
      game.witchPoisonUsed = true;
      api.sendMessage(`🧙‍♀️ जादूगरनी ने ${target.name} को ज़हर दिया।`, senderID);
    } else if (player.role === "Witch" && cmd === "/heal" && !game.witchHealUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.witchHeal = target.id;
      game.witchHealUsed = true;
      api.sendMessage(`🧙‍♀️ जादूगरनी ने ${target.name} को बचाया।`, senderID);
    } else if (player.role === "Bodyguard" && cmd === "/protect") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.bodyguardTarget = target.id;
      api.sendMessage(`🛡️ बॉडीगार्ड ने ${target.name} को प्रोटेक्ट किया।`, senderID);
    } else if (player.role === "Joker" && cmd === "/fakekill" && !game.jokerFakeKillUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", senderID);
      game.jokerFakeKill = target.id;
      api.sendMessage(`🤡 जोकर ने ${target.name} को फेक किल चुना।`, senderID);
    } else {
      api.sendMessage("❌ गलत कमांड या रोल मैच नहीं। अपने रोल के अनुसार यूज करो।", senderID);
    }
  }
};
