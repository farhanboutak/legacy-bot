const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');

class GiveawayService {
  static async createGiveaway(guild, channelId, prize, durationMinutes, winnerCount, hostId) {
    const endTime = HelperService.getCurrentTimestamp() + (durationMinutes * 60);
    
    const embed = EmbedService.create({
      title: 'Giveaway',
      description: `**Prize:** ${prize}\n\nClick the button below to participate!\n**Ends:** ${HelperService.formatTime(endTime)}`,
      color: '#F59E0B',
      fields: [
        { name: 'Host', value: `<@${hostId}>`, inline: true },
        { name: 'Winners', value: winnerCount.toString(), inline: true }
      ],
      footer: 'Participants: 0'
    });
    
    const buttonRow = {
      type: 1,
      components: [{
        type: 2,
        customId: 'giveaway_join',
        label: 'Participate',
        style: 1,
        emoji: { name: '🎁' }
      }]
    };
    
    const channel = await guild.channels.fetch(channelId);
    const message = await channel.send({ embeds: [embed], components: [buttonRow] });
    
    const [result] = await database.query(
      `INSERT INTO giveaways 
       (Prize, WinnerCount, EndTime, MessageID, ChannelID, HostID, Active, CreatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [prize, winnerCount, endTime, message.id, channelId, hostId, HelperService.getCurrentTimestamp()]
    );
    
    logger.info(`Giveaway created: ID ${result.insertId}, Prize: ${prize}`);
    return result.insertId;
  }
  
  static async checkExpiredGiveaways() {
    const giveaways = await database.query(
      'SELECT * FROM giveaways WHERE Active = 1 AND EndTime <= ?',
      [HelperService.getCurrentTimestamp()]
    );
    
    for (const giveaway of giveaways) {
      await this.endGiveaway(giveaway);
    }
    
    return giveaways.length;
  }
  
  static async endGiveaway(giveaway) {
    try {
      await database.query('UPDATE giveaways SET Active = 0 WHERE id = ?', [giveaway.id]);
      
      const entries = await database.query(
        'SELECT DiscordID FROM giveaway_entries WHERE GiveawayID = ?',
        [giveaway.id]
      );
      
      const channel = await global.client.channels.fetch(giveaway.ChannelID);
      if (!channel) return;
      
      const message = await channel.messages.fetch(giveaway.MessageID).catch(() => null);
      if (!message) return;
      
      if (entries.length === 0) {
        const embed = EmbedService.info(
          'Giveaway Ended',
          `**Prize:** ${giveaway.Prize}\n\nNo participants entered this giveaway.`
        );
        await message.edit({ embeds: [embed], components: [] });
        return;
      }
      
      const shuffled = entries.sort(() => 0.5 - Math.random());
      const winners = shuffled.slice(0, giveaway.WinnerCount);
      const winnerMentions = winners.map(w => `<@${w.DiscordID}>`).join(', ');
      
      const resultEmbed = EmbedService.success(
        'Giveaway Concluded',
        `**Prize:** ${giveaway.Prize}\n**Winners:** ${winnerMentions}\n\nCongratulations to the winners!`
      );
      
      await message.edit({ embeds: [resultEmbed], components: [] });
      
      const announcementEmbed = EmbedService.success(
        'Giveaway Winners Announced',
        `**Prize:** ${giveaway.Prize}\n\n**Winners:** ${winnerMentions}\n\nPlease contact <@${giveaway.HostID}> to claim your prize.`
      );
      
      await channel.send({ embeds: [announcementEmbed] });
      
      for (const winner of winners) {
        try {
          const user = await global.client.users.fetch(winner.DiscordID);
          if (user) {
            await user.send({
              embeds: [EmbedService.success(
                'You Won a Giveaway!',
                `Congratulations! You won **${giveaway.Prize}** in the giveaway.\n\nPlease contact <@${giveaway.HostID}> to claim your prize.`
              )]
            });
          }
        } catch (error) {
          logger.error(`Failed to DM winner ${winner.DiscordID}:`, error);
        }
      }
      
      logger.info(`Giveaway ${giveaway.id} ended with ${winners.length} winners`);
    } catch (error) {
      logger.error(`Error ending giveaway ${giveaway.id}:`, error);
    }
  }
  
  static async joinGiveaway(messageId, userId) {
    const giveaway = await database.query(
      'SELECT * FROM giveaways WHERE MessageID = ? AND Active = 1 AND EndTime > ?',
      [messageId, HelperService.getCurrentTimestamp()]
    );
    
    if (!giveaway.length) {
      return { success: false, message: 'Giveaway has ended or does not exist.' };
    }
    
    const existing = await database.query(
      'SELECT id FROM giveaway_entries WHERE GiveawayID = ? AND DiscordID = ?',
      [giveaway[0].id, userId]
    );
    
    if (existing.length) {
      return { success: false, message: 'You have already joined this giveaway.' };
    }
    
    await database.query(
      'INSERT INTO giveaway_entries (GiveawayID, DiscordID, CreatedAt) VALUES (?, ?, ?)',
      [giveaway[0].id, userId, HelperService.getCurrentTimestamp()]
    );
    
    const participantCount = await database.query(
      'SELECT COUNT(*) as total FROM giveaway_entries WHERE GiveawayID = ?',
      [giveaway[0].id]
    );
    
    return { 
      success: true, 
      message: `You have joined the giveaway for **${giveaway[0].Prize}**!`,
      participantCount: participantCount[0].total
    };
  }
  
  static async getGiveawayStats() {
    const [activeCount] = await database.query(
      'SELECT COUNT(*) as total FROM giveaways WHERE Active = 1'
    );
    
    const [totalParticipants] = await database.query(
      'SELECT COUNT(*) as total FROM giveaway_entries'
    );
    
    const [recentGiveaways] = await database.query(
      `SELECT g.*, COUNT(ge.id) as participants 
       FROM giveaways g 
       LEFT JOIN giveaway_entries ge ON g.id = ge.GiveawayID 
       WHERE g.Active = 0 
       GROUP BY g.id 
       ORDER BY g.CreatedAt DESC 
       LIMIT 5`
    );
    
    return {
      active: activeCount[0].total,
      totalParticipants: totalParticipants[0].total,
      recentGiveaways
    };
  }
}

module.exports = GiveawayService;