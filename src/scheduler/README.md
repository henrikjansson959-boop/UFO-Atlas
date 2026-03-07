# Scan Scheduler

The Scan Scheduler automates content discovery by executing scans at configurable intervals using node-cron.

## Features

- **Scheduled Execution**: Run scans at configurable intervals using cron expressions
- **Concurrency Control**: Prevents overlapping scans for the same keyword
- **Timeout Enforcement**: Automatically terminates scans that exceed 30 minutes
- **Timestamp Tracking**: Updates last_scan_at in Keyword_Config when scans start

## Usage

```typescript
import { ScanScheduler } from './scheduler';
import { ContentScanner } from './scanner';
import { StorageService } from './storage';

// Initialize dependencies
const storageService = new StorageService(supabaseUrl, supabaseKey);
const contentScanner = new ContentScanner(storageService);

// Create scheduler
const scheduler = new ScanScheduler(contentScanner, storageService);

// Schedule scans to run every hour
scheduler.scheduleScans('hourly-scan', {
  cronExpression: '0 * * * *', // Every hour
  tagIds: [], // Empty = all tags
  enabled: true,
});

// Schedule scans for specific tags every day at midnight
scheduler.scheduleScans('daily-ufo-scan', {
  cronExpression: '0 0 * * *', // Every day at midnight
  tagIds: [1, 2, 3], // Specific tag IDs
  enabled: true,
});

// Stop a specific schedule
scheduler.stopSchedule('hourly-scan');

// Stop all schedules
scheduler.stopAllSchedules();

// Check active scans
const activeScans = scheduler.getActiveScans();
console.log('Currently scanning:', activeScans);

// Check if a keyword is being scanned
const isActive = scheduler.isScanActive('UFO');
console.log('UFO scan active:', isActive);
```

## Cron Expression Examples

- `'0 * * * *'` - Every hour
- `'0 0 * * *'` - Every day at midnight
- `'*/30 * * * *'` - Every 30 minutes
- `'0 */6 * * *'` - Every 6 hours
- `'0 0 * * 0'` - Every Sunday at midnight
- `'0 9 * * 1-5'` - Every weekday at 9 AM

## Requirements Validated

- **8.8**: Execute Scan_Jobs at configurable intervals for automatic discovery
- **8.9**: Prevent overlapping Scan_Jobs for the same keyword
- **8.10**: Update last_scan_at in Keyword_Config when Scan_Job starts
- **8.11**: Terminate Scan_Job if it exceeds 30 minutes and log timeout error

## Architecture

The ScanScheduler:
1. Uses node-cron to schedule periodic scans
2. Retrieves active keywords from StorageService
3. Executes scans through ContentScanner
4. Tracks active scans in memory to prevent overlaps
5. Sets 30-minute timeouts for each keyword scan
6. Updates keyword timestamps before starting scans
7. Logs all scan activities and errors

## Error Handling

- Network errors during scans are logged but don't stop the scheduler
- Failed timestamp updates are logged but don't prevent scans
- Timeout errors are logged with scan duration details
- Each keyword scan is independent - one failure doesn't affect others
