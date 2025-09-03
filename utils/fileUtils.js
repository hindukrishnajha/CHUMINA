const fs = require('fs');
const path = require('path');

module.exports = {
    saveCookies: (userId, cookieContent) => {
        try {
            const cookiePath = path.join(__dirname, `../cookies/${userId}.json`);
            fs.mkdirSync(path.join(__dirname, '../cookies'), { recursive: true }); // Ensure cookies directory exists
            fs.writeFileSync(cookiePath, cookieContent);
            console.log(`Cookies saved for user ${userId} at ${cookiePath}`);
            return true;
        } catch (err) {
            console.error(`Error saving cookies for user ${userId}:`, err);
            throw err;
        }
    },

    loadAbuseMessages: () => {
        try {
            const abusePath = path.join(__dirname, '../abuse.txt');
            if (fs.existsSync(abusePath)) {
                return fs.readFileSync(abusePath, 'utf8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
            }
            return [];
        } catch (err) {
            console.error('Error loading abuse messages:', err);
            return [];
        }
    },

    loadWelcomeMessages: () => {
        try {
            const welcomePath = path.join(__dirname, '../welcome.txt');
            if (fs.existsSync(welcomePath)) {
                return fs.readFileSync(welcomePath, 'utf8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
            }
            return [
                "{name} आया है जलिल होने इस ग्रुप में 🌟",
                "देखो सब {name} को, ये जोकर भी यहाँ ऐड हो गया 🔥",
                "{name} तुझे डर नहीं लगा यहाँ ऐड होने में 👋",
                "जलिल होने की इतनी जल्दी थी कि {name} यहाँ ऐड हो गए 🎉",
                "{name} नाम की मुनिया ग्रुप में ऐड हुई है 😈",
                "सनीलियोन को टक्कर देने वाला {name} इस ग्रुप में ऐड हो चुका है 🔥",
                "मियाखलिफा तो यूं ही बदनाम है, कहर मचाने तो {name} आया है ग्रुप में 😈"
            ];
        } catch (err) {
            console.error('Error loading welcome messages:', err);
            return [];
        }
    }
};
