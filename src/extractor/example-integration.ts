/**
 * Example: ContentExtractor Integration with Validator, DuplicateDetector, and Storage
 * 
 * This example demonstrates how to wire together the ContentExtractor with
 * DataValidator, DuplicateDetector, and StorageService to create a complete
 * content processing pipeline.
 * 
 * Requirements validated:
 * - 3.1: Only insert valid, non-duplicate content into Review_Queue
 * - 7.1: Check for duplicates before storage
 * - 7.2: Skip duplicate content
 * - 10.1: Validate content before storage
 */

import { ContentExtractor } from './ContentExtractor';
import { DataValidator } from '../validator/DataValidator';
import { DuplicateDetector } from '../duplicate/DuplicateDetector';
import { StorageService } from '../storage/StorageService';

async function main() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment');
  }

  // Initialize all components
  const extractor = new ContentExtractor();
  const validator = new DataValidator();
  const duplicateDetector = new DuplicateDetector(supabaseUrl, supabaseKey);
  const storageService = new StorageService(supabaseUrl, supabaseKey);

  // Wire components together
  extractor.setValidator(validator);
  extractor.setDuplicateDetector(duplicateDetector);
  extractor.setStorageService(storageService);

  // Example URLs to process
  const urls = [
    'https://example.com/ufo-sighting-phoenix',
    'https://example.com/bob-lazar-interview',
    'https://example.com/ancient-aliens-theory',
    'https://example.com/pentagon-ufo-report'
  ];

  console.log('Starting content extraction and storage...\n');

  // Process each URL through the complete pipeline
  for (const url of urls) {
    console.log(`Processing: ${url}`);
    
    try {
      const contentId = await extractor.extractAndStore(url);
      
      if (contentId) {
        console.log(`✓ Successfully stored with content ID: ${contentId}\n`);
      } else {
        console.log(`✗ Not stored (extraction failed, validation failed, or duplicate)\n`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${url}:`, error);
      console.log();
    }
  }

  // Clean up resources
  await extractor.close();
  console.log('Extraction complete. Browser resources cleaned up.');
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
