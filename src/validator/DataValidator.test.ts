import { DataValidator } from './DataValidator';
import { ExtractedContent } from '../types';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('validate', () => {
    it('should return valid for content with all required fields', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting in Roswell',
        description: 'A detailed account of the incident',
        eventDate: new Date('2024-01-15'),
        sourceUrl: 'https://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid for content with null eventDate', () => {
      const content: ExtractedContent = {
        title: 'UFO Theory',
        description: 'A theory about UFOs',
        eventDate: null,
        sourceUrl: 'https://example.com/theory',
        contentType: 'theory',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when title is missing', () => {
      const content: ExtractedContent = {
        title: '',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'https://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should fail validation when title is only whitespace', () => {
      const content: ExtractedContent = {
        title: '   ',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'https://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should fail validation when source_url is missing', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: '',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source URL is required');
    });

    it('should fail validation when source_url is only whitespace', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: '   ',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source URL is required');
    });

    it('should fail validation when source_url is invalid', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'not-a-valid-url',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source URL is invalid');
    });

    it('should accept http and https URLs', () => {
      const httpContent: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'http://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const httpsContent: ExtractedContent = {
        ...httpContent,
        sourceUrl: 'https://example.com/article'
      };

      expect(validator.validate(httpContent).isValid).toBe(true);
      expect(validator.validate(httpsContent).isValid).toBe(true);
    });

    it('should reject non-http(s) URLs', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'ftp://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source URL is invalid');
    });

    it('should fail validation for invalid content_type', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: null,
        sourceUrl: 'https://example.com/article',
        contentType: 'invalid' as any,
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content type must be one of: event, person, theory, news');
    });

    it('should accept all valid content_types', () => {
      const validTypes: Array<'event' | 'person' | 'theory' | 'news'> = ['event', 'person', 'theory', 'news'];

      validTypes.forEach(type => {
        const content: ExtractedContent = {
          title: 'Test Content',
          description: 'Description',
          eventDate: null,
          sourceUrl: 'https://example.com/article',
          contentType: type,
          rawHtml: '<html>...</html>'
        };

        const result = validator.validate(content);
        expect(result.isValid).toBe(true);
      });
    });

    it('should fail validation for invalid date', () => {
      const content: ExtractedContent = {
        title: 'UFO Sighting',
        description: 'Description',
        eventDate: new Date('invalid-date'),
        sourceUrl: 'https://example.com/article',
        contentType: 'event',
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event date must be a valid date in ISO 8601 format');
    });

    it('should accept valid ISO 8601 dates', () => {
      const validDates = [
        new Date('2024-01-15'),
        new Date('2024-01-15T10:30:00Z'),
        new Date('2024-01-15T10:30:00.000Z')
      ];

      validDates.forEach(date => {
        const content: ExtractedContent = {
          title: 'UFO Sighting',
          description: 'Description',
          eventDate: date,
          sourceUrl: 'https://example.com/article',
          contentType: 'event',
          rawHtml: '<html>...</html>'
        };

        const result = validator.validate(content);
        expect(result.isValid).toBe(true);
      });
    });

    it('should accumulate multiple validation errors', () => {
      const content: ExtractedContent = {
        title: '',
        description: 'Description',
        eventDate: new Date('invalid'),
        sourceUrl: '',
        contentType: 'invalid' as any,
        rawHtml: '<html>...</html>'
      };

      const result = validator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('Source URL is required');
      expect(result.errors).toContain('Content type must be one of: event, person, theory, news');
      expect(result.errors).toContain('Event date must be a valid date in ISO 8601 format');
    });
  });
});
