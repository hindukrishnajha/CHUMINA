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
        console.log(`[COMMAND-LOADER] 📁 Loading commands from ${folder}:`, commandFiles);
        
        for (const file of commandFiles) {
            try {
                const commandPath = path.join(folderPath, file);
                console.log(`[COMMAND-LOADER] 🔄 Loading: ${file}`);
                
                // Delete cache to ensure fresh load
                delete require.cache[require.resolve(commandPath)];
                
                const command = require(commandPath);
                
                if (!command.name) {
                    console.log(`[COMMAND-LOADER] ⚠️ ${file} has no name property`);
                    continue;
                }

                if (typeof command.execute !== 'function') {
                    console.log(`[COMMAND-LOADER] ⚠️ ${file} has no execute function`);
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
            }
        }
    }
    
    console.log(`[COMMAND-LOADER] 🎯 Total commands loaded: ${commands.size}`);
    
    // SPECIAL DEBUG: Check if delete command exists
    const deleteCmd = commands.get('delete');
    console.log(`[COMMAND-LOADER] 🔍 Delete command found: ${!!deleteCmd}`);
    if (deleteCmd) {
        console.log(`[COMMAND-LOADER] 🔍 Delete command details:`, deleteCmd.name, deleteCmd.aliases);
    }
    
    return commands;
}

module.exports = {
    loadCommands
};
