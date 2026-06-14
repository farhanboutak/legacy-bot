require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const database = require('./utils/database');
const logger = require('./utils/logger');
const CommandHandler = require('./handlers/commandHandler');
const ButtonHandler = require('./handlers/buttonHandler');
const ModalHandler = require('./handlers/modalHandler');
const SelectHandler = require('./handlers/selectHandler');
const { CHANNELS } = require('./config/constants');
const EmbedService = require('./utils/embeds');
const HelperService = require('./utils/helpers');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Initialize handlers
const commandHandler = new CommandHandler(client);
const buttonHandler = new ButtonHandler(client);
const modalHandler = new ModalHandler(client);
const selectHandler = new SelectHandler(client);

async function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS accounts (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(25) NOT NULL UNIQUE,
      Password VARCHAR(129) NOT NULL,
      Salt VARCHAR(65) NOT NULL,
      Email VARCHAR(64) DEFAULT 'legacystate@fixed.com',
      PhoneNumber VARCHAR(24) DEFAULT '085722222222',
      IP VARCHAR(17) DEFAULT '127.0.0.1',
      Banned INT NOT NULL DEFAULT 0,
      Admin INT NOT NULL DEFAULT 0,
      RegisterDate INT NOT NULL DEFAULT 0,
      LoginDate INT NOT NULL DEFAULT 0,
      VerifyCode VARCHAR(64) DEFAULT NULL,
      WhiteList INT NOT NULL DEFAULT 0,
      DiscordID VARCHAR(64) DEFAULT NULL,
      LastCharacterDelete BIGINT DEFAULT 0,
      CreatedAt INT DEFAULT 0,
      UpdatedAt INT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS characters (
      ID INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(24) NOT NULL,
      \`Character\` VARCHAR(24) NOT NULL UNIQUE,
      \`password\` VARCHAR(65) NOT NULL,
      \`salt\` VARCHAR(65) NOT NULL,
      Gender INT DEFAULT 0,
      Money INT DEFAULT 5000,
      BankMoney INT DEFAULT 0,
      pScore INT DEFAULT 0,
      PlayingHours INT DEFAULT 0,
      Faction INT DEFAULT -1,
      FactionRank INT DEFAULT 0,
      Job VARCHAR(24) DEFAULT '0|0',
      Health FLOAT DEFAULT 100,
      ArmorStatus FLOAT DEFAULT 0,
      Created INT DEFAULT 0,
      LastLogin INT DEFAULT 0,
      VipTime INT DEFAULT 0,
      Vip INT DEFAULT 0,
      Gold INT DEFAULT 0,
      Story INT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS server_config (
      id INT PRIMARY KEY DEFAULT 1,
      server_ip VARCHAR(45) DEFAULT '185.158.143.164',
      server_port INT DEFAULT 7777,
      server_name VARCHAR(100) DEFAULT 'Legacy State Roleplay',
      server_status INT DEFAULT 1,
      updated_by VARCHAR(100),
      updated_at INT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS warnings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Username VARCHAR(64),
      AdminID VARCHAR(32),
      Reason TEXT,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS namechanges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      OldName VARCHAR(64),
      NewName VARCHAR(64),
      UserID INT DEFAULT 0,
      Status INT DEFAULT 0,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS char_stories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`Character\` VARCHAR(64),
      Username VARCHAR(64),
      DiscordID VARCHAR(32),
      Story TEXT,
      Status INT DEFAULT 0,
      AdminNote TEXT,
      ReviewedBy VARCHAR(32),
      CreatedAt BIGINT DEFAULT 0,
      ReviewedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ReporterID VARCHAR(32),
      ReporterName VARCHAR(64),
      TargetName VARCHAR(64),
      Type VARCHAR(32),
      Reason TEXT,
      Evidence TEXT,
      Status INT DEFAULT 0,
      AdminNote TEXT,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS suggestions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      DiscordID VARCHAR(32),
      Username VARCHAR(64),
      Title VARCHAR(128),
      Content TEXT,
      Status INT DEFAULT 0,
      AdminNote TEXT,
      Votes INT DEFAULT 0,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS giveaways (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Prize TEXT,
      WinnerCount INT DEFAULT 1,
      EndTime BIGINT DEFAULT 0,
      MessageID VARCHAR(32),
      ChannelID VARCHAR(32),
      HostID VARCHAR(32),
      Active INT DEFAULT 1,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS giveaway_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      GiveawayID INT,
      DiscordID VARCHAR(32),
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      AdminID VARCHAR(32),
      Title VARCHAR(128),
      Content TEXT,
      CreatedAt BIGINT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS player_vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Owner VARCHAR(64),
      Plate VARCHAR(20),
      Model INT DEFAULT 0,
      health INT DEFAULT 1000,
      Color1 INT DEFAULT 1,
      Color2 INT DEFAULT 1
    )`,
    
    `CREATE TABLE IF NOT EXISTS businesses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bizOwner VARCHAR(64),
      bizName VARCHAR(128),
      bizType INT DEFAULT 0,
      bizMoney INT DEFAULT 0
    )`,
    
    `CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`Character\` VARCHAR(64),
      ItemName VARCHAR(64),
      Amount INT DEFAULT 0,
      UNIQUE KEY unique_inv (\`Character\`, ItemName)
    )`
  ];

  for (const query of tables) {
    try {
      await database.query(query);
      logger.info(`Table verified: ${query.substring(0, 50)}...`);
    } catch (error) {
      logger.warn(`Table warning: ${error.message}`);
    }
  }

  const config = await database.query('SELECT * FROM server_config WHERE id = 1');
  if (!config || config.length === 0) {
    await database.query(
      'INSERT INTO server_config (id, server_ip, server_port, server_name, updated_at) VALUES (1, ?, ?, ?, ?)',
      [process.env.SERVER_IP || '185.158.143.164', process.env.SERVER_PORT || 7777, 'Legacy State Roleplay', HelperService.getCurrentTimestamp()]
    );
  }
}

async function registerCommands() {
  const commands = [
    {
      name: 'ucp',
      description: 'User Control Panel commands',
      options: [
        {
          name: 'info',
          description: 'View your account information',
          type: 1
        },
        {
          name: 'reset',
          description: 'Reset your account password',
          type: 1
        },
        {
          name: 'verify',
          description: 'Request a new verification code',
          type: 1
        }
      ]
    },
    {
      name: 'character',
      description: 'Manage your in-game characters',
      options: [
        {
          name: 'list',
          description: 'List all your characters',
          type: 1
        },
        {
          name: 'stats',
          description: 'View character statistics',
          type: 1,
          options: [
            {
              name: 'name',
              description: 'Character name',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'story',
          description: 'Submit or view character story',
          type: 1,
          options: [
            {
              name: 'name',
              description: 'Character name',
              type: 3,
              required: true
            },
            {
              name: 'content',
              description: 'Story content for submission',
              type: 3,
              required: false
            }
          ]
        },
        {
          name: 'delete',
          description: 'Request character deletion',
          type: 1,
          options: [
            {
              name: 'name',
              description: 'Character name',
              type: 3,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: 'info',
      description: 'Get information about players and game content',
      options: [
        {
          name: 'player',
          description: 'View player information',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Player username',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'faction',
          description: 'View faction information',
          type: 1,
          options: [
            {
              name: 'id',
              description: 'Faction ID',
              type: 4,
              required: true
            }
          ]
        },
        {
          name: 'vehicle',
          description: 'View vehicle information',
          type: 1,
          options: [
            {
              name: 'plate',
              description: 'License plate number',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'business',
          description: 'View business information',
          type: 1,
          options: [
            {
              name: 'name',
              description: 'Business name',
              type: 3,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: 'admin',
      description: 'Administrative commands',
      default_member_permissions: '8',
      options: [
        {
          name: 'whitelist',
          description: 'Whitelist a user account',
          type: 1,
          options: [
            {
              name: 'user',
              description: 'User to whitelist',
              type: 6,
              required: true
            }
          ]
        },
        {
          name: 'ban',
          description: 'Ban a user account',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username to ban',
              type: 3,
              required: true
            },
            {
              name: 'reason',
              description: 'Ban reason',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'unban',
          description: 'Unban a user account',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username to unban',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'view',
          description: 'View user account details',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username to view',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'search',
          description: 'Search for users by username',
          type: 1,
          options: [
            {
              name: 'query',
              description: 'Search query',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'resetpass',
          description: 'Reset user password',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            },
            {
              name: 'password',
              description: 'New password',
              type: 3,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: 'economy',
      description: 'Economy management commands',
      default_member_permissions: '8',
      options: [
        {
          name: 'money',
          description: 'Manage player money',
          type: 1,
          options: [
            {
              name: 'character',
              description: 'Character name',
              type: 3,
              required: true
            },
            {
              name: 'action',
              description: 'Action to perform',
              type: 3,
              required: true,
              choices: [
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' },
                { name: 'Set', value: 'set' }
              ]
            },
            {
              name: 'amount',
              description: 'Amount of money',
              type: 4,
              required: true
            }
          ]
        },
        {
          name: 'gold',
          description: 'Manage player gold',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            },
            {
              name: 'action',
              description: 'Action to perform',
              type: 3,
              required: true,
              choices: [
                { name: 'Add', value: 'add' },
                { name: 'Remove', value: 'remove' },
                { name: 'Set', value: 'set' }
              ]
            },
            {
              name: 'amount',
              description: 'Amount of gold',
              type: 4,
              required: true
            }
          ]
        },
        {
          name: 'vip',
          description: 'Grant VIP status to a player',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            },
            {
              name: 'days',
              description: 'Number of days',
              type: 4,
              required: true
            }
          ]
        },
        {
          name: 'top',
          description: 'View top richest players',
          type: 1,
          options: [
            {
              name: 'limit',
              description: 'Number of results (5-25)',
              type: 4,
              required: false,
              min_value: 5,
              max_value: 25
            }
          ]
        }
      ]
    },
    {
      name: 'server',
      description: 'Server management commands',
      default_member_permissions: '8',
      options: [
        {
          name: 'setip',
          description: 'Update server IP address',
          type: 1,
          options: [
            {
              name: 'ip',
              description: 'IP address',
              type: 3,
              required: true
            },
            {
              name: 'port',
              description: 'Port number',
              type: 4,
              required: true
            }
          ]
        },
        {
          name: 'announce',
          description: 'Send an announcement',
          type: 1,
          options: [
            {
              name: 'title',
              description: 'Announcement title',
              type: 3,
              required: true
            },
            {
              name: 'message',
              description: 'Announcement message',
              type: 3,
              required: true
            },
            {
              name: 'ping',
              description: 'Role to ping',
              type: 3,
              required: false,
              choices: [
                { name: 'Everyone', value: 'everyone' },
                { name: 'Here', value: 'here' },
                { name: 'None', value: 'none' }
              ]
            }
          ]
        },
        {
          name: 'broadcast',
          description: 'Broadcast DM to all whitelisted users',
          type: 1,
          options: [
            {
              name: 'title',
              description: 'Message title',
              type: 3,
              required: true
            },
            {
              name: 'message',
              description: 'Message content',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'giveaway',
          description: 'Create a giveaway',
          type: 1,
          options: [
            {
              name: 'prize',
              description: 'Giveaway prize',
              type: 3,
              required: true
            },
            {
              name: 'duration',
              description: 'Duration in minutes',
              type: 4,
              required: true
            },
            {
              name: 'winners',
              description: 'Number of winners (1-10)',
              type: 4,
              required: false,
              min_value: 1,
              max_value: 10
            }
          ]
        },
        {
          name: 'stats',
          description: 'View server statistics',
          type: 1
        }
      ]
    },
    {
      name: 'mod',
      description: 'Moderation commands',
      default_member_permissions: '1099511627776',
      options: [
        {
          name: 'warn',
          description: 'Warn a player',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            },
            {
              name: 'reason',
              description: 'Warning reason',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'clearwarns',
          description: 'Clear all warnings for a player',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'warnings',
          description: 'View warnings for a player',
          type: 1,
          options: [
            {
              name: 'username',
              description: 'Username',
              type: 3,
              required: true
            }
          ]
        },
        {
          name: 'kick',
          description: 'Kick a player from Discord server',
          type: 1,
          options: [
            {
              name: 'user',
              description: 'User to kick',
              type: 6,
              required: true
            },
            {
              name: 'reason',
              description: 'Kick reason',
              type: 3,
              required: false
            }
          ]
        },
        {
          name: 'timeout',
          description: 'Timeout a user',
          type: 1,
          options: [
            {
              name: 'user',
              description: 'User to timeout',
              type: 6,
              required: true
            },
            {
              name: 'minutes',
              description: 'Timeout duration in minutes',
              type: 4,
              required: true
            },
            {
              name: 'reason',
              description: 'Timeout reason',
              type: 3,
              required: false
            }
          ]
        }
      ]
    },
    {
      name: 'public',
      description: 'Public information commands',
      options: [
        {
          name: 'server',
          description: 'View server information',
          type: 1
        },
        {
          name: 'online',
          description: 'View online players (estimate)',
          type: 1
        },
        {
          name: 'rules',
          description: 'View server rules',
          type: 1
        },
        {
          name: 'help',
          description: 'Get help with commands',
          type: 1
        }
      ]
    }
  ];
  
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  
  try {
    logger.info('Starting command registration...');
    
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: [] }
    );
    logger.info('Cleared existing commands');
    
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    logger.info(`Successfully registered ${commands.length} slash commands`);
  } catch (error) {
    logger.error('Failed to register commands:', error);
    throw error;
  }
}

client.once('ready', async () => {
  logger.info(`Bot online as ${client.user.tag}`);
  
  try {
    await database.connect({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    await initializeDatabase();
    await registerCommands();
    await commandHandler.loadCommands();
    
    const startupChannel = client.channels.cache.get(CHANNELS.STARTUP_LOG);
    if (startupChannel) {
      const embed = EmbedService.success(
        'System Online',
        `Bot is now operational as **${client.user.tag}**\nDatabase: **Connected**\nCommands: **${client.commands.size} loaded**`
      );
      await startupChannel.send({ embeds: [embed] });
    }
    
    const { initializePanels } = require('./panels');
    await initializePanels(client);
    
    logger.info('Bot initialization complete');
  } catch (error) {
    logger.error('Failed to initialize bot:', error);
    process.exit(1);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await commandHandler.execute(interaction);
    } else if (interaction.isButton()) {
      await buttonHandler.execute(interaction);
    } else if (interaction.isModalSubmit()) {
      await modalHandler.execute(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await selectHandler.execute(interaction);
    }
  } catch (error) {
    logger.error('Interaction error:', error);
    const reply = {
      embeds: [EmbedService.error('Error', 'An error occurred while processing your request.')],
      ephemeral: true
    };
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(reply).catch(() => {});
    } else {
      await interaction.editReply(reply).catch(() => {});
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('!')) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'ping') {
    await message.reply('Pong!');
  } else if (command === 'help') {
    const embed = EmbedService.info('Commands', 'Use `/public help` to see all available commands.');
    await message.reply({ embeds: [embed] });
  }
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

client.login(process.env.TOKEN);