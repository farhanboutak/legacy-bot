const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');

class StoryService {
  static async submitStory(characterName, username, discordId, storyText) {
    const existing = await database.query(
      `SELECT id, Status FROM char_stories 
       WHERE \`Character\` = ? AND Status IN (0, 1) 
       ORDER BY CreatedAt DESC LIMIT 1`,
      [characterName]
    );
    
    if (existing.length) {
      if (existing[0].Status === 0) {
        return { 
          success: false, 
          message: 'You already have a pending story for this character.' 
        };
      }
      if (existing[0].Status === 1) {
        return { 
          success: false, 
          message: 'This character already has an approved story.' 
        };
      }
    }
    
    const [result] = await database.query(
      `INSERT INTO char_stories 
       (\`Character\`, Username, DiscordID, Story, Status, CreatedAt) 
       VALUES (?, ?, ?, ?, 0, ?)`,
      [characterName, username, discordId, storyText, HelperService.getCurrentTimestamp()]
    );
    
    logger.info(`Story submitted: ID ${result.insertId} for character ${characterName}`);
    
    return {
      success: true,
      storyId: result.insertId,
      message: 'Your story has been submitted and is pending review.'
    };
  }
  
  static async getPendingStories(limit = 25) {
    return await database.query(
      `SELECT cs.*, a.WhiteList, a.Banned 
       FROM char_stories cs
       JOIN accounts a ON cs.Username = a.Username
       WHERE cs.Status = 0 
       ORDER BY cs.CreatedAt ASC 
       LIMIT ?`,
      [limit]
    );
  }
  
  static async reviewStory(storyId, adminId, action, note = '') {
    const story = await database.query(
      'SELECT * FROM char_stories WHERE id = ?',
      [storyId]
    );
    
    if (!story.length) {
      return { success: false, message: 'Story not found.' };
    }
    
    if (story[0].Status !== 0) {
      return { success: false, message: 'This story has already been reviewed.' };
    }
    
    const status = action === 'accept' ? 1 : 2;
    const statusText = action === 'accept' ? 'Accepted' : 'Rejected';
    const color = action === 'accept' ? '#00FF00' : '#FF0000';
    
    await database.query(
      `UPDATE char_stories 
       SET Status = ?, AdminNote = ?, ReviewedBy = ?, ReviewedAt = ? 
       WHERE id = ?`,
      [status, note, adminId, HelperService.getCurrentTimestamp(), storyId]
    );
    
    if (action === 'accept') {
      await database.query(
        'UPDATE characters SET Story = 1 WHERE `Character` = ? AND Username = ?',
        [story[0].Character, story[0].Username]
      );
    }
    
    logger.info(`Story ${storyId} ${statusText} by admin ${adminId}`);
    
    return {
      success: true,
      message: `Story has been ${statusText.toLowerCase()}.`,
      story: story[0],
      status,
      statusText
    };
  }
  
  static async getUserStories(discordId, limit = 10) {
    return await database.query(
      `SELECT cs.*, 
              CASE cs.Status 
                WHEN 0 THEN 'Pending'
                WHEN 1 THEN 'Approved'
                WHEN 2 THEN 'Rejected'
              END as StatusText
       FROM char_stories cs
       WHERE cs.DiscordID = ?
       ORDER BY cs.CreatedAt DESC
       LIMIT ?`,
      [discordId, limit]
    );
  }
  
  static async getCharacterStories(characterName, limit = 5) {
    return await database.query(
      `SELECT cs.*, 
              CASE cs.Status 
                WHEN 0 THEN 'Pending'
                WHEN 1 THEN 'Approved'
                WHEN 2 THEN 'Rejected'
              END as StatusText
       FROM char_stories cs
       WHERE cs.\`Character\` = ?
       ORDER BY cs.CreatedAt DESC
       LIMIT ?`,
      [characterName, limit]
    );
  }
  
  static async getStoryStatistics() {
    const [pending] = await database.query(
      'SELECT COUNT(*) as total FROM char_stories WHERE Status = 0'
    );
    
    const [approved] = await database.query(
      'SELECT COUNT(*) as total FROM char_stories WHERE Status = 1'
    );
    
    const [rejected] = await database.query(
      'SELECT COUNT(*) as total FROM char_stories WHERE Status = 2'
    );
    
    const [todaySubmissions] = await database.query(
      'SELECT COUNT(*) as total FROM char_stories WHERE CreatedAt >= ?',
      [HelperService.getCurrentTimestamp() - 86400]
    );
    
    const [averageReviewTime] = await database.query(
      `SELECT AVG(ReviewedAt - CreatedAt) as avg_time 
       FROM char_stories 
       WHERE Status IN (1, 2) AND ReviewedAt IS NOT NULL`
    );
    
    return {
      pending: pending[0].total,
      approved: approved[0].total,
      rejected: rejected[0].total,
      todaySubmissions: todaySubmissions[0].total,
      averageReviewHours: averageReviewTime[0]?.avg_time ? 
        Math.round(averageReviewTime[0].avg_time / 3600) : 0
    };
  }
  
  static async formatStoryEmbed(story, includeAdminNote = true) {
    const statusColors = {
      0: '#F59E0B',
      1: '#10B981',
      2: '#EF4444'
    };
    
    const statusText = {
      0: 'Pending Review',
      1: 'Approved',
      2: 'Rejected'
    };
    
    const fields = [
      { name: 'Character', value: story.Character, inline: true },
      { name: 'Player', value: story.Username, inline: true },
      { name: 'Status', value: statusText[story.Status], inline: true },
      { name: 'Submitted', value: HelperService.formatTime(story.CreatedAt), inline: true }
    ];
    
    if (story.ReviewedAt && includeAdminNote) {
      fields.push(
        { name: 'Reviewed', value: HelperService.formatTime(story.ReviewedAt), inline: true },
        { name: 'Reviewer', value: story.ReviewedBy || 'System', inline: true }
      );
    }
    
    if (story.AdminNote && includeAdminNote && story.Status !== 0) {
      fields.push({ name: 'Admin Note', value: story.AdminNote, inline: false });
    }
    
    return EmbedService.create({
      title: `Story: ${story.Character}`,
      description: story.Story,
      color: statusColors[story.Status],
      fields
    });
  }
}

module.exports = StoryService;