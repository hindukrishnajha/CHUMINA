const messageHandler = require('./messageHandler');
const deleteHandler = require('../events/deleteHandler');
const welcomeHandler = require('../events/welcomeHandler');
const commandHandler = require('./commandHandler');
const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Auto-roast function
async function handleAutoRoast(api, event, botState) {
    try {
        // Check if roast is enabled for this thread
        if (!botState.roastEnabled || !botState.roastEnabled[event.threadID]) {
            return false;
        }

        // Check if targeted roast
        if (botState.roastTargets && botState.roastTargets[event.threadID]) {
            if (!botState.roastTargets[event.threadID][event.senderID]) {
                return false;
            }
        }

        // 30 seconds gap check
        const now = Date.now();
        if (botState.lastRoastTime && botState.lastRoastTime[event.threadID]) {
            const timeDiff = now - botState.lastRoastTime[event.threadID];
            if (timeDiff < 30000) { // 30 seconds
                return false;
            }
        }

        // Don't roast bot's own messages
        if (event.senderID === api.getCurrentUserID()) {
            return false;
        }

        // Don't roast commands
        if (event.body && event.body.startsWith('#')) {
            return false;
        }

        // Don't roast empty messages
        if (!event.body || event.body.trim().length === 0) {
            return false;
        }

        const prompt = `
        User ke message ka roast karo. 20-30 words max. Short aur effective.
        
        STRICT RULES:
        1. FAMILY & RELATIVES BANNED: maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle
        2. "AUKAT" WORD BANNED
        3. Sirf allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        4. Sirf USER ko directly roast karo
        5. User ke message ka related jawab do: "${event.body}"
        
        Tera roast:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system", 
                    content: "Tu ek roaster hai. Family words completely banned. Sirf user ko directly roast karta hai. Short aur effective roast karta hai."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.1-70b-versatile", // ✅ FIXED
            temperature: 0.9,
            max_tokens: 80,
            top_p: 1,
            stream: false,
        });

        let roastResponse = completion.choices[0]?.message?.content || "Chup kar gandu!";
        
        // Banned words filter
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });

        // Send roast
        api.sendMessage(roastResponse, event.threadID);
        
        // Update last roast time
        if (!botState.lastRoastTime) botState.lastRoastTime = {};
        botState.lastRoastTime[event.threadID] = now;
        
        return true;
    } catch (error) {
        console.error("Auto-roast error:", error);
        return false;
    }
}

function handleEvent(api, event, botState, userId) {
    try {
        console.log(`[EVENT] Type: ${event.type}, Thread: ${event.threadID}, MessageID: ${event.messageID}`);
        
        // Pehle delete events handle karo
        if (event.type === 'message_unsend') {
            return deleteHandler.handleUnsend(api, event, botState, userId);
        }
        
        // Phir message events
        if (event.type === 'message' || event.type === 'message_reply') {
            // Auto-roast check (sirf normal messages pe)
            if (event.body && !event.body.startsWith('#')) {
                handleAutoRoast(api, event, botState).catch(console.error);
            }
            
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
