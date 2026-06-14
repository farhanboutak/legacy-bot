const database = require('../utils/database');
const logger = require('../utils/logger');
const EmbedService = require('../utils/embeds');
const HelperService = require('../utils/helpers');

class ReportService {
  static async createReport(reporterId, reporterName, targetName, type, reason, evidence = '') {
    const [result] = await database.query(
      `INSERT INTO reports 
       (ReporterID, ReporterName, TargetName, Type, Reason, Evidence, Status, CreatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [reporterId, reporterName, targetName, type, reason, evidence, HelperService.getCurrentTimestamp()]
    );
    
    logger.info(`Report created: ID ${result.insertId}, Type: ${type}, Target: ${targetName}`);
    
    return {
      success: true,
      reportId: result.insertId,
      message: `Your ${type} report has been submitted. Reference ID: #${result.insertId}`
    };
  }
  
  static async getPendingReports(limit = 50) {
    return await database.query(
      `SELECT r.*, a.WhiteList, a.Banned 
       FROM reports r
       LEFT JOIN accounts a ON r.TargetName = a.Username
       WHERE r.Status = 0 
       ORDER BY r.CreatedAt ASC 
       LIMIT ?`,
      [limit]
    );
  }
  
  static async getReportsByType(type, limit = 50) {
    return await database.query(
      `SELECT r.*, a.WhiteList, a.Banned 
       FROM reports r
       LEFT JOIN accounts a ON r.TargetName = a.Username
       WHERE r.Type = ? AND r.Status = 0
       ORDER BY r.CreatedAt ASC 
       LIMIT ?`,
      [type, limit]
    );
  }
  
  static async resolveReport(reportId, adminId, resolution, note = '') {
    const report = await database.query(
      'SELECT * FROM reports WHERE id = ?',
      [reportId]
    );
    
    if (!report.length) {
      return { success: false, message: 'Report not found.' };
    }
    
    if (report[0].Status !== 0) {
      return { success: false, message: 'This report has already been resolved.' };
    }
    
    const status = resolution === 'accept' ? 1 : 2;
    const resolutionText = resolution === 'accept' ? 'Resolved' : 'Dismissed';
    
    await database.query(
      `UPDATE reports 
       SET Status = ?, AdminNote = ? 
       WHERE id = ?`,
      [status, note, reportId]
    );
    
    logger.info(`Report ${reportId} ${resolutionText} by admin ${adminId}`);
    
    try {
      const user = await global.client.users.fetch(report[0].ReporterID);
      if (user) {
        const embed = resolution === 'accept' 
          ? EmbedService.success(
              'Report Resolved',
              `Your report #${reportId} against **${report[0].TargetName}** has been reviewed and action has been taken.\n\n**Admin Note:** ${note || 'Thank you for your report.'}`
            )
          : EmbedService.info(
              'Report Update',
              `Your report #${reportId} against **${report[0].TargetName}** has been reviewed and no action was taken.\n\n**Reason:** ${note || 'Insufficient evidence or violation not found.'}`
            );
        
        await user.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(`Failed to DM reporter ${report[0].ReporterID}:`, error);
    }
    
    return {
      success: true,
      message: `Report #${reportId} has been ${resolutionText}.`,
      report: report[0]
    };
  }
  
  static async getUserReports(discordId, limit = 10) {
    return await database.query(
      `SELECT r.*, 
              CASE r.Status 
                WHEN 0 THEN 'Pending'
                WHEN 1 THEN 'Resolved'
                WHEN 2 THEN 'Dismissed'
              END as StatusText
       FROM reports r
       WHERE r.ReporterID = ?
       ORDER BY r.CreatedAt DESC
       LIMIT ?`,
      [discordId, limit]
    );
  }
  
  static async getReportsAgainstPlayer(username, limit = 10) {
    return await database.query(
      `SELECT r.*, 
              CASE r.Status 
                WHEN 0 THEN 'Pending'
                WHEN 1 THEN 'Resolved'
                WHEN 2 THEN 'Dismissed'
              END as StatusText
       FROM reports r
       WHERE r.TargetName = ?
       ORDER BY r.CreatedAt DESC
       LIMIT ?`,
      [username, limit]
    );
  }
  
  static async getReportStatistics() {
    const [pendingPlayer] = await database.query(
      "SELECT COUNT(*) as total FROM reports WHERE Type = 'player' AND Status = 0"
    );
    
    const [pendingBug] = await database.query(
      "SELECT COUNT(*) as total FROM reports WHERE Type = 'bug' AND Status = 0"
    );
    
    const [resolvedToday] = await database.query(
      'SELECT COUNT(*) as total FROM reports WHERE Status = 1 AND CreatedAt >= ?',
      [HelperService.getCurrentTimestamp() - 86400]
    );
    
    const [topReported] = await database.query(
      `SELECT TargetName, COUNT(*) as report_count 
       FROM reports 
       WHERE Type = 'player' 
       GROUP BY TargetName 
       ORDER BY report_count DESC 
       LIMIT 5`
    );
    
    const [averageResponseTime] = await database.query(
      `SELECT AVG(UpdatedAt - CreatedAt) as avg_time 
       FROM reports 
       WHERE Status IN (1, 2)`
    );
    
    return {
      pendingPlayerReports: pendingPlayer[0].total,
      pendingBugReports: pendingBug[0].total,
      resolvedToday: resolvedToday[0].total,
      topReportedPlayers: topReported,
      averageResponseHours: averageResponseTime[0]?.avg_time ? 
        Math.round(averageResponseTime[0].avg_time / 3600) : 0
    };
  }
  
  static async getBulkReports(filters = {}, limit = 100) {
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params = [];
    
    if (filters.status !== undefined) {
      query += ' AND Status = ?';
      params.push(filters.status);
    }
    
    if (filters.type) {
      query += ' AND Type = ?';
      params.push(filters.type);
    }
    
    if (filters.targetName) {
      query += ' AND TargetName LIKE ?';
      params.push(`%${filters.targetName}%`);
    }
    
    if (filters.dateFrom) {
      query += ' AND CreatedAt >= ?';
      params.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      query += ' AND CreatedAt <= ?';
      params.push(filters.dateTo);
    }
    
    query += ' ORDER BY CreatedAt DESC LIMIT ?';
    params.push(limit);
    
    return await database.query(query, params);
  }
  
  static async formatReportEmbed(report, includeDetails = true) {
    const statusColors = {
      0: '#F59E0B',
      1: '#10B981',
      2: '#6B7280'
    };
    
    const statusText = {
      0: 'Pending Review',
      1: 'Resolved - Action Taken',
      2: 'Dismissed'
    };
    
    const typeLabels = {
      player: 'Player Report',
      bug: 'Bug Report'
    };
    
    const fields = [
      { name: 'Type', value: typeLabels[report.Type] || report.Type, inline: true },
      { name: 'Target', value: report.TargetName, inline: true },
      { name: 'Status', value: statusText[report.Status], inline: true },
      { name: 'Reporter', value: `<@${report.ReporterID}>`, inline: true },
      { name: 'Submitted', value: HelperService.formatTime(report.CreatedAt), inline: true }
    ];
    
    if (includeDetails) {
      fields.push(
        { name: 'Reason', value: HelperService.truncate(report.Reason, 200), inline: false }
      );
      
      if (report.Evidence && report.Evidence !== '-') {
        fields.push({ name: 'Evidence', value: report.Evidence, inline: false });
      }
      
      if (report.AdminNote && report.Status !== 0) {
        fields.push({ name: 'Admin Note', value: report.AdminNote, inline: false });
      }
    }
    
    return EmbedService.create({
      title: `Report #${report.id}`,
      color: statusColors[report.Status],
      fields
    });
  }
}

module.exports = ReportService;