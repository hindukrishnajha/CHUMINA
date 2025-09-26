const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateResponse(isTargetAdmin, targetMessage, targetName) {
    try {
        let prompt;
        if (isTargetAdmin) {
            // Support mode for admin/master: Treat as king, support message, act as true friend/slave
            prompt = `
            User ke message ka full support karo. 30-40 words tak. User ko raja ya king ki tarah treat karo, khud ko gulam ya dost maano. User ke message ko agree karo aur uske sath do, jaise ek sachcha dost. Hindi mixed with English.

            STRICT RULES:
            1. FAMILY & RELATIVES COMPLETELY BANNED: maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle, bhabhi - YE SAB WORDS BILKUL BANNED HAI
            2. Koi gaali ya abuse nahi (madarchod, behenchod, etc.)
            3. User ke message ke words ya context se directly related jawab do, apne aap kuch invent mat karo
            4. User ko "bhai", "malik", "raja" jaise shabd se address karo, khud ko "gulam" ya "dost"
            5. Full supportive tone, example: agar user bole "abe ram ko gandu nikla yaar", to jawab "ha bhai ram to shuru se gandu tha mene tujhe btaya bhi tha"

            User: "${targetMessage}"
            Target Name: "${targetName}"

            Tera complete supportive response:`;
        } else {
            // Roast mode for non-admin: Full adult insulting roast
            prompt = `
            User ke message ka pura roast karo. 30-40 words tak. Full adult aur maximum insulting roast ho, lekin koi gaali (madarchod, behenchod, etc.) nahi.

            STRICT RULES:
            1. FAMILY & RELATIVES COMPLETELY BANNED: maa, behen, baap, bhai, dadi, nani, chacha, mausi, bua, chachi, patni, biwi, mummy, papa, aunty, uncle - YE SAB WORDS BILKUL BANNED HAI
            2. "AUKAT" WORD BILKUL BANNED HAI
            3. Ye words use kar sakta hai: chut, lund, chutad, lavdi, lulli, girlfriend ki bra, girlfriend ki chut, girlfriend ki gaand, girlfriend ka bhosda, girlfriend ke boobs, girlfriend ki chikni gaand, girlfriend ki sexy kamar, girlfriend ko pregnant kar duga, teri gaand me baarood bhar duga
            4. Sirf USER ko directly roast karo - kisi aur ko involve mat karo
            5. User ke message ke words ya context se directly related roast karo, apne aap kuch invent mat karo
            6. Hindi mixed with English, full adult tone, lekin gaaliyon se dur raho
            7. Roast hamesha user ke message ke specific words ya theme pe based ho, example: agar user ne "madarchod hai shivam" likha, to shivam ko target karte hue uske message ke words (jaise "madarchod") ko twist karke roast karo bina family words use kiye

            User: "${targetMessage}"
            Target Name: "${targetName}"

            Tera complete roast:`;
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system", 
                    content: isTargetAdmin 
                        ? "Tu ek supportive dost hai jo admin/master ko king ki tarah treat karta hai. Family aur relatives ki gaaliyan completely banned hain. Sirf user ke message ko support karta hai, uske words ke basis pe."
                        : "Tu ek professional roaster hai jo full adult aur insulting roasts deta hai. Family aur relatives ki gaaliyan completely banned hain. Sirf user ko directly roast karta hai, uske message ke words ya context ke basis pe. 'AUKAT' word bilkul banned hai. Allowed adult words: chut, lund, chutad, lavdi, lulli, girlfriend-related phrases."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.9,
            max_tokens: 100,
            top_p: 1,
            stream: false,
        });

        let response = completion.choices[0]?.message?.content || (isTargetAdmin ? "Ha malik, aap sahi keh rahe ho!" : "Aaj dimaag kaam nahi kar raha, kal try kar chutia!");
        
        // Banned words filter
        const bannedWords = ['maa', 'behen', 'baap', 'bhai', 'dadi', 'nani', 'chacha', 'mausi', 'bua', 'chachi', 'patni', 'biwi', 'mummy', 'papa', 'aunty', 'uncle', 'aukat', 'bhabhi'];
        bannedWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            response = response.replace(regex, '');
        });
        
        return response;
    } catch (error) {
        console.error("Response generation error:", error);
        return isTargetAdmin ? "Server slow hai, thodi der baad try kar malik!" : "Server slow hai, thodi der baad try kar chutia!";
    }
}

module.exports = {
  name: 'roast',
  aliases: ['roast'],
  description: 'Toggle auto-roast mode (general or targeted)',
  async execute(api, threadID, args, event, botState, isMaster, botID, stopBot) {
    const isAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(event.senderID) || isMaster;
    if (!isAdmin) {
      return api.sendMessage('🚫 Yeh command sirf admins ya master ke liye hai! 🕉️', threadID);
    }

    const command = args[0]?.toLowerCase();
    const mentionedIDs = Object.keys(event.mentions || {});

    if (command === 'on') {
      if (mentionedIDs.length > 0 && mentionedIDs.length <= 4) {
        // Targeted roast
        if (!botState.roastTargets) botState.roastTargets = {};
        if (!botState.roastTargets[threadID]) botState.roastTargets[threadID] = {};
        mentionedIDs.forEach(id => {
          botState.roastTargets[threadID][id] = true;
        });
        api.getUserInfo(mentionedIDs, (err, userInfo) => {
          let names = mentionedIDs.map(id => userInfo[id]?.name || 'User').join(', ');
          api.sendMessage(`✅ Targeted roast on for ${names}! Ab sirf yeh users roast honge jab message karenge. 🕉️`, threadID);
        });
      } else {
        // General roast
        if (!botState.roastEnabled) botState.roastEnabled = {};
        botState.roastEnabled[threadID] = true;
        api.sendMessage('🔥 Auto-roast ON for all users! Har message pe beizzati, 30 sec gap ke saath. 🕉️', threadID);
      }
    } else if (command === 'off') {
      if (!botState.roastEnabled) botState.roastEnabled = {};
      botState.roastEnabled[threadID] = false;
      if (botState.roastTargets && botState.roastTargets[threadID]) {
        delete botState.roastTargets[threadID];
      }
      api.sendMessage('✅ Auto-roast OFF! Ab koi beizzati nahi. 🕉️', threadID);
    } else if (command === 'manual') {
      // Manual roast command
      let targetMessage = "";
      let targetName = "Unknown";
      let targetID = null;
      let isTargetAdmin = false;

      if (event.messageReply) {
        targetMessage = event.messageReply.body || "";
        targetID = event.messageReply.senderID;
        try {
          const userInfo = await api.getUserInfo(targetID);
          targetName = userInfo[targetID]?.name || "Unknown";
        } catch (e) {
          targetName = "Unknown";
        }
      } else if (Object.keys(event.mentions).length > 0) {
        targetID = Object.keys(event.mentions)[0];
        targetName = event.mentions[targetID];
        targetMessage = event.body.replace(/@.*?/g, '').replace(/^#roast\s+manual\s*/i, '').trim();
      } else {
        targetMessage = event.body.replace(/^#roast\s+manual\s*/i, '').trim();
      }

      if (!targetMessage && !event.messageReply) {
        return api.sendMessage("❌ Kisi message ko reply karo ya kuch text do roast karne ke liye!", threadID);
      }

      // Check if target is admin or master
      if (targetID) {
        isTargetAdmin = Array.isArray(botState.adminList) && botState.adminList.includes(targetID) || targetID === MASTER_ID;
      }

      api.sendTypingIndicator(threadID);
      const response = await generateResponse(isTargetAdmin, targetMessage, targetName);
      
      if (targetName !== "Unknown") {
        api.sendMessage(`${targetName}, ${response}`, threadID);
      } else {
        api.sendMessage(response, threadID);
      }
      return;
    } else {
      api.sendMessage('❌ Use: #roast on (all users) or #roast on @user1 @user2 (targeted, max 4) or #roast off or #roast manual 🕉️', threadID);
    }

    // Save to learned_responses
    if (botState.learnedResponses && botState.learnedResponses[threadID]) {
      botState.learnedResponses[threadID].roastEnabled = botState.roastEnabled ? botState.roastEnabled[threadID] : false;
      botState.learnedResponses[threadID].roastTargets = botState.roastTargets ? botState.roastTargets[threadID] : {};
      const fs = require('fs');
      const path = require('path');
      const LEARNED_RESPONSES_PATH = path.join(__dirname, '../../config/learned_responses.json');
      fs.writeFileSync(LEARNED_RESPONSES_PATH, JSON.stringify(botState.learnedResponses, null, 2), 'utf8');
    }
  }
};
