import { UapDropService } from './UapDropService';

describe('UapDropService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes valid records and removes invalid coordinates and duplicates', async () => {
    const records = [
      {
        sourceKey: 'archive',
        externalId: 'one',
        title: ' A report ',
        summary: 'Observed lights',
        locationName: 'Stockholm',
        countryCode: 'SE',
        latitude: 59.3293,
        longitude: 18.0686,
        observedAt: '1986-02-28T20:00:00Z',
        sourceUrl: 'https://example.com/report',
        coordinatePrecision: 'CITY',
      },
      {
        sourceKey: 'archive',
        externalId: 'one',
        latitude: 59.3293,
        longitude: 18.0686,
      },
      {
        sourceKey: 'archive',
        externalId: 'invalid',
        latitude: 95,
        longitude: 18,
      },
    ];

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(records), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const service = new UapDropService();
    const result = await service.getSightings();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'uapdrop:archive:one',
      title: 'A report',
      location: 'Stockholm',
      sourceUrl: 'https://example.com/report',
      sourceReference: null,
    });
  });

  it('keeps a non-URL source as a citation instead of making a broken link', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{
        sourceKey: 'hatch',
        externalId: 'two',
        latitude: 10,
        longitude: 20,
        sourceUrl: 'Periodical citation',
      }]), { status: 200 }),
    );

    const service = new UapDropService();
    const [result] = await service.getSightings();

    expect(result.sourceUrl).toBeNull();
    expect(result.sourceReference).toBe('Periodical citation');
  });

  it('reuses the cached dataset', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{
        sourceKey: 'archive',
        externalId: 'cached',
        latitude: 10,
        longitude: 20,
      }]), { status: 200 }),
    );

    const service = new UapDropService();
    await service.getSightings();
    await service.getSightings();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
