// ./commands/user/help.js
const fs = require('fs');

module.exports = {
  name: "help",
  aliases: ["commands"], // अगर कोई #commands यूज करे
  execute(api, threadID, args, event, botState, isMaster) {
    try {
      // डायनामिकली कमांड्स लोड करें
      const commands = new Map();
      const commandFolders = ['admin', 'user', 'master'];
      for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
          try {
            const command = require(`../${folder}/${file}`);
            commands.set(command.name, command);
            if (command.aliases) {
              command.aliases.forEach(alias => commands.set(alias, command));
            }
          } catch (err) {
            console.error(`[ERROR] ${folder} से कमांड ${file} लोड करने में असफल:`, err.message);
          }
        }
      }

      const prefix = botState.sessions[event.threadID]?.prefix || '#';
      const helpText = `
✨ BOT COMMANDS MENU
━━━━━━━━━━━

🔒 Admin Commands
${prefix}groupnamelock on/off <name>
${prefix}nicknamelock on/off <nick>
${prefix}antiout on/off
${prefix}kickout @user
${prefix}unsend
${prefix}send sticker start/stop
${prefix}autospam accept
${prefix}automessage accept
${prefix}loder target on @user
${prefix}loder stop
${prefix}autoconvo on/off
${prefix}learn (trigger) {response}

🆔 User Commands
${prefix}tid
${prefix}uid / ${prefix}uid @mention
${prefix}info @mention
${prefix}groupinfo
${prefix}pair - pair random 
${prefix}music <song>

👑 Special Commands
${prefix}mastercommand
${prefix}masterid

━━━━━━━━━━━
👑 Created By: ✶♡⤾➝SHALENDER..⤹✶➺🐯
      `;
      api.sendMessage(helpText, threadID);
    } catch (e) {
      console.error('[ERROR] help कमांड में गलती:', e.message);
      api.sendMessage('⚠️ Help कमांड में गलती।', threadID);
    }
  }
};
