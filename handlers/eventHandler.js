const messageHandler = require('./messageHandler');
const deleteHandler = require('../events/deleteHandler');
const welcomeHandler = require('../events/welcomeHandler');
const commandHandler = require('./commandHandler');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function handleAutoRoast(api, event, botState) {
    try {
        if (!botState.roastEnabled?.[event.threadID]) return false;
        if (botState.roastTargets?.[event.threadID] && !botState.roastTargets[event.threadID][event.senderID]) return false;
        if (!event.body || event.body.startsWith('#')) return false;

        const prompt = `
        Short roast (20-30 words).
        Rules:
        - Family banned
        - 'Aukat' banned
        - Allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        User: "${event.body}"`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "Tu ek roaster hai. Family words aur 'aukat' banned hai." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.9,
            max_tokens: 80,
        });

        let roastResponse = completion.choices[0]?.message?.content || "Chup kar gandu!";
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });

        api.sendMessage(roastResponse, event.threadID);
        return true;
    } catch (error) {
        console.error("Auto-roast error:", error);
        return false;
    }
}

function handleEvent(api, event, botState, userId) {
    try {
        if (event.type === 'message' && !event.body.startsWith('#')) {
            handleAutoRoast(api, event, botState).catch(console.error);
            return messageHandler.handleMessage(api, event, botState, userId);
        }
        if (event.type === 'message_unsend') return deleteHandler.handleUnsend(api, event, botState, userId);
        if (event.logMessageType === 'log:subscribe') return welcomeHandler.handleWelcome(api, event, botState, userId);
        if (event.logMessageType === 'log:unsubscribe') return welcomeHandler.handleGoodbye(api, event, botState, userId);
    } catch (error) {
        console.error('[EVENT-ERROR] Event handling failed:', error.message);
    }
}

module.exports = handleEvent;
