-- Seed script for initial tag groups and tags
-- This populates the database with predefined tag groups and tags for UFO content categorization

-- Insert Tag Groups
INSERT INTO Tag_Groups (group_name) VALUES
  ('People'),
  ('UFO'),
  ('Aliens'),
  ('Theories');

-- Insert Tags for People group
INSERT INTO Tags (tag_name, tag_group_id) VALUES
  ('Jesse Marcel', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'People')),
  ('Ross Coulthart', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'People'));

-- Insert Tags for UFO group
INSERT INTO Tags (tag_name, tag_group_id) VALUES
  ('UFO', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO')),
  ('Area51', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO')),
  ('Roswell', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO')),
  ('Aztec', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO')),
  ('Crash', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO')),
  ('Observation', (SELECT tag_group_id FROM Tag_Groups WHERE group_name = 'UFO'));

-- Insert Tags for Aliens group (placeholder for future expansion)
-- Additional tags can be added here as needed

-- Insert Tags for Theories group (placeholder for future expansion)
-- Additional tags can be added here as needed

-- Verify seed data
SELECT 
  tg.group_name,
  COUNT(t.tag_id) as tag_count,
  STRING_AGG(t.tag_name, ', ' ORDER BY t.tag_name) as tags
FROM Tag_Groups tg
LEFT JOIN Tags t ON tg.tag_group_id = t.tag_group_id
GROUP BY tg.tag_group_id, tg.group_name
ORDER BY tg.group_name;
