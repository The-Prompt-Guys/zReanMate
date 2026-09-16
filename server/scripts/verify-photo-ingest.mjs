/**
 * End-to-end check for the photo ingest path.
 *
 *   node scripts/verify-photo-ingest.mjs   (or: npm run verify:photo-ingest)
 *
 * A photographed page used to be stored as a single placeholder chunk — the
 * upload succeeded, the source went ready, and the summary, quiz and flashcards
 * were then generated from the string "[Image: notes.jpg]". Nothing failed, so
 * nothing said so. This exercises the real pipeline against the real database
 * and asserts the three things that would make that regression silent again:
 * the chunks hold transcribed text, an 'ocr' row lands in the cost ledger, and
 * a photo with nothing readable in it FAILS rather than going quietly ready.
 *
 * Runs against whichever provider is active. With the mock that is canned text,
 * which still proves the plumbing; with a real key it proves the vision call.
 *
 * Creates its own user, kit and source, and deletes all of it afterwards.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';

import { getAI } from '../src/ai/index.js';
import { pool, closePool } from '../src/db/pool.js';
import { sourcesDb } from '../src/db/sources.db.js';
import { absoluteUploadPath } from '../src/middleware/upload.js';
import { ingestService } from '../src/services/ingest.service.js';

const MARKER = `verify-photo-${Date.now()}`;

let failures = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

/**
 * A real screenshot from docs/screens/, used because it is a real image with
 * real words on it. A synthetic fixture cannot serve here: a 1x1 pixel has
 * genuinely nothing to read, so a vision model is right to report no text and
 * the check would fail for the wrong reason.
 */
const SAMPLE_IMAGE = resolve(
  process.cwd(),
  '../docs/screens/03-study-kits/03-study-kit-file-list.png',
);

/**
 * A valid, entirely blank PNG, built here rather than committed as a fixture.
 *
 * This is the input that exercises the branch that matters: a real image the
 * model can open and find nothing to read on. An empty file cannot stand in for
 * it, because ingest rejects zero bytes before the model is ever called.
 */
const blankPng = (size = 64) => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crcTable = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  // One filter byte per row, then white pixels.
  const raw = Buffer.concat(
    Array.from({ length: size }, () =>
      Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xff)]),
    ),
  );

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const createdPaths = [];
let userId;
let kitId;

const setup = async () => {
  const user = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, locale, plan_tier)
     VALUES ($1, $2, 'x', 'km', 'free') RETURNING id`,
    [MARKER, `${MARKER}@example.test`],
  );
  userId = user.rows[0].id;

  const kit = await pool.query(
    `INSERT INTO study_kits (user_id, title) VALUES ($1, $2) RETURNING id`,
    [userId, MARKER],
  );
  kitId = kit.rows[0].id;
};

/** Creates an image source whose file on disk holds `bytes`. */
const makeImageSource = async (name, bytes, mimeType = 'image/jpeg') => {
  const storagePath = `${userId}/${name}`;
  const absolute = absoluteUploadPath(storagePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  createdPaths.push(absolute);

  const { id } = await sourcesDb.create({
    kitId,
    userId,
    kind: 'image',
    title: name,
    originalFilename: name,
    storagePath,
    mimeType,
    byteSize: bytes.length,
  });
  return id;
};

const cleanup = async () => {
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  for (const path of createdPaths) await rm(path, { force: true });
};

const run = async () => {
  const ai = getAI();
  console.log(`\nprovider: ${ai.name}\n`);

  await setup();

  // ------------------------------------------------------- a readable photo
  console.log('A. a photo with text on it');
  const goodId = await makeImageSource('notes.png', await readFile(SAMPLE_IMAGE), 'image/png');
  await ingestService.processSource(goodId);

  const source = await sourcesDb.findByIdUnscoped(goodId);
  check('source reaches ready', source.status === 'ready', `status=${source.status}`);

  const { rows: chunks } = await pool.query(
    'SELECT content FROM document_chunks WHERE source_id = $1 ORDER BY chunk_index',
    [goodId],
  );
  check('chunks were written', chunks.length > 0, `${chunks.length} chunk(s)`);

  const body = chunks.map((c) => c.content).join('\n');
  check(
    'chunks hold transcribed text, not the old placeholder',
    chunks.length > 0 && !/^\[Image: /.test(body.trim()),
    body.slice(0, 60).replace(/\n/g, ' '),
  );
  check(
    'the transcription is substantial enough to study from',
    body.length > 80,
    `${body.length} chars`,
  );

  const { rows: ocrRows } = await pool.query(
    `SELECT provider, model, status, prompt_tokens, completion_tokens, response
       FROM ai_generations WHERE source_id = $1 AND kind = 'ocr'`,
    [goodId],
  );
  check('an ocr row landed in the cost ledger', ocrRows.length === 1, `${ocrRows.length} row(s)`);
  if (ocrRows[0]) {
    check('the ocr row records success', ocrRows[0].status === 'ok', ocrRows[0].status);
    check(
      'the ocr row reports the provider that ran it',
      ocrRows[0].provider === ai.name,
      ocrRows[0].provider,
    );
    check(
      'the ocr row records what was read',
      (ocrRows[0].response?.chars ?? 0) > 0,
      JSON.stringify(ocrRows[0].response),
    );
  }

  // The whole point of reading the photo: the study materials downstream are
  // built from the transcription, not from a filename.
  const { rows: materials } = await pool.query(
    `SELECT (SELECT count(*) FROM summaries       WHERE source_id = $1)::int AS summaries,
            (SELECT count(*) FROM flashcards      WHERE source_id = $1)::int AS flashcards`,
    [goodId],
  );
  check(
    'study materials were generated from it',
    materials[0].summaries > 0 && materials[0].flashcards > 0,
    JSON.stringify(materials[0]),
  );

  // ----------------------------------------------------- an unreadable photo
  console.log('\nB. a real photo with nothing readable on it');
  if (ai.name === 'mock') {
    // Not a pass and not a failure: the mock returns canned notes for any image
    // with bytes in it, because it cannot look at pixels. Asserting here would
    // only be testing the fixture. Re-run with a key to cover this branch.
    console.log('  skip this case needs a provider that can see — run with OPENAI_API_KEY set');
  } else {
  const blankId = await makeImageSource('blank.png', blankPng(), 'image/png');
  await ingestService.processSource(blankId);

  const blank = await sourcesDb.findByIdUnscoped(blankId);
  check(
    'it fails rather than going quietly ready',
    blank.status === 'failed',
    `status=${blank.status}`,
  );
  check(
    'the student is told to retake the photo',
    /photo/i.test(blank.error_message ?? ''),
    blank.error_message ?? '(no message)',
  );
  const { rows: blankChunks } = await pool.query(
    'SELECT count(*)::int AS n FROM document_chunks WHERE source_id = $1',
    [blankId],
  );
  check('nothing was embedded for it', blankChunks[0].n === 0, `${blankChunks[0].n} chunk(s)`);
  }

  // ---------------------------------------------------------- a broken upload
  console.log('\nC. an empty file');
  const emptyId = await makeImageSource('empty.jpg', Buffer.alloc(0));
  await ingestService.processSource(emptyId);

  const empty = await sourcesDb.findByIdUnscoped(emptyId);
  check('it fails', empty.status === 'failed', `status=${empty.status}`);
  check(
    'it is reported as a broken upload, not as an unreadable photo',
    /empty/i.test(empty.error_message ?? '') && !/well-lit/i.test(empty.error_message ?? ''),
    empty.error_message ?? '(no message)',
  );
  const { rows: ocrForEmpty } = await pool.query(
    "SELECT count(*)::int AS n FROM ai_generations WHERE source_id = $1 AND kind = 'ocr'",
    [emptyId],
  );
  check('no vision call was paid for it', ocrForEmpty[0].n === 0, `${ocrForEmpty[0].n} row(s)`);
};

try {
  await run();
} catch (err) {
  failures += 1;
  console.error(`\nFAIL: ${err.stack ?? err.message}`);
} finally {
  await cleanup();
  await closePool();
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
