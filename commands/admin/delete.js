const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

console.log('[DELETE-CMD] Delete command file loaded'); // DEBUG LINE

module.exports = {
    name: 'delete',
    aliases: ['deletenotify', 'unsendnotify'],
    execute: (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
        console.log('[DELETE-CMD] Execute function called'); // DEBUG LINE
        try {
            const action = args[0] ? args[0].toLowerCase() : '';
            console.log('[DELETE-CMD] Action:', action); // DEBUG LINE
            
            // Ensure deleteNotifyEnabled exists
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
                api.sendMessage('✅ डिलीट नोटिफिकेशन चालू कर दिया गया।\n📸 Sticker, Photo, Message - सबका backup आएगा!', threadID, event.messageID);
            
            } else if (action === 'off') {
                botState.deleteNotifyEnabled[threadID] = false;
                botState.learnedResponses.deleteNotifyEnabled[threadID] = false;
                
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8);
                api.sendMessage('✅ डिलीट नोटिफिकेशन बंद कर दिया गया।', threadID, event.messageID);
            
            } else {
                api.sendMessage('❌ यूज: #delete on या #delete off\n📸 Sticker, Photo, Message - तीनों का backup आएगा!', threadID, event.messageID);
            }
        } catch (error) {
            console.error('[DELETE-CMD] Error:', error);
            api.sendMessage('❌ Delete command में error आया!', threadID, event.messageID);
        }
    }
};
