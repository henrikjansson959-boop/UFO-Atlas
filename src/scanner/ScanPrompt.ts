const UFO_SCOPE_TERMS = [
  'ufo',
  'ufos',
  'uap',
  'uaps',
  'alien',
  'aliens',
  'extraterrestrial',
  'extraterrestrials',
  'flying saucer',
  'flying saucers',
  'nhi',
  'non-human intelligence',
  'non human intelligence',
  'sighting',
  'sightings',
  'abduction',
  'abductions',
  'roswell',
  'aztec',
  'area 51',
  'aatip',
  'aawsap',
  'grusch',
  'whistleblower',
  'crash retrieval',
  'reverse engineering',
  'disclosure',
  'cover-up',
  'cover up',
  'conspiracy',
  'conspiracies',
];

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
};

export type ScanPromptParseFailure = {
  error: string;
  statusCode: number;
};

export function parseScanPrompt(rawPrompt: string): ScanPromptParseSuccess | ScanPromptParseFailure {
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

  if (!containsAnyTerm(lowerPrompt, UFO_SCOPE_TERMS)) {
    return {
      error: 'This search is outside scope. Describe a UFO, UAP, alien, disclosure, crash, or whistleblower topic.',
      statusCode: 400,
    };
  }

  const keywords = deriveKeywords(normalizedPrompt);
  return { keywords, normalizedPrompt };
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

  if (!keywords.some((keyword) => ['ufo', 'ufos', 'uap', 'uaps'].includes(keyword))) {
    keywords.unshift('ufo');
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

function containsAnyTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}
