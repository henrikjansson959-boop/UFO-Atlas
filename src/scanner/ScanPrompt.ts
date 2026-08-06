import { PlannedQuery, ScanIntentType, ScanPlan, SourceMaterialType } from '../types';

const BLOCKED_PROMPT_TERMS = [
  'porn',
  'porno',
  'sex',
  'sexual',
  'escort',
  'nude',
  'xxx',
  'drug',
  'drugs',
  'cocaine',
  'heroin',
  'meth',
  'cartel',
  'crime',
  'criminal',
  'violence',
  'violent',
  'weapon',
  'weapons',
  'shooting',
  'kill',
  'killing',
  'assault',
  'abuse',
  'torture',
  'war',
  'drug cartel',
  'drug trafficking',
  'rape',
  'gore',
  'beheading',
  'snuff',
  'murder',
  'terrorism',
];

const PREFERRED_PHRASES = [
  'non-human intelligence',
  'flying saucer',
  'crash retrieval',
  'reverse engineering',
  'government cover-up',
  'government cover up',
  'secret program',
  'secret programs',
  'area 51',
];

const STOP_WORDS = new Set([
  'and',
  'about',
  'claims',
  'claim',
  'after',
  'against',
  'before',
  'being',
  'could',
  'find',
  'from',
  'have',
  'into',
  'just',
  'like',
  'material',
  'maybe',
  'more',
  'need',
  'news',
  'over',
  'report',
  'reports',
  'show',
  'something',
  'that',
  'them',
  'there',
  'these',
  'they',
  'thing',
  'things',
  'this',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'want',
  'look',
  'looking',
  'search',
  'searches',
  'scan',
  'scans',
  'related',
  'topic',
  'topics',
  'stuff',
  'the',
  'then',
  ]);

export type ScanPromptParseSuccess = {
  keywords: string[];
  normalizedPrompt: string;
  plan: ScanPlan;
};

export type ScanPromptParseFailure = {
  error: string;
  statusCode: number;
};

export type SearchHistorySeed = {
  keywordsUsed?: string[];
};

export function parseScanPrompt(
  rawPrompt: string,
): ScanPromptParseSuccess | ScanPromptParseFailure {
  const normalizedPrompt = rawPrompt.replace(/\s+/g, ' ').trim();

  if (normalizedPrompt.length === 0) {
    return {
      error: 'Describe what to find before running a search.',
      statusCode: 400,
    };
  }

  const lowerPrompt = normalizedPrompt.toLowerCase();

  if (containsAnyTerm(lowerPrompt, BLOCKED_PROMPT_TERMS)) {
    return {
      error: 'This search request is blocked. The system does not run sexual, drug, violent, or criminal topic scans.',
      statusCode: 400,
    };
  }

  const keywords = deriveKeywords(normalizedPrompt);
  const plan = buildScanPlan(normalizedPrompt, keywords);
  return { keywords, normalizedPrompt, plan };
}

export function diversifyScanPlanWithHistory(
  basePlan: ScanPlan,
  recentHistory: SearchHistorySeed[],
  backgroundKeywords: string[] = [],
): ScanPlan {
  const matchingHistory = recentHistory.filter((entry) => historyMatchesPlan(entry, basePlan));
  const repeatCount = matchingHistory.length;

  if (repeatCount === 0) {
    return basePlan;
  }

  const diversifiedQueries = buildDiversifiedHistoryQueries(basePlan, repeatCount, backgroundKeywords);
  if (diversifiedQueries.length === 0) {
    return basePlan;
  }

  return {
    ...basePlan,
    queryPlans: dedupePlannedQueries([...basePlan.queryPlans, ...diversifiedQueries]).slice(0, 16),
  };
}

function buildScanPlan(prompt: string, keywords: string[]): ScanPlan {
  const intentType = detectIntentType(prompt);
  const segments = splitPromptSegments(prompt);
  const topicPhrases = deriveTopicPhrases(prompt, segments, intentType);
  const contextHints = deriveContextHints(prompt, segments, topicPhrases, keywords);
  const sourceTypeHints: SourceMaterialType[] = ['article', 'forum', 'document', 'video', 'image', 'archive'];
  const queryPlans = buildQueryPlans(topicPhrases, contextHints, intentType);

  return {
    normalizedPrompt: prompt,
    intentType,
    topicPhrases,
    contextHints,
    sourceTypeHints,
    queryPlans,
    keywords: Array.from(new Set([...topicPhrases, ...contextHints, ...keywords])).slice(0, 12),
  };
}

function deriveKeywords(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const keywords: string[] = [];

  for (const phrase of PREFERRED_PHRASES) {
    if (lowerPrompt.includes(phrase)) {
      keywords.push(phrase.replace('government cover up', 'government cover-up'));
    }
  }

  const tokens = Array.from(new Set(lowerPrompt.match(/[a-z0-9-]+/g) ?? []));
  for (const token of tokens) {
    if (token.length < 3 || STOP_WORDS.has(token) || BLOCKED_PROMPT_TERMS.includes(token)) {
      continue;
    }

    keywords.push(token);
  }

  if (
    containsAnyTerm(lowerPrompt, ['conspiracy', 'conspiracies', 'cover up', 'cover-up', 'disclosure']) &&
    !keywords.includes('conspiracy')
  ) {
    keywords.push('conspiracy');
  }

  const normalized = Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0)
        .map((keyword) => keyword.replace(/\s+/g, ' ')),
    ),
  );

  return normalized.slice(0, 8);
}

function detectIntentType(prompt: string): ScanIntentType {
  if (/\?$/.test(prompt.trim()) || /^(what|why|how|who|when|where)\b/i.test(prompt)) {
    return 'question';
  }

  if (/[,:;]/.test(prompt) && !/^(find|look|search|investigate|collect|gather)\b/i.test(prompt)) {
    return 'fragments';
  }

  return 'statement';
}

function splitPromptSegments(prompt: string): string[] {
  return prompt
    .split(/[,.:;]+/)
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function deriveTopicPhrases(prompt: string, segments: string[], intentType: ScanIntentType): string[] {
  const cleanedPrompt = prompt
    .replace(/^(find|look for|search for|investigate|collect|gather)\s+(material|evidence|sources|info|information)?\s*(about|on)?\s*/i, '')
    .replace(/^(what(?:'s| is)\s+the\s+(?:theory|story|history|background)\s+(?:behind|of)\s*)/i, '')
    .replace(/^(tell me about|show me)\s*/i, '')
    .replace(/\?$/, '')
    .trim();

  const directPhrase = cleanedPrompt.replace(/\s+/g, ' ').trim();
  const topicCandidates = [
    intentType === 'fragments' ? segments[0] ?? '' : directPhrase,
    intentType === 'fragments' ? directPhrase : segments[0] ?? '',
  ]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 3)
    .filter((value) => !/^(find|look|search|investigate|collect|gather)\b/i.test(value));

  return Array.from(new Set(topicCandidates)).slice(0, 3);
}

function deriveContextHints(
  prompt: string,
  segments: string[],
  topicPhrases: string[],
  keywords: string[],
): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const hints = new Set<string>();

  for (const segment of segments.slice(1)) {
    if (segment.length >= 3) {
      hints.add(segment);
    }
  }

  for (const keyword of keywords) {
    if (!topicPhrases.some((phrase) => phrase.toLowerCase().includes(keyword.toLowerCase()))) {
      hints.add(keyword);
    }
  }

  if (/(theory|theories|why|how|explanation|behind)/.test(lowerPrompt)) {
    hints.add('theory');
    hints.add('explanation');
  }

  if (/(document|pdf|archive|files|records)/.test(lowerPrompt)) {
    hints.add('documents');
    hints.add('archives');
  }

  return Array.from(hints)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 3)
    .slice(0, 8);
}

function buildQueryPlans(
  topicPhrases: string[],
  contextHints: string[],
  intentType: ScanIntentType,
): PlannedQuery[] {
  const queries: PlannedQuery[] = [];

  for (const topicPhrase of topicPhrases) {
    const normalizedTopic = topicPhrase.replace(/\s+/g, ' ').trim();
    if (!normalizedTopic) {
      continue;
    }

    queries.push({ query: `"${normalizedTopic}"`, layer: 'exact-topic' });
    queries.push({ query: normalizedTopic, layer: 'exact-topic' });
    queries.push({ query: `"${normalizedTopic}" pdf OR archive OR document`, layer: 'context-expansion', sourceTypeHint: 'document' });
    queries.push({ query: `"${normalizedTopic}" forum OR reddit OR discussion`, layer: 'context-expansion', sourceTypeHint: 'forum' });

    if (intentType === 'question') {
      queries.push({ query: `"${normalizedTopic}" theory OR explanation`, layer: 'context-expansion', sourceTypeHint: 'article' });
    }

    const contextualTail = contextHints.slice(0, 3).join(' ').trim();
    if (contextualTail) {
      queries.push({ query: `${normalizedTopic} ${contextualTail}`, layer: 'context-expansion' });
    }
  }

  return dedupePlannedQueries(queries).slice(0, 10);
}

function containsAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function dedupePlannedQueries(queries: PlannedQuery[]): PlannedQuery[] {
  return Array.from(
    new Map(
      queries
        .filter((entry) => entry.query.trim().length > 0)
        .map((entry) => [`${entry.layer}:${entry.sourceTypeHint ?? 'any'}:${entry.query.toLowerCase()}`, entry]),
    ).values(),
  );
}

function historyMatchesPlan(entry: SearchHistorySeed, plan: ScanPlan): boolean {
  const keywordsUsed = (entry.keywordsUsed ?? [])
    .map((value) => normalizeHistoryText(value))
    .filter(Boolean);

  if (keywordsUsed.length === 0) {
    return false;
  }

  const topicPhrases = plan.topicPhrases.map((phrase) => normalizeHistoryText(phrase)).filter(Boolean);
  const topicTokens = extractHistoryTokens(topicPhrases.join(' '));

  return keywordsUsed.some((historyKeyword) => {
    if (topicPhrases.some((phrase) => historyKeyword.includes(phrase) || phrase.includes(historyKeyword))) {
      return true;
    }

    const overlap = Array.from(extractHistoryTokens(historyKeyword)).filter((token) => topicTokens.has(token));
    return topicTokens.size > 0 && overlap.length >= Math.min(2, topicTokens.size);
  });
}

function buildDiversifiedHistoryQueries(
  plan: ScanPlan,
  repeatCount: number,
  backgroundKeywords: string[],
): PlannedQuery[] {
  const queryBank: PlannedQuery[] = [];
  const contextTerms = Array.from(new Set([
    ...plan.contextHints,
    ...backgroundKeywords.filter((keyword) => keyword.length >= 3),
  ])).slice(0, 4);
  const contextTail = contextTerms.join(' ').trim();
  const geographicHints = contextTerms.filter((value) => /sweden|sverige|scandinavia|scandinavian|norway|finland|denmark/i.test(value));
  const yearHints = contextTerms.filter((value) => /\b(18|19|20)\d{2}\b/.test(value));

  for (const topicPhrase of plan.topicPhrases) {
    const topic = topicPhrase.replace(/\s+/g, ' ').trim();
    if (!topic) {
      continue;
    }

    queryBank.push(
      { query: `"${topic}" witness OR sightings OR report`, layer: 'context-expansion', sourceTypeHint: 'article' },
      { query: `"${topic}" archive OR newspaper OR chronology`, layer: 'context-expansion', sourceTypeHint: 'archive' },
      { query: `"${topic}" declassified OR memo OR file`, layer: 'context-expansion', sourceTypeHint: 'document' },
      { query: `"${topic}" photograph OR sketch OR image`, layer: 'context-expansion', sourceTypeHint: 'image' },
      { query: `"${topic}" interview OR oral history`, layer: 'context-expansion', sourceTypeHint: 'article' },
      { query: `"${topic}" forum OR witness discussion`, layer: 'context-expansion', sourceTypeHint: 'forum' },
    );

    if (contextTail) {
      queryBank.push(
        { query: `"${topic}" ${contextTail} archive`, layer: 'context-expansion', sourceTypeHint: 'archive' },
        { query: `"${topic}" ${contextTail} report`, layer: 'context-expansion', sourceTypeHint: 'document' },
      );
    }

    for (const place of geographicHints.slice(0, 2)) {
      queryBank.push(
        { query: `"${topic}" ${place} witness`, layer: 'context-expansion', sourceTypeHint: 'article' },
        { query: `"${topic}" ${place} archive`, layer: 'context-expansion', sourceTypeHint: 'archive' },
      );
    }

    for (const year of yearHints.slice(0, 2)) {
      queryBank.push(
        { query: `"${topic}" ${year} report`, layer: 'context-expansion', sourceTypeHint: 'document' },
        { query: `"${topic}" ${year} newspaper`, layer: 'context-expansion', sourceTypeHint: 'archive' },
      );
    }
  }

  const dedupedBank = dedupePlannedQueries(queryBank);
  const desiredCount = Math.min(6, 2 + Math.min(repeatCount, 4));
  const startIndex = Math.min(dedupedBank.length, (repeatCount - 1) * 2);

  return dedupedBank.slice(startIndex, startIndex + desiredCount);
}

function normalizeHistoryText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractHistoryTokens(value: string): Set<string> {
  return new Set(
    (value.match(/[a-z0-9]{4,}/g) ?? []).filter((token) => !STOP_WORDS.has(token)),
  );
}
