# Content Extractor

The ContentExtractor class is responsible for fetching web pages and extracting structured UFO-related content.

## Features

- **Dual Extraction Strategy**: Tries fast static HTML parsing with Cheerio first, falls back to Puppeteer for JavaScript-heavy sites
- **Comprehensive Metadata Extraction**: Extracts title, description, date, and content type from various HTML structures
- **Smart Content Classification**: Automatically classifies content as event, person, theory, or news based on keywords
- **Error Handling**: Gracefully handles network errors, timeouts, and extraction failures with logging
- **Raw HTML Storage**: Preserves original HTML for admin reference

## Usage

```typescript
import { ContentExtractor } from './extractor';

const extractor = new ContentExtractor();

// Extract content from a URL
const content = await extractor.extract('https://example.com/ufo-sighting');

if (content) {
  console.log('Title:', content.title);
  console.log('Description:', content.description);
  console.log('Content Type:', content.contentType);
  console.log('Event Date:', content.eventDate);
  console.log('Source URL:', content.sourceUrl);
  // Raw HTML available in content.rawHtml
}

// Clean up resources when done
await extractor.close();
```

## Extraction Strategy

### 1. Static HTML Parsing (Cheerio)
- Fast and lightweight
- Works for most static websites
- Attempts first for all URLs

### 2. JavaScript Rendering (Puppeteer)
- Used as fallback when static parsing fails
- Handles JavaScript-heavy sites
- Waits for network idle before extraction

## Metadata Extraction

### Title
Tries in order:
1. Open Graph title (`og:title`)
2. Twitter title (`twitter:title`)
3. HTML `<title>` tag
4. First `<h1>` element

### Description
Tries in order:
1. Open Graph description (`og:description`)
2. Meta description tag
3. Twitter description (`twitter:description`)
4. First `<p>` element text

### Date
Tries in order:
1. Open Graph published time (`article:published_time`)
2. `<time>` element with `datetime` attribute
3. Meta date tags (`name="date"`, `name="publish-date"`)
4. Returns `null` if no date found

## Content Classification

The extractor automatically classifies content into four types:

### Event
Keywords: sighting, encounter, incident, crash, observation, witnessed, occurred, Roswell, Area 51, Rendlesham, Phoenix Lights, Nimitz

### Person
Keywords: biography, profile, researcher, investigator, witness, testified, expert, ufologist, whistleblower, Jesse Marcel, Bob Lazar, David Grusch, Ross Coulthart

### Theory
Keywords: theory, hypothesis, explanation, believes, suggests, ancient aliens, interdimensional, extraterrestrial, disclosure, cover-up, conspiracy

### News
Keywords: breaking, report, announced, revealed, disclosed, Congress, hearing, Pentagon, government, official, investigation, study

**Default**: If no clear classification, defaults to "news"

## Error Handling

The extractor handles various error scenarios:

- **Network Errors**: Logs error and returns `null`
- **Timeout Errors**: 10-second timeout for Cheerio, 30-second for Puppeteer
- **Missing Title**: Returns `null` (title is required)
- **Invalid Dates**: Returns `null` for eventDate field
- **Extraction Failures**: Logs error with URL, timestamp, and stack trace

All errors are logged to console with structured format:
```
[ContentExtractor.methodName] Error extracting from URL: {
  message: "error message",
  stack: "stack trace",
  timestamp: "ISO 8601 timestamp"
}
```

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 2.1**: Extracts title, description, date, source URL, and content type
- **Requirement 2.2**: Classifies content as event, person, theory, or news
- **Requirement 2.3**: Parses dates into ISO 8601 format (via JavaScript Date object)
- **Requirement 2.4**: Logs failures and skips sources that fail extraction
- **Requirement 2.5**: Stores raw HTML for admin reference

## Testing

The ContentExtractor includes comprehensive unit tests covering:

- Title extraction from various HTML structures
- Description extraction strategies
- Date parsing and format handling
- Content type classification
- Error handling and logging
- Puppeteer fallback behavior
- Edge cases (missing fields, invalid dates, empty content)

Run tests:
```bash
npm test -- ContentExtractor.test.ts
```

## Performance Considerations

- **Cheerio First**: Fast static parsing attempted first for better performance
- **Puppeteer Pooling**: Browser instance reused across multiple extractions
- **Timeouts**: Prevents hanging on slow or unresponsive sites
- **Resource Cleanup**: `close()` method properly closes browser instance

## Future Enhancements

Potential improvements for future iterations:

- Browser instance pooling for concurrent extractions
- Configurable timeout values
- Custom classification rules via configuration
- Support for additional metadata formats (JSON-LD, microdata)
- Retry logic with exponential backoff
- Rate limiting for respectful scraping
