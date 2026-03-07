/**
 * Example usage of ContentScanner
 * 
 * This file demonstrates how to use the ContentScanner component
 * to discover and process UFO-related content.
 */

import { ContentScanner } from './ContentScanner';
import { StorageService } from '../storage/StorageService';
import { ContentExtractor } from '../extractor/ContentExtractor';
import { DataValidator } from '../validator/DataValidator';
import { DuplicateDetector } from '../duplicate/DuplicateDetector';

async function main() {
  // Initialize Supabase storage service
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || '';
  const storage = new StorageService(supabaseUrl, supabaseKey);

  // Create content scanner
  const scanner = new ContentScanner(storage);

  // Optional: Set up content extractor for automatic processing
  const extractor = new ContentExtractor();
  const validator = new DataValidator();
  const duplicateDetector = new DuplicateDetector(storage);

  extractor.setValidator(validator);
  extractor.setDuplicateDetector(duplicateDetector);
  extractor.setStorageService(storage);

  scanner.setContentExtractor(extractor);

  // Example 1: Get active keywords
  console.log('=== Example 1: Get Active Keywords ===');
  const activeKeywords = await scanner.getActiveKeywords();
  console.log('Active keywords:', activeKeywords);

  // Example 2: Execute scan with specific keywords
  console.log('\n=== Example 2: Execute Scan with Specific Keywords ===');
  const result1 = await scanner.executeScan(
    ['UFO', 'Roswell'],  // Search for UFO and Roswell
    []                    // No tag filters (search all tags)
  );
  console.log('Scan result:', {
    scanJobId: result1.scanJobId,
    keywordsUsed: result1.keywordsUsed,
    discoveredUrls: result1.discoveredUrls.length,
    errorCount: result1.errorCount,
  });

  // Example 3: Execute scan with tag filters
  console.log('\n=== Example 3: Execute Scan with Tag Filters ===');
  const result2 = await scanner.executeScan(
    ['UFO'],
    [1, 2, 5],  // Filter by specific tags: Jesse Marcel, Ross Coulthart, Area51
  );
  console.log('Scan result:', {
    scanJobId: result2.scanJobId,
    keywordsUsed: result2.keywordsUsed,
    selectedTagIds: result2.selectedTagIds,
    discoveredUrls: result2.discoveredUrls.length,
    errorCount: result2.errorCount,
  });

  // Example 4: Execute scan from saved search
  console.log('\n=== Example 4: Execute Scan from Saved Search ===');
  const result3 = await scanner.executeScan(
    ['UFO', 'Alien'],
    [1, 2],
    123,  // savedSearchId
    2     // savedSearchVersion
  );
  console.log('Scan result:', {
    scanJobId: result3.scanJobId,
    keywordsUsed: result3.keywordsUsed,
    selectedTagIds: result3.selectedTagIds,
    discoveredUrls: result3.discoveredUrls.length,
    errorCount: result3.errorCount,
  });

  // Example 5: Execute scan with all active keywords
  console.log('\n=== Example 5: Execute Scan with All Active Keywords ===');
  const result4 = await scanner.executeScan(
    [],  // Empty array = use all active keywords
    []   // No tag filters
  );
  console.log('Scan result:', {
    scanJobId: result4.scanJobId,
    keywordsUsed: result4.keywordsUsed,
    discoveredUrls: result4.discoveredUrls.length,
    errorCount: result4.errorCount,
  });

  // Clean up
  await extractor.close();
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
