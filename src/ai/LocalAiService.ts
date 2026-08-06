import {
  ContentItem,
  PersonSuggestion,
  PlannedQuery,
  ScanPlan,
  SourceMaterialType,
} from '../types';

type QueryPlan = ScanPlan;

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type WebSearchContextEntry = {
  query: string;
  url: string;
  title: string;
  description: string;
};

export type LocalAiStatus = {
  enabled: boolean;
  reachable: boolean;
  model: string;
  baseUrl: string;
};

export class LocalAiService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly searxngUrl: string;
  private readonly requestTimeoutMs: number;

  constructor() {
    this.enabled = process.env.LOCAL_AI_ENABLED === 'true';
    this.baseUrl = (process.env.LOCAL_AI_URL || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
    this.model = process.env.LOCAL_AI_MODEL || 'google/gemma-4-e4b';
    this.searxngUrl = process.env.SEARXNG_URL || 'http://searxng:8080';
    const configuredTimeout = Number.parseInt(process.env.LOCAL_AI_TIMEOUT_MS || '', 10);
    this.requestTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout >= 5_000
      ? configuredTimeout
      : 60_000;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async getStatus(): Promise<LocalAiStatus> {
    if (!this.enabled) {
      return {
        enabled: false,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Accept: 'application/json',
        },
      });

      return {
        enabled: true,
        reachable: response.ok,
        model: this.model,
        baseUrl: this.baseUrl,
      };
    } catch {
      return {
        enabled: true,
        reachable: false,
        model: this.model,
        baseUrl: this.baseUrl,
      };
    }
  }

  async buildQueryPlan(brief: string, basePlan: ScanPlan, backgroundKeywords: string[]): Promise<QueryPlan | null> {
    if (!this.enabled || brief.trim().length === 0) {
      return null;
    }

    const webContext = await this.buildWebSearchContext(brief, basePlan, backgroundKeywords);
    const prompt = [
      'You are building an evidence-gathering UFO/UAP intake plan for an editorial investigation tool.',
      'The user may write a question, a statement, or loose fragments.',
      'A free live web-search context is provided below. Use it to ground and improve the search plan.',
      'Return only valid JSON with this shape:',
      '{"intentType":"question|statement|fragments","topicPhrases":["..."],"contextHints":["..."],"sourceTypeHints":["article|forum|document|video|image|archive"],"queryPlans":[{"query":"...","layer":"exact-topic|context-expansion","sourceTypeHint":"article|forum|document|video|image|archive"}],"keywords":["..."]}',
      'Rules:',
      '- Primary goal: gather evidence and source material, not answer the question directly.',
      '- Keep the core topic phrase exact. Do not drift into adjacent generic UFO entertainment, celebrity, or broad culture content.',
      '- If the brief names a place, country, person, event, or year, keep the plan centered on that exact scope.',
      '- Active keywords are background hints only. Use them to enrich or rank search ideas, but do not let them overpower the core topic.',
      '- Cover multiple source types when useful: articles, forums, PDFs/documents, videos, images, archives.',
      '- Prefer query plans that collect investigative material, source documents, discussions, and evidence.',
      '- Actively look for declassified records, PDFs, archive pages, and official government sources when relevant.',
      '- Do not include sexual, criminal, violent, war, gore, weapons, drug, or abuse topics.',
      '- Do not broaden into general politics, crime news, celebrity gossip, unrelated current events, streaming guides, or documentary listicles.',
      '- Produce 5 to 10 query plans.',
      '- Keywords, topic phrases, and context hints must reflect the exact brief.',
      `CONTEXT (Web Search):\n${webContext || 'none'}`,
      `Brief: ${brief}`,
      `Detected intent: ${basePlan.intentType}`,
      `Base topic phrases: ${basePlan.topicPhrases.join(', ') || 'none'}`,
      `Base context hints: ${basePlan.contextHints.join(', ') || 'none'}`,
      `Background keywords: ${backgroundKeywords.join(', ') || 'none'}`,
    ].join('\n');

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(this.requestTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
          temperature: 0.1,
          max_tokens: 1400,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'ufo_atlas_scan_plan',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  intentType: {
                    type: 'string',
                    enum: ['question', 'statement', 'fragments'],
                  },
                  topicPhrases: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  contextHints: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  sourceTypeHints: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['article', 'forum', 'document', 'video', 'image', 'archive'],
                    },
                  },
                  queryPlans: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        query: { type: 'string' },
                        layer: {
                          type: 'string',
                          enum: ['exact-topic', 'context-expansion'],
                        },
                        sourceTypeHint: {
                          type: 'string',
                          enum: ['article', 'forum', 'document', 'video', 'image', 'archive'],
                        },
                      },
                      required: ['query', 'layer', 'sourceTypeHint'],
                    },
                  },
                  keywords: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: [
                  'intentType',
                  'topicPhrases',
                  'contextHints',
                  'sourceTypeHints',
                  'queryPlans',
                  'keywords',
                ],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Local AI request failed with status ${response.status}`);
      }

      const data = (await response.json()) as OpenAiChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as Partial<QueryPlan> & {
        queryPlans?: Array<Partial<PlannedQuery>>;
        sourceTypeHints?: string[];
      };
      const keywordsOut = Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : [];
      const topicPhrases = Array.isArray(parsed.topicPhrases)
        ? parsed.topicPhrases.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : [];
      const contextHints = Array.isArray(parsed.contextHints)
        ? parsed.contextHints.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : [];
      const queryPlans = Array.isArray(parsed.queryPlans)
        ? parsed.queryPlans
            .map((entry) => this.normalizePlannedQuery(entry))
            .filter((entry): entry is PlannedQuery => entry !== null)
        : [];
      const sourceTypeHints = Array.isArray(parsed.sourceTypeHints)
        ? parsed.sourceTypeHints
            .filter((value): value is SourceMaterialType => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value): value is SourceMaterialType => ['article', 'forum', 'document', 'video', 'image', 'archive'].includes(value))
        : [];

      if (keywordsOut.length === 0 && topicPhrases.length === 0 && queryPlans.length === 0) {
        return null;
      }

      return {
        normalizedPrompt: brief.trim(),
        intentType: parsed.intentType === 'question' || parsed.intentType === 'fragments' ? parsed.intentType : 'statement',
        topicPhrases: Array.from(new Set(topicPhrases.length > 0 ? topicPhrases : basePlan.topicPhrases)).slice(0, 4),
        contextHints: Array.from(new Set(contextHints.length > 0 ? contextHints : basePlan.contextHints)).slice(0, 8),
        sourceTypeHints: Array.from(new Set(sourceTypeHints.length > 0 ? sourceTypeHints : basePlan.sourceTypeHints)).slice(0, 6),
        queryPlans: Array.from(
          new Map(
            (queryPlans.length > 0 ? queryPlans : basePlan.queryPlans).map((entry) => [
              `${entry.layer}:${entry.sourceTypeHint ?? 'any'}:${entry.query.toLowerCase()}`,
              entry,
            ]),
          ).values(),
        ).slice(0, 10),
        keywords: Array.from(new Set(keywordsOut.length > 0 ? keywordsOut : basePlan.keywords)).slice(0, 12),
      };
    } catch (error) {
      console.warn('[LocalAiService] Falling back to non-AI scan plan:', error);
      return null;
    }
  }

  async suggestPersonProfile(name: string, item: ContentItem): Promise<PersonSuggestion> {
    const fallback = this.buildFallbackPersonSuggestion(name, item);
    if (!this.enabled) return fallback;

    const evidence = [
      item.title,
      item.description,
      item.evidenceExcerpt ?? '',
      item.extractedText ?? '',
    ].join('\n').slice(0, 6000);
    const prompt = [
      'Prepare an editorial draft profile for a person mentioned in UFO/UAP source material.',
      'Use only the supplied evidence. Do not invent dates, roles, aliases, achievements, or claims.',
      'If a fact is unknown, use null or an empty array. Keep the biography cautious and source-attributed.',
      'Return only valid JSON matching the requested schema.',
      `Detected name: ${name}`,
      `Source title: ${item.title}`,
      `Source URL: ${item.sourceUrl}`,
      `Evidence:\n${evidence}`,
    ].join('\n');

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(this.requestTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.05,
          max_tokens: 900,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'ufo_atlas_person_suggestion',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  fullName: { type: 'string' },
                  aliases: { type: 'array', items: { type: 'string' } },
                  role: { type: 'string' },
                  birthYear: { type: ['integer', 'null'] },
                  deathYear: { type: ['integer', 'null'] },
                  biography: { type: 'string' },
                  sourceNotes: { type: ['string', 'null'] },
                },
                required: [
                  'fullName',
                  'aliases',
                  'role',
                  'birthYear',
                  'deathYear',
                  'biography',
                  'sourceNotes',
                ],
              },
            },
          },
        }),
      });

      if (!response.ok) throw new Error(`Local AI request failed with status ${response.status}`);
      const data = (await response.json()) as OpenAiChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return fallback;

      const parsed = JSON.parse(content) as Partial<PersonSuggestion>;
      const fullName = typeof parsed.fullName === 'string' && parsed.fullName.trim()
        ? parsed.fullName.trim()
        : fallback.fullName;
      return {
        ...fallback,
        fullName,
        slug: this.slugify(fullName),
        aliases: Array.isArray(parsed.aliases)
          ? Array.from(new Set(parsed.aliases.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)))
          : [],
        role: typeof parsed.role === 'string' && parsed.role.trim() ? parsed.role.trim() : fallback.role,
        birthYear: this.normalizeYear(parsed.birthYear),
        deathYear: this.normalizeYear(parsed.deathYear),
        biography: typeof parsed.biography === 'string' && parsed.biography.trim()
          ? parsed.biography.trim()
          : fallback.biography,
        sourceNotes: typeof parsed.sourceNotes === 'string' && parsed.sourceNotes.trim()
          ? parsed.sourceNotes.trim()
          : null,
        aiGenerated: true,
      };
    } catch (error) {
      console.warn('[LocalAiService] Falling back to evidence-only person suggestion:', error);
      return fallback;
    }
  }

  private buildFallbackPersonSuggestion(name: string, item: ContentItem): PersonSuggestion {
    const fullName = name.trim();
    return {
      fullName,
      slug: this.slugify(fullName),
      aliases: [],
      role: 'UFO-related person',
      birthYear: null,
      deathYear: null,
      photoUrl: null,
      biography: `${fullName} is mentioned in “${item.title}”. Review the original source before publishing additional biographical claims.`,
      sourceTitle: item.title,
      sourceUrl: item.sourceUrl,
      sourceNotes: item.relevanceReason ?? null,
      aiGenerated: false,
    };
  }

  private normalizeYear(value: unknown): number | null {
    return Number.isInteger(value) && Number(value) >= 1800 && Number(value) <= new Date().getFullYear()
      ? Number(value)
      : null;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'person';
  }

  private normalizePlannedQuery(entry: Partial<PlannedQuery>): PlannedQuery | null {
    if (!entry || typeof entry.query !== 'string') {
      return null;
    }

    const query = entry.query.trim();
    if (!query) {
      return null;
    }

    const layer = entry.layer === 'context-expansion' ? 'context-expansion' : 'exact-topic';
    const sourceTypeHint =
      entry.sourceTypeHint && ['article', 'forum', 'document', 'video', 'image', 'archive'].includes(entry.sourceTypeHint)
        ? entry.sourceTypeHint
        : undefined;

    return {
      query,
      layer,
      sourceTypeHint,
    };
  }

  private async buildWebSearchContext(brief: string, basePlan: ScanPlan, backgroundKeywords: string[]): Promise<string> {
    try {
      const probes = this.buildContextQueries(brief, basePlan, backgroundKeywords);
      const results = new Map<string, WebSearchContextEntry>();

      for (const probe of probes) {
        const entries = await this.searchFreeWeb(probe);
        for (const entry of entries) {
          if (!results.has(entry.url)) {
            results.set(entry.url, entry);
          }
          if (results.size >= 10) {
            break;
          }
        }
        if (results.size >= 10) {
          break;
        }
      }

      return Array.from(results.values())
        .slice(0, 10)
        .map((entry, index) => {
          const summary = entry.description.trim() || 'No snippet available.';
          return `${index + 1}. [query: ${entry.query}]\nTitle: ${entry.title}\nURL: ${entry.url}\nSnippet: ${summary}`;
        })
        .join('\n\n');
    } catch (error) {
      console.warn('[LocalAiService] Failed to gather web context before AI planning:', error);
      return '';
    }
  }

  private buildContextQueries(brief: string, basePlan: ScanPlan, backgroundKeywords: string[]): string[] {
    const primaryTopic = basePlan.topicPhrases[0]?.trim() || brief.trim();
    const contextTail = Array.from(new Set([...basePlan.contextHints, ...backgroundKeywords]))
      .filter((value) => value.trim().length > 0)
      .slice(0, 3)
      .join(' ')
      .trim();
    const topicWithContext = [primaryTopic, contextTail].filter(Boolean).join(' ').trim();

    return Array.from(
      new Set(
        [
          `"${primaryTopic}"`,
          topicWithContext || primaryTopic,
          `"${primaryTopic}" filetype:pdf`,
          `"${primaryTopic}" site:cia.gov`,
          `"${primaryTopic}" site:nsa.gov`,
          `"${primaryTopic}" site:archives.gov`,
          `"${primaryTopic}" declassified memorandum`,
          `"${primaryTopic}" archive report`,
        ].filter((query) => query.trim().length > 0),
      ),
    ).slice(0, 8);
  }

  private async searchFreeWeb(query: string): Promise<WebSearchContextEntry[]> {
    const url = `${this.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&language=en-US&safesearch=2&categories=general,news`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(Math.min(this.requestTimeoutMs, 8_000)),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; UFO-Atlas-Bot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Web context search failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{ url?: string; title?: string; content?: string }>;
    };

    return (payload.results ?? [])
      .map((result): WebSearchContextEntry | null => {
        const urlValue = (result.url ?? '').trim();
        const title = (result.title ?? '').trim();
        if (!urlValue || !title) {
          return null;
        }

        return {
          query,
          url: urlValue,
          title,
          description: (result.content ?? '').trim(),
        };
      })
      .filter((entry): entry is WebSearchContextEntry => entry !== null)
      .slice(0, 3);
  }
}
