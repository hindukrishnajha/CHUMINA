module.exports = {
    handleHelp: (api, threadID, prefix = '#') => {
        const helpText = `
🛠️ 𝗕𝗢𝗧 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 𝗠𝗘𝗡𝗨
━━━━━━━━━━━━━━━━━━━━
🔒 𝗔𝗱𝗺𝗶𝗻 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
• ${prefix}groupnamelock on/off <name> - Lock group name
• ${prefix}nicknamelock on/off <nickname> - Lock all nicknames
• ${prefix}antiout on/off - Toggle anti-out feature
• ${prefix}kickout @user - Kick user from group
• ${prefix}unsend - Delete replied message
• ${prefix}send sticker start/stop - Sticker spam
• ${prefix}autospam accept - Auto accept spam messages
• ${prefix}automessage accept - Auto accept message requests
• ${prefix}loder target on @user - Target a user
• ${prefix}loder stop - Stop targeting
• autoconvo on/off - Toggle auto conversation

🆔 𝗨𝘀𝗲𝗿 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
• ${prefix}tid - Get group ID
• ${prefix}uid - Get your ID
• ${prefix}uid @mention - Get mentioned user's ID
• ${prefix}info @mention - Get user info
• ${prefix}group info - Get group info
• ${prefix}pair - Pair two random members
• ${prefix}music <song name> - Play YouTube music
• ${prefix}learn (trigger) {response} - Teach bot a new response

👑 𝗦𝗽𝗲𝗰𝗶𝗮𝗹 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
• ${prefix}mastercommand - Show master commands
• ${prefix}masterid - Show master profile link
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`;
        api.sendMessage(helpText, threadID);
    }
};
