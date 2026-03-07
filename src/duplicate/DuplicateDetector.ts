import * as levenshtein from 'fast-levenshtein';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ExtractedContent,
  DuplicateCheckResult,
  DuplicateDetector as IDuplicateDetector,
} from '../types';

/**
 * DuplicateDetector checks for duplicate content before storage
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */
export class DuplicateDetector implements IDuplicateDetector {
  private client: SupabaseClient;
  private readonly SIMILARITY_THRESHOLD = 0.9; // 90% similarity threshold

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
   * Check if content is a duplicate
   * @param content - Content to check
   * @returns Duplicate check result
   * 
   * Validates:
   * - Requirement 7.1: Check if source_url exists in Review_Queue
   * - Requirement 7.2: Check if source_url exists in Timeline_Archive
   * - Requirement 7.3: Check for title similarity above 90%
   * - Requirement 7.4: Flag as potential_duplicate if similar title exists
   */
  async checkDuplicate(content: ExtractedContent): Promise<DuplicateCheckResult> {
    // Requirement 7.1: Check if source_url exists in Review_Queue
    const reviewQueueDuplicate = await this.checkSourceUrlInTable(
      content.sourceUrl,
      'Review_Queue'
    );

    if (reviewQueueDuplicate) {
      return {
        isDuplicate: true,
        isPotentialDuplicate: false,
        matchedContentId: reviewQueueDuplicate.contentId,
      };
    }

    // Requirement 7.2: Check if source_url exists in Timeline_Archive
    const timelineArchiveDuplicate = await this.checkSourceUrlInTable(
      content.sourceUrl,
      'Timeline_Archive'
    );

    if (timelineArchiveDuplicate) {
      return {
        isDuplicate: true,
        isPotentialDuplicate: false,
        matchedContentId: timelineArchiveDuplicate.contentId,
      };
    }

    // Requirements 7.3, 7.4: Check for title similarity above 90%
    const similarContent = await this.checkTitleSimilarity(content.title);

    if (similarContent) {
      return {
        isDuplicate: false,
        isPotentialDuplicate: true,
        matchedContentId: similarContent.contentId,
        similarityScore: similarContent.similarityScore,
      };
    }

    // No duplicates found
    return {
      isDuplicate: false,
      isPotentialDuplicate: false,
    };
  }

  /**
   * Check if source_url exists in a specific table
   * @param sourceUrl - Source URL to check
   * @param tableName - Table name to check (Review_Queue or Timeline_Archive)
   * @returns Content ID if found, null otherwise
   */
  private async checkSourceUrlInTable(
    sourceUrl: string,
    tableName: 'Review_Queue' | 'Timeline_Archive'
  ): Promise<{ contentId: number } | null> {
    const { data, error } = await this.client
      .from(tableName)
      .select('content_id')
      .eq('source_url', sourceUrl)
      .limit(1)
      .single();

    if (error) {
      // No match found (PGRST116 is "no rows returned")
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? { contentId: data.content_id } : null;
  }

  /**
   * Check for title similarity above threshold
   * @param title - Title to check
   * @returns Content ID and similarity score if similar title found, null otherwise
   */
  private async checkTitleSimilarity(
    title: string
  ): Promise<{ contentId: number; similarityScore: number } | null> {
    // Fetch all titles from both tables
    const reviewQueueTitles = await this.fetchTitlesFromTable('Review_Queue');
    const timelineArchiveTitles = await this.fetchTitlesFromTable('Timeline_Archive');

    const allTitles = [...reviewQueueTitles, ...timelineArchiveTitles];

    // Calculate similarity for each title
    for (const item of allTitles) {
      const similarity = this.calculateSimilarity(title, item.title);

      if (similarity > this.SIMILARITY_THRESHOLD) {
        return {
          contentId: item.contentId,
          similarityScore: similarity,
        };
      }
    }

    return null;
  }

  /**
   * Fetch all titles from a specific table
   * @param tableName - Table name to fetch from
   * @returns Array of content items with ID and title
   */
  private async fetchTitlesFromTable(
    tableName: 'Review_Queue' | 'Timeline_Archive'
  ): Promise<Array<{ contentId: number; title: string }>> {
    const { data, error } = await this.client
      .from(tableName)
      .select('content_id, title');

    if (error) throw error;

    return (data || []).map((item: any) => ({
      contentId: item.content_id,
      title: item.title,
    }));
  }

  /**
   * Calculate similarity between two titles using Levenshtein distance
   * @param title1 - First title
   * @param title2 - Second title
   * @returns Similarity score between 0 and 1 (1 = identical)
   */
  private calculateSimilarity(title1: string, title2: string): number {
    // Normalize titles for comparison (lowercase, trim)
    const normalized1 = title1.toLowerCase().trim();
    const normalized2 = title2.toLowerCase().trim();

    // Handle edge cases
    if (normalized1 === normalized2) return 1.0;
    if (normalized1.length === 0 || normalized2.length === 0) return 0.0;

    // Calculate Levenshtein distance
    const distance = levenshtein.get(normalized1, normalized2);

    // Convert distance to similarity score (0-1 range)
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - distance / maxLength;

    return similarity;
  }
}
