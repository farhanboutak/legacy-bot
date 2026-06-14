const { SlashCommandBuilder } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');

module.exports = [
  new SlashCommandBuilder()
    .setName('public')
    .setDescription('Public information commands')
    .addSubcommand(sub => sub
      .setName('server')
      .setDescription('View server information')
    )
    .addSubcommand(sub => sub
      .setName('online')
      .setDescription('View online players (estimate)')
    )
    .addSubcommand(sub => sub
      .setName('rules')
      .setDescription('View server rules')
    )
    .addSubcommand(sub => sub
      .setName('help')
      .setDescription('Get help with commands')
    ),
  {
    name: 'public_server',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const [config] = await database.query('SELECT * FROM server_config WHERE id = 1');
      
      const [totalAccounts] = await database.query('SELECT COUNT(*) as total FROM accounts');
      const [onlinePlayers] = await database.query('SELECT COUNT(*) as total FROM accounts WHERE LoginDate > ?', [HelperService.getCurrentTimestamp() - 300]);
      
      const embed = EmbedService.create({
        title: config[0]?.server_name || 'Legacy State Roleplay',
        description: 'Welcome to Legacy State Roleplay - Where stories come to life.',
        color: '#0099FF',
        fields: [
          { name: 'Server IP', value: `\`${config[0]?.server_ip || 'Not set'}:${config[0]?.server_port || 'Not set'}\``, inline: true },
          { name: 'Status', value: config[0]?.server_status === 1 ? '🟢 Online' : '🔴 Offline', inline: true },
          { name: 'Players Online', value: onlinePlayers[0].total.toString(), inline: true },
          { name: 'Total Accounts', value: totalAccounts[0].total.toString(), inline: true },
          { name: 'Game Mode', value: 'Heavy Roleplay', inline: true },
          { name: 'Language', value: 'English / Indonesian', inline: true }
        ],
        footer: 'Use /public help for commands'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'public_online',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const onlinePlayers = await database.query(
        'SELECT Username, LoginDate FROM accounts WHERE LoginDate > ? ORDER BY LoginDate DESC LIMIT 50',
        [HelperService.getCurrentTimestamp() - 300]
      );
      
      if (!onlinePlayers.length) {
        return interaction.editReply({
          embeds: [EmbedService.info('No Players Online', 'There are currently no players online.')]
        });
      }
      
      const description = onlinePlayers.map((player, index) => {
        return `${index + 1}. **${player.Username}** - Last active ${HelperService.formatTime(player.LoginDate)}`;
      }).join('\n');
      
      const embed = EmbedService.create({
        title: `Online Players (${onlinePlayers.length})`,
        description,
        color: '#00FF00',
        footer: 'Estimated based on last 5 minutes activity'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'public_rules',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const embed = EmbedService.create({
        title: 'Server Rules',
        description: 'Please follow these rules to ensure a positive experience for everyone.',
        color: '#FF0000',
        fields: [
          { name: '1. Respect', value: 'Treat all players with respect. No harassment, discrimination, or toxicity.', inline: false },
          { name: '2. Roleplay', value: 'Stay in character at all times. No deathmatch (DM), carjacking, or random killing.', inline: false },
          { name: '3. Realism', value: 'Use realistic roleplay scenarios. No unrealistic actions or powergaming.', inline: false },
          { name: '4. Cheating', value: 'No cheating, exploiting, or using third-party programs. This includes money glitches.', inline: false },
          { name: '5. Metagaming', value: 'Do not use out-of-character information in roleplay situations.', inline: false },
          { name: '6. Voice Chat', value: 'Voice chat is for IC communication only. No OOC talking in voice.', inline: false },
          { name: '7. Advertising', value: 'No advertising of other servers or services.', inline: false },
          { name: '8. Staff', value: 'Follow staff instructions. Do not argue with staff decisions.', inline: false }
        ],
        footer: 'Violations may result in warnings, kicks, or bans'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'public_help',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const embed = EmbedService.create({
        title: 'Command Help',
        description: 'Here are all available commands:',
        color: '#0099FF',
        fields: [
          { name: '📱 Account Commands', value: '`/ucp info` - View account info\n`/ucp register` - Create account\n`/ucp reset` - Reset password\n`/ucp verify` - Get verification code', inline: false },
          { name: '👤 Character Commands', value: '`/character list` - List characters\n`/character stats` - View stats\n`/character story` - Submit story\n`/character delete` - Delete character', inline: false },
          { name: 'ℹ️ Info Commands', value: '`/info player` - View player\n`/info faction` - View faction\n`/info vehicle` - View vehicle\n`/info business` - View business', inline: false },
          { name: '🌐 Public Commands', value: '`/public server` - Server info\n`/public online` - Online players\n`/public rules` - Server rules\n`/public help` - This menu', inline: false },
          { name: '🛡️ Support', value: 'For support, please contact staff or open a ticket.', inline: false }
        ],
        footer: 'Use commands in any text channel'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
];