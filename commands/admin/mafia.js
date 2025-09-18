const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports.config = {
  name: "mafia",
  version: "2.1.0",
  permission: 0,
  prefix: true,
  credits: "Shalender + GPT",
  description: "Mafia Game with Advanced Features",
  category: "game",
  usages: "mafia start",
  cooldowns: 5,
};

const mafiaGame = {
  active: false,
  players: [], // {id, name, role, alive}
  phase: "idle", // join | night | day | end
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

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function getAlivePlayers() {
  return mafiaGame.players.filter(p => p.alive);
}

function formatPlayerList() {
  let alive = getAlivePlayers();
  return alive.length > 0 ? alive.map((p, i) => `${i + 1}) ${p.name}`).join("\n") : "कोई खिलाड़ी जीवित नहीं।";
}

function checkGameEnd() {
  let alive = getAlivePlayers();
  let mafiaCount = alive.filter(p => p.role === "Mafia").length;
  let villagerCount = alive.filter(p => p.role !== "Mafia" && p.role !== "Joker").length;
  if (mafiaCount === 0) return "विलेजर जीते! सारे माफिया मर गए।";
  if (mafiaCount >= villagerCount) return "माफिया जीता! उनकी संख्या विलेजरों से ज्यादा है।";
  return null;
}

module.exports.handleEvent = async function ({ api, event, botState }) {
  if (!mafiaGame.active) return;

  const body = event.body?.trim();
  if (!body) return;

  if (event.isGroup === false && mafiaGame.phase === "night") {
    let player = mafiaGame.players.find(p => p.id === event.senderID && p.alive);
    if (!player) return;

    let args = body.split(" ");
    let cmd = args[0].toLowerCase();
    let choice = args[1];

    let target = null;
    if (choice) {
      let alive = getAlivePlayers();
      if (!isNaN(choice)) {
        target = alive[parseInt(choice) - 1];
      } else {
        target = alive.find(p => p.name.toLowerCase() === choice?.toLowerCase() || p.id === choice);
      }
    }

    if (player.role === "Mafia" && cmd === "/kill") {
      if (target) {
        mafiaGame.mafiaTarget = target.id;
        api.sendMessage(`☠️ माफिया ने ${target.name} को चुना।`, event.threadID);
      }
    }

    if (player.role === "Doctor" && cmd === "/save") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.doctorTarget = target.id;
      api.sendMessage(`💉 डॉक्टर ने ${target.name} को बचाने की कोशिश की।`, player.id);
    }

    if (player.role === "Detective" && cmd === "/check") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.detectiveTarget = target.id;
      let result = mafiaGame.players.find(p => p.id === target.id).role === "Mafia"
        ? `❌ ${target.name} माफिया है!`
        : `✅ ${target.name} माफिया नहीं है।`;
      api.sendMessage(`🔍 डिटेक्टिव रिजल्ट: ${result}`, player.id);
    }

    if (player.role === "Witch" && cmd === "/poison" && !mafiaGame.witchPoisonUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.witchPoison = target.id;
      mafiaGame.witchPoisonUsed = true;
      api.sendMessage(`🧙‍♀️ जादूगरनी ने ${target.name} को ज़हर दिया।`, player.id);
    }

    if (player.role === "Witch" && cmd === "/heal" && !mafiaGame.witchHealUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.witchHeal = target.id;
      mafiaGame.witchHealUsed = true;
      api.sendMessage(`🧙‍♀️ जादूगरनी ने ${target.name} को बचाया।`, player.id);
    }

    if (player.role === "Bodyguard" && cmd === "/protect") {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.bodyguardTarget = target.id;
      api.sendMessage(`🛡️ बॉडीगार्ड ने ${target.name} को प्रोटेक्ट किया।`, player.id);
    }

    if (player.role === "Joker" && cmd === "/fakekill" && !mafiaGame.jokerFakeKillUsed) {
      if (!target) return api.sendMessage("❌ गलत टारगेट।", player.id);
      mafiaGame.jokerFakeKill = target.id;
      mafiaGame.jokerFakeKillUsed = true;
      api.sendMessage(`🤡 जोकर ने ${target.name} को फेक किल किया।`, player.id);
    }
  }
};

module.exports.run = async function ({ api, event, args, botState }) {
  const threadID = event.threadID;
  const senderID = event.senderID;
  const command = args[0]?.toLowerCase();
  const isAdmin = botState.adminList?.includes(senderID) || senderID === botState.sessions[Object.keys(botState.sessions)[0]]?.botID;

  if (botState.commandCooldowns[threadID]?.[command]) {
    return api.sendMessage("❌ कूलडाउन: 10 सेकंड रुको।", threadID);
  }

  if (["begin", "next", "endvote", "stop", "reveal"].includes(command) && !isAdmin) {
    return api.sendMessage("🚫 यह कमांड सिर्फ एडमिन्स के लिए है! 🕉️", threadID);
  }

  if (command === "start") {
    if (mafiaGame.active) {
      return api.sendMessage("❌ गेम पहले से चल रहा है! #mafia stop यूज करो।", threadID);
    }
    mafiaGame.active = true;
    mafiaGame.players = [];
    mafiaGame.phase = "join";
    mafiaGame.round = 0;
    mafiaGame.mafiaKills = 0;
    mafiaGame.mafiaTarget = null;
    mafiaGame.doctorTarget = null;
    mafiaGame.detectiveTarget = null;
    mafiaGame.witchPoison = null;
    mafiaGame.witchHeal = null;
    mafiaGame.witchPoisonUsed = false;
    mafiaGame.witchHealUsed = false;
    mafiaGame.bodyguardTarget = null;
    mafiaGame.mafiaChatID = null;
    mafiaGame.votes = {};
    mafiaGame.revealRoles = true;
    mafiaGame.jokerFakeKill = null;
    mafiaGame.jokerFakeKillUsed = false;
    mafiaGame.log = [];
    api.sendMessage("🎭 माफिया गेम शुरू! #join टाइप करके शामिल हो। कम से कम 4 खिलाड़ी चाहिए।", threadID);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "join" && mafiaGame.phase === "join") {
    if (mafiaGame.players.find(p => p.id === senderID)) {
      return api.sendMessage("❌ तुम पहले से गेम में हो।", threadID);
    }
    api.getUserInfo(senderID, (err, ret) => {
      if (err || !ret || !ret[senderID]) {
        return api.sendMessage("⚠️ यूजर जानकारी नहीं मिली।", threadID);
      }
      const name = ret[senderID].name || "Unknown";
      mafiaGame.players.push({ id: senderID, name, role: null, alive: true });
      api.sendMessage(`✅ ${name} गेम में शामिल हुआ!`, threadID);
      botState.commandCooldowns[threadID] = { [command]: true };
      setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    });
    return;
  }

  if (command === "begin" && mafiaGame.phase === "join") {
    if (mafiaGame.players.length < 4) {
      return api.sendMessage("❌ कम से कम 4 खिलाड़ी चाहिए।", threadID);
    }

    let playerCount = mafiaGame.players.length;
    let mafiaCount = Math.floor(playerCount / 4) || 1;
    let doctorCount = Math.floor(playerCount / 5) || 1;
    let detectiveCount = playerCount >= 5 ? 1 : 0;
    let jokerCount = 1;
    let witchCount = playerCount > 10 ? 1 : 0;
    let bodyguardCount = playerCount > 15 ? 1 : 0;

    let shuffled = shuffle(mafiaGame.players);
    let index = 0;
    for (let i = 0; i < mafiaCount; i++) shuffled[index++].role = "Mafia";
    for (let i = 0; i < doctorCount; i++) shuffled[index++].role = "Doctor";
    if (detectiveCount) shuffled[index++].role = "Detective";
    if (witchCount) shuffled[index++].role = "Witch";
    if (bodyguardCount) shuffled[index++].role = "Bodyguard";
    if (jokerCount) shuffled[index++].role = "Joker";
    shuffled.slice(index).forEach(p => p.role = "Villager");

    if (mafiaCount > 1) {
      let mafiaIDs = mafiaGame.players.filter(p => p.role === "Mafia").map(p => p.id);
      api.createChat(mafiaIDs, "Mafia Secret Chat", (err, chatThreadID) => {
        if (!err) {
          mafiaGame.mafiaChatID = chatThreadID;
          api.sendMessage("☠️ माफिया, यहाँ रणनीति बनाओ और `/kill <नंबर>` से टारगेट चुनो।", chatThreadID);
        }
      });
    }

    for (let p of shuffled) {
      let msg = `🎭 तुम्हारा रोल: ${p.role}\n\n`;
      if (p.role === "Mafia") msg += "☠️ /kill <नंबर> यूज करो।\n";
      if (p.role === "Doctor") msg += "💉 /save <नंबर> यूज करो।\n";
      if (p.role === "Detective") msg += "🔍 /check <नंबर> यूज करो।\n";
      if (p.role === "Witch") msg += "🧙‍♀️ /poison <नंबर> (एक बार) और /heal <नंबर> (एक बार) यूज करो।\n";
      if (p.role === "Bodyguard") msg += "🛡️ /protect <नंबर> यूज करो।\n";
      if (p.role === "Joker") msg += "🤡 तुम जोकर हो! वोट से निकलवाओ और जीतो। /fakekill <नंबर> (एक बार) और #mafia doublevote <नंबर> यूज करो।\n";
      msg += "\nजीवित खिलाड़ी:\n" + formatPlayerList();
      api.sendMessage(msg, p.id);
      if (p.role === "Joker") {
        let randomJokerMsg = ["जोकर, आज किसे बेवकूफ बनाएगा? 🤡", "जोकर, वोट्स इकट्ठा करो, जीत तुम्हारी है! 😎"];
        api.sendMessage(randomJokerMsg[Math.floor(Math.random() * randomJokerMsg.length)], p.id);
      }
    }

    mafiaGame.phase = "night";
    mafiaGame.round = 1;
    api.sendMessage("🌙 नाइट 1 शुरू! माफिया, डॉक्टर, डिटेक्टिव, जादूगरनी, बॉडीगार्ड, जोकर अपने इनबॉक्स चेक करें।", threadID);
    setTimeout(() => {
      if (mafiaGame.phase === "night") {
        api.sendMessage("⏰ नाइट टाइम खत्म! ऑटो रिजल्ट प्रोसेस हो रहा है।", threadID);
        module.exports.run({ api, event: { threadID, senderID }, args: ["next"], botState });
      }
    }, 60000);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "next" && mafiaGame.phase === "night") {
    let killedPlayers = [mafiaGame.mafiaTarget];
    if (mafiaGame.witchPoison) killedPlayers.push(mafiaGame.witchPoison);
    let saved = mafiaGame.doctorTarget || mafiaGame.witchHeal;
    let msg = `🌙 नाइट ${mafiaGame.round} रिजल्ट:\n`;

    if (mafiaGame.bodyguardTarget && killedPlayers.includes(mafiaGame.bodyguardTarget)) {
      let bodyguard = mafiaGame.players.find(p => p.role === "Bodyguard");
      bodyguard.alive = false;
      killedPlayers = killedPlayers.filter(id => id !== mafiaGame.bodyguardTarget);
      msg += `🛡️ बॉडीगार्ड ने ${mafiaGame.players.find(p => p.id === mafiaGame.bodyguardTarget).name} को बचा लिया, लेकिन खुद मर गया!\n`;
    }

    let killed = killedPlayers.filter(id => id && id !== saved);
    killed.forEach(id => {
      let killedPlayer = mafiaGame.players.find(p => p.id === id);
      if (killedPlayer) {
        killedPlayer.alive = false;
        mafiaGame.log.push(`☠️ राउंड ${mafiaGame.round}: ${killedPlayer.name} मारा गया`);
        mafiaGame.mafiaKills++;
        msg += `💀 माफिया ने @${killedPlayer.name} को मार दिया!${mafiaGame.revealRoles ? ` (${killedPlayer.name} ${killedPlayer.role} था)` : ""}\n`;
      }
    });
    if (killedPlayers.length > 0 && killed.length === 0) {
      msg += `💉 ${mafiaGame.players.find(p => p.id === saved).name} को बचाया गया!\n`;
    }
    if (!killedPlayers.length) {
      msg += "कोई नहीं मरा।\n";
    }

    if (mafiaGame.jokerFakeKill) {
      let fakeKilled = mafiaGame.players.find(p => p.id === mafiaGame.jokerFakeKill);
      msg += `💀 माफिया ने @${fakeKilled.name} को मार दिया! (लेकिन वो ज़िंदा है, जोकर की चाल? 🤡)\n`;
    }

    mafiaGame.mafiaTarget = null;
    mafiaGame.doctorTarget = null;
    mafiaGame.detectiveTarget = null;
    mafiaGame.witchPoison = null;
    mafiaGame.witchHeal = null;
    mafiaGame.bodyguardTarget = null;
    mafiaGame.jokerFakeKill = null;

    let gameEnd = checkGameEnd();
    if (gameEnd) {
      msg += `\n🎮 गेम ओवर: ${gameEnd}\n`;
      msg += `📜 गेम लॉग:\n${mafiaGame.log.join("\n")}\n`;
      msg += `🏆 माफिया किल्स: ${mafiaGame.mafiaKills}`;
      let winners = gameEnd.includes("Villagers") ? getAlivePlayers().filter(p => p.role !== "Mafia") : getAlivePlayers().filter(p => p.role === "Mafia");
      winners.forEach(p => {
        botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + 5;
      });
      mafiaGame.players.filter(p => p.role === "Mafia").forEach(p => {
        botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + mafiaGame.mafiaKills * 10;
      });
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      msg += `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).map(([id, points]) => `${mafiaGame.players.find(p => p.id === id)?.name || id}: ${points} पॉइंट्स`).join("\n")}`;
      mafiaGame.active = false;
      mafiaGame.phase = "idle";
      api.sendMessage(msg, threadID, null, null, [{ tag: '@everyone', id: 'everyone' }]);
      return;
    }

    mafiaGame.phase = "day";
    msg += `\n☀️ डे ${mafiaGame.round} शुरू!\nजीवित खिलाड़ी:\n${formatPlayerList()}\nचर्चा करें और #mafia vote <नंबर> या #mafia doublevote <नंबर> से वोट करें।`;
    api.sendMessage(msg, threadID);
    setTimeout(() => {
      if (mafiaGame.phase === "day") {
        api.sendMessage("⏰ डे टाइम खत्म! ऑटो वोट रिजल्ट प्रोसेस हो रहा है।", threadID);
        module.exports.run({ api, event: { threadID, senderID }, args: ["endvote"], botState });
      }
    }, 60000);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "vote" || command === "doublevote" && mafiaGame.phase === "day") {
    let choice = args[1];
    let target = null;
    let alive = getAlivePlayers();
    if (choice) {
      if (!isNaN(choice)) {
        target = alive[parseInt(choice) - 1];
      } else {
        target = alive.find(p => p.name.toLowerCase() === choice?.toLowerCase() || p.id === choice);
      }
    }
    if (!target) return api.sendMessage("❌ गलत टारगेट।", threadID);

    api.getUserInfo(senderID, (err, ret) => {
      if (err || !ret || !ret[senderID]) {
        return api.sendMessage("⚠️ यूजर जानकारी नहीं मिली।", threadID);
      }
      const voterName = ret[senderID].name || "Unknown";
      let voteCount = command === "doublevote" && mafiaGame.players.find(p => p.id === senderID).role === "Joker" ? 1.5 : 1;
      mafiaGame.votes[target.id] = (mafiaGame.votes[target.id] || 0) + voteCount;
      api.sendMessage(`🗳️ ${voterName} ने ${target.name} को वोट दिया! कुल वोट्स: ${mafiaGame.votes[target.id]}`, threadID);
      botState.commandCooldowns[threadID] = { [command]: true };
      setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    });
    return;
  }

  if (command === "endvote" && mafiaGame.phase === "day") {
    let maxVotes = 0;
    let eliminated = null;
    for (let id in mafiaGame.votes) {
      if (mafiaGame.votes[id] > maxVotes) {
        maxVotes = mafiaGame.votes[id];
        eliminated = mafiaGame.players.find(p => p.id === id);
      }
    }
    let aliveCount = getAlivePlayers().length;
    let msg = `☀️ डे ${mafiaGame.round} वोटिंग रिजल्ट:\n`;
    if (eliminated && maxVotes > aliveCount / 2) {
      eliminated.alive = false;
      mafiaGame.log.push(`🗳️ राउंड ${mafiaGame.round}: ${eliminated.name} वोट से निकाला गया`);
      msg += `💀 वोट से @${eliminated.name} को निकाला गया!${mafiaGame.revealRoles ? ` (${eliminated.name} ${eliminated.role} था)` : ""}\n`;
      if (eliminated.role === "Joker") {
        msg += `🤡 हा हा! ${eliminated.name} जोकर था और उसने सबको बेवकूफ बनाया! जोकर जीत गया, गेम ओवर!\n`;
        msg += `📜 गेम लॉग:\n${mafiaGame.log.join("\n")}\n`;
        msg += `🏆 माफिया किल्स: ${mafiaGame.mafiaKills}`;
        botState.leaderboard[eliminated.id] = (botState.leaderboard[eliminated.id] || 0) + 20;
        botState.jokerWins = botState.jokerWins || {};
        botState.jokerWins[eliminated.id] = (botState.jokerWins[eliminated.id] || 0) + 1;
        if (botState.jokerWins[eliminated.id] >= 3) {
          msg += `\n👑 ${eliminated.name} जोकर किंग बन गया! 🤡`;
        }
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
        msg += `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).map(([id, points]) => `${mafiaGame.players.find(p => p.id === id)?.name || id}: ${points} पॉइंट्स`).join("\n")}`;
        mafiaGame.active = false;
        mafiaGame.phase = "idle";
        api.sendMessage(msg, threadID, null, null, [{ tag: '@everyone', id: 'everyone' }]);
        return;
      }
    } else {
      msg += `🛡️ कोई बहुमत नहीं मिला, कोई नहीं निकला।\n`;
    }

    let gameEnd = checkGameEnd();
    if (gameEnd) {
      msg += `\n🎮 गेम ओवर: ${gameEnd}\n`;
      msg += `📜 गेम लॉग:\n${mafiaGame.log.join("\n")}\n`;
      msg += `🏆 माफिया किल्स: ${mafiaGame.mafiaKills}`;
      let winners = gameEnd.includes("Villagers") ? getAlivePlayers().filter(p => p.role !== "Mafia") : getAlivePlayers().filter(p => p.role === "Mafia");
      winners.forEach(p => {
        botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + 5;
      });
      mafiaGame.players.filter(p => p.role === "Mafia").forEach(p => {
        botState.leaderboard[p.id] = (botState.leaderboard[p.id] || 0) + mafiaGame.mafiaKills * 10;
      });
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2));
      msg += `\n🏆 लीडरबोर्ड:\n${Object.entries(botState.leaderboard).map(([id, points]) => `${mafiaGame.players.find(p => p.id === id)?.name || id}: ${points} पॉइंट्स`).join("\n")}`;
      mafiaGame.active = false;
      mafiaGame.phase = "idle";
      api.sendMessage(msg, threadID, null, null, [{ tag: '@everyone', id: 'everyone' }]);
      return;
    }

    mafiaGame.votes = {};
    mafiaGame.round++;
    mafiaGame.phase = "night";
    api.sendMessage(`🌙 नाइट ${mafiaGame.round} शुरू!\nजीवित खिलाड़ी:\n${formatPlayerList()}`, threadID);
    setTimeout(() => {
      if (mafiaGame.phase === "night") {
        api.sendMessage("⏰ नाइट टाइम खत्म! ऑटो रिजल्ट प्रोसेस हो रहा है।", threadID);
        module.exports.run({ api, event: { threadID, senderID }, args: ["next"], botState });
      }
    }, 60000);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "reveal" && isAdmin) {
    mafiaGame.revealRoles = args[1]?.toLowerCase() === "on";
    api.sendMessage(`🕵️‍♂️ रोल रिवील ${mafiaGame.revealRoles ? "चालू" : "बंद"} कर दिया गया।`, threadID);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "stop") {
    if (!mafiaGame.active) {
      return api.sendMessage("❌ कोई गेम नहीं चल रहा।", threadID);
    }
    mafiaGame.active = false;
    mafiaGame.phase = "idle";
    api.sendMessage("🛑 माफिया गेम बंद।", threadID);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  if (command === "status") {
    if (!mafiaGame.active) {
      return api.sendMessage("❌ कोई गेम नहीं चल रहा।", threadID);
    }
    let msg = `🎭 माफिया गेम स्टेटस:\nफेज: ${mafiaGame.phase}\nराउंड: ${mafiaGame.round}\nजीवित खिलाड़ी:\n${formatPlayerList()}\nमाफिया किल्स: ${mafiaGame.mafiaKills}`;
    api.sendMessage(msg, threadID);
    botState.commandCooldowns[threadID] = { [command]: true };
    setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
    return;
  }

  api.sendMessage("❌ गलत कमांड। यूज: #mafia [start|join|begin|next|vote|doublevote|endvote|stop|status|reveal]", threadID);
};
