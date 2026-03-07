import { ContentExtractor } from './ContentExtractor';
import axios from 'axios';
import puppeteer from 'puppeteer';

// Mock axios and puppeteer
jest.mock('axios');
jest.mock('puppeteer');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('ContentExtractor', () => {
  let extractor: ContentExtractor;

  beforeEach(() => {
    extractor = new ContentExtractor();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await extractor.close();
  });

  describe('extract method', () => {
    it('should extract title, description, and content type from valid HTML', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>UFO Sighting in Phoenix</title>
            <meta name="description" content="Multiple witnesses report strange lights over Phoenix">
            <meta property="article:published_time" content="2024-01-15T10:30:00Z">
          </head>
          <body>
            <h1>UFO Sighting in Phoenix</h1>
            <p>Multiple witnesses report strange lights over Phoenix</p>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/ufo-sighting');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('UFO Sighting in Phoenix');
      expect(result?.description).toBe('Multiple witnesses report strange lights over Phoenix');
      expect(result?.sourceUrl).toBe('https://example.com/ufo-sighting');
      expect(result?.contentType).toBe('event');
      expect(result?.rawHtml).toBe(mockHtml);
      expect(result?.eventDate).toBeInstanceOf(Date);
    });

    it('should extract Open Graph metadata when available', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:title" content="Bob Lazar: Area 51 Whistleblower">
            <meta property="og:description" content="Profile of the controversial Area 51 whistleblower">
            <title>Different Title</title>
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/bob-lazar');

      expect(result?.title).toBe('Bob Lazar: Area 51 Whistleblower');
      expect(result?.description).toBe('Profile of the controversial Area 51 whistleblower');
    });

    it('should classify content as "person" when person keywords are present', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Jesse Marcel Biography</title>
            <meta name="description" content="Profile of the Roswell witness and investigator">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/jesse-marcel');

      expect(result?.contentType).toBe('person');
    });

    it('should classify content as "theory" when theory keywords are present', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ancient Aliens Theory</title>
            <meta name="description" content="Theory suggests extraterrestrial visitors in ancient times">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/ancient-aliens');

      expect(result?.contentType).toBe('theory');
    });

    it('should classify content as "news" when news keywords are present', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Pentagon Announces UFO Investigation</title>
            <meta name="description" content="Breaking: Government reveals new UFO research program">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/pentagon-news');

      expect(result?.contentType).toBe('news');
    });

    it('should default to "news" when no clear content type is identified', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Generic UFO Article</title>
            <meta name="description" content="Some information about UFOs">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/generic');

      expect(result?.contentType).toBe('news');
    });

    it('should return null when title is missing', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head></head>
          <body>
            <p>Some content without a title</p>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/no-title');

      expect(result).toBeNull();
    });

    it('should handle extraction errors and return null', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await extractor.extract('https://example.com/error');

      expect(result).toBeNull();
    });

    it('should store raw HTML for admin reference', async () => {
      const mockHtml = '<html><head><title>Test</title></head><body>Content</body></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/test');

      expect(result?.rawHtml).toBe(mockHtml);
    });

    it('should parse ISO 8601 date format', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Article</title>
            <meta property="article:published_time" content="2024-01-15T10:30:00Z">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/dated');

      expect(result?.eventDate).toBeInstanceOf(Date);
      expect(result?.eventDate?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should extract date from time element with datetime attribute', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <time datetime="2024-02-20T15:45:00Z">February 20, 2024</time>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/time-element');

      expect(result?.eventDate).toBeInstanceOf(Date);
      expect(result?.eventDate?.toISOString()).toBe('2024-02-20T15:45:00.000Z');
    });

    it('should return null for eventDate when no date is found', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Article</title></head>
          <body><p>No date information</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/no-date');

      expect(result?.eventDate).toBeNull();
    });

    it('should handle axios timeout errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

      const result = await extractor.extract('https://example.com/timeout');

      expect(result).toBeNull();
    });

    it('should fall back to Puppeteer when Cheerio extraction fails', async () => {
      // First call (Cheerio) returns empty title
      mockedAxios.get.mockResolvedValue({ data: '<html><body></body></html>' });

      // Mock Puppeteer
      const mockPage = {
        setUserAgent: jest.fn(),
        goto: jest.fn(),
        content: jest.fn().mockResolvedValue(`
          <html>
            <head><title>JS-Rendered Title</title></head>
            <body><p>JS-rendered content</p></body>
          </html>
        `),
        close: jest.fn()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
      };

      mockedPuppeteer.launch.mockResolvedValue(mockBrowser as any);

      const result = await extractor.extract('https://example.com/js-heavy');

      expect(result?.title).toBe('JS-Rendered Title');
      expect(mockedPuppeteer.launch).toHaveBeenCalled();
    });

    it('should extract description from first paragraph when meta tags are missing', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <p>This is the first paragraph with description content.</p>
            <p>This is the second paragraph.</p>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/paragraph');

      expect(result?.description).toBe('This is the first paragraph with description content.');
    });

    it('should extract title from h1 when title tag is missing', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head></head>
          <body>
            <h1>Main Heading Title</h1>
            <p>Content</p>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/h1-title');

      expect(result?.title).toBe('Main Heading Title');
    });

    it('should classify Roswell incident as event', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>The Roswell Incident</title>
            <meta name="description" content="The famous UFO crash in Roswell, New Mexico">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/roswell');

      expect(result?.contentType).toBe('event');
    });
  });

  describe('error handling', () => {
    it('should log errors when extraction fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockedAxios.get.mockRejectedValue(new Error('Network failure'));

      await extractor.extract('https://example.com/error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid date formats gracefully', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta property="article:published_time" content="invalid-date">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      const result = await extractor.extract('https://example.com/invalid-date');

      expect(result?.eventDate).toBeNull();
    });
  });

  describe('close method', () => {
    it('should close browser instance when called', async () => {
      const mockBrowser = {
        newPage: jest.fn(),
        close: jest.fn()
      };

      mockedPuppeteer.launch.mockResolvedValue(mockBrowser as any);

      // Trigger browser launch by failing Cheerio extraction
      mockedAxios.get.mockResolvedValue({ data: '<html><body></body></html>' });
      
      const mockPage = {
        setUserAgent: jest.fn(),
        goto: jest.fn(),
        content: jest.fn().mockResolvedValue('<html><head><title>Test</title></head></html>'),
        close: jest.fn()
      };
      
      mockBrowser.newPage.mockResolvedValue(mockPage as any);

      await extractor.extract('https://example.com/test');
      await extractor.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('extractAndStore integration', () => {
    let mockValidator: any;
    let mockDuplicateDetector: any;
    let mockStorageService: any;

    beforeEach(() => {
      mockValidator = {
        validate: jest.fn()
      };

      mockDuplicateDetector = {
        checkDuplicate: jest.fn()
      };

      mockStorageService = {
        insertReviewQueue: jest.fn()
      };

      extractor.setValidator(mockValidator);
      extractor.setDuplicateDetector(mockDuplicateDetector);
      extractor.setStorageService(mockStorageService);
    });

    it('should extract, validate, check duplicates, and store valid content', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>UFO Sighting</title>
            <meta name="description" content="A UFO was spotted">
          </head>
          <body></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
        isPotentialDuplicate: false
      });
      mockStorageService.insertReviewQueue.mockResolvedValue(123);

      const contentId = await extractor.extractAndStore('https://example.com/ufo');

      expect(contentId).toBe(123);
      expect(mockValidator.validate).toHaveBeenCalled();
      expect(mockDuplicateDetector.checkDuplicate).toHaveBeenCalled();
      expect(mockStorageService.insertReviewQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'UFO Sighting',
          sourceUrl: 'https://example.com/ufo'
        }),
        false
      );
    });

    it('should return null when extraction fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const contentId = await extractor.extractAndStore('https://example.com/error');

      expect(contentId).toBeNull();
      expect(mockValidator.validate).not.toHaveBeenCalled();
      expect(mockDuplicateDetector.checkDuplicate).not.toHaveBeenCalled();
      expect(mockStorageService.insertReviewQueue).not.toHaveBeenCalled();
    });

    it('should return null when validation fails', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Title is required']
      });

      const contentId = await extractor.extractAndStore('https://example.com/invalid');

      expect(contentId).toBeNull();
      expect(mockValidator.validate).toHaveBeenCalled();
      expect(mockDuplicateDetector.checkDuplicate).not.toHaveBeenCalled();
      expect(mockStorageService.insertReviewQueue).not.toHaveBeenCalled();
    });

    it('should return null and skip storage when exact duplicate is found', async () => {
      const mockHtml = '<html><head><title>Duplicate Content</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        isPotentialDuplicate: false,
        matchedContentId: 456
      });

      const contentId = await extractor.extractAndStore('https://example.com/duplicate');

      expect(contentId).toBeNull();
      expect(mockValidator.validate).toHaveBeenCalled();
      expect(mockDuplicateDetector.checkDuplicate).toHaveBeenCalled();
      expect(mockStorageService.insertReviewQueue).not.toHaveBeenCalled();
    });

    it('should store content with potential duplicate flag when similar title found', async () => {
      const mockHtml = '<html><head><title>Similar Content</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
        isPotentialDuplicate: true,
        matchedContentId: 789,
        similarityScore: 0.92
      });
      mockStorageService.insertReviewQueue.mockResolvedValue(999);

      const contentId = await extractor.extractAndStore('https://example.com/similar');

      expect(contentId).toBe(999);
      expect(mockStorageService.insertReviewQueue).toHaveBeenCalledWith(
        expect.any(Object),
        true // isPotentialDuplicate flag
      );
    });

    it('should throw error when validator is not set', async () => {
      const extractorWithoutValidator = new ContentExtractor();
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });

      await expect(
        extractorWithoutValidator.extractAndStore('https://example.com/test')
      ).rejects.toThrow('Validator not set');
    });

    it('should throw error when duplicate detector is not set', async () => {
      const extractorWithoutDetector = new ContentExtractor();
      extractorWithoutDetector.setValidator(mockValidator);
      
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });

      await expect(
        extractorWithoutDetector.extractAndStore('https://example.com/test')
      ).rejects.toThrow('DuplicateDetector not set');
    });

    it('should throw error when storage service is not set', async () => {
      const extractorWithoutStorage = new ContentExtractor();
      extractorWithoutStorage.setValidator(mockValidator);
      extractorWithoutStorage.setDuplicateDetector(mockDuplicateDetector);
      
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
        isPotentialDuplicate: false
      });

      await expect(
        extractorWithoutStorage.extractAndStore('https://example.com/test')
      ).rejects.toThrow('StorageService not set');
    });

    it('should return null when storage fails', async () => {
      const mockHtml = '<html><head><title>Test</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
        isPotentialDuplicate: false
      });
      mockStorageService.insertReviewQueue.mockRejectedValue(new Error('Database error'));

      const contentId = await extractor.extractAndStore('https://example.com/storage-error');

      expect(contentId).toBeNull();
    });

    it('should log validation errors when validation fails', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockHtml = '<html><head><title></title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({
        isValid: false,
        errors: ['Title is required', 'Source URL is invalid']
      });

      await extractor.extractAndStore('https://example.com/invalid');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed'),
        expect.objectContaining({
          errors: ['Title is required', 'Source URL is invalid']
        })
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should log duplicate detection when exact duplicate found', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const mockHtml = '<html><head><title>Duplicate</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        isPotentialDuplicate: false,
        matchedContentId: 123
      });

      await extractor.extractAndStore('https://example.com/duplicate');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate detected'),
        expect.objectContaining({
          matchedContentId: 123
        })
      );
      
      consoleInfoSpy.mockRestore();
    });

    it('should log potential duplicate when similar title found', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockHtml = '<html><head><title>Similar</title></head></html>';
      mockedAxios.get.mockResolvedValue({ data: mockHtml });
      mockValidator.validate.mockReturnValue({ isValid: true, errors: [] });
      mockDuplicateDetector.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
        isPotentialDuplicate: true,
        matchedContentId: 456,
        similarityScore: 0.95
      });
      mockStorageService.insertReviewQueue.mockResolvedValue(789);

      await extractor.extractAndStore('https://example.com/similar');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potential duplicate flagged'),
        expect.objectContaining({
          contentId: 789,
          similarityScore: 0.95
        })
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});
