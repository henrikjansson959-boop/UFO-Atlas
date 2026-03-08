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
 * CronValidator utility class for frontend
 * Validates cron expressions and enforces minimum interval requirements
 * Client-side version that doesn't depend on node-cron
 */
export class CronValidator {
  private static readonly MINIMUM_INTERVAL_MINUTES = 15;

  /**
   * Validate cron expression syntax and check minimum interval
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

    // Validate cron syntax
    const syntaxValidation = this.validateSyntax(cronExpression);
    if (!syntaxValidation.isValid) {
      return syntaxValidation;
    }

    // Calculate minimum interval
    const intervalMinutes = this.calculateMinimumInterval(cronExpression);

    // Check if interval meets minimum requirement
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
   * Validate cron expression syntax
   */
  private validateSyntax(cronExpression: string): CronValidationResult {
    const parts = cronExpression.trim().split(/\s+/);

    // Check field count
    if (parts.length < 5) {
      return {
        isValid: false,
        error: this.getInvalidSyntaxError(cronExpression, 'too_few'),
      };
    }

    if (parts.length > 5) {
      return {
        isValid: false,
        error: this.getInvalidSyntaxError(cronExpression, 'too_many'),
      };
    }

    // Validate each field
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (!this.isValidCronField(minute, 0, 59) ||
        !this.isValidCronField(hour, 0, 23) ||
        !this.isValidCronField(dayOfMonth, 1, 31) ||
        !this.isValidCronField(month, 1, 12) ||
        !this.isValidCronField(dayOfWeek, 0, 6)) {
      return {
        isValid: false,
        error: this.getInvalidSyntaxError(cronExpression, 'invalid_field'),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate a single cron field
   */
  private isValidCronField(field: string, min: number, max: number): boolean {
    // Wildcard
    if (field === '*') return true;

    // Step values (*/n)
    if (field.includes('*/')) {
      const step = parseInt(field.split('*/')[1], 10);
      return !isNaN(step) && step > 0;
    }

    // Range (a-b)
    if (field.includes('-')) {
      const [rangeMin, rangeMax] = field.split('-').map(v => parseInt(v, 10));
      return !isNaN(rangeMin) && !isNaN(rangeMax) &&
             rangeMin >= min && rangeMax <= max && rangeMin <= rangeMax;
    }

    // List (a,b,c)
    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v.trim(), 10));
      return values.every(v => !isNaN(v) && v >= min && v <= max);
    }

    // Specific value
    const value = parseInt(field, 10);
    return !isNaN(value) && value >= min && value <= max;
  }

  /**
   * Calculate next execution time from cron expression
   * 
   * @param cronExpression - Valid cron expression
   * @param fromDate - Calculate from this date (default: now)
   * @returns Next execution timestamp
   */
  calculateNextRun(cronExpression: string, fromDate: Date = new Date()): Date {
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
      const interval = parseInt(minute.split('*/')[1], 10);
      return isNaN(interval) ? 0 : interval;
    }

    if (minute.includes(',')) {
      const minutes = minute.split(',').map(m => parseInt(m.trim(), 10));
      if (minutes.length > 1) {
        const sortedMinutes = minutes.sort((a, b) => a - b);
        let minDiff = 60;
        for (let i = 1; i < sortedMinutes.length; i++) {
          const diff = sortedMinutes[i] - sortedMinutes[i - 1];
          minDiff = Math.min(minDiff, diff);
        }
        const wrapDiff = 60 - sortedMinutes[sortedMinutes.length - 1] + sortedMinutes[0];
        minDiff = Math.min(minDiff, wrapDiff);
        return minDiff;
      }
    }

    if (minute.includes('-') || minute === '*') {
      return 1;
    }

    // Check hour field
    if (hour.includes('*/')) {
      const interval = parseInt(hour.split('*/')[1], 10);
      return isNaN(interval) ? 60 : interval * 60;
    }

    if (hour === '*') {
      return 60;
    }

    if (hour.includes(',')) {
      const hours = hour.split(',').map(h => parseInt(h.trim(), 10));
      if (hours.length > 1) {
        const sortedHours = hours.sort((a, b) => a - b);
        let minDiff = 24;
        for (let i = 1; i < sortedHours.length; i++) {
          const diff = sortedHours[i] - sortedHours[i - 1];
          minDiff = Math.min(minDiff, diff);
        }
        const wrapDiff = 24 - sortedHours[sortedHours.length - 1] + sortedHours[0];
        minDiff = Math.min(minDiff, wrapDiff);
        return minDiff * 60;
      }
    }

    // Check day fields
    if (dayOfMonth === '*' && dayOfWeek === '*') {
      return 24 * 60;
    }

    return 24 * 60;
  }

  /**
   * Check if cron expression meets 15-minute minimum interval
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
   */
  private matchesCronExpression(
    date: Date,
    minute: string,
    hour: string,
    dayOfMonth: string,
    month: string,
    dayOfWeek: string
  ): boolean {
    if (!this.matchesField(date.getMinutes(), minute, 0, 59)) {
      return false;
    }

    if (!this.matchesField(date.getHours(), hour, 0, 23)) {
      return false;
    }

    if (!this.matchesField(date.getDate(), dayOfMonth, 1, 31)) {
      return false;
    }

    if (!this.matchesField(date.getMonth() + 1, month, 1, 12)) {
      return false;
    }

    if (!this.matchesField(date.getDay(), dayOfWeek, 0, 6)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a value matches a cron field
   */
  private matchesField(value: number, field: string, _min: number, _max: number): boolean {
    if (field === '*') {
      return true;
    }

    if (field.includes('*/')) {
      const step = parseInt(field.split('*/')[1], 10);
      return value % step === 0;
    }

    if (field.includes('-')) {
      const [rangeMin, rangeMax] = field.split('-').map(v => parseInt(v, 10));
      return value >= rangeMin && value <= rangeMax;
    }

    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v.trim(), 10));
      return values.includes(value);
    }

    const fieldValue = parseInt(field, 10);
    return value === fieldValue;
  }

  /**
   * Generate error messages
   */
  private getEmptyExpressionError(): string {
    return 'Cron expression cannot be empty. Please enter a valid cron expression.\n\n' +
      'Examples:\n' +
      '  • "*/15 * * * *" - Every 15 minutes\n' +
      '  • "0 * * * *" - Every hour\n' +
      '  • "0 9 * * *" - Daily at 9:00 AM\n' +
      '  • "0 9 * * 1" - Every Monday at 9:00 AM';
  }

  private getInvalidSyntaxError(_cronExpression: string, errorType: string): string {
    if (errorType === 'too_few') {
      return 'Invalid cron expression: Too few fields. Cron expressions require exactly 5 fields.\n\n' +
        'Format: "minute hour day month weekday"\n\n' +
        'Examples:\n' +
        '  • "*/15 * * * *" - Every 15 minutes\n' +
        '  • "0 */2 * * *" - Every 2 hours\n' +
        '  • "30 14 * * 1" - Every Monday at 2:30 PM';
    }
    
    if (errorType === 'too_many') {
      return 'Invalid cron expression: Too many fields. Cron expressions require exactly 5 fields.\n\n' +
        'Format: "minute hour day month weekday"\n\n' +
        'Note: Seconds are not supported. Use minute as the smallest unit.\n\n' +
        'Examples:\n' +
        '  • "*/15 * * * *" - Every 15 minutes\n' +
        '  • "0 9,12,15 * * *" - At 9 AM, 12 PM, and 3 PM';
    }

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

  private getMinimumIntervalError(cronExpression: string, intervalMinutes: number): string {
    let specificAdvice = '';

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
}
