// utils/fileUtils.js
const fs = require('fs');

function loadAbuseMessages(filePath = 'abuse.txt') {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const messages = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      console.log(`[DEBUG] Loaded ${messages.length} abuse messages from ${filePath}`);
      return messages;
    }
    console.warn(`[WARN] Abuse file ${filePath} not found, returning empty array`);
    return [];
  } catch (err) {
    console.error(`[ERROR] Error reading abuse file ${filePath}:`, err.message);
    return [];
  }
}

function loadWelcomeMessages(filePath = 'welcome.txt') {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const messages = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      console.log(`[DEBUG] Loaded ${messages.length} welcome messages from ${filePath}`);
      return messages;
    }
    console.warn(`[WARN] Welcome file ${filePath} not found, returning default messages`);
    // डिफॉल्ट वेलकम मैसेजेस
    return [
      'Welcome {name} to the group! 🎉',
      'Hey {name}, glad you joined us! 😎',
      '{name}, you’re now part of the crew! 🚀'
    ];
  } catch (err) {
    console.error(`[ERROR] Error reading welcome file ${filePath}:`, err.message);
    return [
      'Welcome {name} to the group! 🎉',
      'Hey {name}, glad you joined us! 😎',
      '{name}, you’re now part of the crew! 🚀'
    ];
  }
}

function saveFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content);
    console.log(`[DEBUG] File ${filePath} saved successfully`);
  } catch (err) {
    console.error(`[ERROR] Error saving file ${filePath}:`, err.message);
    throw err;
  }
}

module.exports = {
  loadAbuseMessages,
  loadWelcomeMessages,
  saveFile
};
