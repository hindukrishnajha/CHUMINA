const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function handleRoast(api, event) {
    try {
        let targetMessage =
            event.messageReply?.body ||
            event.body.replace(/^#roast\s*/i, '').trim();
        let targetName = "User";

        if (!targetMessage) {
            return api.sendMessage("❌ Roast ke liye message do!", event.threadID);
        }

        api.sendTypingIndicator(event.threadID);

        const prompt = `
        User ke message ka roast karo. 30-40 words tak. 

        Rules:
        1. Family & relatives ki gaaliyan bilkul banned hain
        2. "AUKAT" word bilkul banned hai
        3. Allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        4. Sirf user ko roast karo
        5. Hindi + English mix karo

        User: "${targetMessage}"`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Tu ek roaster hai. Family words aur 'aukat' strictly banned hai."
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.1-8b-instant", // ✅ supported model
            temperature: 0.9,
            max_tokens: 100,
        });

        let roastResponse = completion.choices[0]?.message?.content || "Roast fail ho gaya!";

        // 🚫 banned words filter
        const bannedWords = [
            'maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha',
            'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa',
            'aunty', 'uncle', 'aukat'
        ];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });

        api.sendMessage(`${targetName}, ${roastResponse}`, event.threadID);

    } catch (error) {
        console.error("Roast error:", error);
        api.sendMessage("❌ Roast server slow hai!", event.threadID);
    }
}

module.exports = { handleRoast };
