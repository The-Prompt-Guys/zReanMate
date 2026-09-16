/**
 * Probes the live YouTube transcript path.
 *
 *   node scripts/check-youtube.mjs [videoIdOrUrl ...]   (or: npm run check:youtube)
 *
 * This is the script to reach for when students report that YouTube links stop
 * producing study materials, because the failure mode is a quiet one. YouTube
 * keeps listing a video's caption tracks long after it stops serving them: the
 * track URLs answer 200 with an empty body unless the caller attests itself the
 * way the web player does. From the outside that is indistinguishable from a
 * video with no captions, and the app can only report what it was told.
 *
 * So this separates the two. It walks the same path ingest does — player
 * lookup, then track fetch — and says which step gave way, against videos whose
 * captions are known to exist.
 *
 * Touches only youtube.com. No API key, no database, no tokens spent.
 */
import { ingestYouTube } from '../src/ingest/youtube.js';

/** Videos chosen to cover the tracks that behave differently, not for variety. */
const DEFAULT_CASES = [
  ['jNQXAC9IVRw', 'short video, manual captions'],
  ['dQw4w9WgXcQ', 'manual captions, many languages'],
  ['aircAruvnKk', 'long lecture, 30+ language tracks'],
  ['9bZkp7q19f0', 'auto-generated (ASR) track only'],
];

const argv = process.argv.slice(2);
const cases = argv.length > 0 ? argv.map((v) => [v, 'from argv']) : DEFAULT_CASES;

let failures = 0;

for (const [video, label] of cases) {
  const started = Date.now();
  try {
    // 'plus' so a long video exercises the transcript path rather than
    // stopping at the free plan's duration cap, which is not what is in doubt.
    const result = await ingestYouTube(video, { planTier: 'plus' });
    const elapsed = Date.now() - started;
    const lastCue = result.cues[result.cues.length - 1];

    console.log(`PASS  ${video}  (${label})`);
    console.log(`      "${result.title}"`);
    console.log(
      `      ${result.cues.length} cues, ${result.fullText.length} chars, ` +
        `video ${result.durationSeconds}s, last cue at ${lastCue.startSeconds.toFixed(1)}s, ${elapsed}ms`,
    );

    // The unit check that no amount of plausible-looking text would catch: srv3
    // reports milliseconds, and reading those as seconds puts every citation a
    // thousandfold too far into the video while the transcript still reads fine.
    if (lastCue.startSeconds > result.durationSeconds + 5) {
      console.log(
        `      WARNING: last cue sits past the end of the video — cue times are ` +
          `probably being read in the wrong unit (see parseTranscript).`,
      );
      failures += 1;
    }
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${video}  (${label})`);
    console.log(`      ${err.code ?? err.name}: ${err.message}`);
    if (err.code === 'extract_failed' && /would not serve/.test(err.message)) {
      console.log(
        '      The tracks were listed but served nothing. This is the attestation\n' +
          '      wall, not a missing transcript — the InnerTube client in\n' +
          '      src/ingest/youtube.js likely needs revisiting.',
      );
    }
    if (err.code === 'no_captions') {
      console.log('      Tracks were served but parsed to zero cues — suspect a format change.');
    }
  }
  console.log('');
}

const total = cases.length;
console.log(`${total - failures}/${total} passed`);

if (failures > 0) {
  console.log(
    '\nYouTube ingest is degraded. Students adding video links will see the\n' +
      'failure reported on the processing sheet.',
  );
}

process.exit(failures > 0 ? 1 : 0);
