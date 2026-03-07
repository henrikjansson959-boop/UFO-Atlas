# DuplicateDetector

The `DuplicateDetector` class checks for duplicate content before storage in the Automated Data Collection system.

## Features

- **Exact URL Matching**: Checks if `source_url` already exists in `Review_Queue` or `Timeline_Archive` tables (Requirements 7.1, 7.2)
- **Title Similarity Detection**: Calculates title similarity using the Levenshtein distance algorithm (Requirements 7.3, 7.4)
- **Configurable Threshold**: Flags content as potential duplicate when title similarity exceeds 90%

## Usage

```typescript
import { DuplicateDetector } from './duplicate';
import { ExtractedContent } from './types';

// Initialize the detector
const detector = new DuplicateDetector(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Check for duplicates
const content: ExtractedContent = {
  title: 'UFO Sighting in Roswell',
  description: 'A detailed account',
  eventDate: new Date('2024-01-15'),
  sourceUrl: 'https://example.com/article',
  contentType: 'event',
  rawHtml: '<html>...</html>'
};

const result = await detector.checkDuplicate(content);

if (result.isDuplicate) {
  console.log('Exact duplicate found!');
  console.log('Matched content ID:', result.matchedContentId);
} else if (result.isPotentialDuplicate) {
  console.log('Potential duplicate detected!');
  console.log('Similarity score:', result.similarityScore);
  console.log('Matched content ID:', result.matchedContentId);
} else {
  console.log('No duplicates found - safe to store');
}
```

## Return Values

The `checkDuplicate` method returns a `DuplicateCheckResult` object:

```typescript
interface DuplicateCheckResult {
  isDuplicate: boolean;           // True if exact source_url match found
  isPotentialDuplicate: boolean;  // True if title similarity > 90%
  matchedContentId?: number;      // ID of the matching content
  similarityScore?: number;       // Similarity score (0-1) for potential duplicates
}
```

## Similarity Calculation

The similarity score is calculated using the Levenshtein distance algorithm:

1. Titles are normalized (lowercase, trimmed)
2. Levenshtein distance is calculated
3. Distance is converted to similarity score: `1 - (distance / maxLength)`
4. Score ranges from 0 (completely different) to 1 (identical)

## Requirements Validation

- **Requirement 7.1**: Checks if source_url exists in Review_Queue
- **Requirement 7.2**: Checks if source_url exists in Timeline_Archive
- **Requirement 7.3**: Calculates title similarity above 90%
- **Requirement 7.4**: Flags potential duplicates with >90% similarity
