import assert from 'node:assert/strict';
import test from 'node:test';

import { extractVideoId, parseTranscript } from '../src/ingest/youtube.js';

/**
 * The transcript formats YouTube actually serves.
 *
 * These are offline on purpose. The network path is covered by
 * `npm run check:youtube`, which needs real videos; what is worth pinning here
 * is the unit conversion, because srv3 measures in milliseconds and the legacy
 * format in seconds. Reading one as the other still produces a plausible cue
 * list that chunks and embeds without complaint — the error only ever shows up
 * as tutor citations pointing past the end of the video.
 */

const SRV3 = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<body>
<p t="1200" d="2160">All right, so here we are, in front of the
elephants</p>
<p t="5318" d="2656">the cool thing about these guys</p>
<p t="12616" d="1751">and that&#39;s cool</p>
</body>
</timedtext>`;

const LEGACY = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="1.2" dur="2.16">All right</text>
<text start="5.318" dur="2.656">the cool thing</text>
</transcript>`;

const JSON3 = JSON.stringify({
  events: [
    { tStartMs: 1200, dDurationMs: 2160, segs: [{ utf8: 'All ' }, { utf8: 'right' }] },
    { tStartMs: 5318, dDurationMs: 2656, segs: [{ utf8: 'the cool thing' }] },
  ],
});

test('srv3 times are milliseconds and convert to seconds', () => {
  const cues = parseTranscript(SRV3);
  assert.equal(cues.length, 3);
  assert.equal(cues[0].startSeconds, 1.2);
  assert.equal(cues[0].durationSeconds, 2.16);
  assert.equal(cues[2].startSeconds, 12.616);
});

test('srv3 joins the wrapped line into one cue and decodes entities', () => {
  const cues = parseTranscript(SRV3);
  assert.equal(cues[0].text, 'All right, so here we are, in front of the elephants');
  assert.equal(cues[2].text, "and that's cool");
});

test('srv3 drops the paragraph-break elements that carry no text', () => {
  const cues = parseTranscript(`<timedtext format="3"><body><p t="0" d="10">
</p><p t="10" d="10">real</p></body></timedtext>`);
  assert.deepEqual(cues.map((c) => c.text), ['real']);
});

test('srv3 flattens the per-word spans of an auto-generated track', () => {
  const cues = parseTranscript(
    '<timedtext format="3"><body><p t="1000" d="2000">' +
      '<s t="0">hello</s><s t="300"> there</s></p></body></timedtext>',
  );
  assert.deepEqual(cues, [{ text: 'hello there', startSeconds: 1, durationSeconds: 2 }]);
});

test('the legacy format is still read in seconds, not milliseconds', () => {
  const cues = parseTranscript(LEGACY);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startSeconds, 1.2);
  assert.equal(cues[1].startSeconds, 5.318);
});

test('json3 is recognised by its leading brace', () => {
  const cues = parseTranscript(JSON3);
  assert.deepEqual(cues.map((c) => c.text), ['All right', 'the cool thing']);
  assert.equal(cues[0].startSeconds, 1.2);
});

test('every format agrees on the same transcript', () => {
  const starts = [SRV3, LEGACY, JSON3].map((body) =>
    parseTranscript(body).slice(0, 2).map((c) => c.startSeconds),
  );
  assert.deepEqual(starts[0], starts[1]);
  assert.deepEqual(starts[1], starts[2]);
});

test('an unparseable body yields no cues rather than throwing', () => {
  assert.deepEqual(parseTranscript(''), []);
  assert.deepEqual(parseTranscript('<html><body>nope</body></html>'), []);
  assert.deepEqual(parseTranscript('{not json'), []);
});

test('video ids are read from every URL shape the app accepts', () => {
  const id = 'jNQXAC9IVRw';
  for (const input of [
    id,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?t=30`,
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `  https://youtu.be/${id}  `,
  ]) {
    assert.equal(extractVideoId(input), id, input);
  }
});

test('a non-YouTube URL is rejected as invalid rather than guessed at', () => {
  for (const input of ['https://example.com/watch?v=abc', 'hello', '', null]) {
    assert.throws(() => extractVideoId(input), (err) => err.code === 'invalid_url');
  }
});
