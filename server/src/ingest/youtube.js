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
 * Parses the legacy `<text start="seconds" dur="seconds">` transcript format.
 *
 * Kept because the caption URLs YouTube hands out are not uniform — the format
 * depends on which client asked for them, so both this and srv3 below are live
 * paths rather than one being a historical leftover.
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
 * Parses srv3 (`<timedtext format="3">`), which is what the InnerTube player
 * returns.
 *
 * Two differences from the legacy format above, and getting either wrong is
 * silent rather than loud: the element is `<p>` not `<text>`, and `t`/`d` are
 * MILLISECONDS where `start`/`dur` were seconds. A cue list built with the
 * wrong unit still chunks and embeds fine — it only shows up much later, as
 * tutor citations and chapter timings pointing a thousand times too far into
 * the video.
 *
 * Auto-generated tracks nest per-word `<s>` spans inside each `<p>`; stripping
 * tags and joining is what turns those back into a sentence. `<p>` elements
 * carrying only whitespace are the format's paragraph breaks, and drop out.
 */
const parseTranscriptSrv3 = (xmlText) => {
  const cues = [];
  const regex = /<p\s+([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = regex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const startMs = parseFloat(/\bt="(-?[\d.]+)"/.exec(attrs)?.[1] ?? 'NaN');
    if (Number.isNaN(startMs)) continue;
    const durationMs = parseFloat(/\bd="([\d.]+)"/.exec(attrs)?.[1] ?? 'NaN');

    const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      cues.push({
        text,
        startSeconds: startMs / 1000,
        durationSeconds: Number.isNaN(durationMs) ? 3.0 : durationMs / 1000,
      });
    }
  }

  return cues;
};

/**
 * Parses json3, the format the caption endpoint returns when it honours
 * `&fmt=json3`. Like srv3, its times are in milliseconds.
 *
 * Each event carries its line as a list of `segs` — one per word on an
 * auto-generated track — so they are joined before the cue is built.
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
 * Picks the parser by what actually came back, not by what was requested.
 *
 * Exported for tests: the millisecond-to-second conversion in srv3 is the kind
 * of mistake that survives every integration check and only surfaces as wrong
 * citation timings weeks later.
 */
export const parseTranscript = (body) => {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    try {
      return parseTranscriptJson3(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (trimmed.includes('<timedtext') || trimmed.includes('<p ')) {
    return parseTranscriptSrv3(trimmed);
  }
  return parseTranscriptXml(trimmed);
};

/**
 * The InnerTube client we identify as.
 *
 * This is not a disguise for its own sake. Scraping `youtube.com/watch` still
 * yields a player response with a full `captionTracks` list, so that path looks
 * healthy right up to the end — but the `baseUrl`s in it now answer 200 with a
 * ZERO-BYTE body, because the web player is expected to attest itself with a
 * proof-of-origin token minted by BotGuard. There is no header or query
 * parameter that substitutes for it; the bytes simply are not served.
 *
 * The Android player client is not held to that check and returns caption URLs
 * that serve their content, which is why this asks as Android rather than as
 * the browser. The User-Agent has to match the client name — asking as Android
 * from a desktop UA is refused.
 *
 * When this stops working the symptom will be the same silent one: captions
 * listed, nothing behind them. `npm run check:youtube` is the fastest way to
 * tell that apart from a video that genuinely has no captions.
 */
const INNERTUBE_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 30,
};

const INNERTUBE_USER_AGENT =
  `com.google.android.youtube/${INNERTUBE_CLIENT.clientVersion} (Linux; U; Android 11) gzip`;

/**
 * Asks the InnerTube player endpoint for one video's details and caption list.
 *
 * Note there is no API key on the URL: the old `?key=AIza...` constant is now
 * rejected with a 400, and the endpoint accepts an unkeyed POST instead.
 */
const fetchPlayerResponse = async (videoId) => {
  let response;
  try {
    response = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT,
      },
      body: JSON.stringify({
        videoId,
        context: { client: { ...INNERTUBE_CLIENT, hl: 'en', gl: 'US' } },
      }),
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

  let playerResponse;
  try {
    playerResponse = await response.json();
  } catch {
    playerResponse = null;
  }

  if (!playerResponse || !response.ok) {
    throw new IngestError(
      INGEST_ERROR_CODES.VIDEO_UNAVAILABLE,
      'Could not read video details from YouTube.',
    );
  }

  return playerResponse;
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

  const playerResponse = await fetchPlayerResponse(videoId);

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
    // Same client that was issued the URL — these are scoped to the caller.
    transcriptRes = await fetch(track.baseUrl, {
      headers: { 'User-Agent': INNERTUBE_USER_AGENT },
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

  // An empty 200 is the signature of a caption URL that needs an attestation
  // token we did not send — the track exists, it just refused to serve. Saying
  // "this video has no captions" there sends the student off to find another
  // video when the video was never the problem, so it gets its own message.
  if (transcriptData.trim().length === 0) {
    throw new IngestError(
      INGEST_ERROR_CODES.EXTRACT_FAILED,
      'YouTube listed captions for this video but would not serve them. This is a ' +
        'limit on our side rather than a problem with the video — please try again later.',
    );
  }

  const cues = parseTranscript(transcriptData);

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
