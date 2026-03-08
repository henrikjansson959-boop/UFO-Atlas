-- Create anon role for PostgREST
CREATE ROLE anon NOLOGIN;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;

-- Grant select on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant insert, update, delete on specific tables that need write access
GRANT INSERT, UPDATE, DELETE ON keyword_config TO anon;
GRANT INSERT, UPDATE, DELETE ON tags TO anon;
GRANT INSERT, UPDATE, DELETE ON content_items TO anon;
GRANT INSERT, UPDATE, DELETE ON content_tags TO anon;
GRANT INSERT, UPDATE, DELETE ON error_logs TO anon;
GRANT INSERT, UPDATE, DELETE ON saved_searches TO anon;
GRANT INSERT, UPDATE, DELETE ON search_history TO anon;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
