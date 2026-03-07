import { DuplicateDetector } from './DuplicateDetector';
import { ExtractedContent } from '../types';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: 'PGRST116' },
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;
  const mockSupabaseUrl = 'https://test.supabase.co';
  const mockSupabaseKey = 'test-key';

  beforeEach(() => {
    detector = new DuplicateDetector(mockSupabaseUrl, mockSupabaseKey);
  });

  describe('checkDuplicate', () => {
    it('should return isDuplicate false and isPotentialDuplicate false when no duplicates exist', async () => {
      const content: ExtractedContent = {
        title: 'Unique UFO Sighting',
        description: 'A unique sighting',
        eventDate: new Date('2024-01-01'),
        sourceUrl: 'https://example.com/unique',
        contentType: 'event',
        rawHtml: '<html></html>',
      };

      const result = await detector.checkDuplicate(content);

      expect(result.isDuplicate).toBe(false);
      expect(result.isPotentialDuplicate).toBe(false);
      expect(result.matchedContentId).toBeUndefined();
      expect(result.similarityScore).toBeUndefined();
    });
  });

  describe('similarity calculation', () => {
    it('should calculate 100% similarity for identical titles', () => {
      // Access private method through type assertion for testing
      const similarity = (detector as any).calculateSimilarity(
        'UFO Sighting in Roswell',
        'UFO Sighting in Roswell'
      );

      expect(similarity).toBe(1.0);
    });

    it('should calculate high similarity for nearly identical titles', () => {
      const similarity = (detector as any).calculateSimilarity(
        'UFO Sighting in Roswell',
        'UFO Sighting in Roswel' // Missing one letter
      );

      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should calculate low similarity for different titles', () => {
      const similarity = (detector as any).calculateSimilarity(
        'UFO Sighting in Roswell',
        'Alien Abduction in Area 51'
      );

      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle case-insensitive comparison', () => {
      const similarity = (detector as any).calculateSimilarity(
        'UFO SIGHTING IN ROSWELL',
        'ufo sighting in roswell'
      );

      expect(similarity).toBe(1.0);
    });

    it('should handle empty strings', () => {
      const similarity = (detector as any).calculateSimilarity('', '');
      expect(similarity).toBe(0.0);
    });

    it('should handle one empty string', () => {
      const similarity = (detector as any).calculateSimilarity('UFO Sighting', '');
      expect(similarity).toBe(0.0);
    });
  });
});
