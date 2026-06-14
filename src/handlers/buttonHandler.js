const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');
const ValidatorService = require('../utils/validator');
const GiveawayService = require('../services/giveawayService');
const StoryService = require('../services/storyService');
const ReportService = require('../services/reportService');
const { CHANNELS, ROLES } = require('../config/constants');

class ButtonHandler {
  constructor(client) {
    this.client = client;
  }

  async execute(interaction) {
    const { customId, user, guild, message } = interaction;
    
    logger.info(`Button clicked: ${customId} by ${user.tag}`);
    
    // UCP Panel Buttons
    if (customId === 'ucp_register') {
      return this.handleUCPRegister(interaction);
    }
    
    if (customId === 'ucp_myaccount') {
      return this.handleUCPMyAccount(interaction);
    }
    
    if (customId === 'ucp_resetpass') {
      return this.handleUCPResetPassword(interaction);
    }
    
    if (customId === 'ucp_resendcode') {
      return this.handleUCPResendCode(interaction);
    }
    
    // Character Panel Buttons
    if (customId === 'char_list') {
      return this.handleCharacterList(interaction);
    }
    
    if (customId === 'char_stats') {
      return this.handleCharacterStats(interaction);
    }
    
    if (customId === 'char_delete') {
      return this.handleCharacterDelete(interaction);
    }
    
    // Story Panel Buttons
    if (customId === 'char_story_submit') {
      return this.handleStorySubmit(interaction);
    }
    
    if (customId === 'char_story_status') {
      return this.handleStoryStatus(interaction);
    }
    
    if (customId === 'char_story_history') {
      return this.handleStoryHistory(interaction);
    }
    
    // Report Panel Buttons
    if (customId === 'report_player') {
      return this.handleReportPlayer(interaction);
    }
    
    if (customId === 'report_bug') {
      return this.handleReportBug(interaction);
    }
    
    if (customId === 'report_status') {
      return this.handleReportStatus(interaction);
    }
    
    // Suggestion Panel Buttons
    if (customId === 'suggestion_send') {
      return this.handleSuggestionSend(interaction);
    }
    
    if (customId === 'suggestion_status') {
      return this.handleSuggestionStatus(interaction);
    }
    
    // Giveaway Buttons
    if (customId === 'giveaway_join') {
      return this.handleGiveawayJoin(interaction);
    }
    
    // Story Review Buttons
    if (customId.startsWith('story_accept_')) {
      return this.handleStoryAccept(interaction);
    }
    
    if (customId.startsWith('story_reject_')) {
      return this.handleStoryReject(interaction);
    }
    
    // Default response
    return interaction.reply({
      embeds: [EmbedService.warning('Not Implemented', 'This feature is coming soon.')],
      ephemeral: true
    });
  }

  async handleUCPRegister(interaction) {
    const [existing] = await database.query(
      'SELECT ID FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (existing.length) {
      return interaction.reply({
        embeds: [EmbedService.error('Already Registered', 'You already have an account.')],
        ephemeral: true
      });
    }
    
    const modal = {
      customId: 'register_modal',
      title: 'Account Registration',
      components: [{
        type: 1,
        components: [{
          type: 4,
          customId: 'username',
          label: 'Desired Username',
          style: 1,
          minLength: 3,
          maxLength: 24,
          required: true,
          placeholder: 'Enter your desired username'
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }

  async handleUCPMyAccount(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT * FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account registered.')]
      });
    }
    
    const [characterCount] = await database.query(
      'SELECT COUNT(*) as total FROM characters WHERE Username = ?',
      [account.Username]
    );
    
    const status = account.Banned ? 'Banned' : (account.WhiteList ? 'Active' : 'Pending');
    const statusColor = account.Banned ? '#FF0000' : (account.WhiteList ? '#00FF00' : '#FFA500');
    
    const embed = EmbedService.create({
      title: 'My Account',
      color: statusColor,
      fields: [
        { name: 'Username', value: account.Username, inline: true },
        { name: 'Status', value: status, inline: true },
        { name: 'Characters', value: characterCount.total.toString(), inline: true },
        { name: 'Admin Level', value: account.Admin.toString(), inline: true },
        { name: 'Verification Code', value: `\`${account.VerifyCode || 'Not set'}\``, inline: true },
        { name: 'Registered', value: HelperService.formatTime(account.RegisterDate), inline: true },
        { name: 'Last Online', value: HelperService.formatTime(account.LoginDate), inline: true }
      ]
    });
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleUCPResetPassword(interaction) {
    const [account] = await database.query(
      'SELECT ID FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.reply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')],
        ephemeral: true
      });
    }
    
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
          required: true,
          placeholder: 'Enter your new password'
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }

  async handleUCPResendCode(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username, VerifyCode FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
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
    
    await interaction.user.send({
      embeds: [EmbedService.info(
        'Verification Code',
        `Hello ${account.Username},\n\nYour verification code is:\n\`${code}\`\n\nKeep this code secure and do not share it with anyone.`
      )]
    }).catch(() => {
      return interaction.editReply({
        embeds: [EmbedService.error('Cannot Send DM', 'Please enable DMs to receive your verification code.')]
      });
    });
    
    return interaction.editReply({
      embeds: [EmbedService.success('Code Sent', 'Verification code has been sent to your DMs.')]
    });
  }

  async handleCharacterList(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const characters = await database.query(
      'SELECT `Character`, pScore, PlayingHours, Money, BankMoney FROM characters WHERE Username = ?',
      [account[0].Username]
    );
    
    if (!characters.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Characters', 'You don\'t have any characters yet.')]
      });
    }
    
    const description = characters.map(char => {
      return `**${char.Character}**\n• Level: ${char.pScore} | Playtime: ${char.PlayingHours}h\n• Money: ${HelperService.formatMoney(char.Money)} | Bank: ${HelperService.formatMoney(char.BankMoney)}\n`;
    }).join('\n');
    
    const embed = EmbedService.create({
      title: `Your Characters (${characters.length})`,
      description,
      color: '#00FF00'
    });
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleCharacterStats(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const characters = await database.query(
      'SELECT `Character` FROM characters WHERE Username = ?',
      [account[0].Username]
    );
    
    if (!characters.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Characters', 'You don\'t have any characters.')]
      });
    }
    
    const selectMenu = {
      type: 1,
      components: [{
        type: 3,
        customId: 'character_select',
        placeholder: 'Select a character...',
        options: characters.map(char => ({
          label: char.Character,
          value: char.Character,
          description: `View stats for ${char.Character}`
        }))
      }]
    };
    
    return interaction.editReply({
      content: 'Select a character to view their statistics:',
      components: [selectMenu]
    });
  }

  async handleCharacterDelete(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username, LastCharacterDelete FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const cooldownCheck = ValidatorService.validateCharacterCooldown(
      account.LastCharacterDelete,
      432000
    );
    
    if (!cooldownCheck.valid) {
      return interaction.editReply({
        embeds: [EmbedService.error('Cooldown Active', cooldownCheck.message)]
      });
    }
    
    const characters = await database.query(
      'SELECT `Character` FROM characters WHERE Username = ?',
      [account[0].Username]
    );
    
    if (!characters.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Characters', 'You don\'t have any characters to delete.')]
      });
    }
    
    const selectMenu = {
      type: 1,
      components: [{
        type: 3,
        customId: 'character_delete_select',
        placeholder: 'Select character to delete...',
        options: characters.map(char => ({
          label: char.Character,
          value: char.Character,
          description: 'This action is permanent!',
          emoji: { name: '⚠️' }
        }))
      }]
    };
    
    return interaction.editReply({
      content: '⚠️ **Warning:** Character deletion is permanent and cannot be undone. Select a character to delete:',
      components: [selectMenu]
    });
  }

  async handleStorySubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const characters = await database.query(
      `SELECT c.\`Character\` 
       FROM characters c 
       WHERE c.Username = ? 
       AND c.\`Character\` NOT IN (
         SELECT \`Character\` FROM char_stories WHERE Username = ? AND Status IN (0, 1)
       )`,
      [account[0].Username, account[0].Username]
    );
    
    if (!characters.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Characters Available', 'All your characters already have pending or approved stories.')]
      });
    }
    
    const selectMenu = {
      type: 1,
      components: [{
        type: 3,
        customId: 'story_character_select',
        placeholder: 'Select a character...',
        options: characters.map(char => ({
          label: char.Character,
          value: char.Character,
          description: 'Submit background story for this character'
        }))
      }]
    };
    
    return interaction.editReply({
      content: 'Select a character to submit a background story:',
      components: [selectMenu]
    });
  }

  async handleStoryStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const stories = await StoryService.getUserStories(interaction.user.id, 5);
    
    if (!stories.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Stories', 'You haven\'t submitted any stories yet.')]
      });
    }
    
    const embed = EmbedService.create({
      title: 'Story Status',
      color: '#0099FF'
    });
    
    for (const story of stories) {
      const statusColor = story.Status === 0 ? '#FFA500' : (story.Status === 1 ? '#00FF00' : '#FF0000');
      const statusText = story.Status === 0 ? 'Pending' : (story.Status === 1 ? 'Approved' : 'Rejected');
      
      embed.addFields({
        name: `${story.Character} - ${statusText}`,
        value: `Submitted: ${HelperService.formatTime(story.CreatedAt)}\n${story.AdminNote ? `Note: ${story.AdminNote}` : ''}`,
        inline: false
      });
    }
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleStoryHistory(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const stories = await StoryService.getUserStories(interaction.user.id, 10);
    
    if (!stories.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Stories', 'You haven\'t submitted any stories yet.')]
      });
    }
    
    const description = stories.map(story => {
      const status = story.Status === 0 ? '⏳ Pending' : (story.Status === 1 ? '✅ Approved' : '❌ Rejected');
      return `**${story.Character}** - ${status}\n• Submitted: ${HelperService.formatTime(story.CreatedAt)}\n${story.AdminNote ? `• Note: ${story.AdminNote}\n` : ''}`;
    }).join('\n\n');
    
    const embed = EmbedService.create({
      title: 'Story History',
      description,
      color: '#9B59B6'
    });
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleReportPlayer(interaction) {
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.reply({
        embeds: [EmbedService.error('No Account', 'You need an account to submit reports.')],
        ephemeral: true
      });
    }
    
    const modal = {
      customId: 'report_player_modal',
      title: 'Report Player',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'target',
            label: 'Player Name',
            style: 1,
            required: true,
            placeholder: 'Enter the player\'s character name'
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'reason',
            label: 'Reason for Report',
            style: 2,
            required: true,
            placeholder: 'Describe what happened...',
            minLength: 10,
            maxLength: 500
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'evidence',
            label: 'Evidence (Optional)',
            style: 1,
            required: false,
            placeholder: 'Screenshot/video link (Imgur, YouTube, etc.)'
          }]
        }
      ]
    };
    
    return interaction.showModal(modal);
  }

  async handleReportBug(interaction) {
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.reply({
        embeds: [EmbedService.error('No Account', 'You need an account to submit bug reports.')],
        ephemeral: true
      });
    }
    
    const modal = {
      customId: 'report_bug_modal',
      title: 'Report Bug',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'title',
            label: 'Bug Title',
            style: 1,
            required: true,
            placeholder: 'Brief description of the bug'
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'description',
            label: 'Bug Description',
            style: 2,
            required: true,
            placeholder: 'Detailed explanation of the bug...',
            minLength: 20,
            maxLength: 1000
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'reproduce',
            label: 'How to Reproduce',
            style: 2,
            required: true,
            placeholder: 'Steps to reproduce the bug...'
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'evidence',
            label: 'Evidence (Optional)',
            style: 1,
            required: false,
            placeholder: 'Screenshot/video link'
          }]
        }
      ]
    };
    
    return interaction.showModal(modal);
  }

  async handleReportStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const reports = await ReportService.getUserReports(interaction.user.id, 5);
    
    if (!reports.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Reports', 'You haven\'t submitted any reports yet.')]
      });
    }
    
    const embed = EmbedService.create({
      title: 'Report Status',
      color: '#0099FF'
    });
    
    for (const report of reports) {
      const statusColor = report.Status === 0 ? '#FFA500' : (report.Status === 1 ? '#00FF00' : '#6B7280');
      const statusText = report.Status === 0 ? 'Pending' : (report.Status === 1 ? 'Resolved' : 'Dismissed');
      
      embed.addFields({
        name: `#${report.id} - ${report.Type === 'player' ? 'Player Report' : 'Bug Report'}`,
        value: `Target: ${report.TargetName}\nStatus: ${statusText}\nSubmitted: ${HelperService.formatTime(report.CreatedAt)}\n${report.AdminNote ? `Note: ${report.AdminNote}` : ''}`,
        inline: false
      });
    }
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleSuggestionSend(interaction) {
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    const modal = {
      customId: 'suggestion_modal',
      title: 'Submit Suggestion',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'title',
            label: 'Suggestion Title',
            style: 1,
            required: true,
            placeholder: 'Brief title for your suggestion',
            maxLength: 100
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            customId: 'content',
            label: 'Suggestion Details',
            style: 2,
            required: true,
            placeholder: 'Describe your suggestion in detail...',
            minLength: 20,
            maxLength: 2000
          }]
        }
      ]
    };
    
    return interaction.showModal(modal);
  }

  async handleSuggestionStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const suggestions = await database.query(
      'SELECT id, Title, Status, AdminNote, CreatedAt FROM suggestions WHERE DiscordID = ? ORDER BY CreatedAt DESC LIMIT 5',
      [interaction.user.id]
    );
    
    if (!suggestions.length) {
      return interaction.editReply({
        embeds: [EmbedService.info('No Suggestions', 'You haven\'t submitted any suggestions yet.')]
      });
    }
    
    const statusMap = { 0: 'Pending', 1: 'Approved', 2: 'Rejected', 3: 'In Progress' };
    const statusColors = { 0: '#FFA500', 1: '#00FF00', 2: '#FF0000', 3: '#0099FF' };
    
    const embed = EmbedService.create({
      title: 'Suggestion Status',
      color: '#9B59B6'
    });
    
    for (const sug of suggestions) {
      embed.addFields({
        name: `${sug.Title}`,
        value: `Status: ${statusMap[sug.Status]}\nSubmitted: ${HelperService.formatTime(sug.CreatedAt)}\n${sug.AdminNote ? `Response: ${sug.AdminNote}` : ''}`,
        inline: false
      });
    }
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleGiveawayJoin(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const result = await GiveawayService.joinGiveaway(
      interaction.message.id,
      interaction.user.id
    );
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Cannot Join', result.message)]
      });
    }
    
    // Update participant count on message
    if (result.participantCount) {
      const embed = EmbedService.create({
        title: interaction.message.embeds[0]?.title || 'Giveaway',
        description: interaction.message.embeds[0]?.description,
        color: '#F59E0B',
        fields: interaction.message.embeds[0]?.fields || [],
        footer: `Participants: ${result.participantCount}`
      });
      
      await interaction.message.edit({ embeds: [embed] });
    }
    
    return interaction.editReply({
      embeds: [EmbedService.success('Joined Giveaway', result.message)]
    });
  }

  async handleStoryAccept(interaction) {
    const storyId = customId.replace('story_accept_', '');
    
    const modal = {
      customId: `story_accept_modal_${storyId}`,
      title: 'Accept Story',
      components: [{
        type: 1,
        components: [{
          type: 4,
          customId: 'note',
          label: 'Admin Note (Optional)',
          style: 2,
          required: false,
          placeholder: 'Add any notes for the player...',
          maxLength: 200
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }

  async handleStoryReject(interaction) {
    const storyId = customId.replace('story_reject_', '');
    
    const modal = {
      customId: `story_reject_modal_${storyId}`,
      title: 'Reject Story',
      components: [{
        type: 1,
        components: [{
          type: 4,
          customId: 'reason',
          label: 'Rejection Reason',
          style: 2,
          required: true,
          placeholder: 'Explain why the story is being rejected...',
          minLength: 10,
          maxLength: 200
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }
}

module.exports = ButtonHandler;