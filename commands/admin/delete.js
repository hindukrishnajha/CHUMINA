const fs = require('fs');
const { LEARNED_RESPONSES_PATH } = require('../../config/constants');

module.exports = {
    name: 'delete',
    aliases: ['deletenotify', 'unsendnotify'],
    execute: (api, threadID, args, event, botState, isMaster, botID, stopBot) => {
        try {
            const action = args[0] ? args[0].toLowerCase() : '';
            
            if (action === 'on') {
                botState.deleteNotifyEnabled[threadID] = true;
                botState.learnedResponses.deleteNotifyEnabled = botState.deleteNotifyEnabled;
                
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
                api.sendMessage('✅ डिलीट नोटिफिकेशन चालू कर दिया गया।\n📸 Sticker, Photo, Message - सबका backup आएगा!', threadID, event.messageID);
            
            } else if (action === 'off') {
                botState.deleteNotifyEnabled[threadID] = false;
                botState.learnedResponses.deleteNotifyEnabled = botState.deleteNotifyEnabled;
                
                fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
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
