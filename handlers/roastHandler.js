const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const bannedWords = [
    'maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha',
    'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa',
    'aunty', 'uncle', 'aukat'
];

async function generateRoastCore(api, event, message, wordLimit = 30) {
    try {
        const prompt = `
        User ke message ka roast karo. ${wordLimit - 10}-${wordLimit} words tak.
        Rules:
        - Family & relatives ki gaaliyan banned
        - "AUKAT" word banned
        - Allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        - Hindi + English mix
        User: "${message}"`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "Tu ek roaster hai. Family words aur 'aukat' banned hai." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.9,
            max_tokens: wordLimit * 2,
        });

        let roast = completion.choices[0]?.message?.content || "Chutiya roast fail ho gaya!";
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roast = roast.replace(regex, '');
        });
        return roast;
    } catch (error) {
        console.error("Roast generation error:", error);
        return "Server slow hai, baad me try kar!";
    }
}

async function handleRoast(api, event) {
    try {
        let targetMessage = event.messageReply?.body || event.body.replace(/^#roast\s*/i, '').trim();
        if (!targetMessage) {
            return api.sendMessage("❌ Roast ke liye message reply kar ya text daal!", event.threadID);
        }

        api.sendTypingIndicator(event.threadID);

        const userInfo = await api.getUserInfo([event.senderID]);
        const targetName = userInfo[event.senderID]?.name || "User";

        const roastResponse = await generateRoastCore(api, event, targetMessage, 40);
        api.sendMessage(`${targetName}, ${roastResponse}`, event.threadID);
    } catch (error) {
        console.error("Roast error:", error);
        api.sendMessage("❌ Roast server slow hai!", event.threadID);
    }
}

module.exports = { handleRoast };
