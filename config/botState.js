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
  adminList: ['100023807453349'],
  autoConvo: false,
  memberCache: {},
  commandCooldowns: {},
  learnedResponses: {},
  eventProcessed: {},
  chatEnabled: {}
};

const LEARNED_RESPONSES_PATH = path.join(__dirname, '../config/learned_responses.json');
if (!fs.existsSync(LEARNED_RESPONSES_PATH)) {
  fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify({}, null, 2), 'utf8');
}

module.exports = { botState };
