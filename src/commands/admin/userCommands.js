const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');
const ValidatorService = require('../../utils/validator');
const { ROLES } = require('../../config/constants');

module.exports = [
  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative user management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('whitelist')
      .setDescription('Whitelist a user account')
      .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('ban')
      .setDescription('Ban a user account')
      .addStringOption(opt => opt.setName('username').setDescription('Username to ban').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('unban')
      .setDescription('Unban a user account')
      .addStringOption(opt => opt.setName('username').setDescription('Username to unban').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View user account details')
      .addStringOption(opt => opt.setName('username').setDescription('Username to view').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('search')
      .setDescription('Search for users by username')
      .addStringOption(opt => opt.setName('query').setDescription('Search query').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('resetpass')
      .setDescription('Reset user password')
      .addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true))
      .addStringOption(opt => opt.setName('password').setDescription('New password').setRequired(true))
    ),
  {
    name: 'admin_whitelist',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const targetUser = interaction.options.getUser('user');
      
      const [account] = await database.query(
        'SELECT Username, WhiteList FROM accounts WHERE DiscordID = ?',
        [targetUser.id]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', 'No account found for this user.')]
        });
      }
      
      if (account[0].WhiteList === 1) {
        return interaction.editReply({
          embeds: [EmbedService.warning('Already Whitelisted', 'This user is already whitelisted.')]
        });
      }
      
      await database.query(
        'UPDATE accounts SET WhiteList = 1 WHERE DiscordID = ?',
        [targetUser.id]
      );
      
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (member) {
        await member.roles.add(ROLES.MEMBER).catch(() => {});
        await member.send({
          embeds: [EmbedService.success(
            'Account Whitelisted',
            `Your account **${account[0].Username}** has been whitelisted. You can now access the server.`
          )]
        }).catch(() => {});
      }
      
      const logEmbed = EmbedService.info(
        'User Whitelisted',
        `**Admin:** ${interaction.user.tag}\n**User:** ${targetUser.tag}\n**Username:** ${account[0].Username}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Whitelisted', `${targetUser.tag} has been whitelisted successfully.`)]
      });
    }
  },
  {
    name: 'admin_ban',
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
        'SELECT DiscordID, WhiteList FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      if (account[0].WhiteList === 0) {
        return interaction.editReply({
          embeds: [EmbedService.warning('Not Whitelisted', 'This user is not whitelisted.')]
        });
      }
      
      await database.query(
        'UPDATE accounts SET Banned = 1 WHERE Username = ?',
        [username]
      );
      
      if (account[0].DiscordID) {
        const user = await interaction.client.users.fetch(account[0].DiscordID).catch(() => null);
        if (user) {
          await user.send({
            embeds: [EmbedService.error(
              'Account Banned',
              `Your account **${username}** has been banned.\n\n**Reason:** ${reason}\n\nIf you believe this is a mistake, please contact support.`
            )]
          }).catch(() => {});
        }
      }
      
      const logEmbed = EmbedService.error(
        'User Banned',
        `**Admin:** ${interaction.user.tag}\n**Username:** ${username}\n**Reason:** ${reason}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Banned', `${username} has been banned successfully.`)]
      });
    }
  },
  {
    name: 'admin_unban',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      
      const [account] = await database.query(
        'SELECT DiscordID, Banned FROM accounts WHERE Username = ?',
        [username]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      if (account[0].Banned === 0) {
        return interaction.editReply({
          embeds: [EmbedService.warning('Not Banned', 'This user is not banned.')]
        });
      }
      
      await database.query(
        'UPDATE accounts SET Banned = 0 WHERE Username = ?',
        [username]
      );
      
      if (account[0].DiscordID) {
        const user = await interaction.client.users.fetch(account[0].DiscordID).catch(() => null);
        if (user) {
          await user.send({
            embeds: [EmbedService.success(
              'Account Unbanned',
              `Your account **${username}** has been unbanned. You may now rejoin the server.`
            )]
          }).catch(() => {});
        }
      }
      
      const logEmbed = EmbedService.info(
        'User Unbanned',
        `**Admin:** ${interaction.user.tag}\n**Username:** ${username}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Unbanned', `${username} has been unbanned successfully.`)]
      });
    }
  },
  {
    name: 'admin_view',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      
      const [account] = await database.query(
        `SELECT a.*, 
                COUNT(DISTINCT c.id) as character_count,
                COUNT(DISTINCT w.id) as warning_count,
                COUNT(DISTINCT cs.id) as story_count
         FROM accounts a
         LEFT JOIN characters c ON a.Username = c.Username
         LEFT JOIN warnings w ON a.Username = w.Username
         LEFT JOIN char_stories cs ON a.Username = cs.Username
         WHERE a.Username = ?
         GROUP BY a.ID`,
        [username]
      );
      
      if (!account) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `User "${username}" not found.`)]
        });
      }
      
      const [characters] = await database.query(
        'SELECT `Character`, pScore, PlayingHours, Money, Faction FROM characters WHERE Username = ? LIMIT 5',
        [username]
      );
      
      const status = account.Banned ? 'Banned' : (account.WhiteList ? 'Active' : 'Pending');
      const statusColor = account.Banned ? '#FF0000' : (account.WhiteList ? '#00FF00' : '#FFA500');
      
      const fields = [
        { name: 'Username', value: account.Username, inline: true },
        { name: 'Status', value: status, inline: true },
        { name: 'Admin Level', value: account.Admin.toString(), inline: true },
        { name: 'Characters', value: account.character_count.toString(), inline: true },
        { name: 'Warnings', value: account.warning_count.toString(), inline: true },
        { name: 'Stories', value: account.story_count.toString(), inline: true },
        { name: 'Discord ID', value: account.DiscordID ? `<@${account.DiscordID}>` : 'Not linked', inline: true },
        { name: 'Registered', value: HelperService.formatTime(account.RegisterDate), inline: true },
        { name: 'Last Online', value: HelperService.formatTime(account.LoginDate), inline: true }
      ];
      
      if (characters.length) {
        const charList = characters.map(c => 
          `• **${c.Character}** | Score: ${c.pScore} | Money: ${HelperService.formatMoney(c.Money)}`
        ).join('\n');
        fields.push({ name: 'Characters', value: charList, inline: false });
      }
      
      const embed = EmbedService.create({
        title: `User Account: ${account.Username}`,
        color: statusColor,
        fields
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'admin_search',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const query = interaction.options.getString('query');
      const sanitized = ValidatorService.sanitizeInput(query);
      
      const accounts = await database.query(
        `SELECT Username, DiscordID, WhiteList, Banned, Admin, RegisterDate 
         FROM accounts 
         WHERE Username LIKE ? 
         LIMIT 10`,
        [`%${sanitized}%`]
      );
      
      if (!accounts.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('No Results', `No users found matching "${query}".`)]
        });
      }
      
      const description = accounts.map(acc => {
        const status = acc.Banned ? '🔴 Banned' : (acc.WhiteList ? '🟢 Active' : '🟡 Pending');
        return `**${acc.Username}** - ${status} | Admin: ${acc.Admin} | ${acc.DiscordID ? `<@${acc.DiscordID}>` : 'No Discord'}`;
      }).join('\n');
      
      const embed = EmbedService.create({
        title: `Search Results: "${query}"`,
        description,
        color: '#0099FF'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'admin_resetpass',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const username = interaction.options.getString('username');
      const newPassword = interaction.options.getString('password');
      
      const passwordCheck = ValidatorService.validatePassword(newPassword);
      if (!passwordCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Password', passwordCheck.error)]
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
      
      const salt = HelperService.generateSalt();
      const hashedPassword = HelperService.hashPassword(newPassword, salt);
      
      await database.query(
        'UPDATE accounts SET Password = ?, Salt = ? WHERE Username = ?',
        [hashedPassword, salt, username]
      );
      
      if (account[0].DiscordID) {
        const user = await interaction.client.users.fetch(account[0].DiscordID).catch(() => null);
        if (user) {
          await user.send({
            embeds: [EmbedService.info(
              'Password Reset',
              `Your account password for **${username}** has been reset by an administrator.\n\nIf you did not request this, please contact support immediately.`
            )]
          }).catch(() => {});
        }
      }
      
      const logEmbed = EmbedService.warning(
        'Password Reset',
        `**Admin:** ${interaction.user.tag}\n**Username:** ${username}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Password Reset', `Password for ${username} has been reset.`)]
      });
    }
  }
];