import { Router, Request, Response, NextFunction } from 'express';
import { StorageService } from '../storage/StorageService';
import { CronValidator } from '../scheduler/cronValidator';

/**
 * Schedule API Routes
 * Provides endpoints for managing saved search schedules
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

// Error handling wrapper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create schedule routes router
 * @param storageService - Storage service instance for database operations
 * @param cronValidator - Cron validator instance for validation
 * @returns Express router with schedule endpoints
 */
export function createScheduleRoutes(
  storageService: StorageService,
  cronValidator: CronValidator
): Router {
  const router = Router();

  /**
   * POST /api/saved-searches/:id/schedule
   * Create or update schedule for a saved search
   * Validates: Requirements 8.1, 8.2, 8.5
   */
  router.post('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
    const savedSearchId = parseInt(req.params.id, 10);
    const { scheduleEnabled, cronExpression } = req.body;

    // Validate saved search ID
    if (isNaN(savedSearchId)) {
      return res.status(400).json({ error: 'Invalid saved search ID' });
    }

    // Validate required fields
    if (typeof scheduleEnabled !== 'boolean') {
      return res.status(400).json({ error: 'scheduleEnabled must be a boolean' });
    }

    // If enabling schedule, validate cron expression
    if (scheduleEnabled) {
      if (!cronExpression || typeof cronExpression !== 'string') {
        return res.status(400).json({ error: 'cronExpression is required when enabling schedule' });
      }

      // Validate cron expression and minimum interval
      const validationResult = cronValidator.validateCronExpression(cronExpression);
      if (!validationResult.isValid) {
        return res.status(400).json({ 
          error: validationResult.error || 'Invalid cron expression'
        });
      }

      // Calculate next run time
      const nextRunAt = cronValidator.calculateNextRun(cronExpression);

      // Update schedule in database
      await storageService.updateSavedSearchSchedule(
        savedSearchId,
        scheduleEnabled,
        cronExpression,
        nextRunAt
      );

      // Return updated saved search with schedule
      const updatedSearch = await storageService.getSavedSearchWithSchedule(savedSearchId);
      return res.json(updatedSearch);
    } else {
      // Disabling schedule - preserve cron expression but clear next_run_at
      await storageService.updateSavedSearchSchedule(
        savedSearchId,
        scheduleEnabled,
        cronExpression || null,
        null
      );

      // Return updated saved search with schedule
      const updatedSearch = await storageService.getSavedSearchWithSchedule(savedSearchId);
      return res.json(updatedSearch);
    }
  }));

  /**
   * GET /api/saved-searches/:id/schedule
   * Get schedule configuration for a saved search
   * Validates: Requirements 8.3
   */
  router.get('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
    const savedSearchId = parseInt(req.params.id, 10);

    // Validate saved search ID
    if (isNaN(savedSearchId)) {
      return res.status(400).json({ error: 'Invalid saved search ID' });
    }

    try {
      // Get saved search with schedule
      const savedSearch = await storageService.getSavedSearchWithSchedule(savedSearchId);

      // Return schedule configuration
      return res.json({
        scheduleEnabled: savedSearch.scheduleEnabled,
        cronExpression: savedSearch.cronExpression,
        nextRunAt: savedSearch.nextRunAt,
        lastRunAt: savedSearch.lastRunAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: 'Saved search not found' });
      }
      throw error;
    }
  }));

  /**
   * DELETE /api/saved-searches/:id/schedule
   * Delete schedule configuration
   * Validates: Requirements 8.4
   */
  router.delete('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
    const savedSearchId = parseInt(req.params.id, 10);

    // Validate saved search ID
    if (isNaN(savedSearchId)) {
      return res.status(400).json({ error: 'Invalid saved search ID' });
    }

    // Clear all schedule fields
    await storageService.updateSavedSearchSchedule(
      savedSearchId,
      false,
      null,
      null
    );

    return res.json({ success: true, message: 'Schedule deleted successfully' });
  }));

  /**
   * PATCH /api/saved-searches/:id/schedule/toggle
   * Enable or disable schedule
   * Validates: Requirements 8.4
   */
  router.patch('/:id/schedule/toggle', asyncHandler(async (req: Request, res: Response) => {
    const savedSearchId = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    // Validate saved search ID
    if (isNaN(savedSearchId)) {
      return res.status(400).json({ error: 'Invalid saved search ID' });
    }

    // Validate enabled field
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Get current schedule configuration
    const savedSearch = await storageService.getSavedSearchWithSchedule(savedSearchId);

    if (enabled) {
      // Enabling schedule - need valid cron expression
      if (!savedSearch.cronExpression) {
        return res.status(400).json({ 
          error: 'Cannot enable schedule without a cron expression. Use POST /schedule to set one.' 
        });
      }

      // Calculate next run time
      const nextRunAt = cronValidator.calculateNextRun(savedSearch.cronExpression);

      // Update schedule
      await storageService.updateSavedSearchSchedule(
        savedSearchId,
        true,
        savedSearch.cronExpression,
        nextRunAt
      );
    } else {
      // Disabling schedule - preserve cron expression
      await storageService.updateSavedSearchSchedule(
        savedSearchId,
        false,
        savedSearch.cronExpression,
        null
      );
    }

    // Return updated schedule configuration
    const updatedSearch = await storageService.getSavedSearchWithSchedule(savedSearchId);
    return res.json({
      scheduleEnabled: updatedSearch.scheduleEnabled,
      cronExpression: updatedSearch.cronExpression,
      nextRunAt: updatedSearch.nextRunAt,
      lastRunAt: updatedSearch.lastRunAt,
    });
  }));

  return router;
}
