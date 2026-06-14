const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');
const ValidatorService = require('../../utils/validator');
const GiveawayService = require('../../services/giveawayService');
const { CHANNELS } = require('../../config/constants');

module.exports = [
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('setip')
      .setDescription('Update server IP address')
      .addStringOption(opt => opt.setName('ip').setDescription('IP address').setRequired(true))
      .addIntegerOption(opt => opt.setName('port').setDescription('Port number').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('announce')
      .setDescription('Send an announcement')
      .addStringOption(opt => opt.setName('title').setDescription('Announcement title').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Announcement message').setRequired(true))
      .addStringOption(opt => opt.setName('ping').setDescription('Ping role').addChoices(
        { name: 'Everyone', value: 'everyone' },
        { name: 'Here', value: 'here' },
        { name: 'None', value: 'none' }
      ))
    )
    .addSubcommand(sub => sub
      .setName('broadcast')
      .setDescription('Broadcast DM to all whitelisted users')
      .addStringOption(opt => opt.setName('title').setDescription('Message title').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Message content').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('giveaway')
      .setDescription('Create a giveaway')
      .addStringOption(opt => opt.setName('prize').setDescription('Giveaway prize').setRequired(true))
      .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true))
      .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10))
    )
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('View server statistics')
    ),
  {
    name: 'server_setip',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const ip = interaction.options.getString('ip');
      const port = interaction.options.getInteger('port');
      
      const ipCheck = ValidatorService.validateIPAddress(ip);
      if (!ipCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid IP', ipCheck.error)]
        });
      }
      
      const portCheck = ValidatorService.validatePort(port);
      if (!portCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Port', portCheck.error)]
        });
      }
      
      await database.query(
        `UPDATE server_config 
         SET server_ip = ?, server_port = ?, updated_by = ?, updated_at = ? 
         WHERE id = 1`,
        [ip, port, interaction.user.tag, HelperService.getCurrentTimestamp()]
      );
      
      const logEmbed = EmbedService.info(
        'Server IP Updated',
        `**Admin:** ${interaction.user.tag}\n**New IP:** ${ip}:${port}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Server Updated', `Server IP changed to \`${ip}:${port}\``)]
      });
    }
  },
  {
    name: 'server_announce',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const pingOption = interaction.options.getString('ping') || 'none';
      
      const announcementChannel = interaction.guild.channels.cache.get(CHANNELS.ANNOUNCEMENT);
      if (!announcementChannel) {
        return interaction.editReply({
          embeds: [EmbedService.error('Channel Error', 'Announcement channel not configured.')]
        });
      }
      
      const embed = EmbedService.create({
        title: `📢 ${title}`,
        description: message,
        color: '#F59E0B',
        footer: `Announced by ${interaction.user.tag}`,
        timestamp: true
      });
      
      let content = '';
      if (pingOption === 'everyone') content = '@everyone';
      if (pingOption === 'here') content = '@here';
      
      await announcementChannel.send({ content, embeds: [embed] });
      
      await database.query(
        'INSERT INTO announcements (AdminID, Title, Content, CreatedAt) VALUES (?, ?, ?, ?)',
        [interaction.user.id, title, message, HelperService.getCurrentTimestamp()]
      );
      
      return interaction.editReply({
        embeds: [EmbedService.success('Announcement Sent', 'Your announcement has been posted.')]
      });
    }
  },
  {
    name: 'server_broadcast',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      
      const accounts = await database.query(
        'SELECT DiscordID FROM accounts WHERE WhiteList = 1 AND Banned = 0 AND DiscordID IS NOT NULL'
      );
      
      let success = 0;
      let failed = 0;
      
      for (const account of accounts) {
        try {
          const user = await interaction.client.users.fetch(account.DiscordID);
          if (user) {
            const embed = EmbedService.create({
              title: `📢 ${title}`,
              description: message,
              color: '#0099FF',
              footer: 'Legacy State Roleplay Announcement'
            });
            await user.send({ embeds: [embed] });
            success++;
          }
        } catch (error) {
          failed++;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const logEmbed = EmbedService.info(
        'Broadcast Sent',
        `**Admin:** ${interaction.user.tag}\n**Sent:** ${success}\n**Failed:** ${failed}\n**Title:** ${title}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success(
          'Broadcast Complete',
          `Message sent to ${success} users.\nFailed: ${failed}`
        )]
      });
    }
  },
  {
    name: 'server_giveaway',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const prize = interaction.options.getString('prize');
      const duration = interaction.options.getInteger('duration');
      const winners = interaction.options.getInteger('winners') || 1;
      
      if (duration < 5) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Duration', 'Giveaway duration must be at least 5 minutes.')]
        });
      }
      
      const channelId = CHANNELS.GIVEAWAY_PANEL;
      
      const giveawayId = await GiveawayService.createGiveaway(
        interaction.guild,
        channelId,
        prize,
        duration,
        winners,
        interaction.user.id
      );
      
      return interaction.editReply({
        embeds: [EmbedService.success(
          'Giveaway Created',
          `Giveaway for **${prize}** has been created!\nDuration: ${duration} minutes\nWinners: ${winners}\nGiveaway ID: #${giveawayId}`
        )]
      });
    }
  },
  {
    name: 'server_stats',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const [totalAccounts] = await database.query('SELECT COUNT(*) as total FROM accounts');
      const [whitelisted] = await database.query('SELECT COUNT(*) as total FROM accounts WHERE WhiteList = 1');
      const [banned] = await database.query('SELECT COUNT(*) as total FROM accounts WHERE Banned = 1');
      const [totalCharacters] = await database.query('SELECT COUNT(*) as total FROM characters');
      const [totalVehicles] = await database.query('SELECT COUNT(*) as total FROM player_vehicles');
      const [totalBusinesses] = await database.query('SELECT COUNT(*) as total FROM businesses');
      const [pendingStories] = await database.query('SELECT COUNT(*) as total FROM char_stories WHERE Status = 0');
      const [pendingReports] = await database.query('SELECT COUNT(*) as total FROM reports WHERE Status = 0');
      
      const [config] = await database.query('SELECT server_ip, server_port, server_name FROM server_config WHERE id = 1');
      
      const embed = EmbedService.create({
        title: 'Server Statistics',
        color: '#0099FF',
        fields: [
          { name: 'Server Name', value: config[0]?.server_name || 'Legacy State RP', inline: true },
          { name: 'Server IP', value: `${config[0]?.server_ip || 'Not set'}:${config[0]?.server_port || 'Not set'}`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Total Accounts', value: totalAccounts[0].total.toString(), inline: true },
          { name: 'Whitelisted', value: whitelisted[0].total.toString(), inline: true },
          { name: 'Banned', value: banned[0].total.toString(), inline: true },
          { name: 'Characters', value: totalCharacters[0].total.toString(), inline: true },
          { name: 'Vehicles', value: totalVehicles[0].total.toString(), inline: true },
          { name: 'Businesses', value: totalBusinesses[0].total.toString(), inline: true },
          { name: 'Pending Stories', value: pendingStories[0].total.toString(), inline: true },
          { name: 'Pending Reports', value: pendingReports[0].total.toString(), inline: true }
        ],
        footer: `Last updated • ${interaction.user.tag}`
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
];