const { SlashCommandBuilder } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');

module.exports = [
  new SlashCommandBuilder()
    .setName('ucp')
    .setDescription('User Control Panel commands')
    .addSubcommand(sub => sub.setName('info').setDescription('View your account information'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your account password'))
    .addSubcommand(sub => sub.setName('verify').setDescription('Request verification code'))
].map(cmd => {
  return {
    name: cmd.name,
    execute: async (interaction) => {
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'info') {
        await interaction.deferReply({ ephemeral: true });
        
        const [account] = await database.query(
          'SELECT * FROM accounts WHERE DiscordID = ?',
          [interaction.user.id]
        );
        
        if (!account) {
          return interaction.editReply({
            embeds: [EmbedService.error('Account Not Found', 'You don\'t have an account registered.')]
          });
        }
        
        const [characterCount] = await database.query(
          'SELECT COUNT(*) as total FROM characters WHERE Username = ?',
          [account.Username]
        );
        
        const status = account.Banned ? 'Banned' : (account.WhiteList ? 'Active' : 'Pending');
        const statusColor = account.Banned ? '#FF0000' : (account.WhiteList ? '#00FF00' : '#FFA500');
        
        const embed = EmbedService.create({
          title: 'Account Information',
          color: statusColor,
          fields: [
            { name: 'Username', value: account.Username, inline: true },
            { name: 'Status', value: status, inline: true },
            { name: 'Characters', value: characterCount.total.toString(), inline: true },
            { name: 'Admin Level', value: account.Admin.toString(), inline: true },
            { name: 'Last Online', value: HelperService.formatTime(account.LoginDate), inline: true },
            { name: 'Registered', value: HelperService.formatTime(account.RegisterDate), inline: true }
          ]
        });
        
        return interaction.editReply({ embeds: [embed] });
      }
      
      if (subcommand === 'reset') {
        const modal = {
          customId: 'password_reset_modal',
          title: 'Reset Password',
          components: [{
            type: 1,
            components: [{
              type: 4,
              customId: 'new_password',
              label: 'New Password',
              style: 1,
              minLength: 6,
              maxLength: 32,
              required: true
            }]
          }]
        };
        
        return interaction.showModal(modal);
      }
      
      if (subcommand === 'verify') {
        await interaction.deferReply({ ephemeral: true });
        
        const [account] = await database.query(
          'SELECT Username, VerifyCode FROM accounts WHERE DiscordID = ?',
          [interaction.user.id]
        );
        
        if (!account) {
          return interaction.editReply({
            embeds: [EmbedService.error('Account Not Found', 'You don\'t have an account registered.')]
          });
        }
        
        let code = account.VerifyCode;
        if (!code) {
          code = HelperService.generateCode();
          await database.query(
            'UPDATE accounts SET VerifyCode = ? WHERE DiscordID = ?',
            [code, interaction.user.id]
          );
        }
        
        await interaction.user.send(
          `**Verification Code**\n\nHello ${account.Username}, your verification code is:\n\`${code}\`\n\nKeep this code secure and do not share it with anyone.`
        );
        
        return interaction.editReply({
          embeds: [EmbedService.success('Code Sent', 'Verification code has been sent to your DMs.')]
        });
      }
    }
  };
});