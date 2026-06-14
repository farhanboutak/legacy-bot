const { SlashCommandBuilder } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');

module.exports = [
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Information commands')
    .addSubcommand(sub => sub
      .setName('player')
      .setDescription('View player information')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('faction')
      .setDescription('View faction information')
      .addIntegerOption(opt => opt.setName('id').setDescription('Faction ID').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('vehicle')
      .setDescription('View vehicle information')
      .addStringOption(opt => opt.setName('plate').setDescription('License plate').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('business')
      .setDescription('View business information')
      .addStringOption(opt => opt.setName('name').setDescription('Business name').setRequired(true))
    ),
  {
    name: 'info_player',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const username = interaction.options.getString('username');
      
      const [account] = await database.query(
        'SELECT * FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Player "${username}" not found.`)]
        });
      }
      
      const characters = await database.query(
        'SELECT `Character`, pScore, PlayingHours FROM characters WHERE Username = ? LIMIT 5',
        [username]
      );
      
      const status = account.Banned ? 'Banned' : (account.WhiteList ? 'Active' : 'Pending');
      const statusColor = account.Banned ? '#FF0000' : (account.WhiteList ? '#00FF00' : '#FFA500');
      
      const fields = [
        { name: 'Username', value: account.Username, inline: true },
        { name: 'Status', value: status, inline: true },
        { name: 'Registered', value: HelperService.formatTime(account.RegisterDate), inline: true },
        { name: 'Last Online', value: HelperService.formatTime(account.LoginDate), inline: true }
      ];
      
      if (characters.length) {
        const charList = characters.map((c, i) => `${i + 1}. **${c.Character}** - Level ${c.pScore} (${c.PlayingHours}h)`).join('\n');
        fields.push({ name: 'Characters', value: charList, inline: false });
      }
      
      const embed = EmbedService.create({
        title: `Player: ${account.Username}`,
        color: statusColor,
        fields
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'info_faction',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const factionId = interaction.options.getInteger('id');
      
      const members = await database.query(
        'SELECT `Character`, FactionRank, PlayingHours FROM characters WHERE Faction = ? ORDER BY FactionRank DESC LIMIT 20',
        [factionId]
      );
      
      if (!members.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Faction ID ${factionId} not found or has no members.`)]
        });
      }
      
      const rankGroups = {};
      members.forEach(m => {
        const rank = m.FactionRank;
        if (!rankGroups[rank]) rankGroups[rank] = [];
        rankGroups[rank].push(m);
      });
      
      const description = Object.entries(rankGroups).sort((a, b) => b[0] - a[0]).map(([rank, members]) => {
        const memberList = members.map(m => `• **${m.Character}** (${m.PlayingHours}h)`).join('\n');
        return `**Rank ${rank}**\n${memberList}`;
      }).join('\n\n');
      
      const embed = EmbedService.create({
        title: `Faction ${factionId}`,
        description: description || 'No members with ranks shown.',
        color: '#0099FF',
        footer: `Total members: ${members.length}`
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'info_vehicle',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const plate = interaction.options.getString('plate').toUpperCase();
      
      const [vehicle] = await database.query(
        'SELECT * FROM player_vehicles WHERE Plate = ?',
        [plate]
      );
      
      if (!vehicle) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Vehicle with plate "${plate}" not found.`)]
        });
      }
      
      const embed = EmbedService.create({
        title: `Vehicle Information`,
        color: '#00FF00',
        fields: [
          { name: 'Owner', value: vehicle.Owner, inline: true },
          { name: 'Plate', value: vehicle.Plate, inline: true },
          { name: 'Model ID', value: vehicle.Model.toString(), inline: true },
          { name: 'Health', value: `${Math.floor((vehicle.health / 1000) * 100)}%`, inline: true },
          { name: 'Color 1', value: vehicle.Color1?.toString() || 'Default', inline: true },
          { name: 'Color 2', value: vehicle.Color2?.toString() || 'Default', inline: true }
        ]
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'info_business',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const businessName = interaction.options.getString('name');
      
      const [business] = await database.query(
        'SELECT * FROM businesses WHERE bizName = ?',
        [businessName]
      );
      
      if (!business) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Business "${businessName}" not found.`)]
        });
      }
      
      const embed = EmbedService.create({
        title: `Business: ${business.bizName}`,
        color: '#FFA500',
        fields: [
          { name: 'Owner', value: business.bizOwner || 'None', inline: true },
          { name: 'Type', value: business.bizType?.toString() || 'Unknown', inline: true },
          { name: 'Money', value: HelperService.formatMoney(business.bizMoney || 0), inline: true }
        ]
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
];