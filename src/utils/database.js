const mysql = require('mysql2/promise');
const logger = require('./logger');

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  async connect(config) {
    try {
      this.pool = mysql.createPool({
        host: config.host,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      
      await this.pool.query('SELECT 1');
      logger.info('Database connection established');
      return true;
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('Query error:', { sql, params, error: error.message });
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new DatabaseService();