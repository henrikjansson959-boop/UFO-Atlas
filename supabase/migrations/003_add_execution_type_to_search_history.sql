-- Migration: Add Execution Type to Search_History
-- Add execution_type field to distinguish manual vs scheduled executions

ALTER TABLE Search_History
ADD COLUMN execution_type VARCHAR(20) DEFAULT 'manual' 
CHECK (execution_type IN ('manual', 'scheduled'));

-- Add index for filtering by execution type
CREATE INDEX idx_search_history_execution_type 
ON Search_History(execution_type);

-- Add column comment for documentation
COMMENT ON COLUMN Search_History.execution_type IS 'Classification of how the search was executed: manual (user-triggered) or scheduled (automated)';
