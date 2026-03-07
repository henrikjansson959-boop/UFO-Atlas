# ContentScanner

The ContentScanner component is responsible for discovering UFO-related content from internet sources using configurable keywords and tag filters.

## Features

- **Active Keyword Retrieval**: Retrieves active keywords from the Keyword_Config table
- **Keyword-Based Scanning**: Searches internet sources using keywords and tag filters
- **Network Error Handling**: Implements retry logic with exponential backoff for network failures
- **Content Processing**: Passes discovered URLs to ContentExtractor for data extraction
- **Search History**: Records all scan executions with metadata for audit purposes

## Usage

```typescript
import { ContentScanner } from './scanner';
import { StorageService } from './storage';
import { ContentExtractor } from './extractor';

// Initialize storage service
const storage = new StorageService(supabaseUrl, supabaseKey);

// Create scanner
const scanner = new ContentScanner(storage);

// Set content extractor (optional, for automatic processing)
const extractor = new ContentExtractor();
scanner.setContentExtractor(extractor);

// Get active keywords
const keywords = await scanner.getActiveKeywords();
console.log('Active keywords:', keywords);

// Execute a scan with specific keywords and tag filters
const result = await scanner.executeScan(
  ['UFO', 'Roswell'],  // keywords
  [1, 2, 5],           // tag IDs (e.g., Jesse Marcel, Ross Coulthart, Area51)
  undefined,           // savedSearchId (optional)
  undefined            // savedSearchVersion (optional)
);

console.log('Scan result:', result);
// {
//   scanJobId: 'scan-1234567890-abc123',
//   discoveredUrls: ['https://example.com/ufo-article', ...],
//   searchTimestamp: Date,
//   keywordsUsed: ['UFO', 'Roswell'],
//   selectedTagIds: [1, 2, 5],
//   errorCount: 0
// }
```

## Requirements Validated

- **Requirement 1.1**: Retrieves active keywords from Keyword_Config
- **Requirement 1.2**: Searches internet sources using all active keywords
- **Requirement 1.6**: Supports tag filtering (empty = all tags in group)
- **Requirement 1.8**: Handles network errors with retry logic and continues with remaining keywords

## Implementation Notes

### Search API Integration

The current implementation includes a placeholder for search API integration. In production, you should integrate with a real search API such as:

- **Google Custom Search API**: Provides programmatic access to Google search results
- **Bing Search API**: Microsoft's search API with good coverage
- **DuckDuckGo API**: Privacy-focused search API
- **Web Scraping**: Use Puppeteer to scrape search engine results

Example integration with Google Custom Search API:

```typescript
private async searchInternet(keyword: string, tagNames: string[]): Promise<string[]> {
  const searchQuery = this.buildSearchQuery(keyword, tagNames);
  
  const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: searchQuery,
      num: 10, // Number of results
    },
    timeout: 10000,
  });
  
  return response.data.items.map((item: any) => item.link);
}
```

### Retry Logic

The scanner implements exponential backoff for network errors:
- **Max retries**: 3 attempts
- **Base delay**: 1 second
- **Backoff**: Delay doubles with each retry (1s, 2s, 4s)

### Error Handling

The scanner follows the requirement to continue processing remaining keywords even if one fails:

```typescript
for (const keyword of searchKeywords) {
  try {
    // Search and process
  } catch (error) {
    // Log error but continue with remaining keywords
    this.logError('executeScan', `Failed to search for keyword: ${keyword}`, error);
    errorCount++;
  }
}
```

## Testing

Unit tests should cover:
- Active keyword retrieval with various database states
- Scan execution with empty keyword list
- Error handling for network failures
- Retry logic with simulated failures
- Tag filter application

Property-based tests should verify:
- **Property 1**: Active Keyword Retrieval - only returns keywords where is_active = true
- **Property 2**: Complete Keyword Coverage - uses all active keywords when triggered
- **Property 4**: Default Tag Group Expansion - searches all tags when none selected
- **Property 6**: Scan Error Resilience - continues with remaining keywords on failure

## Future Enhancements

1. **Rate Limiting**: Implement rate limiting to respect search API quotas
2. **Caching**: Cache search results to avoid duplicate API calls
3. **Advanced Filtering**: Support more complex search queries with boolean operators
4. **Multiple Sources**: Integrate with multiple search providers for better coverage
5. **Result Ranking**: Implement relevance scoring for discovered URLs
