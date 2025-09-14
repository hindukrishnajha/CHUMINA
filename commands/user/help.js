const fs = require('fs');

module.exports = {
  name: "help",
  aliases: ["commands"],
  execute(api, threadID, args, event, botState, isMaster) {
    try {
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
By SHALENDER 👑
===
Admin:
- ${prefix}groupnamelock on/off: ग्रुप लॉक
- ${prefix}nicklock on <nick> / @user: निक लॉक
- ${prefix}nicklock off / @user: निक लॉक ऑफ
- ${prefix}removenick on/off @everyone/@user: निक रिमूव
- ${prefix}antiout on/off: आउट रोक
- ${prefix}kickout @user: यूजर किक
- ${prefix}unsend: मैसेज अनसेंड
- ${prefix}send sticker start/stop: स्टिकर भेज
- ${prefix}autospam accept: ऑटोस्पैम
- ${prefix}automessage accept: ऑटोमैसेज
- ${prefix}loder target on @user: लोडर टारगेट
- ${prefix}loder stop: लोडर ऑफ
- ${prefix}autoconvo on/off: ऑटोकन्वो
- ${prefix}chat on/off: चैट कंट्रोल
===
User:
- ${prefix}learn <trigger> {response}: ट्रिगर सेट
- ${prefix}tid: थ्रेड ID
- ${prefix}uid / @mention: यूजर ID
- ${prefix}info @mention: यूजर इन्फो
- ${prefix}groupinfo: ग्रुप इन्फो
- ${prefix}pair: रैंडम पेयर
- ${prefix}music <song>: गाना प्ले
- ${prefix}aihelp: AI हेल्प
- ${prefix}badge / @mention: स्टाइलिश बैज
- ${prefix}hotquote / @mention: फनी कोट
- ${prefix}mood / @mention: मूड स्टेटस
- ${prefix}compare @user1 @user2: यूजर कॉम्पिटिशन
===
Special:
- ${prefix}mastercommand: मास्टर कमांड्स
- ${prefix}masterid: मास्टर ID
===
      `;
      api.sendMessage(helpText, threadID);
    } catch (e) {
      console.error('[ERROR] help कमांड में गलती:', e.message);
      api.sendMessage('⚠️ Help गलती।', threadID);
    }
  }
};
