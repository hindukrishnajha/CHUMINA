// ./commands/user/help.js
const fs = require('fs');

module.exports = {
  name: "help",
  aliases: ["commands"],
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
✨ BOT COMMANDS MENU ✨
━━━━━━━━━━━━━━━━━━━━

🔒 Admin Commands
${prefix}groupnamelock on/off <name> - ग्रुप का नाम लॉक/अनलॉक करें
${prefix}nicklock on <nickname> - सभी का निकनेम लॉक करें
${prefix}nicklock on @user <nickname> - यूजर का निकनेम लॉक करें
${prefix}nicklock off - निकनेम लॉक बंद करें
${prefix}nicklock off @user - यूजर का निकनेम लॉक हटाएँ
${prefix}removenick on @everyone - सभी के निकनेम हटाएँ
${prefix}removenick on @user - यूजर का निकनेम हटाएँ
${prefix}removenick off - निकनेम हटाना बंद करें
${prefix}removenick off @user - यूजर का निकनेम हटाना बंद करें
${prefix}antiout on/off - ग्रुप से निकलने से रोकें
${prefix}kickout @user - यूजर को ग्रुप से निकालें
${prefix}unsend - मैसेज अनसेंड करें
${prefix}send sticker start/stop - स्टिकर भेजना शुरू/बंद करें
${prefix}autospam accept - ऑटोस्पैम स्वीकार करें
${prefix}automessage accept - ऑटोमैसेज स्वीकार करें
${prefix}loder target on @user - लोडर टारगेट सेट करें
${prefix}loder stop - लोडर बंद करें
${prefix}autoconvo on/off - ऑटोकन्वो चालू/बंद करें

🆔 User Commands
${prefix}learn <trigger> {response} - नया ट्रिगर और रिस्पॉन्स सेट करें
${prefix}tid - थ्रेड ID देखें
${prefix}uid / ${prefix}uid @mention - यूजर ID देखें
${prefix}info @mention - यूजर की जानकारी देखें
${prefix}groupinfo - ग्रुप की जानकारी देखें
${prefix}pair - रैंडम पेयर बनाएँ
${prefix}music <song> - गाना चलाएँ
${prefix}aihelp - AI से बात करने का तरीका जानें

👑 Special Commands
${prefix}mastercommand - मास्टर कमांड्स देखें
${prefix}masterid - मास्टर ID देखें

━━━━━━━━━━━━━━━━━━━━
👑 Created By: ✶♡⤾➝SHALENDER..⤹✶➺🐯
      `;
      api.sendMessage(helpText, threadID);
    } catch (e) {
      console.error('[ERROR] help कमांड में गलती:', e.message);
      api.sendMessage('⚠️ Help कमांड में गलती।', threadID);
    }
  }
};
