import { CronValidator, CronValidationResult } from './cronValidator';

describe('CronValidator', () => {
  let validator: CronValidator;

  beforeEach(() => {
    validator = new CronValidator();
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const validExpressions = [
        '0 * * * *',      // Every hour
        '*/15 * * * *',   // Every 15 minutes
        '0 0 * * *',      // Daily at midnight
        '0 */2 * * *',    // Every 2 hours
        '30 9 * * 1',     // Every Monday at 9:30
      ];

      validExpressions.forEach(expr => {
        const result = validator.validateCronExpression(expr);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.nextRun).toBeDefined();
        expect(result.intervalMinutes).toBeDefined();
      });
    });

    it('should reject invalid cron syntax', () => {
      const invalidExpressions = [
        'invalid',
        '* * * *',        // Too few fields
        '* * * * * *',    // Too many fields
        '60 * * * *',     // Invalid minute
        '* 25 * * *',     // Invalid hour
      ];

      invalidExpressions.forEach(expr => {
        const result = validator.validateCronExpression(expr);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Invalid cron expression');
      });
    });

    it('should reject empty or null expressions', () => {
      const result1 = validator.validateCronExpression('');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('cannot be empty');

      const result2 = validator.validateCronExpression('   ');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('cannot be empty');
    });

    it('should reject expressions with interval less than 15 minutes', () => {
      const tooFrequentExpressions = [
        '* * * * *',      // Every minute
        '*/5 * * * *',    // Every 5 minutes
        '*/10 * * * *',   // Every 10 minutes
        '0,5,10 * * * *', // At 0, 5, 10 minutes
      ];

      tooFrequentExpressions.forEach(expr => {
        const result = validator.validateCronExpression(expr);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('15 minutes');
        expect(result.intervalMinutes).toBeLessThan(15);
      });
    });

    it('should accept expressions with interval of exactly 15 minutes', () => {
      const result = validator.validateCronExpression('*/15 * * * *');
      expect(result.isValid).toBe(true);
      expect(result.intervalMinutes).toBe(15);
    });

    it('should accept expressions with interval greater than 15 minutes', () => {
      const validExpressions = [
        { expr: '*/20 * * * *', expectedInterval: 20 },
        { expr: '*/30 * * * *', expectedInterval: 30 },
        { expr: '0 * * * *', expectedInterval: 60 },
        { expr: '0 */2 * * *', expectedInterval: 120 },
      ];

      validExpressions.forEach(({ expr, expectedInterval }) => {
        const result = validator.validateCronExpression(expr);
        expect(result.isValid).toBe(true);
        expect(result.intervalMinutes).toBe(expectedInterval);
      });
    });
  });

  describe('calculateMinimumInterval', () => {
    it('should calculate interval for step patterns', () => {
      expect(validator.calculateMinimumInterval('*/15 * * * *')).toBe(15);
      expect(validator.calculateMinimumInterval('*/30 * * * *')).toBe(30);
      expect(validator.calculateMinimumInterval('* * * * *')).toBe(1);
    });

    it('should calculate interval for hourly patterns', () => {
      expect(validator.calculateMinimumInterval('0 * * * *')).toBe(60);
      expect(validator.calculateMinimumInterval('30 * * * *')).toBe(60);
      expect(validator.calculateMinimumInterval('0 */2 * * *')).toBe(120);
      expect(validator.calculateMinimumInterval('0 */3 * * *')).toBe(180);
    });

    it('should calculate interval for daily patterns', () => {
      expect(validator.calculateMinimumInterval('0 0 * * *')).toBe(24 * 60);
      expect(validator.calculateMinimumInterval('30 9 * * *')).toBe(24 * 60);
    });

    it('should calculate interval for comma-separated minutes', () => {
      expect(validator.calculateMinimumInterval('0,15,30,45 * * * *')).toBe(15);
      expect(validator.calculateMinimumInterval('0,30 * * * *')).toBe(30);
      expect(validator.calculateMinimumInterval('0,10,20 * * * *')).toBe(10);
    });

    it('should calculate interval for comma-separated hours', () => {
      expect(validator.calculateMinimumInterval('0 0,6,12,18 * * *')).toBe(6 * 60);
      expect(validator.calculateMinimumInterval('0 0,12 * * *')).toBe(12 * 60);
    });

    it('should handle wrap-around for comma-separated values', () => {
      // Minutes: 0, 45 -> wraps to 15 minutes (45 to 0 next hour)
      expect(validator.calculateMinimumInterval('0,45 * * * *')).toBe(15);
      
      // Hours: 0, 23 -> wraps to 1 hour (23 to 0 next day)
      expect(validator.calculateMinimumInterval('0 0,23 * * *')).toBe(60);
    });
  });

  describe('meetsMinimumInterval', () => {
    it('should return true for intervals >= 15 minutes', () => {
      expect(validator.meetsMinimumInterval('*/15 * * * *')).toBe(true);
      expect(validator.meetsMinimumInterval('*/20 * * * *')).toBe(true);
      expect(validator.meetsMinimumInterval('0 * * * *')).toBe(true);
      expect(validator.meetsMinimumInterval('0 0 * * *')).toBe(true);
    });

    it('should return false for intervals < 15 minutes', () => {
      expect(validator.meetsMinimumInterval('* * * * *')).toBe(false);
      expect(validator.meetsMinimumInterval('*/5 * * * *')).toBe(false);
      expect(validator.meetsMinimumInterval('*/10 * * * *')).toBe(false);
      expect(validator.meetsMinimumInterval('0,5,10 * * * *')).toBe(false);
    });
  });

  describe('calculateNextRun', () => {
    it('should calculate next run for hourly pattern', () => {
      const now = new Date('2024-01-15T10:30:00Z');
      const nextRun = validator.calculateNextRun('0 * * * *', now);
      
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getHours()).toBe(11);
      expect(nextRun.getDate()).toBe(15);
    });

    it('should calculate next run for every 15 minutes', () => {
      const now = new Date('2024-01-15T10:05:00Z');
      const nextRun = validator.calculateNextRun('*/15 * * * *', now);
      
      expect(nextRun.getMinutes()).toBe(15);
      expect(nextRun.getHours()).toBe(10);
    });

    it('should calculate next run for daily pattern', () => {
      const now = new Date('2024-01-15T10:30:00Z');
      const nextRun = validator.calculateNextRun('0 9 * * *', now);
      
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getDate()).toBe(16); // Next day
    });

    it('should calculate next run for specific minute and hour', () => {
      const now = new Date('2024-01-15T08:00:00Z');
      const nextRun = validator.calculateNextRun('30 9 * * *', now);
      
      expect(nextRun.getMinutes()).toBe(30);
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getDate()).toBe(15); // Same day
    });

    it('should use current time as default', () => {
      const before = new Date();
      const nextRun = validator.calculateNextRun('0 * * * *');
      const after = new Date();
      
      expect(nextRun.getTime()).toBeGreaterThan(before.getTime());
      expect(nextRun.getTime()).toBeLessThan(after.getTime() + 2 * 60 * 60 * 1000); // Within 2 hours
    });
  });

  describe('edge cases', () => {
    it('should handle expressions with multiple comma-separated values', () => {
      const result = validator.validateCronExpression('0,15,30,45 * * * *');
      expect(result.isValid).toBe(true);
      expect(result.intervalMinutes).toBe(15);
    });

    it('should handle complex hourly patterns', () => {
      const result = validator.validateCronExpression('0 0,6,12,18 * * *');
      expect(result.isValid).toBe(true);
      expect(result.intervalMinutes).toBe(6 * 60);
    });

    it('should handle weekly patterns', () => {
      const result = validator.validateCronExpression('0 9 * * 1');
      expect(result.isValid).toBe(true);
      expect(result.intervalMinutes).toBeGreaterThanOrEqual(15);
    });

    it('should handle monthly patterns', () => {
      const result = validator.validateCronExpression('0 0 1 * *');
      expect(result.isValid).toBe(true);
      expect(result.intervalMinutes).toBeGreaterThanOrEqual(15);
    });
  });
});
