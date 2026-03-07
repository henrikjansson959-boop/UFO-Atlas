import { ErrorLogger } from './ErrorLogger';

/**
 * Example usage of ErrorLogger
 * This file demonstrates how to use the ErrorLogger class
 */

async function exampleUsage() {
  // Initialize ErrorLogger
  const errorLogger = new ErrorLogger(
    process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    process.env.SUPABASE_KEY || 'your-anon-key'
  );

  // Example 1: Log a simple error
  await errorLogger.log(
    'Scanner',
    'Failed to connect to search API',
    'Error: Connection timeout\n  at searchInternet (scanner.ts:123)',
    'scan-12345'
  );

  // Example 2: Log an Error object
  try {
    throw new Error('Something went wrong');
  } catch (error) {
    await errorLogger.logError('Extractor', error as Error, 'scan-12345');
  }

  // Example 3: Log a network error
  await errorLogger.logNetworkError(
    'Scanner',
    'https://api.example.com/search',
    404,
    'Resource not found',
    'scan-12345'
  );

  // Example 4: Log a scan execution
  const startTime = new Date();
  // ... perform scan ...
  const endTime = new Date();
  await errorLogger.logScanExecution(
    'scan-12345',
    startTime,
    endTime,
    42, // items discovered
    'Scanner'
  );

  // Example 5: Log a database operation
  await errorLogger.logDatabaseOperation(
    'Storage',
    'INSERT',
    125, // execution time in ms
    'scan-12345'
  );

  // Example 6: Retrieve recent logs
  const recentLogs = await errorLogger.getRecentLogs(10);
  console.log('Recent logs:', recentLogs);

  // Example 7: Get logs by component
  const scannerLogs = await errorLogger.getLogsByComponent('Scanner', 20);
  console.log('Scanner logs:', scannerLogs);

  // Example 8: Get logs by scan job
  const scanLogs = await errorLogger.getLogsByScanJob('scan-12345');
  console.log('Scan job logs:', scanLogs);
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage()
    .then(() => console.log('Example completed'))
    .catch(error => console.error('Example failed:', error));
}

export { exampleUsage };
