# ErrorLogger Module

Centralized error logging for the Automated Data Collection system.

## Overview

The ErrorLogger class provides a unified interface for logging errors, network issues, scan executions, and database operations to the Error_Logs table in Supabase. It ensures all components log errors consistently and makes troubleshooting easier.

## Features

- **Centralized logging**: All errors go to a single Error_Logs table
- **Component tracking**: Track which component generated each error
- **Scan job linking**: Associate errors with specific scan jobs
- **Network error logging**: Special handling for HTTP errors with URL and status code
- **Performance metrics**: Log scan execution times and database operation durations
- **Fallback logging**: If database logging fails, errors are written to console
- **Query capabilities**: Retrieve logs by component, scan job, or time range

## Installation

The ErrorLogger is part of the main project and requires:
- `@supabase/supabase-js` package
- Supabase database with Error_Logs table (created by migration 001_initial_schema.sql)

## Quick Start

```typescript
import { ErrorLogger } from './logger';

// Initialize
const errorLogger = new ErrorLogger(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Log an error
await errorLogger.log('Scanner', 'Search failed', stackTrace, scanJobId);

// Log an Error object
try {
  // ... some operation
} catch (error) {
  await errorLogger.logError('Extractor', error as Error);
}
```

## API Reference

### Constructor

```typescript
new ErrorLogger(supabaseUrl: string, supabaseKey: string)
```

Creates a new ErrorLogger instance with Supabase connection.

### Methods

#### log()

```typescript
async log(
  component: string,
  message: string,
  stackTrace?: string,
  scanJobId?: string
): Promise<void>
```

Log a general error to the Error_Logs table.

**Parameters:**
- `component`: Name of the component where the error occurred (e.g., 'Scanner', 'Extractor')
- `message`: Error message
- `stackTrace`: Optional stack trace
- `scanJobId`: Optional scan job ID to link the error to a specific scan

#### logError()

```typescript
async logError(
  component: string,
  error: Error,
  scanJobId?: string
): Promise<void>
```

Log an Error object. Automatically extracts message and stack trace.

#### logNetworkError()

```typescript
async logNetworkError(
  component: string,
  url: string,
  statusCode: number | undefined,
  errorMessage: string,
  scanJobId?: string
): Promise<void>
```

Log a network error with URL and HTTP status code.

**Validates: Requirements 9.4**

#### logScanExecution()

```typescript
async logScanExecution(
  scanJobId: string,
  startTime: Date,
  endTime: Date,
  itemsDiscovered: number,
  component?: string
): Promise<void>
```

Log a scan execution with performance metrics.

**Validates: Requirements 9.2**

#### logDatabaseOperation()

```typescript
async logDatabaseOperation(
  component: string,
  queryType: string,
  executionTime: number,
  scanJobId?: string
): Promise<void>
```

Log a database operation with execution time.

**Validates: Requirements 9.3**

#### getRecentLogs()

```typescript
async getRecentLogs(limit?: number): Promise<any[]>
```

Retrieve recent error logs (default: 100).

#### getLogsByComponent()

```typescript
async getLogsByComponent(component: string, limit?: number): Promise<any[]>
```

Retrieve error logs for a specific component.

#### getLogsByScanJob()

```typescript
async getLogsByScanJob(scanJobId: string): Promise<any[]>
```

Retrieve all error logs for a specific scan job.

## Database Schema

The ErrorLogger writes to the Error_Logs table:

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

## Integration

See [INTEGRATION.md](./INTEGRATION.md) for detailed integration examples with:
- Scanner
- Extractor
- Storage
- Scheduler

## Requirements Validation

The ErrorLogger validates the following requirements:

- **9.1**: Log error message, timestamp, component name, and stack trace
- **9.2**: Log all Scan_Job executions with start time, end time, and items discovered
- **9.3**: Log all database operations with query type and execution time
- **9.4**: Log network request failures with URL, status code, and error message

## Example Usage

See [example-usage.ts](./example-usage.ts) for complete examples.

## Error Handling

The ErrorLogger includes built-in error handling:
- If database logging fails, errors are written to console
- Logging operations never throw exceptions (fail silently with console fallback)
- This prevents logging failures from breaking the main application

## Best Practices

1. **Initialize once**: Create a single ErrorLogger instance and share it across components
2. **Use consistent component names**: Use the same component name throughout a module
3. **Include scan job IDs**: Always pass scanJobId when available to link errors to scans
4. **Log all errors**: Even if you're rethrowing, log the error first
5. **Use specific methods**: Use `logNetworkError` for network issues, `logDatabaseOperation` for DB operations
6. **Monitor logs**: Regularly check error logs in the admin interface

## Testing

The ErrorLogger can be tested with a test Supabase instance:

```typescript
import { ErrorLogger } from './ErrorLogger';

const testLogger = new ErrorLogger(
  'https://test-project.supabase.co',
  'test-anon-key'
);

// Run tests...
```

## License

Part of the UFO Atlas Automated Data Collection system.
