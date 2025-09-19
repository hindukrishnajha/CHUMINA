const crypto = require('crypto');

module.exports = {
  players: [],
  gameState: null,
  phase: null,
  nightActions: {},
  votes: {},
  lastVoteTime: null,
  commandCooldowns: {},
  masterid: '100092496586513', // शैलेंद्र का ID

  handleEvent(api, event, roleTokens) {
    if (event.type !== 'message' || !event.body) return;

    const threadID = event.threadID;
    const senderID = event.senderID;
    const message = event.body.toLowerCase().trim();
    const senderName = event.senderName || senderID;

    // डुप्लिकेट इवेंट्स स्किप करें
    if (this.commandCooldowns[event.messageID]) {
      console.log('[DEBUG] Skipping duplicate event:', event.messageID);
      return;
    }
    this.commandCooldowns[event.messageID] = true;

    if (message.startsWith('#mafia')) {
      const args = message.split(' ').slice(1);
      const command = args[0] || '';

      if (command === 'start') {
        if (this.gameState) {
          api.sendMessage('गेम पहले से चल रहा है! #mafia stop से बंद करें।', threadID);
          return;
        }
        this.gameState = 'waiting';
        this.players = [];
        api.sendMessage('माफिया गेम शुरू! #mafia join से जुड़ें।', threadID);
      } else if (command === 'join') {
        if (this.gameState !== 'waiting') {
          api.sendMessage('गेम शुरू नहीं हुआ या पहले से चल रहा है। #mafia start करें।', threadID);
          return;
        }
        if (this.players.find(p => p.id === senderID)) {
          api.sendMessage('तुम पहले से गेम में हो!', threadID);
          return;
        }
        this.players.push({ id: senderID, name: senderName, role: null, alive: true });
        api.sendMessage(`${senderName} गेम में शामिल हुआ! अब ${this.players.length} प्लेयर।`, threadID);
      } else if (command === 'begin') {
        if (this.gameState !== 'waiting') {
          api.sendMessage('गेम शुरू करने के लिए पहले #mafia start करें।', threadID);
          return;
        }
        if (this.players.length < 4) {
          api.sendMessage('कम से कम 4 प्लेयर चाहिए।', threadID);
          return;
        }

        this.gameState = 'night';
        this.phase = 1;
        this.nightActions = {};
        this.votes = {};
        this.assignRoles();

        // हर प्लेयर को यूनिक लिंक भेजें
        this.players.forEach(player => {
          const token = crypto.randomBytes(16).toString('hex');
          roleTokens[token] = { uid: player.id, role: player.role, threadID };
          const link = `https://your-bot-domain.com/role?token=${token}&uid=${player.id}`;
          api.sendMessage(`${player.name}, तुम्हारा रोल चेक करने के लिए इस लिंक पर क्लिक करें: ${link}`, threadID);
        });

        api.sendMessage('🌙 नाइट 1 शुरू! अपने रोल और एक्शन्स के लिए लिंक चेक करें।', threadID);
      } else if (command === 'vote' && this.gameState === 'day') {
        const voteIndex = parseInt(args[1]) - 1;
        if (isNaN(voteIndex) || voteIndex < 0 || voteIndex >= this.players.length) {
          api.sendMessage('गलत वोट नंबर। सही नंबर चुनें।', threadID);
          return;
        }
        const target = this.players[voteIndex];
        if (!target.alive) {
          api.sendMessage('ये प्लेयर मर चुका है।', threadID);
          return;
        }
        this.votes[senderID] = target.id;
        api.sendMessage(`${senderName} ने ${target.name} को वोट किया।`, threadID);
        this.checkVotes(api, threadID);
      } else if (command === 'endvote' && this.gameState === 'day') {
        this.endVoting(api, threadID);
      } else if (command === 'stop') {
        this.resetGame();
        api.sendMessage('गेम बंद कर दिया गया। #mafia start से फिर शुरू करें।', threadID);
      }
    }
  },

  assignRoles() {
    const totalPlayers = this.players.length;
    const mafiaCount = Math.floor(totalPlayers / 4);
    const villagers = totalPlayers - mafiaCount - 2; // 1 Doctor, 1 Detective
    const rolePool = [...Array(mafiaCount).fill('Mafia'), 'Doctor', 'Detective', ...Array(villagers).fill('Villager')];

    // शैलेंद्र को स्पेशल रोल (डॉक्टर या डिटेक्टिव)
    const shalender = this.players.find(p => p.id === this.masterid);
    if (shalender) {
      const specialRoles = ['Doctor', 'Detective'];
      shalender.role = specialRoles[Math.floor(Math.random() * specialRoles.length)];
      const index = rolePool.indexOf(shalender.role);
      rolePool.splice(index, 1);
    }

    // बाकी प्लेयर्स को रैंडम रोल्स
    this.players.forEach(player => {
      if (player.id !== this.masterid && !player.role) {
        const randomIndex = Math.floor(Math.random() * rolePool.length);
        player.role = rolePool.splice(randomIndex, 1)[0];
      }
    });
  },

  checkVotes(api, threadID) {
    const voteCounts = {};
    this.players.forEach(p => {
      if (p.alive) voteCounts[p.id] = 0;
    });
    Object.values(this.votes).forEach(vote => {
      if (this.players.find(p => p.id === vote && p.alive)) voteCounts[vote]++;
    });

    const maxVotes = Math.max(...Object.values(voteCounts));
    const toEliminate = Object.keys(voteCounts).find(id => voteCounts[id] === maxVotes && maxVotes > this.players.filter(p => p.alive).length / 2);

    if (toEliminate) {
      const eliminated = this.players.find(p => p.id === toEliminate);
      eliminated.alive = false;
      api.sendMessage(`${eliminated.name} को वोटिंग से बाहर कर दिया गया।`, threadID);
      this.checkGameOver(api, threadID);
    }
  },

  endVoting(api, threadID) {
    this.gameState = 'night';
    this.phase++;
    this.nightActions = {};
    this.votes = {};

    // नाइट फेज के लिए नए लिंक्स भेजें
    this.players.forEach(player => {
      if (player.alive && ['Mafia', 'Doctor', 'Detective'].includes(player.role)) {
        const token = crypto.randomBytes(16).toString('hex');
        roleTokens[token] = { uid: player.id, role: player.role, threadID };
        const link = `https://your-bot-domain.com/role?token=${token}&uid=${player.id}`;
        api.sendMessage(`${player.name}, नाइट ${this.phase} के लिए अपने एक्शन्स के लिए इस लिंक पर क्लिक करें: ${link}`, threadID);
      }
    });

    api.sendMessage(`🌙 नाइट ${this.phase} शुरू! अपने एक्शन्स के लिए लिंक चेक करें।`, threadID);

    // ऑटोमैटिक नाइट टाइमआउट (30 सेकंड)
    setTimeout(() => {
      if (this.gameState === 'night') {
        this.checkNightActions(api, threadID);
      }
    }, 30000);
  },

  checkNightActions(api, threadID) {
    let message = `🌙 नाइट ${this.phase} रिजल्ट:\n`;
    const mafiaTarget = this.nightActions.mafia;
    const doctorTarget = this.nightActions.doctor;

    if (mafiaTarget && mafiaTarget !== doctorTarget) {
      const target = this.players.find(p => p.id === mafiaTarget);
      if (target) {
        target.alive = false;
        message += `${target.name} को माफिया ने मार दिया।\n`;
      }
    } else {
      message += 'कोई किल नहीं हुई। सब सेफ!\n';
    }

    api.sendMessage(message, threadID);
    this.checkGameOver(api, threadID);

    if (this.gameState) {
      this.gameState = 'day';
      this.votes = {};
      let voteMessage = `☀️ डे ${this.phase} शुरू!\nवोटिंग शुरू करें (#mafia vote <number>):\n`;
      this.players.forEach((p, i) => {
        if (p.alive) voteMessage += `${i + 1}. ${p.name}\n`;
      });
      api.sendMessage(voteMessage, threadID);

      // ऑटोमैटिक डे टाइमआउट (30 सेकंड)
      setTimeout(() => {
        if (this.gameState === 'day') {
          this.endVoting(api, threadID);
        }
      }, 30000);
    }
  },

  checkGameOver(api, threadID) {
    const aliveMafia = this.players.filter(p => p.alive && p.role === 'Mafia').length;
    const aliveVillagers = this.players.filter(p => p.alive && p.role !== 'Mafia').length;

    if (aliveMafia === 0) {
      let message = '🎮 गेम ओवर: विलेजर जीते! सारे माफिया मर गए।\n📜 गेम लॉग:\n';
      message += `🏆 माफिया किल्स: 0\n🏆 लीडरबोर्ड:\n`;
      const shalender = this.players.find(p => p.id === this.masterid);
      if (shalender) {
        message += `@${shalender.name} 🏅 First, Score: 14/14\n`;
      }
      this.players.forEach((p, i) => {
        if (p.id !== this.masterid) {
          message += `${i + 1}. ${p.name} - ${p.role} (${p.alive ? 'Alive' : 'Dead'})\n`;
        }
      });
      api.sendMessage(message, threadID);
      this.resetGame();
    } else if (aliveMafia >= aliveVillagers) {
      let message = '🎮 गेम ओवर: माफिया जीते! विलेजर्स हार गए।\n📜 गेम लॉग:\n';
      message += `🏆 माफिया किल्स: ${this.players.length - aliveVillagers}\n🏆 लीडरबोर्ड:\n`;
      const shalender = this.players.find(p => p.id === this.masterid);
      if (shalender) {
        message += `@${shalender.name} 🏅 First, Score: 14/14\n`;
      }
      this.players.forEach((p, i) => {
        if (p.id !== this.masterid) {
          message += `${i + 1}. ${p.name} - ${p.role} (${p.alive ? 'Alive' : 'Dead'})\n`;
        }
      });
      api.sendMessage(message, threadID);
      this.resetGame();
    }
  },

  resetGame() {
    this.players = [];
    this.gameState = null;
    this.phase = null;
    this.nightActions = {};
    this.votes = {};
    this.lastVoteTime = null;
    this.commandCooldowns = {};
  },
};
