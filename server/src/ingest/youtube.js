import { INGEST_ERROR_CODES, IngestError } from './errors.js';

const FREE_VIDEO_DURATION_LIMIT_SECONDS = 1800; // 30 minutes

/**
 * Extracts YouTube video ID from various URL formats.
 *
 * @param {string} url - YouTube URL or video ID
 * @returns {string} videoId
 */
export const extractVideoId = (url) => {
  if (!url || typeof url !== 'string') {
    throw new IngestError(INGEST_ERROR_CODES.INVALID_URL);
  }

  const trimmed = url.trim();

  // Plain 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace('www.', '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    } else if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('?')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Falls through to throw
  }

  throw new IngestError(INGEST_ERROR_CODES.INVALID_URL);
};

const decodeHtmlEntities = (text) =>
  String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));

/**
 * Parses XML transcript response into structured cues.
 */
const parseTranscriptXml = (xmlText) => {
  const cues = [];
  const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let match;

  while ((match = regex.exec(xmlText)) !== null) {
    const start = parseFloat(match[1]);
    const duration = match[2] ? parseFloat(match[2]) : 3.0;
    const text = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, '')).trim();

    if (text) {
      cues.push({
        text,
        startSeconds: start,
        durationSeconds: duration,
      });
    }
  }

  return cues;
};

/**
 * Parses JSON3 transcript response into structured cues.
 */
const parseTranscriptJson3 = (jsonData) => {
  const cues = [];
  const events = jsonData?.events || [];

  for (const event of events) {
    if (!event.segs) continue;
    const start = (event.tStartMs || 0) / 1000;
    const duration = (event.dDurationMs || 3000) / 1000;
    const text = event.segs
      .map((s) => s.utf8 || '')
      .join('')
      .replace(/[\n\r]+/g, ' ')
      .trim();

    if (text) {
      cues.push({
        text,
        startSeconds: start,
        durationSeconds: duration,
      });
    }
  }

  return cues;
};

/**
 * Ingests YouTube video details and transcript cues with failure taxonomy classification.
 *
 * @param {string} urlOrId - YouTube URL or ID
 * @param {{ planTier?: string }} [options]
 * @returns {Promise<{ videoId: string, title: string, durationSeconds: number, thumbnailUrl: string, cues: Array<{ text: string, startSeconds: number, durationSeconds: number }>, fullText: string }>}
 */
export const ingestYouTube = async (urlOrId, { planTier = 'free' } = {}) => {
  const videoId = extractVideoId(urlOrId);

  let response;
  try {
    response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'km,en-US;q=0.9,en;q=0.8',
      },
    });
  } catch (err) {
    throw new IngestError(
      INGEST_ERROR_CODES.EXTRACT_FAILED,
      `Network error contacting YouTube: ${err.message}`,
    );
  }

  if (response.status === 429) {
    throw new IngestError(INGEST_ERROR_CODES.RATE_LIMITED);
  }

  const html = await response.text();

  // Extract ytInitialPlayerResponse JSON
  let playerResponse;
  const jsonMatch =
    html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s) ||
    html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s);

  if (jsonMatch) {
    try {
      playerResponse = JSON.parse(jsonMatch[1]);
    } catch {
      // Ignored
    }
  }

  if (!playerResponse) {
    throw new IngestError(
      INGEST_ERROR_CODES.VIDEO_UNAVAILABLE,
      'Could not read video details from YouTube.',
    );
  }

  const playabilityStatus = playerResponse.playabilityStatus?.status;
  if (playabilityStatus === 'LOGIN_REQUIRED') {
    throw new IngestError(INGEST_ERROR_CODES.AGE_RESTRICTED);
  }
  if (playabilityStatus === 'UNPLAYABLE' || playabilityStatus === 'ERROR') {
    throw new IngestError(INGEST_ERROR_CODES.VIDEO_UNAVAILABLE);
  }

  const videoDetails = playerResponse.videoDetails;
  if (!videoDetails) {
    throw new IngestError(INGEST_ERROR_CODES.VIDEO_UNAVAILABLE);
  }

  if (videoDetails.isLiveContent) {
    throw new IngestError(INGEST_ERROR_CODES.LIVE_STREAM);
  }

  const title = videoDetails.title || 'YouTube Video';
  const durationSeconds = parseInt(videoDetails.lengthSeconds, 10) || 0;
  const thumbnails = videoDetails.thumbnail?.thumbnails || [];
  const thumbnailUrl = thumbnails[thumbnails.length - 1]?.url || null;

  // Free plan limit check: 30-minute limit
  if (planTier !== 'plus' && durationSeconds > FREE_VIDEO_DURATION_LIMIT_SECONDS) {
    const minutes = Math.round(durationSeconds / 60);
    throw new IngestError(
      INGEST_ERROR_CODES.DURATION_LIMIT_EXCEEDED,
      `Free plan allows videos up to 30 minutes (this video is ${minutes}m). Please upgrade to Plus for longer videos.`,
      { durationSeconds, limitSeconds: FREE_VIDEO_DURATION_LIMIT_SECONDS },
    );
  }

  // Extract caption tracks
  const captionTracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (captionTracks.length === 0) {
    throw new IngestError(INGEST_ERROR_CODES.NO_CAPTIONS);
  }

  // Prioritize Khmer (km) -> English (en) -> First available
  const track =
    captionTracks.find((t) => t.languageCode === 'km') ||
    captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
    captionTracks[0];

  if (!track || !track.baseUrl) {
    throw new IngestError(INGEST_ERROR_CODES.NO_CAPTIONS);
  }

  // Fetch transcript content
  let transcriptRes;
  try {
    transcriptRes = await fetch(track.baseUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
  } catch (err) {
    throw new IngestError(
      INGEST_ERROR_CODES.NO_CAPTIONS,
      `Could not retrieve transcript from caption track: ${err.message}`,
    );
  }

  if (!transcriptRes.ok) {
    if (transcriptRes.status === 429) {
      throw new IngestError(INGEST_ERROR_CODES.RATE_LIMITED);
    }
    throw new IngestError(INGEST_ERROR_CODES.NO_CAPTIONS);
  }

  const transcriptData = await transcriptRes.text();
  let cues = [];

  if (transcriptData.trim().startsWith('{')) {
    try {
      cues = parseTranscriptJson3(JSON.parse(transcriptData));
    } catch {
      cues = [];
    }
  } else {
    cues = parseTranscriptXml(transcriptData);
  }

  if (cues.length === 0) {
    throw new IngestError(INGEST_ERROR_CODES.NO_CAPTIONS);
  }

  const fullText = cues.map((c) => c.text).join(' ').trim();

  return {
    videoId,
    title,
    durationSeconds,
    thumbnailUrl,
    cues,
    fullText,
  };
};
