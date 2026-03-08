-- Migration: Add Scheduling Fields to Saved_Searches
-- Add scheduling fields to Saved_Searches table for automated search execution

ALTER TABLE Saved_Searches
ADD COLUMN schedule_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN cron_expression TEXT,
ADD COLUMN next_run_at TIMESTAMP,
ADD COLUMN last_run_at TIMESTAMP;

-- Add index for efficient querying of due scheduled searches
CREATE INDEX idx_saved_searches_next_run 
ON Saved_Searches(next_run_at) 
WHERE schedule_enabled = TRUE;

-- Add check constraint to ensure cron_expression is set when schedule_enabled is true
ALTER TABLE Saved_Searches
ADD CONSTRAINT chk_schedule_config 
CHECK (
  (schedule_enabled = FALSE) OR 
  (schedule_enabled = TRUE AND cron_expression IS NOT NULL)
);

-- Add column comments for documentation
COMMENT ON COLUMN Saved_Searches.schedule_enabled IS 'Whether automated scheduling is enabled for this saved search';
COMMENT ON COLUMN Saved_Searches.cron_expression IS 'Cron expression defining the schedule (e.g., "0 * * * *" for hourly)';
COMMENT ON COLUMN Saved_Searches.next_run_at IS 'Calculated timestamp for next scheduled execution';
COMMENT ON COLUMN Saved_Searches.last_run_at IS 'Timestamp of last scheduled execution';
