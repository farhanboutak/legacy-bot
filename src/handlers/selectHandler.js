const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');
const ValidatorService = require('../utils/validator');

class SelectHandler {
  constructor(client) {
    this.client = client;
    this.tempStore = new Map();
  }

  async execute(interaction) {
    const { customId, values, user, guild } = interaction;
    
    logger.info(`Select menu used: ${customId} with value ${values[0]} by ${user.tag}`);
    
    // Character selection
    if (customId === 'character_select') {
      return this.handleCharacterSelect(interaction, values[0]);
    }
    
    // Character deletion selection
    if (customId === 'character_delete_select') {
      return this.handleCharacterDeleteSelect(interaction, values[0]);
    }
    
    // Story character selection
    if (customId === 'story_character_select') {
      return this.handleStoryCharacterSelect(interaction, values[0]);
    }
    
    // Admin story selection
    if (customId === 'admin_story_select') {
      return this.handleAdminStorySelect(interaction, values[0]);
    }
    
    // Admin whitelist selection
    if (customId === 'admin_whitelist_select') {
      return this.handleAdminWhitelistSelect(interaction, values[0]);
    }
    
    return interaction.reply({
      embeds: [EmbedService.warning('Invalid Selection', 'This selection could not be processed.')],
      ephemeral: true
    });
  }

  async handleCharacterSelect(interaction, characterName) {
    await interaction.deferReply({ ephemeral: true });
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.editReply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')]
      });
    }
    
    const [character] = await database.query(
      `SELECT c.*, a.Username 
       FROM characters c
       JOIN accounts a ON c.Username = a.Username
       WHERE c.\`Character\` = ? AND a.DiscordID = ?`,
      [characterName, interaction.user.id]
    );
    
    if (!character) {
      return interaction.editReply({
        embeds: [EmbedService.error('Not Found', 'Character not found or you don\'t own it.')]
      });
    }
    
    const embed = EmbedService.create({
      title: `Character: ${character.Character}`,
      color: '#FFA500',
      fields: [
        { name: 'Level', value: character.pScore.toString(), inline: true },
        { name: 'Playtime', value: `${character.PlayingHours} hours`, inline: true },
        { name: 'Money', value: HelperService.formatMoney(character.Money), inline: true },
        { name: 'Bank', value: HelperService.formatMoney(character.BankMoney), inline: true },
        { name: 'Total Wealth', value: HelperService.formatMoney((character.Money || 0) + (character.BankMoney || 0)), inline: true },
        { name: 'Faction', value: character.Faction === -1 ? 'None' : character.Faction.toString(), inline: true },
        { name: 'Job', value: character.Job || 'Unemployed', inline: true },
        { name: 'Health', value: `${character.Health || 100}%`, inline: true },
        { name: 'Armor', value: `${character.ArmorStatus || 0}%`, inline: true }
      ]
    });
    
    return interaction.editReply({ embeds: [embed] });
  }

  async handleCharacterDeleteSelect(interaction, characterName) {
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.reply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')],
        ephemeral: true
      });
    }
    
    const modal = {
      customId: `character_delete_confirm_${characterName}`,
      title: 'Confirm Character Deletion',
      components: [{
        type: 1,
        components: [{
          type: 4,
          customId: 'confirm',
          label: `Type "${characterName}" to confirm`,
          style: 1,
          required: true,
          placeholder: characterName
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }

  async handleStoryCharacterSelect(interaction, characterName) {
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [interaction.user.id]
    );
    
    if (!account) {
      return interaction.reply({
        embeds: [EmbedService.error('No Account', 'You don\'t have an account.')],
        ephemeral: true
      });
    }
    
    const modal = {
      customId: `story_modal_${characterName}`,
      title: 'Submit Character Story',
      components: [{
        type: 1,
        components: [{
          type: 4,
          customId: 'story',
          label: 'Background Story',
          style: 2,
          required: true,
          placeholder: 'Write your character\'s background story... (minimum 100 characters)',
          minLength: 100,
          maxLength: 5000
        }]
      }]
    };
    
    return interaction.showModal(modal);
  }

  async handleAdminStorySelect(interaction, storyId) {
    const [story] = await database.query(
      'SELECT * FROM char_stories WHERE id = ?',
      [storyId]
    );
    
    if (!story) {
      return interaction.update({
        content: 'Story not found.',
        components: [],
        embeds: []
      });
    }
    
    const embed = EmbedService.create({
      title: `Story Review: ${story.Character}`,
      description: story.Story,
      color: '#FFA500',
      fields: [
        { name: 'Player', value: story.Username, inline: true },
        { name: 'Discord', value: `<@${story.DiscordID}>`, inline: true },
        { name: 'Submitted', value: HelperService.formatTime(story.CreatedAt), inline: true },
        { name: 'Content Preview', value: HelperService.truncate(story.Story, 200), inline: false }
      ]
    });
    
    const row = {
      type: 1,
      components: [
        { type: 2, customId: `story_accept_${storyId}`, label: 'Accept', style: 3 },
        { type: 2, customId: `story_reject_${storyId}`, label: 'Reject', style: 4 }
      ]
    };
    
    return interaction.update({ embeds: [embed], components: [row] });
  }

  async handleAdminWhitelistSelect(interaction, discordId) {
    await interaction.deferUpdate();
    
    const [account] = await database.query(
      'SELECT Username FROM accounts WHERE DiscordID = ?',
      [discordId]
    );
    
    if (!account) {
      return interaction.editReply({
        content: 'Account not found.',
        components: []
      });
    }
    
    await database.query(
      'UPDATE accounts SET WhiteList = 1 WHERE DiscordID = ?',
      [discordId]
    );
    
    const member = await interaction.guild.members.fetch(discordId).catch(() => null);
    if (member) {
      await member.roles.add(process.env.MEMBER_ROLE_ID).catch(() => {});
      await member.send({
        embeds: [EmbedService.success(
          'Account Whitelisted',
          `Your account **${account[0].Username}** has been whitelisted. You can now access the server.`
        )]
      }).catch(() => {});
    }
    
    const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
    if (logChannel) {
      const logEmbed = EmbedService.info(
        'User Whitelisted',
        `**Admin:** ${interaction.user.tag}\n**User:** <@${discordId}>\n**Username:** ${account[0].Username}`
      );
      await logChannel.send({ embeds: [logEmbed] });
    }
    
    return interaction.editReply({
      content: `✅ Whitelisted <@${discordId}> (${account[0].Username}) successfully.`,
      components: []
    });
  }
}

module.exports = SelectHandler;