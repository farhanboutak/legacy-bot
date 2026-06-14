const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');
const ValidatorService = require('../../utils/validator');

module.exports = [
  new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub
      .setName('warn')
      .setDescription('Warn a player')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Warning reason').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('clearwarns')
      .setDescription('Clear all warnings for a player')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('warnings')
      .setDescription('View warnings for a player')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('kick')
      .setDescription('Kick a player from Discord server')
      .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Kick reason'))
    )
    .addSubcommand(sub => sub
      .setName('timeout')
      .setDescription('Timeout a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
      .addIntegerOption(opt => opt.setName('minutes').setDescription('Timeout duration in minutes').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Timeout reason'))
    ),
  {
    name: 'mod_warn',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      const reason = interaction.options.getString('reason');
      
      const reasonCheck = ValidatorService.validateReason(reason, 5, 200);
      if (!reasonCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Reason', reasonCheck.error)]
        });
      }
      
      const [account] = await database.query(
        'SELECT DiscordID, Username, Warnings FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      await database.query(
        'INSERT INTO warnings (Username, AdminID, Reason, CreatedAt) VALUES (?, ?, ?, ?)',
        [username, interaction.user.id, reason, HelperService.getCurrentTimestamp()]
      );
      
      await database.query(
        'UPDATE accounts SET Warnings = Warnings + 1 WHERE Username = ?',
        [username]
      );
      
      const [warningCount] = await database.query(
        'SELECT Warnings FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (account[0].DiscordID) {
        const user = await interaction.client.users.fetch(account[0].DiscordID).catch(() => null);
        if (user) {
          await user.send({
            embeds: [EmbedService.warning(
              'Warning Issued',
              `You have received a warning on Legacy State Roleplay.\n\n**Warning #${warningCount[0].Warnings}**\n**Reason:** ${reason}\n\nFurther violations may result in a ban.`
            )]
          }).catch(() => {});
        }
      }
      
      const logEmbed = EmbedService.warning(
        'Warning Issued',
        `**Moderator:** ${interaction.user.tag}\n**User:** ${username}\n**Warning #${warningCount[0].Warnings}**\n**Reason:** ${reason}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.warning(
          'Warning Issued',
          `${username} has received warning #${warningCount[0].Warnings}`
        )]
      });
    }
  },
  {
    name: 'mod_clearwarns',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      
      const [account] = await database.query(
        'SELECT Username FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      await database.query('DELETE FROM warnings WHERE Username = ?', [username]);
      await database.query('UPDATE accounts SET Warnings = 0 WHERE Username = ?', [username]);
      
      const logEmbed = EmbedService.info(
        'Warnings Cleared',
        `**Moderator:** ${interaction.user.tag}\n**User:** ${username}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Warnings Cleared', `All warnings for ${username} have been cleared.`)]
      });
    }
  },
  {
    name: 'mod_warnings',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      
      const [account] = await database.query(
        'SELECT Warnings FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      const warnings = await database.query(
        'SELECT Reason, AdminID, CreatedAt FROM warnings WHERE Username = ? ORDER BY CreatedAt DESC LIMIT 10',
        [username]
      );
      
      if (!warnings.length) {
        return interaction.editReply({
          embeds: [EmbedService.info('No Warnings', `${username} has no warnings.`)]
        });
      }
      
      const description = warnings.map((w, index) => {
        return `**#${index + 1}** - ${HelperService.formatTime(w.CreatedAt)}\n• Reason: ${w.Reason}\n• By: <@${w.AdminID}>\n`;
      }).join('\n');
      
      const embed = EmbedService.create({
        title: `Warnings for ${username}`,
        description,
        color: '#FFA500',
        footer: `Total: ${account[0].Warnings} warnings`
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'mod_kick',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', 'User is not in this server.')]
        });
      }
      
      if (!member.kickable) {
        return interaction.editReply({
          embeds: [EmbedService.error('Cannot Kick', 'I do not have permission to kick this user.')]
        });
      }
      
      await member.kick(reason);
      
      const logEmbed = EmbedService.warning(
        'User Kicked',
        `**Moderator:** ${interaction.user.tag}\n**User:** ${targetUser.tag}\n**Reason:** ${reason}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('User Kicked', `${targetUser.tag} has been kicked.\nReason: ${reason}`)]
      });
    }
  },
  {
    name: 'mod_timeout',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const targetUser = interaction.options.getUser('user');
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      
      if (minutes < 1 || minutes > 40320) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Duration', 'Timeout duration must be between 1 minute and 28 days.')]
        });
      }
      
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', 'User is not in this server.')]
        });
      }
      
      if (!member.moderatable) {
        return interaction.editReply({
          embeds: [EmbedService.error('Cannot Timeout', 'I do not have permission to timeout this user.')]
        });
      }
      
      const duration = minutes * 60 * 1000;
      await member.timeout(duration, reason);
      
      const logEmbed = EmbedService.warning(
        'User Timed Out',
        `**Moderator:** ${interaction.user.tag}\n**User:** ${targetUser.tag}\n**Duration:** ${minutes} minutes\n**Reason:** ${reason}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('User Timed Out', `${targetUser.tag} has been timed out for ${minutes} minutes.\nReason: ${reason}`)]
      });
    }
  }
];