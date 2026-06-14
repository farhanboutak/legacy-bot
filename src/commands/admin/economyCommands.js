const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');
const ValidatorService = require('../../utils/validator');

module.exports = [
  new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('money')
      .setDescription('Manage player money')
      .addStringOption(opt => opt.setName('character').setDescription('Character name').setRequired(true))
      .addStringOption(opt => opt.setName('action').setDescription('add/remove/set').addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
        { name: 'Set', value: 'set' }
      ).setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('gold')
      .setDescription('Manage player gold')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption(opt => opt.setName('action').setDescription('add/remove/set').addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' },
        { name: 'Set', value: 'set' }
      ).setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('vip')
      .setDescription('Grant VIP status')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
      .addIntegerOption(opt => opt.setName('days').setDescription('Number of days').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('top')
      .setDescription('View top richest players')
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of results').setMinValue(5).setMaxValue(25))
    ),
  {
    name: 'economy_money',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const character = interaction.options.getString('character');
      const action = interaction.options.getString('action');
      const amount = interaction.options.getInteger('amount');
      
      const amountCheck = ValidatorService.validateMoneyAmount(amount, 0, 100000000);
      if (!amountCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Amount', amountCheck.error)]
        });
      }
      
      const [char] = await database.query(
        'SELECT Money, Username FROM characters WHERE `Character` = ?',
        [character]
      );
      
      if (!char.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Character "${character}" not found.`)]
        });
      }
      
      let query, params;
      let oldMoney = char[0].Money;
      let newMoney;
      
      switch (action) {
        case 'add':
          query = 'UPDATE characters SET Money = Money + ? WHERE `Character` = ?';
          params = [amount, character];
          newMoney = oldMoney + amount;
          break;
        case 'remove':
          query = 'UPDATE characters SET Money = GREATEST(0, Money - ?) WHERE `Character` = ?';
          params = [amount, character];
          newMoney = Math.max(0, oldMoney - amount);
          break;
        case 'set':
          query = 'UPDATE characters SET Money = ? WHERE `Character` = ?';
          params = [amount, character];
          newMoney = amount;
          break;
      }
      
      await database.query(query, params);
      
      const logEmbed = EmbedService.info(
        'Money Modified',
        `**Admin:** ${interaction.user.tag}\n**Character:** ${character}\n**Action:** ${action.toUpperCase()}\n**Old:** ${HelperService.formatMoney(oldMoney)}\n**New:** ${HelperService.formatMoney(newMoney)}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success(
          'Money Updated',
          `**${character}** ${action} → ${HelperService.formatMoney(amount)}\nNew balance: ${HelperService.formatMoney(newMoney)}`
        )]
      });
    }
  },
  {
    name: 'economy_gold',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      const action = interaction.options.getString('action');
      const amount = interaction.options.getInteger('amount');
      
      const amountCheck = ValidatorService.validateNumber(amount, 1, 100000, 'Gold amount');
      if (!amountCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Amount', amountCheck.error)]
        });
      }
      
      const [account] = await database.query(
        'SELECT Username FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      let query, params;
      
      switch (action) {
        case 'add':
          query = 'UPDATE characters SET Gold = Gold + ? WHERE Username = ?';
          params = [amount, username];
          break;
        case 'remove':
          query = 'UPDATE characters SET Gold = GREATEST(0, Gold - ?) WHERE Username = ?';
          params = [amount, username];
          break;
        case 'set':
          query = 'UPDATE characters SET Gold = ? WHERE Username = ?';
          params = [amount, username];
          break;
      }
      
      await database.query(query, params);
      
      const logEmbed = EmbedService.info(
        'Gold Modified',
        `**Admin:** ${interaction.user.tag}\n**Username:** ${username}\n**Action:** ${action.toUpperCase()}\n**Amount:** ${amount} Gold`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Gold Updated', `${action.toUpperCase()} ${amount} Gold to ${username}`)]
      });
    }
  },
  {
    name: 'economy_vip',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      const days = interaction.options.getInteger('days');
      
      const durationCheck = ValidatorService.validateDuration(days, 1, 365);
      if (!durationCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Duration', durationCheck.error)]
        });
      }
      
      const [account] = await database.query(
        'SELECT DiscordID FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      const [current] = await database.query(
        'SELECT VipTime, Vip FROM characters WHERE Username = ? LIMIT 1',
        [username]
      );
      
      const newTime = (current[0]?.VipTime || 0) + (days * 86400);
      
      await database.query(
        'UPDATE characters SET VipTime = ?, Vip = 1 WHERE Username = ?',
        [newTime, username]
      );
      
      if (account[0].DiscordID) {
        const user = await interaction.client.users.fetch(account[0].DiscordID).catch(() => null);
        if (user) {
          await user.send({
            embeds: [EmbedService.success(
              'VIP Status Granted',
              `You have been granted VIP status for **${days} days**!\n\nThank you for supporting Legacy State Roleplay.`
            )]
          }).catch(() => {});
        }
      }
      
      const logEmbed = EmbedService.info(
        'VIP Granted',
        `**Admin:** ${interaction.user.tag}\n**Username:** ${username}\n**Duration:** ${days} days`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('VIP Granted', `${username} has been granted VIP status for ${days} days.`)]
      });
    }
  },
  {
    name: 'economy_top',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const limit = interaction.options.getInteger('limit') || 10;
      
      const [richest] = await database.query(
        `SELECT \`Character\`, Money, BankMoney, (Money + BankMoney) as Total 
         FROM characters 
         ORDER BY Total DESC 
         LIMIT ?`,
        [limit]
      );
      
      if (!richest.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('No Data', 'No character data available.')]
        });
      }
      
      const description = richest.map((char, index) => {
        const total = (char.Money || 0) + (char.BankMoney || 0);
        return `${index + 1}. **${char.Character}** - ${HelperService.formatMoney(total)} (Cash: ${HelperService.formatMoney(char.Money)} | Bank: ${HelperService.formatMoney(char.BankMoney)})`;
      }).join('\n');
      
      const embed = EmbedService.create({
        title: 'Top Richest Characters',
        description,
        color: '#FFD700',
        footer: `Requested by ${interaction.user.tag}`
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  }
];