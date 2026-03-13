import { describe, expect, it } from '@jest/globals';
import { parseScanPrompt } from './ScanPrompt';

describe('parseScanPrompt', () => {
  it('accepts non-blocked prompts without showing an out-of-scope error', () => {
    const result = parseScanPrompt('Find witness interviews from Sweden');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.keywords).toEqual(
        expect.arrayContaining(['witness', 'interviews', 'sweden']),
      );
    }
  });

  it('derives focused keywords from the current prompt only', () => {
    const result = parseScanPrompt('Find UFO witness interviews from Sweden about ghost rockets');

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.keywords).toEqual(
        expect.arrayContaining(['ufo', 'witness', 'interviews', 'sweden', 'ghost', 'rockets']),
      );
    }
  });
});
