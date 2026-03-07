import { ErrorLogger } from './ErrorLogger';

/**
 * Unit tests for ErrorLogger
 * Tests basic functionality with mock Supabase client
 */

// Mock Supabase client
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('ErrorLogger', () => {
  let errorLogger: ErrorLogger;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock chain
    mockFrom.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    });

    mockInsert.mockReturnValue({
      error: null,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      order: mockOrder,
    });

    mockOrder.mockReturnValue({
      limit: mockLimit,
    });

    mockLimit.mockResolvedValue({
      data: [],
      error: null,
    });

    // Create ErrorLogger instance
    errorLogger = new ErrorLogger(
      'https://test.supabase.co',
      'test-key'
    );
  });

  describe('log', () => {
    it('should log error with all parameters', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await errorLogger.log(
        'Scanner',
        'Test error message',
        'Error stack trace',
        'scan-123'
      );

      expect(mockFrom).toHaveBeenCalledWith('Error_Logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Scanner',
          message: 'Test error message',
          stack_trace: 'Error stack trace',
          scan_job_id: 'scan-123',
        })
      );
    });

    it('should log error with optional parameters omitted', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await errorLogger.log('Extractor', 'Simple error');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Extractor',
          message: 'Simple error',
          stack_trace: null,
          scan_job_id: null,
        })
      );
    });

    it('should not throw if database insert fails', async () => {
      mockInsert.mockResolvedValue({ error: new Error('DB error') });

      // Should not throw
      await expect(
        errorLogger.log('Scanner', 'Test error')
      ).resolves.not.toThrow();
    });
  });

  describe('logError', () => {
    it('should log Error object with message and stack', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n  at test.ts:10';

      await errorLogger.logError('Storage', testError, 'scan-456');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Storage',
          message: 'Test error',
          stack_trace: 'Error: Test error\n  at test.ts:10',
          scan_job_id: 'scan-456',
        })
      );
    });
  });

  describe('logNetworkError', () => {
    it('should log network error with URL and status code', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await errorLogger.logNetworkError(
        'Scanner',
        'https://api.example.com/search',
        404,
        'Not found',
        'scan-789'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Scanner',
          message: expect.stringContaining('https://api.example.com/search'),
          message: expect.stringContaining('404'),
          message: expect.stringContaining('Not found'),
          scan_job_id: 'scan-789',
        })
      );
    });

    it('should handle undefined status code', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await errorLogger.logNetworkError(
        'Scanner',
        'https://api.example.com/search',
        undefined,
        'Connection timeout'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('N/A'),
        })
      );
    });
  });

  describe('logScanExecution', () => {
    it('should log scan execution with metrics', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:05:00Z');

      await errorLogger.logScanExecution(
        'scan-999',
        startTime,
        endTime,
        42,
        'Scanner'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Scanner',
          message: expect.stringContaining('42 items discovered'),
          message: expect.stringContaining('300000ms'), // 5 minutes
          scan_job_id: 'scan-999',
        })
      );
    });
  });

  describe('logDatabaseOperation', () => {
    it('should log database operation with execution time', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await errorLogger.logDatabaseOperation(
        'Storage',
        'INSERT',
        125,
        'scan-111'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'Storage',
          message: expect.stringContaining('INSERT'),
          message: expect.stringContaining('125ms'),
          scan_job_id: 'scan-111',
        })
      );
    });
  });

  describe('getRecentLogs', () => {
    it('should retrieve recent logs with default limit', async () => {
      const mockLogs = [
        { log_id: 1, component: 'Scanner', message: 'Error 1' },
        { log_id: 2, component: 'Extractor', message: 'Error 2' },
      ];

      mockLimit.mockResolvedValue({ data: mockLogs, error: null });

      const logs = await errorLogger.getRecentLogs();

      expect(mockFrom).toHaveBeenCalledWith('Error_Logs');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(100);
      expect(logs).toEqual(mockLogs);
    });

    it('should retrieve recent logs with custom limit', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await errorLogger.getRecentLogs(50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should return empty array on error', async () => {
      mockLimit.mockResolvedValue({ data: null, error: new Error('DB error') });

      const logs = await errorLogger.getRecentLogs();

      expect(logs).toEqual([]);
    });
  });

  describe('getLogsByComponent', () => {
    it('should retrieve logs for specific component', async () => {
      const mockLogs = [
        { log_id: 1, component: 'Scanner', message: 'Error 1' },
      ];

      mockLimit.mockResolvedValue({ data: mockLogs, error: null });

      const logs = await errorLogger.getLogsByComponent('Scanner', 50);

      expect(mockEq).toHaveBeenCalledWith('component', 'Scanner');
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(logs).toEqual(mockLogs);
    });
  });

  describe('getLogsByScanJob', () => {
    it('should retrieve logs for specific scan job', async () => {
      const mockLogs = [
        { log_id: 1, scan_job_id: 'scan-123', message: 'Error 1' },
      ];

      mockOrder.mockResolvedValue({ data: mockLogs, error: null });

      const logs = await errorLogger.getLogsByScanJob('scan-123');

      expect(mockEq).toHaveBeenCalledWith('scan_job_id', 'scan-123');
      expect(logs).toEqual(mockLogs);
    });
  });
});
