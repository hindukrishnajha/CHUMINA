const fs = require('fs');
const path = require('path');

function loadAbuseMessages() {
    try {
        if (fs.existsSync('abuse.txt')) {
            const content = fs.readFileSync('abuse.txt', 'utf8');
            const messages = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            console.log(`[FILE-UTILS] Loaded ${messages.length} abuse messages`);
            return messages;
        } else {
            console.log('[FILE-UTILS] abuse.txt not found, creating empty file');
            fs.writeFileSync('abuse.txt', '', 'utf8');
            return [];
        }
    } catch (err) {
        console.error('[FILE-UTILS] Error loading abuse messages:', err.message);
        return [];
    }
}

function loadWelcomeMessages() {
    try {
        if (fs.existsSync('welcome.txt')) {
            const content = fs.readFileSync('welcome.txt', 'utf8');
            const messages = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            console.log(`[FILE-UTILS] Loaded ${messages.length} welcome messages`);
            return messages;
        } else {
            // Default welcome messages
            const defaultMessages = [
                "🎉 Welcome {name} to the group!",
                "👋 Hello {name}, glad to have you here!",
                "😊 Hey {name}, welcome to our family!",
                "🌟 Namaste {name}, aapka swagat hai!",
                "🕉️ Jai Shri Ram {name}, welcome bhailog!"
            ];
            console.log('[FILE-UTILS] welcome.txt not found, using default messages');
            return defaultMessages;
        }
    } catch (err) {
        console.error('[FILE-UTILS] Error loading welcome messages:', err.message);
        return ["Welcome {name} to the group! 🎉"];
    }
}

function saveFile(filename, content) {
    try {
        fs.writeFileSync(filename, content, 'utf8');
        console.log(`[FILE-UTILS] Saved ${filename} successfully`);
        return true;
    } catch (err) {
        console.error(`[FILE-UTILS] Error saving ${filename}:`, err.message);
        return false;
    }
}

function fileExists(filepath) {
    return fs.existsSync(filepath);
}

function readJSONFile(filepath, defaultData = {}) {
    try {
        if (fs.existsSync(filepath)) {
            const content = fs.readFileSync(filepath, 'utf8');
            return JSON.parse(content);
        }
        return defaultData;
    } catch (err) {
        console.error(`[FILE-UTILS] Error reading JSON ${filepath}:`, err.message);
        return defaultData;
    }
}

function writeJSONFile(filepath, data) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`[FILE-UTILS] Error writing JSON ${filepath}:`, err.message);
        return false;
    }
}

function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[FILE-UTILS] Created directory: ${dirPath}`);
    }
}

module.exports = {
    loadAbuseMessages,
    loadWelcomeMessages,
    saveFile,
    fileExists,
    readJSONFile,
    writeJSONFile,
    ensureDirectory
};
