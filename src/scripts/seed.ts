/**
 * Seed script for initial tag groups and tags
 * Run this script to populate the database with predefined tag groups and tags
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('Starting database seeding...');

  try {
    // Insert Tag Groups
    console.log('Creating tag groups...');
    const { data: tagGroups, error: tagGroupError } = await supabase
      .from('Tag_Groups')
      .insert([
        { group_name: 'People' },
        { group_name: 'UFO' },
        { group_name: 'Aliens' },
        { group_name: 'Theories' }
      ])
      .select();

    if (tagGroupError) {
      console.error('Error creating tag groups:', tagGroupError);
      throw tagGroupError;
    }

    console.log(`Created ${tagGroups?.length} tag groups`);

    // Get tag group IDs
    const peopleGroup = tagGroups?.find(g => g.group_name === 'People');
    const ufoGroup = tagGroups?.find(g => g.group_name === 'UFO');

    if (!peopleGroup || !ufoGroup) {
      throw new Error('Failed to retrieve tag group IDs');
    }

    // Insert Tags for People group
    console.log('Creating tags for People group...');
    const { data: peopleTags, error: peopleTagsError } = await supabase
      .from('Tags')
      .insert([
        { tag_name: 'Jesse Marcel', tag_group_id: peopleGroup.tag_group_id },
        { tag_name: 'Ross Coulthart', tag_group_id: peopleGroup.tag_group_id }
      ])
      .select();

    if (peopleTagsError) {
      console.error('Error creating people tags:', peopleTagsError);
      throw peopleTagsError;
    }

    console.log(`Created ${peopleTags?.length} tags in People group`);

    // Insert Tags for UFO group
    console.log('Creating tags for UFO group...');
    const { data: ufoTags, error: ufoTagsError } = await supabase
      .from('Tags')
      .insert([
        { tag_name: 'UFO', tag_group_id: ufoGroup.tag_group_id },
        { tag_name: 'Area51', tag_group_id: ufoGroup.tag_group_id },
        { tag_name: 'Roswell', tag_group_id: ufoGroup.tag_group_id },
        { tag_name: 'Aztec', tag_group_id: ufoGroup.tag_group_id },
        { tag_name: 'Crash', tag_group_id: ufoGroup.tag_group_id },
        { tag_name: 'Observation', tag_group_id: ufoGroup.tag_group_id }
      ])
      .select();

    if (ufoTagsError) {
      console.error('Error creating UFO tags:', ufoTagsError);
      throw ufoTagsError;
    }

    console.log(`Created ${ufoTags?.length} tags in UFO group`);

    // Verify seed data
    console.log('\nVerifying seed data...');
    const { data: allGroups, error: verifyError } = await supabase
      .from('Tag_Groups')
      .select('*, Tags(*)');

    if (verifyError) {
      console.error('Error verifying seed data:', verifyError);
      throw verifyError;
    }

    console.log('\nSeed data summary:');
    allGroups?.forEach(group => {
      console.log(`- ${group.group_name}: ${group.Tags?.length || 0} tags`);
      group.Tags?.forEach((tag: any) => {
        console.log(`  - ${tag.tag_name}`);
      });
    });

    console.log('\n✓ Database seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
