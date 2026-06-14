const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');
const ValidatorService = require('../utils/validator');
const StoryService = require('../services/storyService');
const ReportService = require('../services/reportService');

class ModalHandler {
  constructor(client) {
    this.client = client;
  }

  async execute(interaction) {
    const { customId, user, guild, fields } = interaction;
    
    logger.info(`Modal submitted: ${customId} by ${user.tag}`);
    
    if (customId === 'register_modal') {
      return this.handleRegistration(interaction);
    }
    
    if (customId === 'password_reset_modal') {
      return this.handlePasswordReset(interaction);
    }
    
    if (customId === 'story_modal') {
      return this.handleStorySubmission(interaction);
    }
    
    if (customId === 'report_player_modal') {
      return this.handlePlayerReport(interaction);
    }
    
    if (customId === 'report_bug_modal') {
      return this.handleBugReport(interaction);
    }
    
    if (customId === 'suggestion_modal') {
      return this.handleSuggestion(interaction);
    }
    
    if (customId.startsWith('story_accept_modal_')) {
      return this.handleStoryAccept(interaction);
    }
    
    if (customId.startsWith('story_reject_modal_')) {
      return this.handleStoryReject(interaction);
    }
    
    if (customId === 'character_delete_confirm') {
      return this.handleCharacterDeleteConfirm(interaction);
    }
    
    return interaction.reply({
      embeds: [EmbedService.error('Invalid Form', 'This form could not be processed.')],
      ephemeral: true
    });
  }

  async handleRegistration(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const username = interaction.fields.getTextInputValue('username').trim();
    
    const usernameCheck = ValidatorService.validateUsername(username);
    if (!usernameCheck.valid) {
      return interaction.editReply({
        embeds: [EmbedService.error('Invalid Username', usernameCheck.error)]
      });
    }
    
    const existing = await database.query(
      'SELECT ID FROM accounts WHERE Username = ?',
      [usernameCheck.value]
    );
    
    if (existing.length > 0) {
      return interaction.editReply({
        embeds: [EmbedService.error('Username Taken', 'This username is already taken.')]
      });
    }
    
    const code = HelperService.generateCode();
    const timestamp = HelperService.getCurrentTimestamp();
    
    await database.query(
      `INSERT INTO accounts 
       (Username, DiscordID, RegisterDate, WhiteList, VerifyCode, CreatedAt) 
       VALUES (?, ?, ?, 1, ?, ?)`,
      [usernameCheck.value, interaction.user.id, timestamp, code, timestamp]
    );
    
    await interaction.user.send({
      embeds: [EmbedService.success(
        'Welcome to Legacy State Roleplay',
        `Your account **${usernameCheck.value}** has been created.\n\n**Verification Code:** \`${code}\`\n\nKeep this code safe.`
      )]
    }).catch(() => {});
    
    return interaction.editReply({
      embeds: [EmbedService.success(
        'Registration Complete',
        `Account **${usernameCheck.value}** created. Check your DMs for the verification code.`
      )]
    });
  }

  async handlePasswordReset(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const newPassword = interaction.fields.getTextInputValue('new_password').trim();
    
    const passwordCheck = ValidatorService.validatePassword(newPassword, 6, 32);
    if (!passwordCheck.valid) {
      return interaction.editReply({
        embeds: [EmbedService.error('Invalid Password', passwordCheck.error)]
      });
    }
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const salt = HelperService.generateSalt();
    const hashedPassword = HelperService.hashPassword(newPassword, salt);
    
    await database.query(
      'UPDATE accounts SET Password = ?, Salt = ? WHERE DiscordID = ?',
      [hashedPassword, salt, interaction.user.id]
    );
    
    return interaction.editReply({
      embeds: [EmbedService.success('Password Reset', 'Your password has been reset successfully.')]
    });
  }

  async handleStorySubmission(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const storyContent = interaction.fields.getTextInputValue('story');
    const characterName = interaction.customId.split('_')[2];
    
    const storyCheck = ValidatorService.validateStory(storyContent, 100, 5000);
    if (!storyCheck.valid) {
      return interaction.editReply({
        embeds: [EmbedService.error('Invalid Story', storyCheck.error)]
      });
    }
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const result = await StoryService.submitStory(
      characterName,
      account[0].Username,
      interaction.user.id,
      storyCheck.value
    );
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Submission Failed', result.message)]
      });
    }
    
    return interaction.editReply({
      embeds: [EmbedService.success('Story Submitted', result.message)]
    });
  }

  async handlePlayerReport(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const target = interaction.fields.getTextInputValue('target').trim();
    const reason = interaction.fields.getTextInputValue('reason').trim();
    const evidence = interaction.fields.getTextInputValue('evidence')?.trim() || '';
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    const reporterName = account[0]?.Username || interaction.user.username;
    
    const result = await ReportService.createReport(
      interaction.user.id,
      reporterName,
      target,
      'player',
      reason,
      evidence
    );
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Report Failed', result.message)]
      });
    }
    
    return interaction.editReply({
      embeds: [EmbedService.success('Report Submitted', result.message)]
    });
  }

  async handleBugReport(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const reproduce = interaction.fields.getTextInputValue('reproduce').trim();
    const evidence = interaction.fields.getTextInputValue('evidence')?.trim() || '';
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    const reporterName = account[0]?.Username || interaction.user.username;
    const fullDescription = `${description}\n\n**How to Reproduce:**\n${reproduce}`;
    
    const result = await ReportService.createReport(
      interaction.user.id,
      reporterName,
      title,
      'bug',
      fullDescription,
      evidence
    );
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Report Failed', result.message)]
      });
    }
    
    return interaction.editReply({
      embeds: [EmbedService.success('Bug Report Submitted', result.message)]
    });
  }

  async handleSuggestion(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const title = interaction.fields.getTextInputValue('title').trim();
    const content = interaction.fields.getTextInputValue('content').trim();
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    const username = account[0]?.Username || interaction.user.username;
    
    const result = await database.query(
      'INSERT INTO suggestions (DiscordID, Username, Title, Content, Status, CreatedAt) VALUES (?, ?, ?, ?, 0, ?)',
      [interaction.user.id, username, title, content, HelperService.getCurrentTimestamp()]
    );
    
    return interaction.editReply({
      embeds: [EmbedService.success('Suggestion Submitted', `Your suggestion "${title}" has been submitted.`)]
    });
  }

  async handleStoryAccept(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const storyId = interaction.customId.replace('story_accept_modal_', '');
    const note = interaction.fields.getTextInputValue('note') || 'Story accepted.';
    
    const result = await StoryService.reviewStory(storyId, interaction.user.id, 'accept', note);
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Review Failed', result.message)]
      });
    }
    
    await interaction.message?.delete().catch(() => {});
    
    return interaction.editReply({
      embeds: [EmbedService.success('Story Accepted', `Story #${storyId} has been accepted.`)]
    });
  }

  async handleStoryReject(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const storyId = interaction.customId.replace('story_reject_modal_', '');
    const reason = interaction.fields.getTextInputValue('reason');
    
    const result = await StoryService.reviewStory(storyId, interaction.user.id, 'reject', reason);
    
    if (!result.success) {
      return interaction.editReply({
        embeds: [EmbedService.error('Review Failed', result.message)]
      });
    }
    
    await interaction.message?.delete().catch(() => {});
    
    return interaction.editReply({
      embeds: [EmbedService.success('Story Rejected', `Story #${storyId} has been rejected.`)]
    });
  }

  async handleCharacterDeleteConfirm(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const characterName = interaction.fields.getTextInputValue('confirm').trim();
    const expectedName = interaction.customId.split('_')[3];
    
    if (characterName !== expectedName) {
      return interaction.editReply({
        embeds: [EmbedService.error('Confirmation Failed', `Character name does not match.`)]
      });
    }
    
    const account = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account.length) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    await database.query('DELETE FROM characters WHERE `Character` = ? AND Username = ?', [characterName, account[0].Username]);
    await database.query('DELETE FROM inventory WHERE `Character` = ?', [characterName]);
    await database.query(
      'UPDATE accounts SET LastCharacterDelete = ? WHERE DiscordID = ?',
      [HelperService.getCurrentTimestamp(), interaction.user.id]
    );
    
    return interaction.editReply({
      embeds: [EmbedService.success('Character Deleted', `${characterName} has been permanently deleted.`)]
    });
  }
}

module.exports = ModalHandler;