-- Create anon role for PostgREST
CREATE ROLE anon NOLOGIN;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;

-- Local development uses a broad anon role so the Supabase client can
-- exercise the full app flow against PostgREST without extra auth plumbing.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon;
