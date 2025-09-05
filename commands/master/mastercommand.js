module.exports = {
  name: "mastercommand",
  execute(api, threadID, args, event, botState, isMaster) {
    if (!isMaster) {
      api.sendMessage('🚫 केवल मास्टर (Shalender Hindu Ji) इस कमांड को यूज कर सकते हैं।', threadID);
      return;
    }
    const prefix = botState.sessions[event.threadID]?.prefix || '#';
    const masterText = `
👑 �_M𝗮𝘀𝘁𝗲𝗿 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀 (Only for Shalender Hindu Ji)
━━━━━━━━━━━━━━━━━━━━
• ${prefix}stopall - Stop all bots
• ${prefix}status - Show active bot count
• ${prefix}kick <userId> - Stop bot for specific user
• ${prefix}list - List all active user IDs
• ${prefix}addadmin <@user/uid> - Add a new admin
• ${prefix}removeadmin <@user/uid> - Remove an admin
• ${prefix}listadmins - List all admins
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝗧𝗲𝗱 𝗕𝗬: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`;
    api.sendMessage(masterText, threadID);
  }
};
