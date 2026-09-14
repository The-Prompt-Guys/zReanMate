/**
 * Ingest errors and taxonomy classification.
 *
 * YouTube transcripts and document ingest fail under diverse external conditions.
 * Each failure has a distinct user-facing message and machine-readable error code.
 */

export const INGEST_ERROR_CODES = {
  NO_CAPTIONS: 'no_captions',
  AGE_RESTRICTED: 'age_restricted',
  REGION_BLOCKED: 'region_blocked',
  RATE_LIMITED: 'rate_limited',
  VIDEO_UNAVAILABLE: 'video_unavailable',
  LIVE_STREAM: 'live_stream',
  DURATION_LIMIT_EXCEEDED: 'duration_limit_exceeded',
  PAGE_LIMIT_EXCEEDED: 'page_limit_exceeded',
  INVALID_URL: 'invalid_url',
  EXTRACT_FAILED: 'extract_failed',
  EMPTY_CONTENT: 'empty_content',
};

export const INGEST_MESSAGES = {
  [INGEST_ERROR_CODES.NO_CAPTIONS]:
    'This video does not have captions or a transcript available.',
  [INGEST_ERROR_CODES.AGE_RESTRICTED]:
    'This video is age-restricted and cannot be transcribed.',
  [INGEST_ERROR_CODES.REGION_BLOCKED]:
    'This video is not available in the server’s region.',
  [INGEST_ERROR_CODES.RATE_LIMITED]:
    'YouTube is temporarily rate-limiting requests. Please try again in a few minutes.',
  [INGEST_ERROR_CODES.VIDEO_UNAVAILABLE]:
    'This video is unavailable, private, or has been removed.',
  [INGEST_ERROR_CODES.LIVE_STREAM]:
    'Live streams cannot be transcribed until the stream concludes.',
  [INGEST_ERROR_CODES.DURATION_LIMIT_EXCEEDED]:
    'Free plan allows videos up to 30 minutes. Please upgrade to Plus for longer videos.',
  [INGEST_ERROR_CODES.PAGE_LIMIT_EXCEEDED]:
    'Free plan allows up to 50 pages per PDF. Please upgrade to Plus for larger documents.',
  [INGEST_ERROR_CODES.INVALID_URL]:
    'Please enter a valid YouTube video URL.',
  [INGEST_ERROR_CODES.EXTRACT_FAILED]:
    'We could not extract readable text from this material.',
  [INGEST_ERROR_CODES.EMPTY_CONTENT]:
    'No readable text could be found in this document.',
};

export class IngestError extends Error {
  /**
   * @param {string} code - from INGEST_ERROR_CODES
   * @param {string} [customMessage]
   * @param {Object} [details]
   */
  constructor(code, customMessage, details) {
    const message = customMessage || INGEST_MESSAGES[code] || 'Ingest processing failed';
    super(message);
    this.name = 'IngestError';
    this.code = code;
    this.details = details;
  }
}
