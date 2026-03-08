/**
 * Example usage of ScanScheduler
 * 
 * This file demonstrates how to use the ScanScheduler class
 * to automate content discovery scans.
 */

import { ScanScheduler } from './ScanScheduler';
import { ContentScanner } from '../scanner';
import { StorageService } from '../storage';

/**
 * Example: Setting up automated scans
 */
async function setupAutomatedScans() {
  // Initialize dependencies
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || '';
  
  const storageService = new StorageService(supabaseUrl, supabaseKey);
  const contentScanner = new ContentScanner(storageService);
  
  // Optional: Set up content extractor for processing discovered URLs
  // const contentExtractor = new ContentExtractor();
  // contentScanner.setContentExtractor(contentExtractor);
  
  // Create scheduler
  const scheduler = new ScanScheduler(contentScanner, storageService);
  
  // Start scheduled search monitoring (checks for due saved searches every minute)
  scheduler.startScheduledSearchMonitoring();
  
  // Example 1: Schedule hourly scans for all tags
  scheduler.scheduleScans('hourly-all-tags', {
    cronExpression: '0 * * * *', // Every hour at minute 0
    tagIds: [], // Empty = search all tags
    enabled: true,
  });
  
  // Example 2: Schedule daily scans for specific UFO-related tags
  scheduler.scheduleScans('daily-ufo-scan', {
    cronExpression: '0 0 * * *', // Every day at midnight
    tagIds: [1, 2, 3], // Specific tag IDs (e.g., UFO, Roswell, Area51)
    enabled: true,
  });
  
  // Example 3: Schedule scans every 6 hours for people-related content
  scheduler.scheduleScans('six-hour-people-scan', {
    cronExpression: '0 */6 * * *', // Every 6 hours
    tagIds: [10, 11, 12], // People tag IDs (e.g., Jesse Marcel, Ross Coulthart)
    enabled: true,
  });
  
  // Example 4: Schedule weekly scans on Sundays
  scheduler.scheduleScans('weekly-sunday-scan', {
    cronExpression: '0 0 * * 0', // Every Sunday at midnight
    tagIds: [],
    enabled: true,
  });
  
  console.log('Scheduled scans:', scheduler.getScheduleIds());
  
  // Monitor active scans
  setInterval(() => {
    const activeScans = scheduler.getActiveScans();
    if (activeScans.length > 0) {
      console.log('Currently scanning keywords:', activeScans);
    }
  }, 60000); // Check every minute
  
  return scheduler;
}

/**
 * Example: Managing schedules dynamically
 */
async function manageSchedules(scheduler: ScanScheduler) {
  // Stop a specific schedule
  scheduler.stopSchedule('hourly-all-tags');
  console.log('Stopped hourly-all-tags schedule');
  
  // Update a schedule (stop and recreate with new config)
  scheduler.scheduleScans('daily-ufo-scan', {
    cronExpression: '0 2 * * *', // Change to 2 AM instead of midnight
    tagIds: [1, 2, 3, 4], // Add more tags
    enabled: true,
  });
  console.log('Updated daily-ufo-scan schedule');
  
  // Temporarily disable a schedule
  scheduler.scheduleScans('weekly-sunday-scan', {
    cronExpression: '0 0 * * 0',
    tagIds: [],
    enabled: false, // Disabled
  });
  console.log('Disabled weekly-sunday-scan schedule');
  
  // Check if a keyword is currently being scanned
  const isUfoScanning = scheduler.isScanActive('UFO');
  console.log('Is UFO currently being scanned?', isUfoScanning);
}

/**
 * Example: Graceful shutdown
 */
async function shutdown(scheduler: ScanScheduler) {
  console.log('Shutting down scheduler...');
  
  // Stop scheduled search monitoring
  scheduler.stopScheduledSearchMonitoring();
  
  // Stop all scheduled scans
  scheduler.stopAllSchedules();
  
  // Wait for active scans to complete (or timeout)
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  
  while (scheduler.getActiveScans().length > 0) {
    if (Date.now() - startTime > maxWaitTime) {
      console.log('Timeout waiting for scans to complete');
      break;
    }
    
    console.log('Waiting for active scans to complete:', scheduler.getActiveScans());
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }
  
  console.log('Scheduler shutdown complete');
}

/**
 * Main execution
 */
async function main() {
  try {
    // Set up automated scans
    const scheduler = await setupAutomatedScans();
    
    // Example: Manage schedules after 1 hour
    setTimeout(() => {
      manageSchedules(scheduler);
    }, 60 * 60 * 1000); // 1 hour
    
    // Handle graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await shutdown(scheduler);
      process.exit(0);
    });
    
    console.log('ScanScheduler is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Error setting up scheduler:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { setupAutomatedScans, manageSchedules, shutdown };
