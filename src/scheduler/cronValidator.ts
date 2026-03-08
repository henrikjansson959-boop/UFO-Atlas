import * as cron from 'node-cron';

/**
 * Result of cron expression validation
 */
export interface CronValidationResult {
  isValid: boolean;
  error?: string;
  nextRun?: Date;
  intervalMinutes?: number;
}

/**
 * CronValidator utility class
 * Validates cron expressions and enforces minimum interval requirements
 * Validates: Requirements 3.1, 3.2, 10.1, 10.3
 */
export class CronValidator {
  private static readonly MINIMUM_INTERVAL_MINUTES = 15;

  /**
   * Validate cron expression syntax and check minimum interval
   * Validates: Requirements 3.1, 10.1, 10.3, 10.4
   * 
   * @param cronExpression - Cron expression to validate
   * @returns Validation result with error message if invalid
   */
  validateCronExpression(cronExpression: string): CronValidationResult {
    // Check if expression is empty or null
    if (!cronExpression || cronExpression.trim() === '') {
      return {
        isValid: false,
        error: this.getEmptyExpressionError(),
      };
    }

    // Validate cron syntax using node-cron
    if (!cron.validate(cronExpression)) {
      return {
        isValid: false,
        error: this.getInvalidSyntaxError(cronExpression),
      };
    }

    // Calculate minimum interval
    const intervalMinutes = this.calculateMinimumInterval(cronExpression);

    // Check if interval meets minimum requirement (Requirement 3.1, 3.2)
    if (!this.meetsMinimumInterval(cronExpression)) {
      return {
        isValid: false,
        error: this.getMinimumIntervalError(cronExpression, intervalMinutes),
        intervalMinutes,
      };
    }

    // Calculate next run time
    const nextRun = this.calculateNextRun(cronExpression);

    return {
      isValid: true,
      nextRun,
      intervalMinutes,
    };
  }

  /**
   * Generate descriptive error message for empty cron expression
   * Validates: Requirement 10.1, 10.4
   * 
   * @returns Error message with examples
   */
  private getEmptyExpressionError(): string {
    return 'Cron expression cannot be empty. Please enter a valid cron expression.\n\n' +
      'Examples:\n' +
      '  • "*/15 * * * *" - Every 15 minutes\n' +
      '  • "0 * * * *" - Every hour\n' +
      '  • "0 9 * * *" - Daily at 9:00 AM\n' +
      '  • "0 9 * * 1" - Every Monday at 9:00 AM';
  }

  /**
   * Generate descriptive error message for invalid cron syntax
   * Validates: Requirement 10.1, 10.3, 10.4
   * 
   * @param cronExpression - The invalid cron expression
   * @returns Error message with common mistakes and examples
   */
  private getInvalidSyntaxError(cronExpression: string): string {
    const parts = cronExpression.trim().split(/\s+/);
    
    // Detect common mistakes
    if (parts.length < 5) {
      return 'Invalid cron expression: Too few fields. Cron expressions require exactly 5 fields.\n\n' +
        'Format: "minute hour day month weekday"\n\n' +
        'Examples:\n' +
        '  • "*/15 * * * *" - Every 15 minutes\n' +
        '  • "0 */2 * * *" - Every 2 hours\n' +
        '  • "30 14 * * 1" - Every Monday at 2:30 PM';
    }
    
    if (parts.length > 5) {
      return 'Invalid cron expression: Too many fields. Cron expressions require exactly 5 fields.\n\n' +
        'Format: "minute hour day month weekday"\n\n' +
        'Note: Seconds are not supported. Use minute as the smallest unit.\n\n' +
        'Examples:\n' +
        '  • "*/15 * * * *" - Every 15 minutes\n' +
        '  • "0 9,12,15 * * *" - At 9 AM, 12 PM, and 3 PM';
    }

    // Check for common "every second" mistake
    if (cronExpression.includes('*/1 ') || cronExpression.startsWith('*/1')) {
      return 'Invalid cron expression: Detected "*/1" pattern which may indicate an attempt to run every second.\n\n' +
        'Note: Seconds are not supported. The minimum interval is 15 minutes.\n\n' +
        'Valid examples:\n' +
        '  • "*/15 * * * *" - Every 15 minutes (minimum allowed)\n' +
        '  • "*/30 * * * *" - Every 30 minutes\n' +
        '  • "0 * * * *" - Every hour';
    }

    // Generic syntax error
    return 'Invalid cron expression syntax. Expected format: "minute hour day month weekday"\n\n' +
      'Each field accepts:\n' +
      '  • Wildcard: * (any value)\n' +
      '  • Step: */n (every n units)\n' +
      '  • List: a,b,c (specific values)\n' +
      '  • Range: a-b (range of values)\n\n' +
      'Examples:\n' +
      '  • "*/15 * * * *" - Every 15 minutes\n' +
      '  • "0 * * * *" - Every hour\n' +
      '  • "0 0 * * *" - Daily at midnight\n' +
      '  • "0,30 * * * *" - At 0 and 30 minutes past each hour';
  }

  /**
   * Generate descriptive error message for minimum interval violation
   * Validates: Requirement 10.1, 10.3, 10.4
   * 
   * @param cronExpression - The cron expression that violates minimum interval
   * @param intervalMinutes - The calculated interval in minutes
   * @returns Error message with explanation and examples
   */
  private getMinimumIntervalError(cronExpression: string, intervalMinutes: number): string {
    let specificAdvice = '';

    // Provide specific advice based on the expression pattern
    if (cronExpression === '* * * * *') {
      specificAdvice = '\n\nYou entered "* * * * *" which runs every minute. ' +
        'To run every 15 minutes, use "*/15 * * * *" instead.';
    } else if (cronExpression.startsWith('*/')) {
      const match = cronExpression.match(/^\*\/(\d+)/);
      if (match) {
        const currentInterval = parseInt(match[1], 10);
        if (currentInterval < 15) {
          specificAdvice = `\n\nYou entered "*/​${currentInterval} * * * *" which runs every ${currentInterval} minutes. ` +
            'To meet the minimum requirement, use "*/15 * * * *" or higher.';
        }
      }
    } else if (cronExpression.includes(',')) {
      specificAdvice = '\n\nYour expression uses a comma-separated list with intervals less than 15 minutes. ' +
        'Consider using "*/15 * * * *" for every 15 minutes, or "0,30 * * * *" for every 30 minutes.';
    } else if (cronExpression.includes('-')) {
      specificAdvice = '\n\nYour expression uses a range which may run every minute within that range. ' +
        'Use step values like "*/15 * * * *" instead.';
    }

    return `Schedule interval must be at least ${CronValidator.MINIMUM_INTERVAL_MINUTES} minutes. ` +
      `Your expression would run every ${intervalMinutes} minute${intervalMinutes !== 1 ? 's' : ''}.` +
      specificAdvice +
      '\n\nValid examples:\n' +
      '  • "*/15 * * * *" - Every 15 minutes (minimum allowed)\n' +
      '  • "*/20 * * * *" - Every 20 minutes\n' +
      '  • "0 * * * *" - Every hour\n' +
      '  • "0,30 * * * *" - Twice per hour (at 0 and 30 minutes)\n' +
      '  • "0 0 * * *" - Once per day at midnight';
  }

  /**
   * Calculate next execution time from cron expression
   * 
   * @param cronExpression - Valid cron expression
   * @param fromDate - Calculate from this date (default: now)
   * @returns Next execution timestamp
   */
  calculateNextRun(cronExpression: string, fromDate: Date = new Date()): Date {
    // Parse cron expression to determine next execution
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression format');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Start from the next minute
    const nextRun = new Date(fromDate);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    nextRun.setMinutes(nextRun.getMinutes() + 1);

    // Find the next matching time
    // This is a simplified implementation that handles common cases
    // For production, consider using a more robust cron parser
    let attempts = 0;
    const maxAttempts = 366 * 24 * 60; // One year worth of minutes

    while (attempts < maxAttempts) {
      if (this.matchesCronExpression(nextRun, minute, hour, dayOfMonth, month, dayOfWeek)) {
        return nextRun;
      }
      nextRun.setMinutes(nextRun.getMinutes() + 1);
      attempts++;
    }

    throw new Error('Could not calculate next run time within reasonable timeframe');
  }

  /**
   * Calculate minimum interval between executions in minutes
   * Validates: Requirement 3.1
   * 
   * @param cronExpression - Cron expression to analyze
   * @returns Minimum interval in minutes
   */
  calculateMinimumInterval(cronExpression: string): number {
    const parts = cronExpression.trim().split(/\s+/);
    
    if (parts.length !== 5) {
      return 0;
    }

    const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;

    // Check minute field for interval patterns
    if (minute.includes('*/')) {
      // Every N minutes pattern (e.g., */15)
      const interval = parseInt(minute.split('*/')[1], 10);
      return isNaN(interval) ? 0 : interval;
    }

    if (minute.includes(',')) {
      // Multiple specific minutes (e.g., 0,15,30,45)
      const minutes = minute.split(',').map(m => parseInt(m.trim(), 10));
      if (minutes.length > 1) {
        // Calculate minimum difference between consecutive minutes
        const sortedMinutes = minutes.sort((a, b) => a - b);
        let minDiff = 60; // Default to 60 if wraps around hour
        for (let i = 1; i < sortedMinutes.length; i++) {
          const diff = sortedMinutes[i] - sortedMinutes[i - 1];
          minDiff = Math.min(minDiff, diff);
        }
        // Check wrap-around from last to first
        const wrapDiff = 60 - sortedMinutes[sortedMinutes.length - 1] + sortedMinutes[0];
        minDiff = Math.min(minDiff, wrapDiff);
        return minDiff;
      }
    }

    if (minute.includes('-')) {
      // Range pattern (e.g., 0-30)
      // This runs every minute in the range, so interval is 1
      return 1;
    }

    if (minute === '*') {
      // Every minute
      return 1;
    }

    // If minute is a specific value or list, check hour field
    if (hour.includes('*/')) {
      // Every N hours pattern (e.g., */2)
      const interval = parseInt(hour.split('*/')[1], 10);
      return isNaN(interval) ? 60 : interval * 60;
    }

    if (hour === '*') {
      // Every hour (at specific minute)
      return 60;
    }

    if (hour.includes(',')) {
      // Multiple specific hours
      const hours = hour.split(',').map(h => parseInt(h.trim(), 10));
      if (hours.length > 1) {
        const sortedHours = hours.sort((a, b) => a - b);
        let minDiff = 24; // Default to 24 if wraps around day
        for (let i = 1; i < sortedHours.length; i++) {
          const diff = sortedHours[i] - sortedHours[i - 1];
          minDiff = Math.min(minDiff, diff);
        }
        const wrapDiff = 24 - sortedHours[sortedHours.length - 1] + sortedHours[0];
        minDiff = Math.min(minDiff, wrapDiff);
        return minDiff * 60;
      }
    }

    // If both minute and hour are specific values, check day fields
    if (dayOfMonth === '*' && dayOfWeek === '*') {
      // Runs once per day
      return 24 * 60;
    }

    // Default to daily for more complex patterns
    return 24 * 60;
  }

  /**
   * Check if cron expression meets 15-minute minimum interval
   * Validates: Requirement 3.2
   * 
   * @param cronExpression - Cron expression to check
   * @returns True if interval >= 15 minutes
   */
  meetsMinimumInterval(cronExpression: string): boolean {
    const intervalMinutes = this.calculateMinimumInterval(cronExpression);
    return intervalMinutes >= CronValidator.MINIMUM_INTERVAL_MINUTES;
  }

  /**
   * Check if a date matches a cron expression
   * 
   * @param date - Date to check
   * @param minute - Minute field from cron expression
   * @param hour - Hour field from cron expression
   * @param dayOfMonth - Day of month field from cron expression
   * @param month - Month field from cron expression
   * @param dayOfWeek - Day of week field from cron expression
   * @returns True if date matches the cron expression
   */
  private matchesCronExpression(
    date: Date,
    minute: string,
    hour: string,
    dayOfMonth: string,
    _month: string,
    dayOfWeek: string
  ): boolean {
    // Check minute
    if (!this.matchesField(date.getMinutes(), minute, 0, 59)) {
      return false;
    }

    // Check hour
    if (!this.matchesField(date.getHours(), hour, 0, 23)) {
      return false;
    }

    // Check day of month
    if (!this.matchesField(date.getDate(), dayOfMonth, 1, 31)) {
      return false;
    }

    // Check month (0-indexed in Date, 1-indexed in cron)
    if (!this.matchesField(date.getMonth() + 1, _month, 1, 12)) {
      return false;
    }

    // Check day of week (0=Sunday in Date, 0=Sunday in cron)
    if (!this.matchesField(date.getDay(), dayOfWeek, 0, 6)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a value matches a cron field
   * 
   * @param value - Value to check
   * @param field - Cron field pattern
   * @param min - Minimum valid value
   * @param max - Maximum valid value
   * @returns True if value matches the field pattern
   */
  private matchesField(value: number, field: string, _min: number, _max: number): boolean {
    // Wildcard matches everything
    if (field === '*') {
      return true;
    }

    // Step values (e.g., */15)
    if (field.includes('*/')) {
      const step = parseInt(field.split('*/')[1], 10);
      return value % step === 0;
    }

    // Range (e.g., 1-5)
    if (field.includes('-')) {
      const [rangeMin, rangeMax] = field.split('-').map(v => parseInt(v, 10));
      return value >= rangeMin && value <= rangeMax;
    }

    // List (e.g., 1,3,5)
    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v.trim(), 10));
      return values.includes(value);
    }

    // Specific value
    const fieldValue = parseInt(field, 10);
    return value === fieldValue;
  }
}
