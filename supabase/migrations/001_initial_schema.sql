-- Automated Data Collection System - Initial Database Schema
-- This migration creates all tables, indexes, and constraints for the system

-- Tag Groups (hierarchical categories)
CREATE TABLE Tag_Groups (
  tag_group_id SERIAL PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tags (specific values within Tag_Groups)
CREATE TABLE Tags (
  tag_id SERIAL PRIMARY KEY,
  tag_name VARCHAR(100) NOT NULL,
  tag_group_id INTEGER NOT NULL REFERENCES Tag_Groups(tag_group_id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tag_name, tag_group_id)
);

-- Review Queue (pending content)
CREATE TABLE Review_Queue (
  content_id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE,
  source_url VARCHAR(1000) NOT NULL UNIQUE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('event', 'person', 'theory', 'news')),
  raw_html TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_potential_duplicate BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  reviewed_by VARCHAR(100)
);

-- Timeline Archive (approved content)
CREATE TABLE Timeline_Archive (
  content_id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date DATE,
  source_url VARCHAR(1000) NOT NULL UNIQUE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('event', 'person', 'theory', 'news')),
  approved_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(100) NOT NULL
);

-- Keyword Configuration
CREATE TABLE Keyword_Config (
  keyword_id SERIAL PRIMARY KEY,
  keyword_text VARCHAR(200) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_scan_at TIMESTAMP
);

-- Content Tags (many-to-many relationship)
CREATE TABLE Content_Tags (
  content_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES Tags(tag_id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  table_name VARCHAR(50) NOT NULL CHECK (table_name IN ('Review_Queue', 'Timeline_Archive')),
  PRIMARY KEY (content_id, tag_id, table_name)
);

-- Saved Searches (reusable search configurations with versioning)
CREATE TABLE Saved_Searches (
  saved_search_id SERIAL PRIMARY KEY,
  search_name VARCHAR(200) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  keywords_used TEXT[] NOT NULL,
  selected_tag_ids INTEGER[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100) NOT NULL,
  parent_search_id INTEGER REFERENCES Saved_Searches(saved_search_id),
  UNIQUE(search_name, version)
);

-- Search History (audit trail of all scans)
CREATE TABLE Search_History (
  search_id SERIAL PRIMARY KEY,
  scan_job_id VARCHAR(100) NOT NULL,
  search_timestamp TIMESTAMP DEFAULT NOW(),
  keywords_used TEXT[] NOT NULL,
  selected_tag_ids INTEGER[] NOT NULL,
  saved_search_id INTEGER REFERENCES Saved_Searches(saved_search_id),
  saved_search_version INTEGER,
  items_discovered INTEGER DEFAULT 0
);

-- Error Logs
CREATE TABLE Error_Logs (
  log_id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  component VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  scan_job_id VARCHAR(100)
);

-- Indexes for performance optimization
CREATE INDEX idx_review_queue_status ON Review_Queue(status);
CREATE INDEX idx_review_queue_discovered_at ON Review_Queue(discovered_at DESC);
CREATE INDEX idx_review_queue_content_type ON Review_Queue(content_type);
CREATE INDEX idx_timeline_archive_event_date ON Timeline_Archive(event_date);
CREATE INDEX idx_timeline_archive_content_type ON Timeline_Archive(content_type);
CREATE INDEX idx_content_tags_tag_id ON Content_Tags(tag_id);
CREATE INDEX idx_content_tags_content_id ON Content_Tags(content_id, table_name);
CREATE INDEX idx_tags_tag_group_id ON Tags(tag_group_id);
CREATE INDEX idx_search_history_timestamp ON Search_History(search_timestamp DESC);
CREATE INDEX idx_search_history_saved_search ON Search_History(saved_search_id, saved_search_version);
CREATE INDEX idx_saved_searches_name ON Saved_Searches(search_name);
CREATE INDEX idx_saved_searches_parent ON Saved_Searches(parent_search_id);
CREATE INDEX idx_keyword_config_active ON Keyword_Config(is_active);
CREATE INDEX idx_error_logs_timestamp ON Error_Logs(timestamp DESC);
CREATE INDEX idx_error_logs_component ON Error_Logs(component);

-- Comments for documentation
COMMENT ON TABLE Tag_Groups IS 'Hierarchical categories for organizing tags (e.g., People, UFO, Aliens, Theories)';
COMMENT ON TABLE Tags IS 'Specific values within tag groups (e.g., Jesse Marcel in People group)';
COMMENT ON TABLE Review_Queue IS 'Auto-discovered content awaiting admin review';
COMMENT ON TABLE Timeline_Archive IS 'Approved UFO events, people, theories, and news';
COMMENT ON TABLE Keyword_Config IS 'Search keywords and scanning parameters';
COMMENT ON TABLE Content_Tags IS 'Many-to-many relationship between content and tags';
COMMENT ON TABLE Saved_Searches IS 'Reusable search configurations with version tracking';
COMMENT ON TABLE Search_History IS 'Audit trail of all scan executions with tag filters';
COMMENT ON TABLE Error_Logs IS 'System error logging for troubleshooting';
