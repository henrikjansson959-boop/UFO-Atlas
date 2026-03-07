# Automated Data Collection System

Automated UFO-related content discovery and curation platform for UFO Atlas.

## Overview

This system automatically scans internet sources using configurable keywords and tag filters, extracts structured data, stores it in Supabase, and provides an admin review workflow before publication.

## Features

- **Content Discovery**: Keyword-based scanning with hierarchical tag filtering
- **Data Extraction**: Structured extraction of title, description, date, and content type
- **Duplicate Detection**: URL and title similarity checking
- **Admin Review**: Web UI for approving/rejecting discovered content
- **Tag Management**: Hierarchical organization with Tag Groups and Tags
- **Saved Searches**: Reusable search configurations with versioning
- **Search History**: Complete audit trail of all scan executions
- **Error Logging**: Comprehensive error tracking and reporting

## Project Structure

```
.
├── src/
│   ├── scanner/       # Content scanning components
│   ├── extractor/     # Data extraction components
│   ├── storage/       # Supabase storage layer
│   ├── admin/         # Admin API and UI
│   └── types/         # TypeScript interfaces and types
├── supabase/
│   ├── migrations/    # Database schema migrations
│   └── seed.sql       # Initial data seeding
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure Supabase:
   - Create a Supabase project
   - Run migrations: `supabase/migrations/001_initial_schema.sql`
   - Run seed script: `supabase/seed.sql`

3. Set environment variables:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

4. Build the project:
```bash
npm run build
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Database Schema

The system uses 9 main tables:
- **Tag_Groups**: Hierarchical categories (People, UFO, Aliens, Theories)
- **Tags**: Specific values within tag groups
- **Review_Queue**: Pending content awaiting review
- **Timeline_Archive**: Approved content
- **Keyword_Config**: Search keywords configuration
- **Content_Tags**: Many-to-many content-tag relationships
- **Saved_Searches**: Reusable search configurations with versioning
- **Search_History**: Audit trail of scan executions
- **Error_Logs**: System error logging

## License

MIT
