import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LocalAiService } from './LocalAiService';
import { parseScanPrompt } from '../scanner/ScanPrompt';

describe('LocalAiService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.LOCAL_AI_ENABLED = 'true';
    process.env.LOCAL_AI_URL = 'http://lm-studio.test/v1';
    process.env.LOCAL_AI_MODEL = 'google/gemma-4-e4b';
    process.env.SEARXNG_URL = 'http://searxng.test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('adds live web-search context to the LM Studio planning prompt', async () => {
    const parsed = parseScanPrompt('Ghost rockets, 1946, Sweden');
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) {
      return;
    }

    const fetchMock = jest.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/search?')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                url: 'https://www.cia.gov/readingroom/docs/ghost-rockets-1946.pdf',
                title: 'CIA Ghost Rockets Memorandum',
                content: 'Top secret memorandum on ghost rockets over Scandinavia in 1946.',
              },
              {
                url: 'https://archives.gov/research/ghost-rockets-report.pdf',
                title: 'Archived Ghost Rockets Report',
                content: 'Historical archive PDF describing the Swedish sightings.',
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/chat/completions')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.model).toBe('google/gemma-4-e4b');
        expect(body.messages[0].content).toContain('CONTEXT (Web Search):');
        expect(body.messages[0].content).toContain('cia.gov/readingroom/docs/ghost-rockets-1946.pdf');
        expect(body.messages[0].content).toContain('Archived Ghost Rockets Report');
        expect(body.response_format.type).toBe('json_schema');
        expect(body.response_format.json_schema.name).toBe('ufo_atlas_scan_plan');

        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intentType: 'fragments',
                    topicPhrases: ['Ghost rockets'],
                    contextHints: ['1946', 'Sweden'],
                    sourceTypeHints: ['document', 'archive'],
                    queryPlans: [
                      {
                        query: '"Ghost rockets" filetype:pdf',
                        layer: 'context-expansion',
                        sourceTypeHint: 'document',
                      },
                    ],
                    keywords: ['Ghost rockets', '1946', 'Sweden'],
                  }),
                },
              },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    global.fetch = fetchMock as typeof fetch;

    const service = new LocalAiService();
    const result = await service.buildQueryPlan('Ghost rockets, 1946, Sweden', parsed.plan, ['UAP']);

    expect(result).not.toBeNull();
    expect(result?.queryPlans.some((entry) => entry.query.includes('filetype:pdf'))).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});
