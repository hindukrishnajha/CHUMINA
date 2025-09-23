const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function handleRoast(api, event, args, botState, userId) {
    try {
        if (!event.isGroup) {
            api.sendMessage("❌ Roast command only works in groups!", event.threadID);
            return;
        }

        let targetMessage = "";
        let targetName = "Unknown";

        if (event.messageReply) {
            targetMessage = event.messageReply.body || "";
            try {
                const userInfo = await api.getUserInfo(event.messageReply.senderID);
                targetName = userInfo[event.messageReply.senderID]?.name || "Unknown";
            } catch (e) {
                targetName = "Unknown";
            }
        } else if (Object.keys(event.mentions).length > 0) {
            const targetID = Object.keys(event.mentions)[0];
            targetName = event.mentions[targetID];
            targetMessage = event.body.replace(/@\[.*?\]/g, '').trim();
        } else {
            targetMessage = event.body.replace(/^#roast\s*/i, '').trim();
        }

        if (!targetMessage && !event.messageReply) {
            api.sendMessage("❌ Kisi message ko reply karo ya kuch text do roast karne ke liye!", event.threadID);
            return;
        }

        api.sendTypingIndicator(event.threadID);

        const prompt = `
        User ke message ka pura roast karo. 30-40 words tak. Complete roast ho.
        
        STRICT RULES:
        1. FAMILY & RELATIVES COMPLETELY BANNED: maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle
        2. "AUKAT" WORD BANNED
        3. Sirf allowed words: gandu, chutia, kinnar, lund, chut, gaand, lavde, chutiye
        4. Sirf USER ko directly roast karo
        5. User ke message ka directly related jawab do: "${targetMessage}"
        6. Hindi mixed with English
        
        Tera complete roast:`;

        // 25 seconds timeout
        const completionPromise = groq.chat.completions.create({
            messages: [
                {
                    role: "system", 
                    content: "Tu ek professional roaster hai. Family aur relatives ki gaaliyan completely banned hain. Sirf user ko directly roast karta hai. 'AUKAT' word bilkul banned hai. Complete roast deta hai."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.9,
            max_tokens: 100,
            top_p: 1,
            stream: false,
        });

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 25000);
        });

        const completion = await Promise.race([completionPromise, timeoutPromise]);
        
        let roastResponse = completion.choices[0]?.message?.content || "Aaj dimaag kaam nahi kar raha, kal try kar gandu!";
        
        // Banned words filter
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            roastResponse = roastResponse.replace(regex, '');
        });
        
        // Send the roast
        if (targetName !== "Unknown") {
            api.sendMessage(`${targetName}, ${roastResponse}`, event.threadID);
        } else {
            api.sendMessage(roastResponse, event.threadID);
        }

    } catch (error) {
        console.error("Roast error:", error);
        
        if (error.message === 'Timeout') {
            api.sendMessage("❌ Roast server slow hai, thodi der baad try kar chutia!", event.threadID);
        } else {
            // Fallback roast
            const fallbackRoasts = [
                "Teri soch se better hai teri choice!",
                "Tere message se accha to mera kutta bhookte hue better baat karta hai!",
                "Jaake apni life sudhar, yaha kyu bakchodi kar raha hai?",
                "Tere jaise logo ko roast karna bhi time waste hai!",
                "Aaj teri life busy hai kya jo yaha time pass kar raha hai?"
            ];
            const randomRoast = fallbackRoasts[Math.floor(Math.random() * fallbackRoasts.length)];
            
            if (targetName !== "Unknown") {
                api.sendMessage(`${targetName}, ${randomRoast}`, event.threadID);
            } else {
                api.sendMessage(randomRoast, event.threadID);
            }
        }
    }
}

module.exports = { handleRoast };
