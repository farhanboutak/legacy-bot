const crypto = require('crypto');

class HelperService {
  static generateCode() {
    return `LSRP-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  static hashPassword(password, salt) {
    return crypto.createHash('sha256')
      .update(salt + password)
      .digest('hex')
      .toUpperCase();
  }

  static generateSalt() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  static formatTime(timestamp) {
    if (!timestamp || timestamp === 0) return 'Never';
    return `<t:${timestamp}:f>`;
  }

  static formatMoney(amount) {
    return `$${(amount || 0).toLocaleString('en-US')}`;
  }

  static getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  static truncate(str, length = 100) {
    if (!str) return '';
    return str.length > length ? `${str.substring(0, length)}...` : str;
  }

  static isValidIP(ip) {
    const regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return regex.test(ip);
  }

  static isValidPort(port) {
    return port >= 1 && port <= 65535;
  }
}

module.exports = HelperService;