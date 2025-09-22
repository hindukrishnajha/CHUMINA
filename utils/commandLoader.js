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
            }
        }
    }
    
    console.log(`[COMMAND-LOADER] 🎯 Total commands loaded: ${commands.size}`);
    
    // Debug: List all loaded commands
    if (commands.size > 0) {
        console.log('[COMMAND-LOADER] 📋 Loaded commands:');
        commands.forEach((cmd, key) => {
            console.log(`   ${key} -> ${cmd.name}`);
        });
    }
    
    return commands;
}

// Test function to verify commands
function testCommandLoading() {
    const commands = loadCommands();
    
    // Test some common commands
    const testCommands = ['help', 'info', 'mafia', 'kick', 'addadmin'];
    testCommands.forEach(cmd => {
        const command = commands.get(cmd);
        if (command) {
            console.log(`[TEST] ✅ ${cmd} command loaded successfully`);
        } else {
            console.log(`[TEST] ❌ ${cmd} command not found`);
        }
    });
    
    return commands.size > 0;
}

module.exports = {
    loadCommands,
    testCommandLoading
};
