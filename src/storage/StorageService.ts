import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ExtractedContent,
  ContentItem,
  ApprovedContentItem,
  PersonCase,
  PersonProfile,
  PersonProfileSummary,
  PersonSource,
  CaseDetail,
  CaseSummary,
  AdminCaseInput,
  AdminCaseRecord,
  AdminCasesWorkspace,
  AdminPersonInput,
  Keyword,
  Tag,
  SavedSearch,
  ContentFilters,
  ScheduledSearchConfig,
  SourceMaterialType,
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
  private readonly maxRawHtmlLength = 40000;
  private readonly maxExtractedTextLength = 4000;
  private reviewQueueSupportsEnrichment: boolean | null = null;

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
      const sanitizedContent = this.sanitizeExtractedContent(content);
      const baseInsert = {
        title: sanitizedContent.title,
        description: sanitizedContent.description,
        event_date: sanitizedContent.eventDate,
        source_url: sanitizedContent.sourceUrl,
        content_type: sanitizedContent.contentType,
        raw_html: sanitizedContent.rawHtml,
        status: 'pending',
        is_potential_duplicate: isPotentialDuplicate,
      };
      const enrichedInsert = {
        ...baseInsert,
        extracted_text: sanitizedContent.extractedText ?? null,
        source_type: sanitizedContent.sourceType ?? null,
        evidence_excerpt: sanitizedContent.evidenceExcerpt ?? null,
        relevance_label: sanitizedContent.relevanceLabel ?? null,
        relevance_reason: sanitizedContent.relevanceReason ?? null,
        people: sanitizedContent.people ?? [],
        organizations: sanitizedContent.organizations ?? [],
        case_topics: sanitizedContent.caseTopics ?? [],
        image_urls: sanitizedContent.imageUrls ?? [],
        related_topics: sanitizedContent.relatedTopics ?? [],
        follow_up_queries: sanitizedContent.followUpQueries ?? [],
      };

      let data: { content_id: number } | null = null;
      let error: any = null;

      if (this.reviewQueueSupportsEnrichment === false) {
        ({ data, error } = await this.client
          .from('review_queue')
          .insert(baseInsert)
          .select('content_id')
          .single());
      } else {
        ({ data, error } = await this.client
          .from('review_queue')
          .insert(enrichedInsert)
          .select('content_id')
          .single());

        if (error && this.isMissingReviewQueueEnrichmentError(error)) {
          this.reviewQueueSupportsEnrichment = false;
          ({ data, error } = await this.client
            .from('review_queue')
            .insert(baseInsert)
            .select('content_id')
            .single());
        } else if (!error) {
          this.reviewQueueSupportsEnrichment = true;
        }
      }

      if (error) throw error;
      if (!data) {
        throw new Error('Review queue insert returned no content_id');
      }
      return data.content_id;
    }, 'insertReviewQueue');
  }

  private sanitizeExtractedContent(content: ExtractedContent): ExtractedContent {
    return {
      ...content,
      title: this.truncateText(content.title, 500),
      description: this.truncateText(content.description, 1200),
      rawHtml: this.truncateText(content.rawHtml, this.maxRawHtmlLength),
      extractedText: this.truncateOptionalText(content.extractedText, this.maxExtractedTextLength),
      people: this.sanitizeTextArray(content.people),
      organizations: this.sanitizeTextArray(content.organizations),
      caseTopics: this.sanitizeTextArray(content.caseTopics),
      imageUrls: this.sanitizeTextArray(content.imageUrls),
      relatedTopics: this.sanitizeTextArray(content.relatedTopics),
      followUpQueries: this.sanitizeTextArray(content.followUpQueries),
    };
  }

  private sanitizeTextArray(values?: string[]): string[] {
    return Array.from(
      new Set(
        (values ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .map((value) => this.truncateText(value, 300)),
      ),
    );
  }

  private truncateOptionalText(value: string | undefined, maxLength: number): string | undefined {
    return value ? this.truncateText(value, maxLength) : undefined;
  }

  private truncateText(value: string, maxLength: number): string {
    const normalizedValue = value.replace(/\0/g, '').trim();
    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, Math.max(0, maxLength - 1))}…`;
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
      const baseColumns = `
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
      `;
      const enrichedColumns = `
        ${baseColumns},
        extracted_text,
        source_type,
        evidence_excerpt,
        relevance_label,
        relevance_reason,
        people,
        organizations,
        case_topics,
        image_urls,
        related_topics,
        follow_up_queries
      `;

      const buildQuery = (selectClause: string) => {
        let query = this.client
          .from('review_queue')
          .select(selectClause)
          .eq('status', 'pending')
          .order('discovered_at', { ascending: false });

        if (filters?.contentType) {
          query = query.eq('content_type', filters.contentType);
        }

        return query;
      };

      let content: any[] | null = null;
      let error: any = null;

      if (this.reviewQueueSupportsEnrichment === false) {
        ({ data: content, error } = await buildQuery(baseColumns));
      } else {
        ({ data: content, error } = await buildQuery(enrichedColumns));

        if (error && this.isMissingReviewQueueEnrichmentError(error)) {
          this.reviewQueueSupportsEnrichment = false;
          ({ data: content, error } = await buildQuery(baseColumns));
        } else if (!error) {
          this.reviewQueueSupportsEnrichment = true;
        }
      }

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
          extractedText: item.extracted_text ?? '',
          sourceType: this.deriveSourceType(item.source_type, item.source_url, item.title, item.description),
          evidenceExcerpt: item.evidence_excerpt ?? this.deriveEvidenceExcerpt(item.extracted_text, item.description),
          relevanceLabel: item.relevance_label ?? this.deriveRelevanceLabel(item.content_type, item.source_type ?? null),
          relevanceReason: item.relevance_reason ?? this.deriveRelevanceReason(item.extracted_text, item.people, item.organizations, item.case_topics),
          people: Array.isArray(item.people) ? item.people : [],
          organizations: Array.isArray(item.organizations) ? item.organizations : [],
          caseTopics: Array.isArray(item.case_topics) ? item.case_topics : [],
          imageUrls: Array.isArray(item.image_urls) ? item.image_urls : [],
          relatedTopics: Array.isArray(item.related_topics) ? item.related_topics : [],
          followUpQueries: Array.isArray(item.follow_up_queries) ? item.follow_up_queries : [],
          discoveredAt: new Date(item.discovered_at),
          status: item.status,
          isPotentialDuplicate: item.is_potential_duplicate,
          tags,
        });
      }

      return contentItems;
    }, 'getPendingContent');
  }

  async getPendingContentById(contentId: number): Promise<ContentItem | null> {
    const items = await this.getPendingContent();
    return items.find((item) => item.contentId === contentId) ?? null;
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
   * Get approved content for the public content library.
   * The archive currently stores the core approved fields, so source material
   * type is derived from those fields when the enriched queue record is moved.
   */
  async getApprovedContent(): Promise<ApprovedContentItem[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('timeline_archive')
        .select(`
          content_id,
          title,
          description,
          event_date,
          source_url,
          content_type,
          approved_at
        `)
        .order('approved_at', { ascending: false });

      if (error) throw error;

      const contentItems: ApprovedContentItem[] = [];
      for (const item of data || []) {
        const tags = await this.getContentTags(item.content_id, 'Timeline_Archive');
        contentItems.push({
          contentId: item.content_id,
          title: item.title,
          description: item.description ?? '',
          eventDate: item.event_date ? new Date(item.event_date) : null,
          sourceUrl: item.source_url,
          contentType: item.content_type,
          sourceType: this.deriveSourceType(null, item.source_url, item.title, item.description ?? ''),
          approvedAt: new Date(item.approved_at),
          tags,
        });
      }

      return contentItems;
    }, 'getApprovedContent');
  }

  async getPeople(): Promise<PersonProfileSummary[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('people_profiles')
        .select(`
          person_id,
          slug,
          full_name,
          aliases,
          role,
          birth_year,
          death_year,
          photo_url,
          biography,
          person_content_links(content_id),
          person_case_links(case_id),
          person_sources(source_id)
        `)
        .eq('is_published', true)
        .order('full_name', { ascending: true });

      if (error) {
        if (this.isMissingPeopleSchemaError(error)) return [];
        throw error;
      }

      return (data || []).map((row: any) => this.mapPersonSummary(row));
    }, 'getPeople');
  }

  async getPersonBySlug(slug: string): Promise<PersonProfile | null> {
    return this.withRetry(async () => {
      const { data: profile, error: profileError } = await this.client
        .from('people_profiles')
        .select(`
          person_id,
          slug,
          full_name,
          aliases,
          role,
          birth_year,
          death_year,
          photo_url,
          biography
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (profileError) {
        if (this.isMissingPeopleSchemaError(profileError)) return null;
        throw profileError;
      }
      if (!profile) return null;

      const [contentLinksResult, caseLinksResult, sourcesResult] = await Promise.all([
        this.client
          .from('person_content_links')
          .select('content_id')
          .eq('person_id', profile.person_id),
        this.client
          .from('person_case_links')
          .select(`
            ufo_cases!inner(
              case_id,
              slug,
              title,
              summary,
              event_date,
              location,
              source_url,
              is_published
            )
          `)
          .eq('person_id', profile.person_id)
          .eq('ufo_cases.is_published', true),
        this.client
          .from('person_sources')
          .select('source_id, title, publisher, published_at, source_url, notes')
          .eq('person_id', profile.person_id)
          .order('published_at', { ascending: false, nullsFirst: false }),
      ]);

      if (contentLinksResult.error) throw contentLinksResult.error;
      if (caseLinksResult.error) throw caseLinksResult.error;
      if (sourcesResult.error) throw sourcesResult.error;

      const contentIds = (contentLinksResult.data || []).map((link: any) => link.content_id);
      const relatedContent = await this.getApprovedContentByIds(contentIds);
      const relatedCases = (caseLinksResult.data || [])
        .map((link: any) => link.ufo_cases)
        .filter(Boolean)
        .map((item: any): PersonCase => ({
          caseId: item.case_id,
          slug: item.slug,
          title: item.title,
          summary: item.summary ?? '',
          eventDate: item.event_date ? new Date(item.event_date) : null,
          location: item.location ?? null,
          sourceUrl: item.source_url ?? null,
        }));
      const sources = (sourcesResult.data || []).map((item: any): PersonSource => ({
        sourceId: item.source_id,
        title: item.title,
        publisher: item.publisher ?? null,
        publishedAt: item.published_at ? new Date(item.published_at) : null,
        sourceUrl: item.source_url,
        notes: item.notes ?? null,
      }));

      return {
        ...this.mapPersonSummary({
          ...profile,
          person_content_links: contentLinksResult.data || [],
          person_case_links: caseLinksResult.data || [],
          person_sources: sourcesResult.data || [],
        }),
        relatedContent,
        relatedCases,
        sources,
      };
    }, 'getPersonBySlug');
  }

  async getCases(): Promise<CaseSummary[]> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('ufo_cases')
        .select(`
          case_id,
          slug,
          title,
          summary,
          event_date,
          location,
          case_status,
          cover_image_url,
          source_url,
          case_content_links(content_id),
          person_case_links(person_id)
        `)
        .eq('is_published', true)
        .order('event_date', { ascending: false, nullsFirst: false });

      if (error) {
        if (this.isMissingCaseSchemaError(error)) return [];
        throw error;
      }

      const cases: CaseSummary[] = [];
      for (const row of data || []) {
        const contentIds = Array.isArray(row.case_content_links)
          ? row.case_content_links.map((link: any) => link.content_id)
          : [];
        const materials = await this.getApprovedContentByIds(contentIds);
        cases.push(this.mapCaseSummary(row, materials));
      }
      return cases;
    }, 'getCases');
  }

  async getCaseBySlug(slug: string): Promise<CaseDetail | null> {
    return this.withRetry(async () => {
      const { data: caseRow, error: caseError } = await this.client
        .from('ufo_cases')
        .select(`
          case_id,
          slug,
          title,
          summary,
          event_date,
          location,
          case_status,
          cover_image_url,
          source_url
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();

      if (caseError) {
        if (this.isMissingCaseSchemaError(caseError)) return null;
        throw caseError;
      }
      if (!caseRow) return null;

      const [contentLinksResult, peopleLinksResult] = await Promise.all([
        this.client
          .from('case_content_links')
          .select('content_id')
          .eq('case_id', caseRow.case_id),
        this.client
          .from('person_case_links')
          .select(`
            people_profiles!inner(
              person_id,
              slug,
              full_name,
              aliases,
              role,
              birth_year,
              death_year,
              photo_url,
              biography,
              is_published,
              person_content_links(content_id),
              person_case_links(case_id),
              person_sources(source_id)
            )
          `)
          .eq('case_id', caseRow.case_id)
          .eq('people_profiles.is_published', true),
      ]);

      if (contentLinksResult.error) throw contentLinksResult.error;
      if (peopleLinksResult.error) throw peopleLinksResult.error;

      const contentIds = (contentLinksResult.data || []).map((link: any) => link.content_id);
      const materials = await this.getApprovedContentByIds(contentIds);
      const relatedPeople = (peopleLinksResult.data || [])
        .map((link: any) => link.people_profiles)
        .filter(Boolean)
        .map((person: any) => this.mapPersonSummary(person));

      return {
        ...this.mapCaseSummary(
          {
            ...caseRow,
            person_case_links: peopleLinksResult.data || [],
          },
          materials,
        ),
        relatedPeople,
        materials,
      };
    }, 'getCaseBySlug');
  }

  async getAdminCases(): Promise<AdminCasesWorkspace> {
    return this.withRetry(async () => {
      const { data, error } = await this.client
        .from('ufo_cases')
        .select(`
          case_id,
          slug,
          title,
          summary,
          event_date,
          location,
          case_status,
          cover_image_url,
          source_url,
          is_published,
          case_content_links(content_id),
          person_case_links(person_id)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        if (this.isMissingCaseSchemaError(error)) {
          return { cases: [], schemaReady: false };
        }
        throw error;
      }

      const cases: AdminCaseRecord[] = [];
      for (const row of data || []) {
        const contentIds = Array.isArray(row.case_content_links)
          ? row.case_content_links.map((link: any) => Number(link.content_id))
          : [];
        const personIds = Array.isArray(row.person_case_links)
          ? row.person_case_links.map((link: any) => Number(link.person_id))
          : [];
        const materials = await this.getApprovedContentByIds(contentIds);

        cases.push({
          ...this.mapCaseSummary(row, materials),
          isPublished: row.is_published === true,
          contentIds,
          personIds,
        });
      }

      return { cases, schemaReady: true };
    }, 'getAdminCases');
  }

  async saveAdminCase(caseId: number | null, input: AdminCaseInput): Promise<number> {
    return this.withRetry(async () => {
      const casePayload = {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        event_date: input.eventDate ? input.eventDate.toISOString().slice(0, 10) : null,
        location: input.location,
        case_status: input.caseStatus,
        cover_image_url: input.coverImageUrl,
        source_url: input.sourceUrl,
        is_published: input.isPublished,
        updated_at: new Date().toISOString(),
      };

      const caseResult = caseId === null
        ? await this.client
            .from('ufo_cases')
            .insert(casePayload)
            .select('case_id')
            .single()
        : await this.client
            .from('ufo_cases')
            .update(casePayload)
            .eq('case_id', caseId)
            .select('case_id')
            .single();

      if (caseResult.error) throw caseResult.error;
      const savedCaseId = Number(caseResult.data.case_id);

      const [deleteContentLinks, deletePersonLinks] = await Promise.all([
        this.client.from('case_content_links').delete().eq('case_id', savedCaseId),
        this.client.from('person_case_links').delete().eq('case_id', savedCaseId),
      ]);
      if (deleteContentLinks.error) throw deleteContentLinks.error;
      if (deletePersonLinks.error) throw deletePersonLinks.error;

      const contentIds = Array.from(new Set(input.contentIds));
      const personIds = Array.from(new Set(input.personIds));
      if (contentIds.length > 0) {
        const { error } = await this.client.from('case_content_links').insert(
          contentIds.map((contentId) => ({
            case_id: savedCaseId,
            content_id: contentId,
          })),
        );
        if (error) throw error;
      }
      if (personIds.length > 0) {
        const { error } = await this.client.from('person_case_links').insert(
          personIds.map((personId) => ({
            case_id: savedCaseId,
            person_id: personId,
          })),
        );
        if (error) throw error;
      }

      return savedCaseId;
    }, 'saveAdminCase');
  }

  async saveAdminPerson(input: AdminPersonInput): Promise<number> {
    return this.withRetry(async () => {
      const { data: profile, error: profileError } = await this.client
        .from('people_profiles')
        .insert({
          slug: input.slug,
          full_name: input.fullName,
          aliases: input.aliases,
          role: input.role,
          birth_year: input.birthYear,
          death_year: input.deathYear,
          photo_url: input.photoUrl,
          biography: input.biography,
          is_published: input.isPublished,
          updated_at: new Date().toISOString(),
        })
        .select('person_id')
        .single();

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error(`A person profile already uses the slug "${input.slug}"`);
        }
        throw profileError;
      }

      const personId = Number(profile.person_id);
      const { error: sourceError } = await this.client
        .from('person_sources')
        .insert({
          person_id: personId,
          title: input.sourceTitle,
          source_url: input.sourceUrl,
          notes: input.sourceNotes,
        });

      if (sourceError) {
        await this.client.from('people_profiles').delete().eq('person_id', personId);
        throw sourceError;
      }

      return personId;
    }, 'saveAdminPerson');
  }

  private mapPersonSummary(row: any): PersonProfileSummary {
    return {
      personId: row.person_id,
      slug: row.slug,
      fullName: row.full_name,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      role: row.role,
      birthYear: row.birth_year ?? null,
      deathYear: row.death_year ?? null,
      photoUrl: row.photo_url ?? null,
      biography: row.biography,
      relatedContentCount: Array.isArray(row.person_content_links)
        ? row.person_content_links.length
        : 0,
      relatedCaseCount: Array.isArray(row.person_case_links)
        ? row.person_case_links.length
        : 0,
      sourceCount: Array.isArray(row.person_sources) ? row.person_sources.length : 0,
    };
  }

  private mapCaseSummary(row: any, materials: ApprovedContentItem[]): CaseSummary {
    const materialBreakdown: Partial<Record<SourceMaterialType, number>> = {};
    for (const material of materials) {
      materialBreakdown[material.sourceType] =
        (materialBreakdown[material.sourceType] ?? 0) + 1;
    }

    return {
      caseId: row.case_id,
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? '',
      eventDate: row.event_date ? new Date(row.event_date) : null,
      location: row.location ?? null,
      caseStatus: row.case_status ?? 'Documented',
      coverImageUrl: row.cover_image_url ?? null,
      sourceUrl: row.source_url ?? null,
      relatedPeopleCount: Array.isArray(row.person_case_links)
        ? row.person_case_links.length
        : 0,
      materialCount: materials.length,
      materialBreakdown,
    };
  }

  private async getApprovedContentByIds(contentIds: number[]): Promise<ApprovedContentItem[]> {
    if (contentIds.length === 0) return [];

    const { data, error } = await this.client
      .from('timeline_archive')
      .select(`
        content_id,
        title,
        description,
        event_date,
        source_url,
        content_type,
        approved_at
      `)
      .in('content_id', contentIds)
      .order('approved_at', { ascending: false });

    if (error) throw error;

    const items: ApprovedContentItem[] = [];
    for (const item of data || []) {
      items.push({
        contentId: item.content_id,
        title: item.title,
        description: item.description ?? '',
        eventDate: item.event_date ? new Date(item.event_date) : null,
        sourceUrl: item.source_url,
        contentType: item.content_type,
        sourceType: this.deriveSourceType(
          null,
          item.source_url,
          item.title,
          item.description ?? '',
        ),
        approvedAt: new Date(item.approved_at),
        tags: await this.getContentTags(item.content_id, 'Timeline_Archive'),
      });
    }

    return items;
  }

  private isMissingReviewQueueEnrichmentError(error: unknown): boolean {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : String(error).toLowerCase();

    return (
        message.includes('review_queue') &&
        message.includes('does not exist') &&
        (
          message.includes('extracted_text') ||
          message.includes('source_type') ||
          message.includes('evidence_excerpt') ||
          message.includes('relevance_label') ||
          message.includes('relevance_reason') ||
          message.includes('people') ||
          message.includes('organizations') ||
          message.includes('case_topics') ||
        message.includes('image_urls') ||
        message.includes('related_topics') ||
        message.includes('follow_up_queries')
      )
    );
  }

  private isMissingPeopleSchemaError(error: unknown): boolean {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : String(error).toLowerCase();

    return (
      message.includes('people_profiles') &&
      (message.includes('does not exist') || message.includes('schema cache'))
    );
  }

  private isMissingCaseSchemaError(error: unknown): boolean {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message).toLowerCase()
        : String(error).toLowerCase();

    return (
      (message.includes('ufo_cases') || message.includes('case_content_links')) &&
      (message.includes('does not exist') || message.includes('schema cache'))
    );
  }

  private deriveSourceType(
    storedValue: unknown,
    sourceUrl: string,
    title: string,
    description: string,
  ): SourceMaterialType {
    if (
      typeof storedValue === 'string' &&
      [
        'article',
        'forum',
        'document',
        'video',
        'image',
        'archive',
        'book',
        'podcast',
        'witness_report',
        'news_report',
        'case_file',
      ].includes(storedValue)
    ) {
      return storedValue as SourceMaterialType;
    }

    const combined = `${sourceUrl} ${title} ${description}`.toLowerCase();
    if (/(podcast|spotify\.com\/episode|podcasts?\.apple|audio episode)/.test(combined)) {
      return 'podcast';
    }
    if (/(isbn|ebook|e-book|books\.google|book review|published book)/.test(combined)) {
      return 'book';
    }
    if (/(witness report|eyewitness|witness testimony|sighting report|first-hand account)/.test(combined)) {
      return 'witness_report';
    }
    if (/(case file|casefile|case report|investigation file|dossier)/.test(combined)) {
      return 'case_file';
    }
    if (/(news report|newspaper|news article|press report|breaking news)/.test(combined)) {
      return 'news_report';
    }
    if (/\.pdf(\?|$)/.test(sourceUrl.toLowerCase()) || /(pdf|document|report|records|declassified)/.test(combined)) {
      return /(archive|history|records|declassified)/.test(combined) ? 'archive' : 'document';
    }
    if (/(reddit|forum|thread|discussion)/.test(combined)) {
      return 'forum';
    }
    if (/(youtube|vimeo|video|interview|watch)/.test(combined)) {
      return 'video';
    }
    if (/(image|photo|gallery|jpg|jpeg|png)/.test(combined)) {
      return 'image';
    }
    return 'article';
  }

  private deriveEvidenceExcerpt(extractedText: unknown, description: string): string {
    const baseText = typeof extractedText === 'string' && extractedText.trim().length > 0 ? extractedText : description;
    const normalized = baseText.replace(/\s+/g, ' ').trim();
    return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
  }

  private deriveRelevanceLabel(contentType: string, sourceType: string | null): string {
    if (sourceType === 'archive') return 'Archival evidence';
    if (sourceType === 'document') return 'Documentary evidence';
    if (contentType === 'theory') return 'Theory context';
    if (sourceType === 'forum') return 'Discussion lead';
    return 'Background source';
  }

  private deriveRelevanceReason(
    extractedText: unknown,
    people: unknown,
    organizations: unknown,
    caseTopics: unknown,
  ): string {
    const topicCount = Array.isArray(caseTopics) ? caseTopics.length : 0;
    const peopleCount = Array.isArray(people) ? people.length : 0;
    const orgCount = Array.isArray(organizations) ? organizations.length : 0;

    if (topicCount > 0) {
      return 'Contains named topics or cases worth direct review.';
    }

    if (peopleCount > 0 || orgCount > 0) {
      return 'Contains named people, organizations, or programs that can guide follow-up.';
    }

    if (typeof extractedText === 'string' && extractedText.trim().length > 0) {
      return 'Includes extracted text that can be reviewed without opening the source first.';
    }

    return 'Useful background material collected for review.';
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

