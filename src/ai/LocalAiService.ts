type QueryPlan = {
  keywords: string[];
  queries: string[];
};

type OllamaGenerateResponse = {
  response?: string;
};

export class LocalAiService {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.enabled = process.env.LOCAL_AI_ENABLED === 'true';
    this.baseUrl = process.env.LOCAL_AI_URL || 'http://ollama:11434';
    this.model = process.env.LOCAL_AI_MODEL || 'qwen3:4b';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async buildQueryPlan(brief: string, keywords: string[]): Promise<QueryPlan | null> {
    if (!this.enabled || brief.trim().length === 0) {
      return null;
    }

    const prompt = [
      'You are building a broad UFO discovery search plan for an editorial intake system.',
      'Return only valid JSON with this shape:',
      '{"keywords":["..."],"queries":["..."]}',
      'Rules:',
      '- Keep it broad and discovery-oriented.',
      '- Focus on UFO, UAP, alien, disclosure, sightings, crash cases, whistleblowers, historical incidents.',
      '- Do not include sexual, criminal, drug, or violent topics.',
      '- Produce 4 to 8 search queries.',
      '- Produce 4 to 10 concise keywords.',
      `Brief: ${brief}`,
      `Base keywords: ${keywords.join(', ') || 'none'}`,
    ].join('\n');

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error(`Local AI request failed with status ${response.status}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      if (!data.response) {
        return null;
      }

      const parsed = JSON.parse(data.response) as Partial<QueryPlan>;
      const keywordsOut = Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : [];
      const queriesOut = Array.isArray(parsed.queries)
        ? parsed.queries.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
        : [];

      if (keywordsOut.length === 0 && queriesOut.length === 0) {
        return null;
      }

      return {
        keywords: Array.from(new Set(keywordsOut)).slice(0, 10),
        queries: Array.from(new Set(queriesOut)).slice(0, 8),
      };
    } catch (error) {
      console.warn('[LocalAiService] Falling back to non-AI scan plan:', error);
      return null;
    }
  }
}
