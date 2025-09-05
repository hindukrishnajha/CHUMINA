function handleGroupNameLock(api, threadID, args, event, botState, isMaster) {
    const command = args[1]?.toLowerCase();
    const groupName = args.slice(2).join(' ');

    if (command === 'on' && groupName) {
        botState.lockedGroups[threadID] = groupName;
        api.sendMessage(`🔒 ग्रुप का नाम "${groupName}" पर लॉक कर दिया गया।`, threadID);
    } else if (command === 'off') {
        delete botState.lockedGroups[threadID];
        api.sendMessage('🔓 ग्रुप नाम लॉक हटा दिया गया।', threadID);
    } else {
        api.sendMessage('❌ गलत कमांड। यूज करें: #groupnamelock on <नाम> या #groupnamelock off', threadID);
    }
}
