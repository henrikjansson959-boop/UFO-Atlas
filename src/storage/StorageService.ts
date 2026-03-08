import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ExtractedContent,
  ContentItem,
  Keyword,
  Tag,
  SavedSearch,
  ContentFilters,
  ScheduledSearchConfig,
  StorageService as IStorageService,
} from '../types';

/**
 * StorageService implementation with Supabase backend
 * Provides connection management, retry logic, and transaction support
 */
export class StorageService implements IStorageService {
  private client: SupabaseClient;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public',
      },
      auth: {
        persistSession: false,
      },
    });
  }

  /**
   * Execute a database operation with retry logic and exponential backoff
   * Validates: Requirements 3.13
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await new Promise<void>(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Insert content into review queue
   * Validates: Requirements 3.1, 3.2
   */
  async insertReviewQueue(
    content: ExtractedContent,
    isPotentialDuplicate: boolean
  ): Promise<number> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('review_queue')
        .insert({
          title: content.title,
          description: content.description,
          event_date: content.eventDate,
          source_url: content.sourceUrl,
          content_type: content.contentType,
          raw_html: content.rawHtml,
          status: 'pending',
          is_potential_duplicate: isPotentialDuplicate,
        })
        .select('content_id')
        .single();

      if (error) throw error;
      return data.content_id;
    }, 'insertReviewQueue');
  }

  /**
   * Approve content and move to timeline archive
   * Validates: Requirements 5.1, 5.2, 5.4, 11.11
   */
  async approveContent(contentId: number, adminUserId: string): Promise<void> {
    return this.withRetry(async () => {
      // Start transaction by fetching content and tags
      const { data: content, error: fetchError } = await this.client
        .from('review_queue')
        .select('*')
        .eq('content_id', contentId)
        .single();

      if (fetchError) throw fetchError;
      if (!content) throw new Error(`Content ${contentId} not found`);

      // Fetch assigned tags
      const { data: tags, error: tagsError } = await this.client
        .from('content_tags')
        .select('tag_id')
        .eq('content_id', contentId)
        .eq('table_name', 'Review_Queue');

      if (tagsError) throw tagsError;

      // Insert into Timeline_Archive
      const { data: archived, error: insertError } = await this.client
        .from('timeline_archive')
        .insert({
          title: content.title,
          description: content.description,
          event_date: content.event_date,
          source_url: content.source_url,
          content_type: content.content_type,
          approved_by: adminUserId,
        })
        .select('content_id')
        .single();

      if (insertError) throw insertError;

      // Copy tags to Timeline_Archive
      if (tags && tags.length > 0) {
        const tagInserts = tags.map((t: any) => ({
          content_id: archived.content_id,
          tag_id: t.tag_id,
          table_name: 'Timeline_Archive',
        }));

        const { error: tagCopyError } = await this.client
          .from('content_tags')
          .insert(tagInserts);

        if (tagCopyError) throw tagCopyError;
      }

      // Update Review_Queue status
      const { error: updateError } = await this.client
        .from('review_queue')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          reviewed_by: adminUserId,
        })
        .eq('content_id', contentId);

      if (updateError) throw updateError;
    }, 'approveContent');
  }

  /**
   * Reject content
   * Validates: Requirements 5.3, 5.4
   */
  async rejectContent(contentId: number, adminUserId: string): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('review_queue')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          reviewed_by: adminUserId,
        })
        .eq('content_id', contentId);

      if (error) throw error;
    }, 'rejectContent');
  }

  /**
   * Get pending content from review queue
   * Validates: Requirements 3.1, 4.2, 4.6, 11.10
   */
  async getPendingContent(filters?: ContentFilters): Promise<ContentItem[]> {
    return this.withRetry(async () => {
      let query = this.client
        .from('review_queue')
        .select(`
          content_id,
          title,
          description,
          event_date,
          source_url,
          content_type,
          raw_html,
          discovered_at,
          status,
          is_potential_duplicate
        `)
        .eq('status', 'pending')
        .order('discovered_at', { ascending: false });

      if (filters?.contentType) {
        query = query.eq('content_type', filters.contentType);
      }

      const { data: content, error } = await query;
      if (error) throw error;

      // Fetch tags for each content item
      const contentItems: ContentItem[] = [];
      for (const item of content || []) {
        const tags = await this.getContentTags(item.content_id, 'Review_Queue');
        
        // Apply tag filter if specified
        if (filters?.tagIds && filters.tagIds.length > 0) {
          const hasMatchingTag = tags.some(tag => 
            filters.tagIds!.includes(tag.tagId)
          );
          if (!hasMatchingTag) continue;
        }

        contentItems.push({
          contentId: item.content_id,
          title: item.title,
          description: item.description,
          eventDate: item.event_date ? new Date(item.event_date) : null,
          sourceUrl: item.source_url,
          contentType: item.content_type,
          rawHtml: item.raw_html,
          discoveredAt: new Date(item.discovered_at),
          status: item.status,
          isPotentialDuplicate: item.is_potential_duplicate,
          tags,
        });
      }

      return contentItems;
    }, 'getPendingContent');
  }

  /**
   * Helper method to get tags for a content item
   */
  private async getContentTags(contentId: number, tableName: string): Promise<Tag[]> {
    const { data, error } = await this.client
      .from('content_tags')
      .select(`
        tag_id,
        tags (
          tag_name,
          tag_group_id,
          tag_groups (
            group_name
          )
        )
      `)
      .eq('content_id', contentId)
      .eq('table_name', tableName);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      tagId: item.tag_id,
      tagName: item.tags.tag_name,
      tagGroupId: item.tags.tag_group_id,
      tagGroupName: item.tags.tag_groups.group_name,
      createdAt: new Date(),
    }));
  }

  /**
   * Add a new keyword
   * Validates: Requirements 6.1, 6.5
   */
  async addKeyword(keyword: string): Promise<number> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('keyword_config')
        .insert({
          keyword_text: keyword,
          is_active: true,
        })
        .select('keyword_id')
        .single();

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          throw new Error(`Keyword "${keyword}" already exists`);
        }
        throw error;
      }

      return data.keyword_id;
    }, 'addKeyword');
  }

  /**
   * Delete a keyword
   */
  async deleteKeyword(keywordId: number): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('keyword_config')
        .delete()
        .eq('keyword_id', keywordId);

      if (error) throw error;
    }, 'deleteKeyword');
  }

  /**
   * Activate a keyword
   * Validates: Requirements 6.2
   */
  async activateKeyword(keywordId: number): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('keyword_config')
        .update({ is_active: true })
        .eq('keyword_id', keywordId);

      if (error) throw error;
    }, 'activateKeyword');
  }

  /**
   * Deactivate a keyword
   * Validates: Requirements 6.2, 6.4
   */
  async deactivateKeyword(keywordId: number): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('keyword_config')
        .update({ is_active: false })
        .eq('keyword_id', keywordId);

      if (error) throw error;
    }, 'deactivateKeyword');
  }

  /**
   * Get active keywords
   * Validates: Requirements 1.1
   */
  async getActiveKeywords(): Promise<Keyword[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('keyword_config')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      return (data || []).map((k: any) => ({
        keywordId: k.keyword_id,
        keywordText: k.keyword_text,
        isActive: k.is_active,
        lastScanAt: k.last_scan_at ? new Date(k.last_scan_at) : null,
      }));
    }, 'getActiveKeywords');
  }

  /**
   * Get all keywords
   */
  async getKeywords(): Promise<Keyword[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('keyword_config')
        .select('*');

      if (error) throw error;

      return (data || []).map((k: any) => ({
        keywordId: k.keyword_id,
        keywordText: k.keyword_text,
        isActive: k.is_active,
        lastScanAt: k.last_scan_at ? new Date(k.last_scan_at) : null,
      }));
    }, 'getKeywords');
  }

  /**
   * Update last_scan_at timestamp for a keyword
   * Validates: Requirement 8.10
   */
  async updateKeywordLastScan(keywordId: number, timestamp: Date): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('keyword_config')
        .update({ last_scan_at: timestamp.toISOString() })
        .eq('keyword_id', keywordId);

      if (error) throw error;
    }, 'updateKeywordLastScan');
  }

  /**
   * Create a new tag
   * Validates: Requirements 11.7
   */
  async createTag(tagName: string, tagGroupId: number): Promise<number> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('tags')
        .insert({
          tag_name: tagName,
          tag_group_id: tagGroupId,
        })
        .select('tag_id')
        .single();

      if (error) throw error;
      return data.tag_id;
    }, 'createTag');
  }

  /**
   * Update a tag
   * Validates: Requirements 11.13
   */
  async updateTag(tagId: number, tagName: string): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('tags')
        .update({ tag_name: tagName })
        .eq('tag_id', tagId);

      if (error) throw error;
    }, 'updateTag');
  }

  /**
   * Delete a tag
   * Validates: Requirements 11.14
   */
  async deleteTag(tagId: number): Promise<void> {
    return this.withRetry(async () => {
      // Check if tag is in use
      const { data: usage, error: checkError } = await this.client
        .from('content_tags')
        .select('tag_id')
        .eq('tag_id', tagId)
        .limit(1);

      if (checkError) throw checkError;

      if (usage && usage.length > 0) {
        throw new Error(`Cannot delete tag ${tagId}: tag is assigned to content`);
      }

      const { error } = await this.client
        .from('tags')
        .delete()
        .eq('tag_id', tagId);

      if (error) throw error;
    }, 'deleteTag');
  }

  /**
   * Get tags by group
   */
  async getTagsByGroup(tagGroupId: number): Promise<Tag[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('tags')
        .select(`
          tag_id,
          tag_name,
          tag_group_id,
          created_at,
          tag_groups (
            group_name
          )
        `)
        .eq('tag_group_id', tagGroupId);

      if (error) throw error;

      return (data || []).map((t: any) => ({
        tagId: t.tag_id,
        tagName: t.tag_name,
        tagGroupId: t.tag_group_id,
        tagGroupName: t.tag_groups.group_name,
        createdAt: new Date(t.created_at),
      }));
    }, 'getTagsByGroup');
  }

  /**
   * Assign tags to content
   * Validates: Requirements 11.8
   */
  async assignTagsToContent(contentId: number, tagIds: number[]): Promise<void> {
    return this.withRetry(async () => {
      // Determine which table the content is in
      const { data: reviewQueue } = await this.client
        .from('review_queue')
        .select('content_id')
        .eq('content_id', contentId)
        .single();

      const tableName = reviewQueue ? 'Review_Queue' : 'Timeline_Archive';

      // Remove existing tags
      await this.client
        .from('content_tags')
        .delete()
        .eq('content_id', contentId)
        .eq('table_name', tableName);

      // Insert new tags
      if (tagIds.length > 0) {
        const inserts = tagIds.map(tagId => ({
          content_id: contentId,
          tag_id: tagId,
          table_name: tableName,
        }));

        const { error } = await this.client
          .from('content_tags')
          .insert(inserts);

        if (error) throw error;
      }
    }, 'assignTagsToContent');
  }

  /**
   * Record search history
   * Validates: Requirements 1.4, 1.5, 3.8, 3.10, 3.11, 3.12
   */
  async recordSearchHistory(
      scanJobId: string,
      keywordsUsed: string[],
      selectedTagIds: number[],
      itemsDiscovered: number,
      savedSearchId?: number,
      savedSearchVersion?: number
    ): Promise<number> {
      return this.withRetry(async () => {
        const { data, error } = await this.client
          .from('search_history')
          .insert({
            scan_job_id: scanJobId,
            keywords_used: keywordsUsed,
            selected_tag_ids: selectedTagIds,
            saved_search_id: savedSearchId || null,
            saved_search_version: savedSearchVersion || null,
            items_discovered: itemsDiscovered,
          })
          .select('search_id')
          .single();

        if (error) throw error;
        return data.search_id;
      }, 'recordSearchHistory');
    }

  /**
   * Record search history with execution type
   * Validates: Requirements 6.1, 6.2
   */
  async recordSearchHistoryWithType(
    scanJobId: string,
    keywordsUsed: string[],
    selectedTagIds: number[],
    itemsDiscovered: number,
    executionType: 'manual' | 'scheduled',
    savedSearchId?: number,
    savedSearchVersion?: number
  ): Promise<number> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('Search_History')
        .insert({
          scan_job_id: scanJobId,
          keywords_used: keywordsUsed,
          selected_tag_ids: selectedTagIds,
          saved_search_id: savedSearchId || null,
          saved_search_version: savedSearchVersion || null,
          items_discovered: itemsDiscovered,
          execution_type: executionType,
        })
        .select('search_id')
        .single();

      if (error) throw error;
      return data.search_id;
    }, 'recordSearchHistoryWithType');
  }

  /**
   * Get search history
   */
  async getSearchHistory(limit: number = 100): Promise<any[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('search_history')
        .select('*')
        .order('search_timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    }, 'getSearchHistory');
  }

  /**
   * Create a saved search
   * Validates: Requirements 12.1, 12.2, 12.8, 12.9
   */
  async createSavedSearch(
    searchName: string,
    keywordsUsed: string[],
    selectedTagIds: number[],
    createdBy: string,
    parentSearchId?: number
  ): Promise<SavedSearch> {
    return this.withRetry(async () => {
      let version = 1;

      // If this is a refinement, get the next version number
      if (parentSearchId) {
        const { data: parent, error: parentError } = await this.client
          .from('saved_searches')
          .select('version, search_name')
          .eq('saved_search_id', parentSearchId)
          .single();

        if (parentError) throw parentError;
        
        // Get the highest version for this search name
        const { data: versions, error: versionError } = await this.client
          .from('saved_searches')
          .select('version')
          .eq('search_name', parent.search_name)
          .order('version', { ascending: false })
          .limit(1);

        if (versionError) throw versionError;
        
        version = versions && versions.length > 0 ? versions[0].version + 1 : 1;
        searchName = parent.search_name; // Use the same name for refinements
      }

      const { data, error } = await this.client
        .from('saved_searches')
        .insert({
          search_name: searchName,
          version,
          keywords_used: keywordsUsed,
          selected_tag_ids: selectedTagIds,
          created_by: createdBy,
          parent_search_id: parentSearchId || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      return {
        savedSearchId: data.saved_search_id,
        searchName: data.search_name,
        version: data.version,
        keywordsUsed: data.keywords_used,
        selectedTagIds: data.selected_tag_ids,
        createdAt: new Date(data.created_at),
        createdBy: data.created_by,
        parentSearchId: data.parent_search_id,
      };
    }, 'createSavedSearch');
  }

  /**
   * Get all saved searches
   * Validates: Requirements 12.3
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('saved_searches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        savedSearchId: s.saved_search_id,
        searchName: s.search_name,
        version: s.version,
        keywordsUsed: s.keywords_used,
        selectedTagIds: s.selected_tag_ids,
        createdAt: new Date(s.created_at),
        createdBy: s.created_by,
        parentSearchId: s.parent_search_id,
      }));
    }, 'getSavedSearches');
  }

  /**
   * Get all versions of a saved search
   * Validates: Requirements 12.10
   */
  async getSavedSearchVersions(searchName: string): Promise<SavedSearch[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('saved_searches')
        .select('*')
        .eq('search_name', searchName)
        .order('version', { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        savedSearchId: s.saved_search_id,
        searchName: s.search_name,
        version: s.version,
        keywordsUsed: s.keywords_used,
        selectedTagIds: s.selected_tag_ids,
        createdAt: new Date(s.created_at),
        createdBy: s.created_by,
        parentSearchId: s.parent_search_id,
      }));
    }, 'getSavedSearchVersions');
  }

  /**
   * Delete a saved search
   * Validates: Requirements 12.13, 12.14
   */
  async deleteSavedSearch(savedSearchId: number): Promise<void> {
    return this.withRetry(async () => {
      // Note: Search_History records are preserved due to foreign key constraint
      const { error } = await this.client
        .from('saved_searches')
        .delete()
        .eq('saved_search_id', savedSearchId);

      if (error) throw error;
    }, 'deleteSavedSearch');
  }
  /**
   * Update schedule configuration for saved search
   * Validates: Requirements 1.2, 1.4, 8.1, 8.2
   */
  async updateSavedSearchSchedule(
    savedSearchId: number,
    scheduleEnabled: boolean,
    cronExpression: string | null,
    nextRunAt: Date | null
  ): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('Saved_Searches')
        .update({
          schedule_enabled: scheduleEnabled,
          cron_expression: cronExpression,
          next_run_at: nextRunAt ? nextRunAt.toISOString() : null,
        })
        .eq('saved_search_id', savedSearchId);

      if (error) throw error;
    }, 'updateSavedSearchSchedule');
  }

  /**
   * Get saved search with schedule configuration
   * Validates: Requirements 1.2, 1.4, 8.1, 8.2
   */
  async getSavedSearchWithSchedule(savedSearchId: number): Promise<SavedSearch & {
    scheduleEnabled: boolean;
    cronExpression: string | null;
    nextRunAt: Date | null;
    lastRunAt: Date | null;
  }> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('Saved_Searches')
        .select('*')
        .eq('saved_search_id', savedSearchId)
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Saved search ${savedSearchId} not found`);

      return {
        savedSearchId: data.saved_search_id,
        searchName: data.search_name,
        version: data.version,
        keywordsUsed: data.keywords_used,
        selectedTagIds: data.selected_tag_ids,
        createdAt: new Date(data.created_at),
        createdBy: data.created_by,
        parentSearchId: data.parent_search_id,
        scheduleEnabled: data.schedule_enabled || false,
        cronExpression: data.cron_expression || null,
        nextRunAt: data.next_run_at ? new Date(data.next_run_at) : null,
        lastRunAt: data.last_run_at ? new Date(data.last_run_at) : null,
      };
    }, 'getSavedSearchWithSchedule');
  }

  /**
   * Get all due scheduled searches
   * Returns searches where schedule_enabled=true AND next_run_at <= NOW()
   * Validates: Requirements 5.1
   */
  async getDueScheduledSearches(): Promise<ScheduledSearchConfig[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('Saved_Searches')
        .select('*')
        .eq('schedule_enabled', true)
        .lte('next_run_at', new Date().toISOString());

      if (error) throw error;

      return (data || []).map((row: any) => ({
        savedSearchId: row.saved_search_id,
        searchName: row.search_name,
        cronExpression: row.cron_expression,
        nextRunAt: new Date(row.next_run_at),
        lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
        keywordsUsed: row.keywords_used,
        selectedTagIds: row.selected_tag_ids,
      }));
    }, 'getDueScheduledSearches');
  }

  /**
   * Update last_run_at and next_run_at after scheduled execution
   * Validates: Requirements 5.2, 5.3
   */
  async updateScheduledSearchExecution(
    savedSearchId: number,
    lastRunAt: Date,
    nextRunAt: Date
  ): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await this.client
        .from('Saved_Searches')
        .update({
          last_run_at: lastRunAt.toISOString(),
          next_run_at: nextRunAt.toISOString(),
        })
        .eq('saved_search_id', savedSearchId);

      if (error) throw error;
    }, 'updateScheduledSearchExecution');
  }
}

