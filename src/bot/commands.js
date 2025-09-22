// src/bot/commands.js
const fs = require('fs');
const path = require('path');
const { botState } = require(path.join(__dirname, '../config/botState'));
const { LEARNED_RESPONSES_PATH } = require(path.join(__dirname, '../config/constants'));
const { sendBotMessage } = require('./message');

function loadCommands() {
  const commands = new Map();
  const commandFolders = ['admin', 'user', 'master'];
  for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, '../commands', folder)).filter(file => file.endsWith('.js'));
    console.log(`[DEBUG] Scanning folder: ${folder}, found files: ${commandFiles}`);
    for (const file of commandFiles) {
      try {
        const command = require(path.join(__dirname, '../commands', folder, file));
        console.log(`[DEBUG] Loading command: ${command.name} from ${file}`);
        commands.set(command.name, command);
        if (command.aliases) {
          command.aliases.forEach(alias => {
            console.log(`[DEBUG] Loading alias: ${alias} for command ${command.name}`);
            commands.set(alias, command);
          });
        }
      } catch (err) {
        console.error(`Error loading command ${file} from ${folder}:`, err.message);
      }
    }
  }
  console.log('[DEBUG] All loaded commands:', Array.from(commands.keys()));
  return commands;
}

function executeCommand(api, threadID, messageID, command, cleanArgs, event, isMaster, isAdmin, botID, stopBot) {
  const commands = loadCommands();
  const cmd = commands.get(command);
  if (cmd) {
    if (botState.commandCooldowns[threadID]?.[command]?.timestamp && Date.now() - botState.commandCooldowns[threadID][command].timestamp < 10000) {
      console.log(`[DEBUG] Command ${command} on cooldown for thread ${threadID}`);
      sendBotMessage(api, '⚠️ कूलडाउन: 10 सेकंड बाद ट्राई करें।', threadID, messageID);
      return;
    }
    try {
      if (['stickerspam', 'antiout', 'groupnamelock', 'nicknamelock', 'unsend', 'roast', 'mute', 'unmute'].includes(cmd.name) && !isAdmin) {
        sendBotMessage(api, "🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है! 🕉️", threadID, messageID);
        console.log(`[DEBUG] Command ${cmd.name} rejected: Sender ${event.senderID} is not admin`);
      } else if (['stopall', 'status', 'removeadmin', 'masterid', 'mastercommand', 'listadmins', 'list', 'kick', 'addadmin'].includes(cmd.name) && !isMaster) {
        sendBotMessage(api, "🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️", threadID, messageID);
        console.log(`[DEBUG] Command ${cmd.name} rejected: Sender ${event.senderID} is not master`);
      } else {
        cmd.execute(api, threadID, cleanArgs, event, botState, isMaster, botID, stopBot);
        if (!botState.commandCooldowns[threadID]) botState.commandCooldowns[threadID] = {};
        botState.commandCooldowns[threadID][command] = { timestamp: Date.now() };
        setTimeout(() => delete botState.commandCooldowns[threadID][command], 10000);
      }
    } catch (err) {
      console.error(`[ERROR] Command ${command} error:`, err.message);
      sendBotMessage(api, `❌ कमांड चलाने में गलती: ${err.message} 🕉️`, threadID, messageID);
    }
  } else if (command === 'learn') {
    const fullMsg = event.body;
    const match = fullMsg.match(/#learn\s*\(\s*([^)]+)\s*\)\s*\{\s*([^}]+)\s*\}/i);
    if (match && isAdmin) {
      const trigger = match[1].trim();
      const response = match[2].trim();
      if (trigger && response) {
        if (!botState.learnedResponses[event.senderID]) {
          botState.learnedResponses[event.senderID] = { triggers: [] };
        }
        let existingIndex = -1;
        botState.learnedResponses[event.senderID].triggers.forEach((entry, index) => {
          if (entry.trigger.toLowerCase().trim() === trigger.toLowerCase().trim()) {
            existingIndex = index;
          }
        });
        if (existingIndex !== -1) {
          botState.learnedResponses[event.senderID].triggers[existingIndex].responses.push(response);
          sendBotMessage(api, `✅ ट्रिगर "${trigger}" अपडेट हो गया! नया रिस्पॉन्स: ${response} 🕉️`, threadID, messageID);
        } else {
          botState.learnedResponses[event.senderID].triggers.push({
            trigger: trigger,
            responses: [response]
          });
          sendBotMessage(api, `✅ नया रिस्पॉन्स सीखा गया!\nट्रिगर: ${trigger}\nरिस्पॉन्स: ${response} 🕉️`, threadID, messageID);
        }
        fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
      } else {
        sendBotMessage(api, '❌ ट्रिगर को ( ) में डालें, जैसे: #learn (trigger) {response} 🕉️', threadID, messageID);
      }
    } else if (!isAdmin) {
      sendBotMessage(api, "🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है! 🕉️", threadID, messageID);
    } else {
      sendBotMessage(api, `❌ गलत कमांड "${command}"। यूज: ${botState.sessions[event.senderID].prefix}help 🕉️`, threadID, messageID);
    }
  } else {
    console.log(`[DEBUG] Command not found: ${command}`);
    sendBotMessage(api, `❌ गलत कमांड "${command}"। यूज: ${botState.sessions[event.senderID].prefix}help 🕉️`, threadID, messageID);
  }
}

module.exports = { loadCommands, executeCommand };
