const fs = require('fs');

function loadAbuseMessages(filePath = 'abuse.txt') {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        }
        return [];
    } catch (err) {
        console.error(`Error reading abuse file ${filePath}:`, err.message);
        return [];
    }
}

function loadWelcomeMessages() {
    try {
        if (fs.existsSync('welcome.txt')) {
            const content = fs.readFileSync('welcome.txt', 'utf8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
        }
        return [];
    } catch (err) {
        console.error('Error reading welcome.txt:', err.message);
        return [];
    }
}

function saveFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content);
        console.log(`File ${filePath} saved successfully`);
    } catch (err) {
        console.error(`Error saving file ${filePath}:`, err.message);
        throw err;
    }
}

module.exports = {
    loadAbuseMessages,
    loadWelcomeMessages,
    saveFile
};
