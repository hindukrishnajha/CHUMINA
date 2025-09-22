// src/bot/commands.js
const fs = require('fs');
const path = require('path');

const commands = new Map();

function loadCommands() {
  const commandFolders = ['admin', 'user', 'master'];
  for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, `../../commands/${folder}`)).filter(file => file.endsWith('.js'));
    console.log(`[DEBUG] Scanning folder: ${folder}, found files: ${commandFiles}`);
    for (const file of commandFiles) {
      try {
        const command = require(path.join(__dirname, `../../commands/${folder}/${file}`));
        console.log(`[DEBUG] Loading command: ${command.name} from ${file}`);
        commands.set(command.name, command);
        if (command.aliases) {
          command.aliases.forEach(alias => {
            console.log(`[DEBUG] Loading alias: ${alias} for command ${command.name}`);
            commands.set(alias, command);
          });
        }
      } catch (err) {
        console.error(`Error loading command ${file} from ${folder}:`, err.message);
      }
    }
  }
  console.log('[DEBUG] All loaded commands:', Array.from(commands.keys()));
}

module.exports = { commands, loadCommands };
