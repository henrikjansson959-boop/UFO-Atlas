# ErrorLogger Integration Guide

This document shows how to integrate the ErrorLogger class with all components in the Automated Data Collection system.

## Overview

The ErrorLogger provides centralized error logging to the Error_Logs table in Supabase. It supports:
- General error logging with component name, message, and stack trace
- Network error logging with URL and status code
- Scan execution logging with metrics
- Database operation logging with execution time

## Setup

```typescript
import { ErrorLogger } from '../logger';

// Initialize ErrorLogger with Supabase credentials
const errorLogger = new ErrorLogger(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);
```

## Integration Examples

### 1. Scanner Integration

```typescript
import { ErrorLogger } from '../logger';
import { ContentScanner } from './ContentScanner';

export class ContentScannerWithLogging extends ContentScanner {
  private errorLogger: ErrorLogger;

  constructor(storageService: StorageService, errorLogger: ErrorLogger) {
    super(storageService);
    this.errorLogger = errorLogger;
  }

  async executeScan(
    keywords: string[],
    tagIds: number[],
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<ScanResult> {
    const scanJobId = this.generateScanJobId();
    const startTime = new Date();

    try {
      const result = await super.executeScan(keywords, tagIds, savedSearchId, savedSearchVersion);
      
      // Log successful scan execution
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

  // Override searchInternet to log network errors
  private async searchInternet(keyword: string, tagNames: string[]): Promise<string[]> {
    try {
      // ... search implementation
      return urls;
    } catch (error) {
      // Log network error
      await this.errorLogger.logNetworkError(
        'Scanner',
        searchUrl,
        statusCode,
        (error as Error).message,
        scanJobId
      );
      throw error;
    }
  }
}
```

### 2. Extractor Integration

```typescript
import { ErrorLogger } from '../logger';
import { ContentExtractor } from '../types';

export class ContentExtractorWithLogging implements ContentExtractor {
  private errorLogger: ErrorLogger;

  constructor(errorLogger: ErrorLogger) {
    this.errorLogger = errorLogger;
  }

  async extract(url: string): Promise<ExtractedContent | null> {
    try {
      // ... extraction logic
      return extractedContent;
    } catch (error) {
      // Log extraction failure
      await this.errorLogger.log(
        'Extractor',
        `Failed to extract content from ${url}: ${(error as Error).message}`,
        (error as Error).stack
      );
      return null;
    }
  }
}
```

### 3. Storage Integration

```typescript
import { ErrorLogger } from '../logger';
import { StorageService } from './StorageService';

export class StorageServiceWithLogging extends StorageService {
  private errorLogger: ErrorLogger;

  constructor(supabaseUrl: string, supabaseKey: string, errorLogger: ErrorLogger) {
    super(supabaseUrl, supabaseKey);
    this.errorLogger = errorLogger;
  }

  async insertReviewQueue(
    content: ExtractedContent,
    isPotentialDuplicate: boolean
  ): Promise<number> {
    const startTime = Date.now();

    try {
      const contentId = await super.insertReviewQueue(content, isPotentialDuplicate);
      
      // Log successful database operation
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
```

### 4. Scheduler Integration

```typescript
import { ErrorLogger } from '../logger';

export class ScanScheduler {
  private errorLogger: ErrorLogger;
  private scanner: ContentScanner;

  constructor(scanner: ContentScanner, errorLogger: ErrorLogger) {
    this.scanner = scanner;
    this.errorLogger = errorLogger;
  }

  async scheduleScan(interval: number): Promise<void> {
    setInterval(async () => {
      const scanJobId = `scheduled-${Date.now()}`;
      const startTime = new Date();

      try {
        const keywords = await this.scanner.getActiveKeywords();
        const result = await this.scanner.executeScan(keywords, []);

        // Log successful scheduled scan
        const endTime = new Date();
        await this.errorLogger.logScanExecution(
          scanJobId,
          startTime,
          endTime,
          result.discoveredUrls.length,
          'Scheduler'
        );
      } catch (error) {
        // Log scheduler error
        await this.errorLogger.logError('Scheduler', error as Error, scanJobId);
      }
    }, interval);
  }
}
```

## Usage in Main Application

```typescript
import { ErrorLogger } from './logger';
import { StorageService } from './storage';
import { ContentScanner } from './scanner';
import { ContentExtractor } from './extractor';

// Initialize ErrorLogger
const errorLogger = new ErrorLogger(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Initialize other components with ErrorLogger
const storageService = new StorageService(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const scanner = new ContentScanner(storageService);
const extractor = new ContentExtractor();

// Use ErrorLogger in error handling
try {
  const result = await scanner.executeScan(['UFO', 'Roswell'], [1, 2]);
} catch (error) {
  await errorLogger.logError('Main', error as Error);
}
```

## Retrieving Error Logs

```typescript
// Get recent error logs
const recentLogs = await errorLogger.getRecentLogs(50);

// Get logs for a specific component
const scannerLogs = await errorLogger.getLogsByComponent('Scanner', 100);

// Get logs for a specific scan job
const scanLogs = await errorLogger.getLogsByScanJob('scan-123456');
```

## Best Practices

1. **Always log errors**: Catch and log all errors, even if you're rethrowing them
2. **Include context**: Use the scanJobId parameter when available to link errors to specific scans
3. **Use appropriate methods**: Use `logNetworkError` for network issues, `logDatabaseOperation` for DB operations, etc.
4. **Don't block on logging**: ErrorLogger methods are async but include fallback console logging if database writes fail
5. **Log metrics**: Use `logScanExecution` and `logDatabaseOperation` to track performance
6. **Component naming**: Use consistent component names across your application (e.g., 'Scanner', 'Extractor', 'Storage', 'Scheduler')

## Error Log Schema

The Error_Logs table has the following structure:

```sql
CREATE TABLE Error_Logs (
  log_id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  component VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  scan_job_id VARCHAR(100)
);
```

All fields are automatically populated by the ErrorLogger methods.
