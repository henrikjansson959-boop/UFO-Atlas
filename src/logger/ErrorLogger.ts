import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * ErrorLogger provides centralized error logging for all components
 * Logs errors to the Error_Logs table in Supabase
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export class ErrorLogger {
  private client: SupabaseClient;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
      },
    });
  }

  /**
   * Log an error to the Error_Logs table
   * @param component - Name of the component where the error occurred
   * @param message - Error message
   * @param stackTrace - Stack trace (optional)
   * @param scanJobId - Associated scan job ID (optional)
   * Validates: Requirements 9.1
   */
  async log(
    component: string,
    message: string,
    stackTrace?: string,
    scanJobId?: string
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from('Error_Logs')
        .insert({
          component,
          message,
          stack_trace: stackTrace || null,
          scan_job_id: scanJobId || null,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        // If logging fails, write to console as fallback
        console.error('Failed to log error to database:', error);
        console.error('Original error:', { component, message, stackTrace, scanJobId });
      }
    } catch (err) {
      // Catch any unexpected errors during logging
      console.error('Unexpected error in ErrorLogger:', err);
      console.error('Original error:', { component, message, stackTrace, scanJobId });
    }
  }

  /**
   * Log an error from an Error object
   * @param component - Name of the component where the error occurred
   * @param error - Error object
   * @param scanJobId - Associated scan job ID (optional)
   */
  async logError(
    component: string,
    error: Error,
    scanJobId?: string
  ): Promise<void> {
    await this.log(component, error.message, error.stack, scanJobId);
  }

  /**
   * Log a network error with URL and status code
   * @param component - Name of the component where the error occurred
   * @param url - URL that failed
   * @param statusCode - HTTP status code (optional)
   * @param errorMessage - Error message
   * @param scanJobId - Associated scan job ID (optional)
   * Validates: Requirements 9.4
   */
  async logNetworkError(
    component: string,
    url: string,
    statusCode: number | undefined,
    errorMessage: string,
    scanJobId?: string
  ): Promise<void> {
    const message = `Network error: ${url} - Status: ${statusCode || 'N/A'} - ${errorMessage}`;
    await this.log(component, message, undefined, scanJobId);
  }

  /**
   * Log a scan execution with metrics
   * @param scanJobId - Scan job ID
   * @param startTime - Scan start time
   * @param endTime - Scan end time
   * @param itemsDiscovered - Number of items discovered
   * @param component - Component name (default: 'Scanner')
   * Validates: Requirements 9.2
   */
  async logScanExecution(
    scanJobId: string,
    startTime: Date,
    endTime: Date,
    itemsDiscovered: number,
    component: string = 'Scanner'
  ): Promise<void> {
    const duration = endTime.getTime() - startTime.getTime();
    const message = `Scan completed: ${itemsDiscovered} items discovered in ${duration}ms`;
    await this.log(component, message, undefined, scanJobId);
  }

  /**
   * Log a database operation with execution time
   * @param component - Name of the component
   * @param queryType - Type of query (SELECT, INSERT, UPDATE, DELETE)
   * @param executionTime - Execution time in milliseconds
   * @param scanJobId - Associated scan job ID (optional)
   * Validates: Requirements 9.3
   */
  async logDatabaseOperation(
    component: string,
    queryType: string,
    executionTime: number,
    scanJobId?: string
  ): Promise<void> {
    const message = `Database operation: ${queryType} completed in ${executionTime}ms`;
    await this.log(component, message, undefined, scanJobId);
  }

  /**
   * Get recent error logs
   * @param limit - Maximum number of logs to retrieve (default: 100)
   * @returns Array of error log entries
   */
  async getRecentLogs(limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('Error_Logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to retrieve error logs:', err);
      return [];
    }
  }

  /**
   * Get error logs for a specific component
   * @param component - Component name
   * @param limit - Maximum number of logs to retrieve (default: 100)
   * @returns Array of error log entries
   */
  async getLogsByComponent(component: string, limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('Error_Logs')
        .select('*')
        .eq('component', component)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to retrieve error logs:', err);
      return [];
    }
  }

  /**
   * Get error logs for a specific scan job
   * @param scanJobId - Scan job ID
   * @returns Array of error log entries
   */
  async getLogsByScanJob(scanJobId: string): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('Error_Logs')
        .select('*')
        .eq('scan_job_id', scanJobId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to retrieve error logs:', err);
      return [];
    }
  }
}
