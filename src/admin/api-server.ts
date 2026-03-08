import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StorageService } from '../storage/StorageService';
import { ContentScanner } from '../scanner/ContentScanner';
import { ContentExtractor } from '../extractor/ContentExtractor';
import { DuplicateDetector } from '../duplicate/DuplicateDetector';
import { ErrorLogger } from '../logger/ErrorLogger';
import { ContentFilters } from '../types';
import { CronValidator } from '../scheduler/cronValidator';
import { DataValidator } from '../validator/DataValidator';
import { createScheduleRoutes } from './scheduleRoutes';
import { parseScanPrompt } from '../scanner/ScanPrompt';

// Load environment variables
dotenv.config();

console.log('Starting API server initialization...');

// Initialize Express app
const app = express();
const PORT = process.env.API_PORT || 3000;

console.log('Express app created');

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('Middleware configured');

// Initialize services
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

console.log('Environment variables loaded:', { supabaseUrl });

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
  process.exit(1);
}

console.log('Creating StorageService...');
const storageService = new StorageService(supabaseUrl, supabaseKey);
console.log('StorageService created');

console.log('Creating ContentScanner...');
const contentScanner = new ContentScanner(storageService);
console.log('ContentScanner created');

console.log('Creating ContentExtractor...');
const contentExtractor = new ContentExtractor();
console.log('ContentExtractor created');

console.log('Creating DataValidator...');
const dataValidator = new DataValidator();
console.log('DataValidator created');

console.log('Creating DuplicateDetector...');
const duplicateDetector = new DuplicateDetector(supabaseUrl, supabaseKey);
console.log('DuplicateDetector created');

console.log('Creating ErrorLogger...');
const errorLogger = new ErrorLogger(supabaseUrl, supabaseKey);
console.log('ErrorLogger created');

console.log('Creating CronValidator...');
const cronValidator = new CronValidator();
console.log('CronValidator created');

// Set up extractor with storage service
contentExtractor.setStorageService(storageService);
contentExtractor.setValidator(dataValidator);
contentExtractor.setDuplicateDetector(duplicateDetector);

// Set up scanner with extractor
contentScanner.setContentExtractor(contentExtractor);

console.log('Services initialized successfully');

// Admin user ID for actions (in production, this would come from authentication)
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'admin';

// Error handling middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// REVIEW QUEUE ENDPOINTS
// ============================================================================

/**
 * GET /api/review-queue
 * Get pending content with optional filters
 * Validates: Requirements 4.2, 5.1, 5.3
 */
app.get('/api/review-queue', asyncHandler(async (req: Request, res: Response) => {
  const { contentType, tagIds } = req.query;
  
  const filters: ContentFilters = {};
  
  if (contentType && typeof contentType === 'string') {
    filters.contentType = contentType as 'event' | 'person' | 'theory' | 'news';
  }
  
  if (tagIds && typeof tagIds === 'string') {
    filters.tagIds = tagIds.split(',').map(id => parseInt(id, 10));
  }
  
  const content = await storageService.getPendingContent(filters);
  res.json(content);
}));

/**
 * POST /api/review-queue/:id/approve
 * Approve content and move to timeline archive
 * Validates: Requirements 5.1, 5.2
 */
app.post('/api/review-queue/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const contentId = parseInt(req.params.id, 10);
  
  if (isNaN(contentId)) {
    res.status(400).json({ error: 'Invalid content ID' });
    return;
  }
  
  await storageService.approveContent(contentId, ADMIN_USER_ID);
  res.json({ success: true, message: 'Content approved successfully' });
}));

/**
 * POST /api/review-queue/:id/reject
 * Reject content
 * Validates: Requirements 5.3
 */
app.post('/api/review-queue/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const contentId = parseInt(req.params.id, 10);
  
  if (isNaN(contentId)) {
    res.status(400).json({ error: 'Invalid content ID' });
    return;
  }
  
  await storageService.rejectContent(contentId, ADMIN_USER_ID);
  res.json({ success: true, message: 'Content rejected successfully' });
}));

// ============================================================================
// KEYWORD MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/keywords
 * Get all keywords
 * Validates: Requirements 6.1, 6.2
 */
app.get('/api/keywords', asyncHandler(async (_req: Request, res: Response) => {
  const keywords = await storageService.getKeywords();
  res.json(keywords);
}));

/**
 * POST /api/keywords
 * Add new keyword
 * Validates: Requirements 6.1
 */
app.post('/api/keywords', asyncHandler(async (req: Request, res: Response) => {
  const { keyword } = req.body;
  
  if (!keyword || typeof keyword !== 'string') {
    res.status(400).json({ error: 'Keyword is required' });
    return;
  }
  
  try {
    const keywordId = await storageService.addKeyword(keyword);
    res.json({ success: true, keywordId, message: 'Keyword added successfully' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
}));

/**
 * PATCH /api/keywords/:id/toggle
 * Activate or deactivate keyword
 * Validates: Requirements 6.2
 */
app.patch('/api/keywords/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
  const keywordId = parseInt(req.params.id, 10);
  const { isActive } = req.body;
  
  if (isNaN(keywordId)) {
    res.status(400).json({ error: 'Invalid keyword ID' });
    return;
  }
  
  if (typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive must be a boolean' });
    return;
  }
  
  if (isActive) {
    await storageService.activateKeyword(keywordId);
  } else {
    await storageService.deactivateKeyword(keywordId);
  }
  
  res.json({ success: true, message: `Keyword ${isActive ? 'activated' : 'deactivated'} successfully` });
}));

app.delete('/api/keywords/:id', asyncHandler(async (req: Request, res: Response) => {
  const keywordId = parseInt(req.params.id, 10);

  if (isNaN(keywordId)) {
    res.status(400).json({ error: 'Invalid keyword ID' });
    return;
  }

  await storageService.deleteKeyword(keywordId);
  res.json({ success: true, message: 'Keyword deleted successfully' });
}));

// ============================================================================
// TAG MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/tag-groups
 * Get all tag groups with tags
 * Validates: Requirements 11.7, 11.8, 11.13
 */
app.get('/api/tag-groups', asyncHandler(async (_req: Request, res: Response) => {
  // Get all tag groups (hardcoded IDs based on seed data)
  const tagGroupIds = [1, 2, 3, 4]; // People, UFO, Aliens, Theories
  const tagGroups = [];
  
  for (const groupId of tagGroupIds) {
    try {
      const tags = await storageService.getTagsByGroup(groupId);
      if (tags.length > 0) {
        tagGroups.push({
          tagGroupId: groupId,
          groupName: tags[0].tagGroupName,
          tags,
        });
      }
    } catch (error) {
      // Continue if group doesn't exist
      console.error(`Error fetching tag group ${groupId}:`, error);
    }
  }
  
  res.json(tagGroups);
}));

/**
 * POST /api/tags
 * Create new tag
 * Validates: Requirements 11.7
 */
app.post('/api/tags', asyncHandler(async (req: Request, res: Response) => {
  const { tagName, tagGroupId } = req.body;
  
  if (!tagName || typeof tagName !== 'string') {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  if (!tagGroupId || typeof tagGroupId !== 'number') {
    res.status(400).json({ error: 'Tag group ID is required' });
    return;
  }
  
  const tagId = await storageService.createTag(tagName, tagGroupId);
  res.json({ success: true, tagId, message: 'Tag created successfully' });
}));

/**
 * PATCH /api/tags/:id
 * Update tag
 * Validates: Requirements 11.13
 */
app.patch('/api/tags/:id', asyncHandler(async (req: Request, res: Response) => {
  const tagId = parseInt(req.params.id, 10);
  const { tagName } = req.body;
  
  if (isNaN(tagId)) {
    res.status(400).json({ error: 'Invalid tag ID' });
    return;
  }
  
  if (!tagName || typeof tagName !== 'string') {
    res.status(400).json({ error: 'Tag name is required' });
    return;
  }
  
  await storageService.updateTag(tagId, tagName);
  res.json({ success: true, message: 'Tag updated successfully' });
}));

/**
 * DELETE /api/tags/:id
 * Delete tag
 * Validates: Requirements 11.14
 */
app.delete('/api/tags/:id', asyncHandler(async (req: Request, res: Response) => {
  const tagId = parseInt(req.params.id, 10);
  
  if (isNaN(tagId)) {
    res.status(400).json({ error: 'Invalid tag ID' });
    return;
  }
  
  try {
    await storageService.deleteTag(tagId);
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('assigned to content')) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
}));

/**
 * POST /api/content/:id/tags
 * Assign tags to content
 * Validates: Requirements 11.8
 */
app.post('/api/content/:id/tags', asyncHandler(async (req: Request, res: Response) => {
  const contentId = parseInt(req.params.id, 10);
  const { tagIds } = req.body;
  
  if (isNaN(contentId)) {
    res.status(400).json({ error: 'Invalid content ID' });
    return;
  }
  
  if (!Array.isArray(tagIds)) {
    res.status(400).json({ error: 'tagIds must be an array' });
    return;
  }
  
  await storageService.assignTagsToContent(contentId, tagIds);
  res.json({ success: true, message: 'Tags assigned successfully' });
}));

// ============================================================================
// SCAN TRIGGER ENDPOINT
// ============================================================================

/**
 * POST /api/scan/trigger
 * Trigger manual scan with tag filters
 * Validates: Requirements 8.6
 */
app.post('/api/scan/trigger', asyncHandler(async (req: Request, res: Response) => {
  const {
    tagIds,
    selectedTagIds,
    savedSearchId,
    keywordsUsed,
    promptText,
  } = req.body;
  const normalizedTagIds = Array.isArray(tagIds) ? tagIds : selectedTagIds;
  
  if (!Array.isArray(normalizedTagIds)) {
    res.status(400).json({ error: 'tagIds must be an array' });
    return;
  }

  if (keywordsUsed !== undefined && !Array.isArray(keywordsUsed)) {
    res.status(400).json({ error: 'keywordsUsed must be an array when provided' });
    return;
  }

  if (promptText !== undefined && typeof promptText !== 'string') {
    res.status(400).json({ error: 'promptText must be a string when provided' });
    return;
  }

  const normalizedKeywords = Array.isArray(keywordsUsed)
    ? keywordsUsed
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter((keyword) => keyword.length > 0)
    : [];

  let promptKeywords: string[] = [];
  if (typeof promptText === 'string' && promptText.trim().length > 0) {
    const parsedPrompt = parseScanPrompt(promptText);
    if ('error' in parsedPrompt) {
      res.status(parsedPrompt.statusCode).json({ error: parsedPrompt.error });
      return;
    }

    promptKeywords = parsedPrompt.keywords;
  }
  
  // Get active keywords
  const keywords = promptKeywords.length > 0
    ? promptKeywords
    : normalizedKeywords.length > 0
      ? normalizedKeywords
      : await contentScanner.getActiveKeywords();
  
  // Execute scan
  const result = await contentScanner.executeScan(
    keywords,
    normalizedTagIds,
    savedSearchId,
    undefined,
    promptKeywords.length > 0 ? { fallbackStrategy: 'none' } : undefined,
  );
  
  res.json(result);
}));

// ============================================================================
// SAVED SEARCH ENDPOINTS
// ============================================================================

/**
 * GET /api/saved-searches
 * Get all saved searches
 * Validates: Requirements 12.1, 12.3
 */
app.get('/api/saved-searches', asyncHandler(async (_req: Request, res: Response) => {
  const savedSearches = await storageService.getSavedSearches();
  res.json(savedSearches);
}));

/**
 * POST /api/saved-searches
 * Create new saved search
 * Validates: Requirements 12.1
 */
app.post('/api/saved-searches', asyncHandler(async (req: Request, res: Response) => {
  const { searchName, keywordsUsed, selectedTagIds } = req.body;
  
  if (!searchName || typeof searchName !== 'string') {
    res.status(400).json({ error: 'Search name is required' });
    return;
  }
  
  if (!Array.isArray(keywordsUsed)) {
    res.status(400).json({ error: 'keywordsUsed must be an array' });
    return;
  }
  
  if (!Array.isArray(selectedTagIds)) {
    res.status(400).json({ error: 'selectedTagIds must be an array' });
    return;
  }
  
  const savedSearch = await storageService.createSavedSearch(
    searchName,
    keywordsUsed,
    selectedTagIds,
    ADMIN_USER_ID
  );
  
  res.json(savedSearch);
}));

// Mount schedule routes for saved searches
// Validates: Requirements 8.1
const scheduleRoutes = createScheduleRoutes(storageService, cronValidator);
app.use('/api/saved-searches', scheduleRoutes);

/**
 * POST /api/saved-searches/:id/execute
 * Execute saved search
 * Validates: Requirements 12.5
 */
app.post('/api/saved-searches/:id/execute', asyncHandler(async (req: Request, res: Response) => {
  const savedSearchId = parseInt(req.params.id, 10);
  
  if (isNaN(savedSearchId)) {
    res.status(400).json({ error: 'Invalid saved search ID' });
    return;
  }
  
  // Get saved search details
  const savedSearches = await storageService.getSavedSearches();
  const savedSearch = savedSearches.find(s => s.savedSearchId === savedSearchId);
  
  if (!savedSearch) {
    res.status(404).json({ error: 'Saved search not found' });
    return;
  }
  
  // Execute scan with saved search parameters
  const result = await contentScanner.executeScan(
    savedSearch.keywordsUsed,
    savedSearch.selectedTagIds,
    savedSearch.savedSearchId,
    savedSearch.version
  );
  
  res.json(result);
}));

/**
 * POST /api/saved-searches/:id/refine
 * Refine saved search (create new version)
 * Validates: Requirements 12.7, 12.8
 */
app.post('/api/saved-searches/:id/refine', asyncHandler(async (req: Request, res: Response) => {
  const parentSearchId = parseInt(req.params.id, 10);
  const { searchName, keywordsUsed, selectedTagIds } = req.body;
  
  if (isNaN(parentSearchId)) {
    res.status(400).json({ error: 'Invalid parent search ID' });
    return;
  }
  
  if (!searchName || typeof searchName !== 'string') {
    res.status(400).json({ error: 'Search name is required' });
    return;
  }
  
  if (!Array.isArray(keywordsUsed)) {
    res.status(400).json({ error: 'keywordsUsed must be an array' });
    return;
  }
  
  if (!Array.isArray(selectedTagIds)) {
    res.status(400).json({ error: 'selectedTagIds must be an array' });
    return;
  }
  
  const refinedSearch = await storageService.createSavedSearch(
    searchName,
    keywordsUsed,
    selectedTagIds,
    ADMIN_USER_ID,
    parentSearchId
  );
  
  res.json(refinedSearch);
}));

/**
 * DELETE /api/saved-searches/:id
 * Delete saved search
 * Validates: Requirements 12.13
 */
app.delete('/api/saved-searches/:id', asyncHandler(async (req: Request, res: Response) => {
  const savedSearchId = parseInt(req.params.id, 10);
  
  if (isNaN(savedSearchId)) {
    res.status(400).json({ error: 'Invalid saved search ID' });
    return;
  }
  
  await storageService.deleteSavedSearch(savedSearchId);
  res.json({ success: true, message: 'Saved search deleted successfully' });
}));

/**
 * GET /api/saved-searches/:name/versions
 * Get version history for a saved search
 * Validates: Requirements 12.13
 */
app.get('/api/saved-searches/:name/versions', asyncHandler(async (req: Request, res: Response) => {
  const searchName = decodeURIComponent(req.params.name);
  
  const versions = await storageService.getSavedSearchVersions(searchName);
  res.json(versions);
}));

// ============================================================================
// ERROR LOGS AND SEARCH HISTORY ENDPOINTS
// ============================================================================

/**
 * GET /api/error-logs
 * Get recent error logs
 * Validates: Requirements 9.5
 */
app.get('/api/error-logs', asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  
  const logs = await errorLogger.getRecentLogs(limit);
  res.json(logs);
}));

/**
 * GET /api/search-history
 * Get search history
 * Validates: Requirements 4.8
 */
app.get('/api/search-history', asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  
  const history = await storageService.getSearchHistory(limit);
  res.json(history);
}));

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  
  // Log error to database
  errorLogger.logError('api-server', err).catch(console.error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

console.log('About to start server on port', PORT);

app.listen(PORT, () => {
  console.log(`AdminAPI server running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

export default app;
