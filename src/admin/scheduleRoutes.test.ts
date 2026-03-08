import request from 'supertest';
import express, { Express } from 'express';
import { createScheduleRoutes } from './scheduleRoutes';
import { StorageService } from '../storage/StorageService';
import { CronValidator } from '../scheduler/cronValidator';
import { SavedSearchWithSchedule } from '../types';

/**
 * Unit tests for schedule API routes
 * Tests validation, error handling, and endpoint behavior
 */

describe('Schedule API Routes', () => {
  let app: Express;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockCronValidator: jest.Mocked<CronValidator>;

  beforeEach(() => {
    // Create mock storage service
    mockStorageService = {
      updateSavedSearchSchedule: jest.fn(),
      getSavedSearchWithSchedule: jest.fn(),
    } as any;

    // Create mock cron validator
    mockCronValidator = {
      validateCronExpression: jest.fn(),
      calculateNextRun: jest.fn(),
    } as any;

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/saved-searches', createScheduleRoutes(mockStorageService, mockCronValidator));
  });

  describe('POST /api/saved-searches/:id/schedule', () => {
    it('should create schedule with valid cron expression', async () => {
      const savedSearchId = 1;
      const cronExpression = '0 * * * *';
      const nextRunAt = new Date('2024-01-01T12:00:00Z');

      mockCronValidator.validateCronExpression.mockReturnValue({
        isValid: true,
        nextRun: nextRunAt,
        intervalMinutes: 60,
      });
      mockCronValidator.calculateNextRun.mockReturnValue(nextRunAt);

      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: true,
        cronExpression,
        nextRunAt,
        lastRunAt: null,
      };

      mockStorageService.getSavedSearchWithSchedule.mockResolvedValue(mockSavedSearch);

      const response = await request(app)
        .post(`/api/saved-searches/${savedSearchId}/schedule`)
        .send({ scheduleEnabled: true, cronExpression })
        .expect(200);

      expect(response.body.scheduleEnabled).toBe(true);
      expect(response.body.cronExpression).toBe(cronExpression);
      expect(mockStorageService.updateSavedSearchSchedule).toHaveBeenCalledWith(
        savedSearchId,
        true,
        cronExpression,
        nextRunAt
      );
    });

    it('should reject invalid cron expression', async () => {
      const savedSearchId = 1;
      const invalidCron = 'invalid';

      mockCronValidator.validateCronExpression.mockReturnValue({
        isValid: false,
        error: 'Invalid cron syntax',
      });

      const response = await request(app)
        .post(`/api/saved-searches/${savedSearchId}/schedule`)
        .send({ scheduleEnabled: true, cronExpression: invalidCron })
        .expect(400);

      expect(response.body.error).toContain('Invalid cron');
      expect(mockStorageService.updateSavedSearchSchedule).not.toHaveBeenCalled();
    });

    it('should reject cron expression with interval less than 15 minutes', async () => {
      const savedSearchId = 1;
      const shortIntervalCron = '*/5 * * * *';

      mockCronValidator.validateCronExpression.mockReturnValue({
        isValid: false,
        error: 'Minimum interval between executions must be at least 15 minutes',
      });

      const response = await request(app)
        .post(`/api/saved-searches/${savedSearchId}/schedule`)
        .send({ scheduleEnabled: true, cronExpression: shortIntervalCron })
        .expect(400);

      expect(response.body.error).toContain('15 minutes');
      expect(mockStorageService.updateSavedSearchSchedule).not.toHaveBeenCalled();
    });

    it('should disable schedule and preserve cron expression', async () => {
      const savedSearchId = 1;
      const cronExpression = '0 * * * *';

      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: false,
        cronExpression,
        nextRunAt: null,
        lastRunAt: null,
      };

      mockStorageService.getSavedSearchWithSchedule.mockResolvedValue(mockSavedSearch);

      const response = await request(app)
        .post(`/api/saved-searches/${savedSearchId}/schedule`)
        .send({ scheduleEnabled: false, cronExpression })
        .expect(200);

      expect(response.body.scheduleEnabled).toBe(false);
      expect(response.body.cronExpression).toBe(cronExpression);
      expect(mockStorageService.updateSavedSearchSchedule).toHaveBeenCalledWith(
        savedSearchId,
        false,
        cronExpression,
        null
      );
    });

    it('should return 400 for invalid saved search ID', async () => {
      await request(app)
        .post('/api/saved-searches/invalid/schedule')
        .send({ scheduleEnabled: true, cronExpression: '0 * * * *' })
        .expect(400);
    });

    it('should return 400 for missing scheduleEnabled', async () => {
      await request(app)
        .post('/api/saved-searches/1/schedule')
        .send({ cronExpression: '0 * * * *' })
        .expect(400);
    });

    it('should return 400 for missing cronExpression when enabling', async () => {
      await request(app)
        .post('/api/saved-searches/1/schedule')
        .send({ scheduleEnabled: true })
        .expect(400);
    });
  });

  describe('GET /api/saved-searches/:id/schedule', () => {
    it('should return schedule configuration', async () => {
      const savedSearchId = 1;
      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: true,
        cronExpression: '0 * * * *',
        nextRunAt: new Date('2024-01-01T12:00:00Z'),
        lastRunAt: new Date('2024-01-01T11:00:00Z'),
      };

      mockStorageService.getSavedSearchWithSchedule.mockResolvedValue(mockSavedSearch);

      const response = await request(app)
        .get(`/api/saved-searches/${savedSearchId}/schedule`)
        .expect(200);

      expect(response.body.scheduleEnabled).toBe(true);
      expect(response.body.cronExpression).toBe('0 * * * *');
      expect(response.body.nextRunAt).toBeDefined();
      expect(response.body.lastRunAt).toBeDefined();
    });

    it('should return 404 for non-existent saved search', async () => {
      mockStorageService.getSavedSearchWithSchedule.mockRejectedValue(
        new Error('Saved search not found')
      );

      await request(app)
        .get('/api/saved-searches/999/schedule')
        .expect(404);
    });

    it('should return 400 for invalid saved search ID', async () => {
      await request(app)
        .get('/api/saved-searches/invalid/schedule')
        .expect(400);
    });
  });

  describe('DELETE /api/saved-searches/:id/schedule', () => {
    it('should delete schedule configuration', async () => {
      const savedSearchId = 1;

      await request(app)
        .delete(`/api/saved-searches/${savedSearchId}/schedule`)
        .expect(200);

      expect(mockStorageService.updateSavedSearchSchedule).toHaveBeenCalledWith(
        savedSearchId,
        false,
        null,
        null
      );
    });

    it('should return 400 for invalid saved search ID', async () => {
      await request(app)
        .delete('/api/saved-searches/invalid/schedule')
        .expect(400);
    });
  });

  describe('PATCH /api/saved-searches/:id/schedule/toggle', () => {
    it('should enable schedule with existing cron expression', async () => {
      const savedSearchId = 1;
      const cronExpression = '0 * * * *';
      const nextRunAt = new Date('2024-01-01T12:00:00Z');

      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: false,
        cronExpression,
        nextRunAt: null,
        lastRunAt: null,
      };

      mockStorageService.getSavedSearchWithSchedule
        .mockResolvedValueOnce(mockSavedSearch)
        .mockResolvedValueOnce({ ...mockSavedSearch, scheduleEnabled: true, nextRunAt });

      mockCronValidator.calculateNextRun.mockReturnValue(nextRunAt);

      const response = await request(app)
        .patch(`/api/saved-searches/${savedSearchId}/schedule/toggle`)
        .send({ enabled: true })
        .expect(200);

      expect(response.body.scheduleEnabled).toBe(true);
      expect(mockStorageService.updateSavedSearchSchedule).toHaveBeenCalledWith(
        savedSearchId,
        true,
        cronExpression,
        nextRunAt
      );
    });

    it('should disable schedule and preserve cron expression', async () => {
      const savedSearchId = 1;
      const cronExpression = '0 * * * *';

      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: true,
        cronExpression,
        nextRunAt: new Date('2024-01-01T12:00:00Z'),
        lastRunAt: null,
      };

      mockStorageService.getSavedSearchWithSchedule
        .mockResolvedValueOnce(mockSavedSearch)
        .mockResolvedValueOnce({ ...mockSavedSearch, scheduleEnabled: false, nextRunAt: null });

      const response = await request(app)
        .patch(`/api/saved-searches/${savedSearchId}/schedule/toggle`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.scheduleEnabled).toBe(false);
      expect(response.body.cronExpression).toBe(cronExpression);
      expect(mockStorageService.updateSavedSearchSchedule).toHaveBeenCalledWith(
        savedSearchId,
        false,
        cronExpression,
        null
      );
    });

    it('should return 400 when enabling without cron expression', async () => {
      const savedSearchId = 1;

      const mockSavedSearch: SavedSearchWithSchedule = {
        savedSearchId,
        searchName: 'Test Search',
        version: 1,
        keywordsUsed: ['test'],
        selectedTagIds: [1],
        createdAt: new Date(),
        createdBy: 'admin',
        parentSearchId: null,
        scheduleEnabled: false,
        cronExpression: null,
        nextRunAt: null,
        lastRunAt: null,
      };

      mockStorageService.getSavedSearchWithSchedule.mockResolvedValue(mockSavedSearch);

      const response = await request(app)
        .patch(`/api/saved-searches/${savedSearchId}/schedule/toggle`)
        .send({ enabled: true })
        .expect(400);

      expect(response.body.error).toContain('cron expression');
    });

    it('should return 400 for invalid saved search ID', async () => {
      await request(app)
        .patch('/api/saved-searches/invalid/schedule/toggle')
        .send({ enabled: true })
        .expect(400);
    });

    it('should return 400 for missing enabled field', async () => {
      await request(app)
        .patch('/api/saved-searches/1/schedule/toggle')
        .send({})
        .expect(400);
    });
  });
});
