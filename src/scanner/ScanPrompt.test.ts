import { describe, expect, it } from '@jest/globals';
import { diversifyScanPlanWithHistory, parseScanPrompt } from './ScanPrompt';

describe('parseScanPrompt', () => {
  it('accepts non-blocked prompts without showing an out-of-scope error', () => {
    const result = parseScanPrompt('Find witness interviews from Sweden');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.keywords).toEqual(
        expect.arrayContaining(['witness', 'interviews', 'sweden']),
      );
      expect(result.plan.intentType).toBe('statement');
      expect(result.plan.topicPhrases[0]).toContain('witness interviews from Sweden');
    }
  });

  it('derives focused keywords from the current prompt only', () => {
    const result = parseScanPrompt('Find UFO witness interviews from Sweden about ghost rockets');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.keywords).toEqual(
        expect.arrayContaining(['ufo', 'witness', 'interviews', 'sweden', 'ghost', 'rockets']),
      );
      expect(result.plan.topicPhrases[0].toLowerCase()).toContain('ufo witness interviews from sweden about ghost rockets');
      expect(result.plan.queryPlans.length).toBeGreaterThan(0);
    }
  });

  it('classifies question prompts and keeps theory context', () => {
    const result = parseScanPrompt("What's the theory behind ghost rockets?");

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.plan.intentType).toBe('question');
      expect(result.plan.contextHints).toEqual(expect.arrayContaining(['theory', 'explanation']));
      expect(result.plan.topicPhrases[0].toLowerCase()).toContain('ghost rockets');
    }
  });

  it('classifies fragment prompts and keeps context segments', () => {
    const result = parseScanPrompt('Ghost rockets, 1946, Sweden');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.plan.intentType).toBe('fragments');
      expect(result.plan.topicPhrases[0]).toBe('Ghost rockets');
      expect(result.plan.contextHints).toEqual(expect.arrayContaining(['1946', 'Sweden']));
    }
  });

  it('diversifies repeated topic scans with new evidence-oriented queries', () => {
    const result = parseScanPrompt('Ghost rockets, 1946, Sweden');

    expect('error' in result).toBe(false);
    if ('error' in result) {
      return;
    }

    const diversified = diversifyScanPlanWithHistory(
      result.plan,
      [
        { keywordsUsed: ['Ghost rockets', '1946', 'Sweden'] },
        { keywordsUsed: ['Ghost rockets', 'Sweden', 'ufo'] },
        { keywordsUsed: ['Ghost rockets', 'archive', '1946'] },
      ],
      ['UAP', 'ufo'],
    );

    expect(diversified.queryPlans.length).toBeGreaterThan(result.plan.queryPlans.length);
    expect(
      diversified.queryPlans.some((entry) => /archive|newspaper|chronology|witness|declassified/i.test(entry.query)),
    ).toBe(true);
  });
});
