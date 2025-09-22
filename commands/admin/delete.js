// SIMPLE VERSION - NO UNICODE
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'delete',
    aliases: ['deletenotify'],
    execute: function(api, threadID, args, event, botState, isMaster, botID, stopBot) {
        try {
            console.log('DELETE COMMAND EXECUTED');
            
            if (!isMaster) {
                api.sendMessage("Master only command!", threadID);
                return;
            }

            const action = args[0] ? args[0].toLowerCase() : '';
            
            if (!botState.deleteNotifyEnabled) botState.deleteNotifyEnabled = {};
            if (!botState.learnedResponses.deleteNotifyEnabled) botState.learnedResponses.deleteNotifyEnabled = {};
            
            if (action === 'on') {
                botState.deleteNotifyEnabled[threadID] = true;
                botState.learnedResponses.deleteNotifyEnabled[threadID] = true;
                api.sendMessage("Delete notifications ON", threadID);
            } 
            else if (action === 'off') {
                botState.deleteNotifyEnabled[threadID] = false;
                botState.learnedResponses.deleteNotifyEnabled[threadID] = false;
                api.sendMessage("Delete notifications OFF", threadID);
            }
            else {
                api.sendMessage("Use: #delete on/off", threadID);
            }
        } catch (error) {
            console.error('Delete error:', error);
            api.sendMessage("Command error", threadID);
        }
    }
};
