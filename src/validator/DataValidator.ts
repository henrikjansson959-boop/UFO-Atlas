import { ExtractedContent, ValidationResult, DataValidator as IDataValidator } from '../types';

/**
 * DataValidator validates ExtractedContent objects before storage
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
export class DataValidator implements IDataValidator {
  private readonly VALID_CONTENT_TYPES = ['event', 'person', 'theory', 'news'] as const;
  private readonly BLOCKED_CONTENT_TERMS = [
    'porn',
    'porno',
    'sex',
    'sexual',
    'escort',
    'nude',
    'xxx',
    'cocaine',
    'heroin',
    'meth',
    'drug cartel',
    'drug trafficking',
    'rape',
    'gore',
    'beheading',
    'snuff',
  ];

  /**
   * Validate extracted content
   * @param content - Extracted content to validate
   * @returns Validation result with errors if any
   */
  validate(content: ExtractedContent): ValidationResult {
    const errors: string[] = [];

    // Requirement 10.1: Validate title is present
    if (!content.title || content.title.trim() === '') {
      errors.push('Title is required');
    }

    // Requirement 10.2: Validate source_url is present
    if (!content.sourceUrl || content.sourceUrl.trim() === '') {
      errors.push('Source URL is required');
    }

    // Requirement 10.3: Validate source_url format
    if (content.sourceUrl && content.sourceUrl.trim() !== '') {
      if (!this.isValidUrl(content.sourceUrl)) {
        errors.push('Source URL is invalid');
      }
    }

    // Requirement 10.4: Validate content_type enum
    if (!this.VALID_CONTENT_TYPES.includes(content.contentType)) {
      errors.push(`Content type must be one of: ${this.VALID_CONTENT_TYPES.join(', ')}`);
    }

    // Requirement 10.5: Validate date format (ISO 8601) if present
    if (content.eventDate !== null) {
      if (!this.isValidDate(content.eventDate)) {
        errors.push('Event date must be a valid date in ISO 8601 format');
      }
    }

    const moderationText = `${content.title} ${content.description} ${content.sourceUrl}`.toLowerCase();
    if (this.BLOCKED_CONTENT_TERMS.some((term) => moderationText.includes(term))) {
      errors.push('Content blocked by safety filter');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate URL format
   * @param url - URL string to validate
   * @returns true if valid URL, false otherwise
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate date is a valid Date object
   * @param date - Date to validate
   * @returns true if valid date, false otherwise
   */
  private isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }
}
