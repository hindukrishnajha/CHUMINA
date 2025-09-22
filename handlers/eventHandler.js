const messageHandler = require('./messageHandler');
const deleteHandler = require('../events/deleteHandler');
const welcomeHandler = require('../events/welcomeHandler');
const commandHandler = require('./commandHandler');

function handleEvent(api, event, botState, userId) {
    try {
        console.log(`[EVENT] Type: ${event.type}, Thread: ${event.threadID}, MessageID: ${event.messageID}`);
        
        // Pehle delete events handle karo
        if (event.type === 'message_unsend') {
            return deleteHandler.handleUnsend(api, event, botState, userId);
        }
        
        // Phir message events
        if (event.type === 'message' || event.type === 'message_reply') {
            return messageHandler.handleMessage(api, event, botState, userId);
        }
        
        // Welcome/goodbye events
        if (event.logMessageType === 'log:subscribe') {
            return welcomeHandler.handleWelcome(api, event, botState, userId);
        }
        
        if (event.logMessageType === 'log:unsubscribe') {
            return welcomeHandler.handleGoodbye(api, event, botState, userId);
        }
        
        // Group events
        if (event.logMessageType === 'log:thread-name') {
            return messageHandler.handleGroupNameChange(api, event, botState);
        }
        
        if (event.logMessageType === 'log:user-nickname') {
            return messageHandler.handleNicknameChange(api, event, botState);
        }
        
        // Ignore these events
        if (event.type === 'read_receipt' || event.type === 'presence' || event.type === 'typ') {
            return;
        }
        
    } catch (error) {
        console.error('[EVENT-ERROR] Event handling failed:', error.message);
    }
}

module.exports = handleEvent;
