const { loadCommands } = require('../utils/commandLoader');

class CommandHandler {
    constructor() {
        this.commands = loadCommands();
    }

    handleCommand(api, event, botState, userId) {
        const content = event.body || '';
        const prefix = botState.sessions[userId].prefix;
        const fullCommand = content.split(' ')[0].toLowerCase();
        const command = fullCommand.slice(prefix.length).toLowerCase();
        const cleanArgs = content.split(' ').slice(1);
        
        const senderID = event.senderID;
        const isMaster = senderID === require('../config/constants').MASTER_ID;
        const isAdmin = Array.isArray(botState.adminList) && (botState.adminList.includes(senderID) || isMaster);
        const threadID = event.threadID;
        const messageID = event.messageID;

        console.log(`[CMD] Detected: ${command}, Args:`, cleanArgs);

        const cmd = this.commands.get(command);
        if (!cmd) {
            this.handleUnknownCommand(api, command, threadID, messageID, prefix);
            return;
        }

        // Cooldown check
        if (this.isOnCooldown(botState, threadID, command)) {
            api.sendMessage('⚠️ कूलडाउन: 10 सेकंड बाद ट्राई करें।', threadID, messageID);
            return;
        }

        // Permission check
        if (!this.hasPermission(cmd, isMaster, isAdmin)) {
            api.sendMessage(this.getPermissionMessage(cmd, isMaster, isAdmin), threadID, messageID);
            return;
        }

        // Execute command
        this.executeCommand(api, cmd, threadID, cleanArgs, event, botState, isMaster, userId);
        
        // Set cooldown
        this.setCooldown(botState, threadID, command);
    }

    handleUnknownCommand(api, command, threadID, messageID, prefix) {
        if (command === 'learn') {
            api.sendMessage('❌ गलत कमांड फॉर्मेट। यूज: #learn (trigger) {response} 🕉️', threadID, messageID);
        } else {
            api.sendMessage(`❌ गलत कमांड "${command}"। यूज: ${prefix}help 🕉️`, threadID, messageID);
        }
    }

    isOnCooldown(botState, threadID, command) {
        return botState.commandCooldowns[threadID]?.[command]?.timestamp && 
               Date.now() - botState.commandCooldowns[threadID][command].timestamp < 10000;
    }

    hasPermission(cmd, isMaster, isAdmin) {
        const adminCommands = ['stickerspam', 'antiout', 'groupnamelock', 'nicknamelock', 'unsend', 'roast', 'mute', 'unmute'];
        const masterCommands = ['stopall', 'status', 'removeadmin', 'masterid', 'mastercommand', 'listadmins', 'list', 'kick', 'addadmin'];

        if (masterCommands.includes(cmd.name) && !isMaster) return false;
        if (adminCommands.includes(cmd.name) && !isAdmin && !isMaster) return false;
        
        return true;
    }

    getPermissionMessage(cmd, isMaster, isAdmin) {
        const masterCommands = ['stopall', 'status', 'removeadmin', 'masterid', 'mastercommand', 'listadmins', 'list', 'kick', 'addadmin'];
        
        if (masterCommands.includes(cmd.name)) {
            return "🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️";
        } else {
            return "🚫 ये कमांड सिर्फ एडमिन्स या मास्टर के लिए है! 🕉️";
        }
    }

    executeCommand(api, cmd, threadID, cleanArgs, event, botState, isMaster, userId) {
        try {
            const botID = botState.sessions[userId].botID;
            const stopBot = require('../utils/botManager').stopBot;
            
            console.log(`[CMD] Executing: ${cmd.name} with args:`, cleanArgs);
            cmd.execute(api, threadID, cleanArgs, event, botState, isMaster, botID, stopBot);
        } catch (err) {
            console.error(`[CMD-ERROR] ${cmd.name}:`, err);
            api.sendMessage(`❌ कमांड error: ${err.message}`, threadID, event.messageID);
        }
    }

    setCooldown(botState, threadID, command) {
        if (!botState.commandCooldowns[threadID]) {
            botState.commandCooldowns[threadID] = {};
        }
        botState.commandCooldowns[threadID][command] = { timestamp: Date.now() };
        
        setTimeout(() => {
            if (botState.commandCooldowns[threadID]?.[command]) {
                delete botState.commandCooldowns[threadID][command];
            }
        }, 10000);
    }
}

module.exports = new CommandHandler();
