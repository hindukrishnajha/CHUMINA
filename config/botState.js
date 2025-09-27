const path = require('path');
const fs = require('fs');

const botState = {
  sessions: {},
  nicknameTimers: {},
  nicknameQueues: {},
  stickerSpam: {},
  lockedGroups: {},
  abuseTargets: {},
  welcomeMessages: [],
  adminList: Object.freeze(['100023807453349']), // Immutable
  autoConvo: false,
  memberCache: {},
  commandCooldowns: {},
  learnedResponses: {},
  eventProcessed: {},
  chatEnabled: {}
};

const LEARNED_RESPONSES_PATH = path.join(__dirname, '../config/learned_responses.json');
if (fs.existsSync(LEARNED_RESPONSES_PATH)) {
  try {
    const data = JSON.parse(fs.readFileSync(LEARNED_RESPONSES_PATH, 'utf8'));
    botState.learnedResponses = data.learnedResponses || {};
    if (data.adminList) {
      botState.adminList = Object.freeze(data.adminList); // Load adminList from JSON
    }
    console.log('Loaded botState:', botState);
  } catch (e) {
    console.error('Error loading learned_responses.json:', e);
  }
} else {
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({ adminList: botState.adminList, learnedResponses: {}, chatEnabled: {}, mafiaGames: {} }, null, 2), 'utf8');
}

module.exports = { botState };
