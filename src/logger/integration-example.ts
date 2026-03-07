/**
 * Integration Example: Using ErrorLogger with Scanner, Extractor, and Storage
 * 
 * This file demonstrates how to integrate ErrorLogger with all components
 * in the Automated Data Collection system.
 */

import { ErrorLogger } from './ErrorLogger';
import { StorageService } from '../storage/StorageService';
import { ContentScanner } from '../scanner/ContentScanner';

/**
 * Example: Initialize ErrorLogger and integrate with components
 */
async function integrateErrorLogger() {
  // 1. Initialize ErrorLogger
  const errorLogger = new ErrorLogger(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_KEY || 'your-anon-key'
  );

  // 2. Initialize other components
  const storageService = new StorageService(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_KEY || 'your-anon-key'
  );

  const scanner = new ContentScanner(storageService);

  // 3. Use ErrorLogger in Scanner operations
  try {
    const scanJobId = `scan-${Date.now()}`;
    const startTime = new Date();

    // Execute scan
    const result = await scanner.executeScan(['UFO', 'Roswell'], [1, 2]);

    // Log successful scan execution
    const endTime = new Date();
    await errorLogger.logScanExecution(
      scanJobId,
      startTime,
      endTime,
      result.discoveredUrls.length,
      'Scanner'
    );

    console.log(`Scan completed: ${result.discoveredUrls.length} URLs discovered`);
  } catch (error) {
    // Log scan failure
    await errorLogger.logError('Scanner', error as Error);
    console.error('Scan failed:', error);
  }

  // 4. Use ErrorLogger in Storage operations
  try {
    const startTime = Date.now();

    // Example: Add a keyword
    await storageService.addKeyword('Area51');

    // Log successful database operation
    const executionTime = Date.now() - startTime;
    await errorLogger.logDatabaseOperation(
      'Storage',
      'INSERT',
      executionTime
    );

    console.log('Keyword added successfully');
  } catch (error) {
    // Log database error
    await errorLogger.logError('Storage', error as Error);
    console.error('Failed to add keyword:', error);
  }

  // 5. Retrieve and display error logs
  console.log('\n--- Recent Error Logs ---');
  const recentLogs = await errorLogger.getRecentLogs(10);
  recentLogs.forEach(log => {
    console.log(`[${log.timestamp}] ${log.component}: ${log.message}`);
  });

  // 6. Get logs for specific component
  console.log('\n--- Scanner Logs ---');
  const scannerLogs = await errorLogger.getLogsByComponent('Scanner', 5);
  scannerLogs.forEach(log => {
    console.log(`[${log.timestamp}] ${log.message}`);
  });
}

/**
 * Example: Extended Scanner with ErrorLogger integration
 */
class ScannerWithLogging extends ContentScanner {
  private errorLogger: ErrorLogger;

  constructor(storageService: any, errorLogger: ErrorLogger) {
    super(storageService);
    this.errorLogger = errorLogger;
  }

  /**
   * Override executeScan to add error logging
   */
  async executeScan(
    keywords: string[],
    tagIds: number[],
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<any> {
    const scanJobId = `scan-${Date.now()}`;
    const startTime = new Date();

    try {
      // Execute the scan
      const result = await super.executeScan(keywords, tagIds, savedSearchId, savedSearchVersion);

      // Log successful execution
      const endTime = new Date();
      await this.errorLogger.logScanExecution(
        scanJobId,
        startTime,
        endTime,
        result.discoveredUrls.length,
        'Scanner'
      );

      return result;
    } catch (error) {
      // Log scan failure
      await this.errorLogger.logError('Scanner', error as Error, scanJobId);
      throw error;
    }
  }
}

/**
 * Example: Extended Storage with ErrorLogger integration
 */
class StorageWithLogging extends StorageService {
  private errorLogger: ErrorLogger;

  constructor(supabaseUrl: string, supabaseKey: string, errorLogger: ErrorLogger) {
    super(supabaseUrl, supabaseKey);
    this.errorLogger = errorLogger;
  }

  /**
   * Override insertReviewQueue to add logging
   */
  async insertReviewQueue(content: any, isPotentialDuplicate: boolean): Promise<number> {
    const startTime = Date.now();

    try {
      const contentId = await super.insertReviewQueue(content, isPotentialDuplicate);

      // Log successful operation
      const executionTime = Date.now() - startTime;
      await this.errorLogger.logDatabaseOperation(
        'Storage',
        'INSERT',
        executionTime
      );

      return contentId;
    } catch (error) {
      // Log database error
      await this.errorLogger.logError('Storage', error as Error);
      throw error;
    }
  }
}

// Export examples
export {
  integrateErrorLogger,
  ScannerWithLogging,
  StorageWithLogging,
};

// Run example if executed directly
if (require.main === module) {
  integrateErrorLogger()
    .then(() => console.log('\nIntegration example completed'))
    .catch(error => console.error('\nIntegration example failed:', error));
}
