const { SlashCommandBuilder } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');

module.exports = [
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Server information commands')
    .addSubcommand(sub => sub.setName('info').setDescription('View server statistics'))
    .addSubcommand(sub => sub.setName('ip').setDescription('View server connection details'))
    .addSubcommand(sub => sub.setName('status').setDescription('Check server status'))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View server leaderboards')
      .addStringOption(opt => opt.setName('type').setDescription('Leaderboard type')
        .addChoices(
          { name: 'Score', value: 'pScore' },
          { name: 'Playtime', value: 'PlayingHours' },
          { name: 'Wealth', value: 'Money' }
        ).setRequired(true)))
].map(cmd => {
  return {
    name: cmd.name,
    execute: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'info') {
        await interaction.deferReply();
        
        const [stats] = await database.query(`
          SELECT 
            (SELECT COUNT(*) FROM accounts) as total_accounts,
            (SELECT COUNT(*) FROM accounts WHERE WhiteList = 1) as whitelisted,
            (SELECT COUNT(*) FROM accounts WHERE Banned = 1) as banned,
            (SELECT COUNT(*) FROM characters) as total_characters,
            (SELECT COUNT(*) FROM characters WHERE Faction > 0) as faction_members
        `);
        
        const embed = EmbedService.create({
          title: 'Server Information',
          color: '#0099FF',
          fields: [
            { name: 'Total Accounts', value: stats.total_accounts.toString(), inline: true },
            { name: 'Whitelisted', value: stats.whitelisted.toString(), inline: true },
            { name: 'Banned', value: stats.banned.toString(), inline: true },
            { name: 'Total Characters', value: stats.total_characters.toString(), inline: true },
            { name: 'Faction Members', value: stats.faction_members.toString(), inline: true },
            { name: 'Server IP', value: `${process.env.SERVER_IP}:${process.env.SERVER_PORT}`, inline: true }
          ]
        });
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      if (subcommand === 'ip') {
        await interaction.deferReply();
        
        const [config] = await database.query('SELECT * FROM server_config WHERE id = 1');
        
        const embed = EmbedService.create({
          title: config.server_name || 'Server Connection',
          description: `\`\`\`\n${config.server_ip}:${config.server_port}\n\`\`\``,
          color: '#00FF00',
          fields: [
            { name: 'IP Address', value: `\`${config.server_ip}\``, inline: true },
            { name: 'Port', value: `\`${config.server_port}\``, inline: true },
            { name: 'Status', value: config.server_status === 1 ? '🟢 Online' : '🔴 Offline', inline: true }
          ]
        });
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      if (subcommand === 'leaderboard') {
        await interaction.deferReply();
        
        const type = interaction.options.getString('type');
        const [results] = await database.query(
          `SELECT \`Character\`, \`${type}\` FROM characters ORDER BY \`${type}\` DESC LIMIT 10`
        );
        
        if (!results.length) {
          return interaction.editReply({
            embeds: [EmbedService.error('No Data', 'No data available for leaderboard.')]
          });
        }
        
        const typeLabels = {
          pScore: 'Score',
          PlayingHours: 'Playtime (Hours)',
          Money: 'Money'
        };
        
        const description = results.map((row, index) => {
          let value = row[type];
          if (type === 'Money') value = HelperService.formatMoney(value);
          if (type === 'PlayingHours') value = `${value} hours`;
          return `${index + 1}. **${row.Character}** — ${value}`;
        }).join('\n');
        
        const embed = EmbedService.create({
          title: `Top 10 ${typeLabels[type]}`,
          description,
          color: '#FFD700'
        });
        
        return interaction.editReply({ embeds: [embed] });
      }
    }
  };
});