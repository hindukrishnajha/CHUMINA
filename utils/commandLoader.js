const fs = require('fs');
const path = require('path');

function loadCommands() {
    const commands = new Map();
    const commandFolders = ['admin', 'user', 'master'];
    
    console.log('[COMMAND-LOADER] Starting command loading...');
    
    for (const folder of commandFolders) {
        const folderPath = path.join(__dirname, '../commands', folder);
        
        if (!fs.existsSync(folderPath)) {
            console.log(`[COMMAND-LOADER] ❌ Folder not found: ${folderPath}`);
            continue;
        }

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        console.log(`[COMMAND-LOADER] 📁 Loading ${commandFiles.length} commands from ${folder}`);
        
        for (const file of commandFiles) {
            try {
                const commandPath = path.join(folderPath, file);
                console.log(`[COMMAND-LOADER] Trying to load: ${file}`);
                
                const command = require(commandPath);
                
                if (!command.name) {
                    console.log(`[COMMAND-LOADER] ⚠️ ${file} has no name property`);
                    continue;
                }

                // Check if command has execute function
                if (typeof command.execute !== 'function') {
                    console.log(`[COMMAND-LOADER] ❌ ${file} has no execute function`);
                    continue;
                }

                commands.set(command.name.toLowerCase(), command);
                console.log(`[COMMAND-LOADER] ✅ Loaded: ${command.name}`);
                
                // Load aliases
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => {
                        if (alias && typeof alias === 'string') {
                            commands.set(alias.toLowerCase(), command);
                            console.log(`[COMMAND-LOADER]   Alias: ${alias} -> ${command.name}`);
                        }
                    });
                }
            } catch (err) {
                console.error(`[COMMAND-LOADER] ❌ Failed to load ${file}:`, err.message);
                console.error(err.stack); // Full error stack
            }
        }
    }
    
    console.log(`[COMMAND-LOADER] 🎯 Total commands loaded: ${commands.size}`);
    
    // Debug: List all loaded commands
    console.log('[COMMAND-LOADER] 📋 All loaded commands:');
    commands.forEach((cmd, key) => {
        console.log(`   ${key} -> ${cmd.name}`);
    });
    
    return commands;
}

module.exports = {
    loadCommands
};
