const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');

class CommandHandler {
  constructor(client) {
    this.client = client;
    this.cooldowns = new Map();
  }

  async execute(interaction) {
    const { commandName, user, guild } = interaction;
    
    const command = this.client.commands.get(commandName);
    if (!command) {
      logger.warn(`Command not found: ${commandName}`);
      return interaction.reply({
        embeds: [EmbedService.error('Command Error', 'This command does not exist.')],
        ephemeral: true
      });
    }

    // Check cooldown
    if (this.isOnCooldown(commandName, user.id)) {
      const remaining = this.getCooldownRemaining(commandName, user.id);
      return interaction.reply({
        embeds: [EmbedService.warning(
          'Cooldown',
          `Please wait ${Math.ceil(remaining / 1000)} seconds before using this command again.`
        )],
        ephemeral: true
      });
    }

    logger.info(`Command executed: ${commandName} by ${user.tag} in ${guild?.name || 'DM'}`);

    try {
      await command.execute(interaction);
      this.setCooldown(commandName, user.id);
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      
      const reply = {
        embeds: [EmbedService.error('Command Failed', error.message || 'An unexpected error occurred.')],
        ephemeral: true
      };
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(reply);
      } else {
        await interaction.editReply(reply);
      }
    }
  }

  isOnCooldown(commandName, userId) {
    const key = `${commandName}:${userId}`;
    const cooldown = this.cooldowns.get(key);
    if (!cooldown) return false;
    
    const now = Date.now();
    return now - cooldown < 3000;
  }

  getCooldownRemaining(commandName, userId) {
    const key = `${commandName}:${userId}`;
    const cooldown = this.cooldowns.get(key);
    if (!cooldown) return 0;
    
    const now = Date.now();
    const remaining = 3000 - (now - cooldown);
    return Math.max(0, remaining);
  }

  setCooldown(commandName, userId) {
    const key = `${commandName}:${userId}`;
    this.cooldowns.set(key, Date.now());
    
    setTimeout(() => {
      this.cooldowns.delete(key);
    }, 3000);
  }

  async loadCommands() {
    // Initialize commands Map if not exists
    if (!this.client.commands) {
      this.client.commands = new Map();
    }
    
    try {
      // Load UCP commands
      const ucpCommands = require('../commands/player/ucpCommands');
      if (Array.isArray(ucpCommands)) {
        for (const cmd of ucpCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      // Load Character commands
      const characterCommands = require('../commands/player/characterCommands');
      if (Array.isArray(characterCommands)) {
        for (const cmd of characterCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      // Load Info commands
      const infoCommands = require('../commands/player/infoCommands');
      if (Array.isArray(infoCommands)) {
        for (const cmd of infoCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      // Load Admin commands
      const userAdminCommands = require('../commands/admin/userCommands');
      if (Array.isArray(userAdminCommands)) {
        for (const cmd of userAdminCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      const economyCommands = require('../commands/admin/economyCommands');
      if (Array.isArray(economyCommands)) {
        for (const cmd of economyCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      const serverCommands = require('../commands/admin/serverCommands');
      if (Array.isArray(serverCommands)) {
        for (const cmd of serverCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      const moderationCommands = require('../commands/admin/moderationCommands');
      if (Array.isArray(moderationCommands)) {
        for (const cmd of moderationCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      // Load Public commands
      const publicServerCommands = require('../commands/public/serverCommands');
      if (Array.isArray(publicServerCommands)) {
        for (const cmd of publicServerCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      const publicInfoCommands = require('../commands/public/infoCommands');
      if (Array.isArray(publicInfoCommands)) {
        for (const cmd of publicInfoCommands) {
          if (cmd && cmd.name && cmd.execute) {
            this.client.commands.set(cmd.name, cmd);
            logger.info(`Loaded command: ${cmd.name}`);
          }
        }
      }
      
      logger.info(`Total commands loaded: ${this.client.commands.size}`);
    } catch (error) {
      logger.error('Error loading commands:', error);
      throw error;
    }
  }
}

module.exports = CommandHandler;