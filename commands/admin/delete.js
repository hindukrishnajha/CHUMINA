const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
    name: 'delete',
    aliases: ['deletenotify', 'unsendnotify'],
    execute: function(api, threadID, args, event, botState, isMaster, botID, stopBot) {
        try {
            console.log('[DELETE-CMD] Command executed');
            
            if (!isMaster) {
                api.sendMessage("🚫 ये कमांड सिर्फ मास्टर के लिए है! 🕉️", threadID, event.messageID);
                return;
            }

            const action = args[0] ? args[0].toLowerCase() : '';
            
            // Ensure objects exist
            if (!botState.deleteNotifyEnabled) {
                botState.deleteNotifyEnabled = {};
            }
            if (!botState.learnedResponses.deleteNotifyEnabled) {
                botState.learnedResponses.deleteNotifyEnabled = {};
            }
            
            if (action === 'on') {
                botState.deleteNotifyEnabled[threadID] = true;
                botState.learnedResponses.deleteNotifyEnabled[threadID] = true;
                
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                api.sendMessage('✅ डिलीट नोटिफिकेशन चालू कर दिया गया।', threadID, event.messageID);
            
            } else if (action === 'off') {
                botState.deleteNotifyEnabled[threadID] = false;
                botState.learnedResponses.deleteNotifyEnabled[threadID] = false;
                
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8);
                api.sendMessage('✅ डिलीट नोटिफिकेशन बंद कर दिया गया।', threadID, event.messageID);
            
            } else {
                api.sendMessage('❌ यूज: #delete on या #delete off', threadID, event.messageID);
            }
        } catch (error) {
            console.error('[DELETE-CMD] Error:', error);
            api.sendMessage('❌ Delete command में error आया!', threadID, event.messageID);
        }
    }
};
