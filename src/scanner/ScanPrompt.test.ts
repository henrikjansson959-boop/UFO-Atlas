import { parseScanPrompt } from './ScanPrompt';

describe('parseScanPrompt', () => {
  it('derives focused UFO keywords from a natural-language brief', () => {
    const result = parseScanPrompt(
      'Find UFO conspiracy material about the Aztec crash and whistleblower cover-up claims.',
    );

    if ('error' in result) {
      throw new Error(`Expected success, got error: ${result.error}`);
    }

    expect(result.keywords).toEqual(
      expect.arrayContaining(['ufo', 'aztec', 'crash', 'whistleblower', 'conspiracy']),
    );
  });

  it('rejects blocked criminal or sexual prompts', () => {
    const result = parseScanPrompt('Find UFO stories about sex cults and drug trafficking.');

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('blocked'),
        statusCode: 400,
      }),
    );
  });

  it('rejects prompts outside the UFO scope', () => {
    const result = parseScanPrompt('Find Formula 1 rumors in Mexico City.');

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('outside scope'),
        statusCode: 400,
      }),
    );
  });
});
