const { SlashCommandBuilder } = require('discord.js');
const database = require('../../utils/database');
const EmbedService = require('../../utils/embeds');
const HelperService = require('../../utils/helpers');
const ValidatorService = require('../../utils/validator');
const StoryService = require('../../services/storyService');

module.exports = [
  new SlashCommandBuilder()
    .setName('character')
    .setDescription('Character management commands')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all your characters')
    )
    .addSubcommand(sub => sub
      .setName('stats')
      .setDescription('View character statistics')
      .addStringOption(opt => opt.setName('name').setDescription('Character name').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('story')
      .setDescription('Submit or view character story')
      .addStringOption(opt => opt.setName('name').setDescription('Character name').setRequired(true))
      .addStringOption(opt => opt.setName('content').setDescription('Story content (for submit)'))
    )
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Request character deletion')
      .addStringOption(opt => opt.setName('name').setDescription('Character name').setRequired(true))
    ),
  {
    name: 'character_list',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const [account] = await database.query(
        'SELECT Username FROM accounts WHERE DiscordID = ?',
        [interaction.user.id]
      );
      
      if (!account.length) {
        return interaction.editReply({
          embeds: [EmbedService.error('No Account', 'You don\'t have an account. Use `/ucp register` to create one.')]
        });
      }
      
      const characters = await database.query(
        'SELECT `Character`, pScore, PlayingHours, Money, BankMoney, Faction, Job FROM characters WHERE Username = ?',
        [account[0].Username]
      );
      
      if (!characters.length) {
        return interaction.editReply({
          embeds: [EmbedService.info('No Characters', 'You don\'t have any characters yet.')]
        });
      }
      
      const description = characters.map(char => {
        return `**${char.Character}**\n• Level: ${char.pScore} | Playtime: ${char.PlayingHours}h\n• Money: ${HelperService.formatMoney(char.Money)} | Bank: ${HelperService.formatMoney(char.BankMoney)}\n• Faction: ${char.Faction === -1 ? 'None' : char.Faction} | Job: ${char.Job || 'Unemployed'}\n`;
      }).join('\n');
      
      const embed = EmbedService.create({
        title: `Your Characters (${characters.length})`,
        description,
        color: '#00FF00'
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'character_stats',
    execute: async (interaction) => {
      await interaction.deferReply();
      
      const characterName = interaction.options.getString('name');
      
      const [character] = await database.query(
        `SELECT c.*, a.Username 
         FROM characters c
         JOIN accounts a ON c.Username = a.Username
         WHERE c.\`Character\` = ?`,
        [characterName]
      );
      
      if (!character) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `Character "${characterName}" not found.`)]
        });
      }
      
      const [story] = await StoryService.getCharacterStories(characterName, 1);
      
      const embed = EmbedService.create({
        title: `Character: ${character.Character}`,
        color: '#FFA500',
        fields: [
          { name: 'Owner', value: character.Username, inline: true },
          { name: 'Level', value: character.pScore.toString(), inline: true },
          { name: 'Playtime', value: `${character.PlayingHours} hours`, inline: true },
          { name: 'Money', value: HelperService.formatMoney(character.Money), inline: true },
          { name: 'Bank', value: HelperService.formatMoney(character.BankMoney), inline: true },
          { name: 'Total Wealth', value: HelperService.formatMoney((character.Money || 0) + (character.BankMoney || 0)), inline: true },
          { name: 'Faction', value: character.Faction === -1 ? 'None' : character.Faction.toString(), inline: true },
          { name: 'Faction Rank', value: character.FactionRank.toString(), inline: true },
          { name: 'Job', value: character.Job || 'Unemployed', inline: true },
          { name: 'Health', value: `${character.Health || 100}%`, inline: true },
          { name: 'Armor', value: `${character.ArmorStatus || 0}%`, inline: true },
          { name: 'VIP', value: character.Vip === 1 ? `Yes (${Math.max(0, Math.floor((character.VipTime - HelperService.getCurrentTimestamp()) / 86400))} days left)` : 'No', inline: true },
          { name: 'Story Status', value: story ? (story.Status === 0 ? 'Pending' : story.Status === 1 ? 'Approved' : 'Rejected') : 'Not Submitted', inline: true }
        ]
      });
      
      return interaction.editReply({ embeds: [embed] });
    }
  },
  {
    name: 'character_story',
    execute: async (interaction) => {
      const characterName = interaction.options.getString('name');
      const storyContent = interaction.options.getString('content');
      
      if (!storyContent) {
        await interaction.deferReply({ ephemeral: true });
        
        const stories = await StoryService.getCharacterStories(characterName, 5);
        
        if (!stories.length) {
          return interaction.editReply({
            embeds: [EmbedService.info('No Story', `No story found for ${characterName}. Use \`/character story ${characterName} [content]\` to submit one.`)]
          });
        }
        
        const embed = await StoryService.formatStoryEmbed(stories[0], true);
        return interaction.editReply({ embeds: [embed] });
      }
      
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
      
      const [character] = await database.query(
        'SELECT * FROM characters WHERE `Character` = ? AND Username = ?',
        [characterName, account[0].Username]
      );
      
      if (!character) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `You don't own character "${characterName}".`)]
        });
      }
      
      const storyCheck = ValidatorService.validateStory(storyContent, 100, 5000);
      if (!storyCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Invalid Story', storyCheck.error)]
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
      
      const reviewChannel = interaction.guild.channels.cache.get(process.env.STORY_REVIEW_CHANNEL);
      if (reviewChannel) {
        const reviewEmbed = await StoryService.formatStoryEmbed(
          { Character: characterName, Username: account[0].Username, Story: storyCheck.value, CreatedAt: HelperService.getCurrentTimestamp(), Status: 0 },
          false
        );
        
        const row = {
          type: 1,
          components: [
            { type: 2, customId: `story_accept_${result.storyId}`, label: 'Accept', style: 3 },
            { type: 2, customId: `story_reject_${result.storyId}`, label: 'Reject', style: 4 }
          ]
        };
        
        await reviewChannel.send({
          content: `<@&${process.env.ADMIN_ROLE_ID}> New story pending review.`,
          embeds: [reviewEmbed],
          components: [row]
        });
      }
      
      return interaction.editReply({
        embeds: [EmbedService.success('Story Submitted', result.message)]
      });
    }
  },
  {
    name: 'character_delete',
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      
      const characterName = interaction.options.getString('name');
      
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
        432000 // 5 days in seconds
      );
      
      if (!cooldownCheck.valid) {
        return interaction.editReply({
          embeds: [EmbedService.error('Cooldown Active', cooldownCheck.message)]
        });
      }
      
      const [character] = await database.query(
        'SELECT * FROM characters WHERE `Character` = ? AND Username = ?',
        [characterName, account[0].Username]
      );
      
      if (!character) {
        return interaction.editReply({
          embeds: [EmbedService.error('Not Found', `You don't own character "${characterName}".`)]
        });
      }
      
      const confirmation = await interaction.followUp({
        embeds: [EmbedService.warning(
          'Confirm Deletion',
          `Are you sure you want to delete **${characterName}**? This action is **permanent** and cannot be undone.\n\nType \`${characterName}\` to confirm.`
        )],
        fetchReply: true
      });
      
      const filter = (msg) => msg.author.id === interaction.user.id && msg.content === characterName;
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).catch(() => null);
      
      if (!collected) {
        return interaction.editReply({
          embeds: [EmbedService.error('Cancelled', 'Character deletion cancelled.')]
        });
      }
      
      await database.query('DELETE FROM characters WHERE `Character` = ?', [characterName]);
      await database.query('DELETE FROM inventory WHERE `Character` = ?', [characterName]);
      await database.query(
        'UPDATE accounts SET LastCharacterDelete = ? WHERE DiscordID = ?',
        [HelperService.getCurrentTimestamp(), interaction.user.id]
      );
      
      const logEmbed = EmbedService.warning(
        'Character Deleted',
        `**Player:** ${interaction.user.tag}\n**Character:** ${characterName}`
      );
      
      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL);
      if (logChannel) await logChannel.send({ embeds: [logEmbed] });
      
      return interaction.editReply({
        embeds: [EmbedService.success('Character Deleted', `${characterName} has been permanently deleted.`)]
      });
    }
  }
];