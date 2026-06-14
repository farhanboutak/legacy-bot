const HelperService = require('./helpers');

class ValidatorService {
  // Username validation
  static validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required.' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters long.' };
    }
    
    if (trimmed.length > 25) {
      return { valid: false, error: 'Username cannot exceed 25 characters.' };
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }
    
    const reservedNames = ['admin', 'system', 'moderator', 'legacy', 'staff', 'support'];
    if (reservedNames.includes(trimmed.toLowerCase())) {
      return { valid: false, error: 'This username is reserved and cannot be used.' };
    }
    
    return { valid: true, value: trimmed };
  }
  
  // Character name validation
  static validateCharacterName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Character name is required.' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      return { valid: false, error: 'Character name must be at least 2 characters long.' };
    }
    
    if (trimmed.length > 24) {
      return { valid: false, error: 'Character name cannot exceed 24 characters.' };
    }
    
    const nameRegex = /^[A-Za-z][A-Za-z\s]*[A-Za-z]$/;
    if (!nameRegex.test(trimmed)) {
      return { valid: false, error: 'Character name must start and end with a letter and contain only letters and spaces.' };
    }
    
    return { valid: true, value: trimmed };
  }
  
  // Password validation
  static validatePassword(password, minLength = 6, maxLength = 32) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required.' };
    }
    
    if (password.length < minLength) {
      return { valid: false, error: `Password must be at least ${minLength} characters long.` };
    }
    
    if (password.length > maxLength) {
      return { valid: false, error: `Password cannot exceed ${maxLength} characters.` };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return { valid: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.' };
    }
    
    const commonPasswords = ['password123', 'admin123', 'qwerty123', 'abc123', '12345678'];
    if (commonPasswords.includes(password.toLowerCase())) {
      return { valid: false, error: 'This password is too common. Please choose a stronger password.' };
    }
    
    return { valid: true };
  }
  
  // Email validation
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email address is required.' };
    }
    
    const trimmed = email.trim().toLowerCase();
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }
    
    if (trimmed.length > 64) {
      return { valid: false, error: 'Email address cannot exceed 64 characters.' };
    }
    
    const disposableDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com'];
    const domain = trimmed.split('@')[1];
    if (disposableDomains.includes(domain)) {
      return { valid: false, error: 'Disposable email addresses are not allowed.' };
    }
    
    return { valid: true, value: trimmed };
  }
  
  // IP Address validation
  static validateIPAddress(ip) {
    if (!ip || typeof ip !== 'string') {
      return { valid: false, error: 'IP address is required.' };
    }
    
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) {
      return { valid: false, error: 'Please enter a valid IPv4 address (e.g., 192.168.1.1).' };
    }
    
    const parts = ip.split('.');
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        return { valid: false, error: 'Each IP segment must be between 0 and 255.' };
      }
    }
    
    return { valid: true };
  }
  
  // Port validation
  static validatePort(port) {
    if (!port && port !== 0) {
      return { valid: false, error: 'Port number is required.' };
    }
    
    const num = parseInt(port, 10);
    if (isNaN(num)) {
      return { valid: false, error: 'Port must be a number.' };
    }
    
    if (num < 1 || num > 65535) {
      return { valid: false, error: 'Port must be between 1 and 65535.' };
    }
    
    const privilegedPorts = [21, 22, 23, 25, 80, 110, 143, 443, 993, 995];
    if (privilegedPorts.includes(num)) {
      return { valid: false, error: 'This port is reserved for system services. Please use a different port.' };
    }
    
    return { valid: true, value: num };
  }
  
  // Money amount validation
  static validateMoneyAmount(amount, min = 0, max = 1000000000) {
    const num = parseInt(amount, 10);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Amount must be a valid number.' };
    }
    
    if (num < min) {
      return { valid: false, error: `Amount cannot be less than ${HelperService.formatMoney(min)}.` };
    }
    
    if (num > max) {
      return { valid: false, error: `Amount cannot exceed ${HelperService.formatMoney(max)}.` };
    }
    
    return { valid: true, value: num };
  }
  
  // Story content validation
  static validateStory(content, minLength = 100, maxLength = 5000) {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Story content is required.' };
    }
    
    const trimmed = content.trim();
    
    if (trimmed.length < minLength) {
      return { valid: false, error: `Story must be at least ${minLength} characters long. Current: ${trimmed.length}` };
    }
    
    if (trimmed.length > maxLength) {
      return { valid: false, error: `Story cannot exceed ${maxLength} characters. Current: ${trimmed.length}` };
    }
    
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 20) {
      return { valid: false, error: 'Story must contain at least 20 words.' };
    }
    
    const forbiddenWords = ['gay', 'fuck', 'shit', 'bitch', 'asshole'];
    const lowerContent = trimmed.toLowerCase();
    for (const word of forbiddenWords) {
      if (lowerContent.includes(word)) {
        return { valid: false, error: 'Story contains inappropriate language. Please revise.' };
      }
    }
    
    return { valid: true, value: trimmed };
  }
  
  // Reason validation (for reports, warnings, etc.)
  static validateReason(reason, minLength = 5, maxLength = 500) {
    if (!reason || typeof reason !== 'string') {
      return { valid: false, error: 'Reason is required.' };
    }
    
    const trimmed = reason.trim();
    
    if (trimmed.length < minLength) {
      return { valid: false, error: `Reason must be at least ${minLength} characters long.` };
    }
    
    if (trimmed.length > maxLength) {
      return { valid: false, error: `Reason cannot exceed ${maxLength} characters.` };
    }
    
    return { valid: true, value: trimmed };
  }
  
  // Evidence URL validation
  static validateEvidence(url) {
    if (!url || typeof url !== 'string') {
      return { valid: true, value: '-' };
    }
    
    const trimmed = url.trim();
    
    if (trimmed === '-' || trimmed === '') {
      return { valid: true, value: '-' };
    }
    
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid URL for evidence.' };
    }
    
    const allowedDomains = ['imgur.com', 'youtube.com', 'streamable.com', 'medal.tv', 'discord.com', 'cdn.discordapp.com'];
    try {
      const urlObj = new URL(trimmed);
      const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
      if (!isAllowed) {
        return { valid: false, error: 'Please use evidence from trusted platforms (Imgur, YouTube, Streamable, Medal, Discord).' };
      }
    } catch {
      return { valid: false, error: 'Invalid URL format.' };
    }
    
    return { valid: true, value: trimmed };
  }
  
  // Discord ID validation
  static validateDiscordId(id) {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'Discord ID is required.' };
    }
    
    const idRegex = /^\d{17,20}$/;
    if (!idRegex.test(id)) {
      return { valid: false, error: 'Invalid Discord ID format.' };
    }
    
    return { valid: true };
  }
  
  // Faction ID validation
  static validateFactionId(id) {
    const num = parseInt(id, 10);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Faction ID must be a number.' };
    }
    
    if (num < -1) {
      return { valid: false, error: 'Invalid faction ID.' };
    }
    
    return { valid: true, value: num };
  }
  
  // Rank validation
  static validateRank(rank, min = 0, max = 10) {
    const num = parseInt(rank, 10);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Rank must be a number.' };
    }
    
    if (num < min || num > max) {
      return { valid: false, error: `Rank must be between ${min} and ${max}.` };
    }
    
    return { valid: true, value: num };
  }
  
  // Duration validation (in days)
  static validateDuration(days, min = 1, max = 365) {
    const num = parseInt(days, 10);
    
    if (isNaN(num)) {
      return { valid: false, error: 'Duration must be a number.' };
    }
    
    if (num < min) {
      return { valid: false, error: `Duration must be at least ${min} day(s).` };
    }
    
    if (num > max) {
      return { valid: false, error: `Duration cannot exceed ${max} days.` };
    }
    
    return { valid: true, value: num };
  }
  
  // Character cooldown validation
  static validateCharacterCooldown(lastDelete, cooldownSeconds) {
    if (!lastDelete || lastDelete === 0) {
      return { valid: true, remaining: 0 };
    }
    
    const elapsed = HelperService.getCurrentTimestamp() - lastDelete;
    
    if (elapsed < cooldownSeconds) {
      const remaining = cooldownSeconds - elapsed;
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      return { 
        valid: false, 
        remaining,
        message: `Please wait ${days} days and ${hours} hours before deleting another character.`
      };
    }
    
    return { valid: true, remaining: 0 };
  }
  
  // Multiple validation for account creation
  static validateAccountCreation(username, password, email = null) {
    const errors = [];
    
    const usernameCheck = this.validateUsername(username);
    if (!usernameCheck.valid) errors.push(usernameCheck.error);
    
    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.valid) errors.push(passwordCheck.error);
    
    if (email) {
      const emailCheck = this.validateEmail(email);
      if (!emailCheck.valid) errors.push(emailCheck.error);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data: {
        username: usernameCheck.value || username,
        email: email ? email.trim().toLowerCase() : null
      }
    };
  }
  
  // Bulk validation for report submission
  static validateReportSubmission(target, reason, evidence = null) {
    const errors = [];
    
    const targetCheck = this.validateCharacterName(target);
    if (!targetCheck.valid) errors.push(targetCheck.error);
    
    const reasonCheck = this.validateReason(reason, 10, 500);
    if (!reasonCheck.valid) errors.push(reasonCheck.error);
    
    if (evidence) {
      const evidenceCheck = this.validateEvidence(evidence);
      if (!evidenceCheck.valid) errors.push(evidenceCheck.error);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data: {
        target: targetCheck.value || target,
        reason: reasonCheck.value || reason,
        evidence: evidence ? (evidenceCheck?.value || evidence) : '-'
      }
    };
  }
  
  // Sanitize input (remove dangerous characters)
  static sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[&|;$%@"<>()+,\\]/g, '') // Remove special characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .substring(0, 1000); // Limit length
  }
  
  // Validate numeric input with range
  static validateNumber(value, min = null, max = null, fieldName = 'Value') {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
      return { valid: false, error: `${fieldName} must be a valid number.` };
    }
    
    if (min !== null && num < min) {
      return { valid: false, error: `${fieldName} cannot be less than ${min}.` };
    }
    
    if (max !== null && num > max) {
      return { valid: false, error: `${fieldName} cannot exceed ${max}.` };
    }
    
    return { valid: true, value: num };
  }
  
  // Validate date range
  static validateDateRange(startDate, endDate) {
    const start = parseInt(startDate, 10);
    const end = parseInt(endDate, 10);
    
    if (isNaN(start) || isNaN(end)) {
      return { valid: false, error: 'Invalid date format.' };
    }
    
    if (start > end) {
      return { valid: false, error: 'Start date cannot be after end date.' };
    }
    
    const maxRange = 90 * 86400; // 90 days
    if (end - start > maxRange) {
      return { valid: false, error: 'Date range cannot exceed 90 days.' };
    }
    
    return { valid: true };
  }
}

module.exports = ValidatorService;