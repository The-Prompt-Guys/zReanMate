/**
 * End-to-end check for the Office document ingest path.
 *
 *   node scripts/verify-document-ingest.mjs [file ...]
 *   (or: npm run verify:document-ingest)
 *
 * Runs Word, Excel, PowerPoint and text files through the real pipeline against
 * the real database, and asserts the thing that separates a document from a
 * plain text dump: that the numbered part a citation points at survives into
 * document_chunks. A deck whose text all landed on "slide null" would still
 * summarise and quiz perfectly well, and the loss would only surface when a
 * student tapped a citation and it went nowhere.
 *
 * Pass file paths to check real documents of your own. With no arguments it
 * builds a small deck, workbook and document in memory, so it runs anywhere.
 *
 * Creates its own user, kit and sources, and deletes all of it afterwards.
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';

import { zipSync, strToU8 } from 'fflate';

import { getAI } from '../src/ai/index.js';
import { pool, closePool } from '../src/db/pool.js';
import { sourcesDb } from '../src/db/sources.db.js';
import { OFFICE_FORMATS } from '../src/ingest/office.js';
import { absoluteUploadPath } from '../src/middleware/upload.js';
import { ingestService } from '../src/services/ingest.service.js';

const MARKER = `verify-doc-${Date.now()}`;

let failures = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

const MIME_BY_EXT = {
  '.docx': OFFICE_FORMATS.docx.mimeType,
  '.xlsx': OFFICE_FORMATS.xlsx.mimeType,
  '.pptx': OFFICE_FORMATS.pptx.mimeType,
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
};

/** Term/definition pairs, the shape a student's glossary sheet actually takes. */
const GLOSSARY = [
  ['Term', 'Meaning'],
  ['Primary key', 'A column whose value uniquely identifies each row in a table'],
  ['Foreign key', 'A column that points at the primary key of another table'],
  ['Index', 'A structure that makes looking up rows faster as a table grows'],
  ['Normalization', 'Splitting tables apart so the same fact is not stored twice'],
  ['Transaction', 'A group of changes that either all apply or none of them do'],
  ['Schema', 'The definition of the tables, columns and types in a database'],
  ['Query', 'A statement that reads or changes the stored data'],
  ['Join', 'Combining rows from two tables using a shared key'],
  ['View', 'A saved query that behaves like a table when you read from it'],
  ['Constraint', 'A rule the database enforces on the values a column may hold'],
  ['Migration', 'A versioned change to the schema, applied once and recorded'],
  ['Deadlock', 'Two transactions each waiting on a lock the other one holds'],
];

const pack = (files) =>
  Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

/** Built-in samples, so this runs without any document to hand. */
const samples = () => {
  const deck = pack({
    '[Content_Types].xml': '<Types/>',
    'ppt/presentation.xml':
      '<presentation><sldIdLst><p:sldId id="256" r:id="rId1"/>' +
      '<p:sldId id="257" r:id="rId2"/></sldIdLst></presentation>',
    'ppt/_rels/presentation.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/>' +
      '<Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml':
      '<p:sld><a:p><a:r><a:t>Relational Databases</a:t></a:r></a:p>' +
      '<a:p><a:r><a:t>A table stores rows and columns. A primary key identifies ' +
      'each row uniquely, and can never be empty.</a:t></a:r></a:p></p:sld>',
    'ppt/slides/slide2.xml':
      '<p:sld><a:p><a:r><a:t>Normalization</a:t></a:r></a:p>' +
      '<a:p><a:r><a:t>Normalization removes duplicated data by splitting tables ' +
      'apart and linking them with foreign keys.</a:t></a:r></a:p></p:sld>',
  });

  const workbook = pack({
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="Glossary" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    // A realistic glossary rather than two rows. Flashcard generation asks the
    // model for a fixed number of distinct cards and rejects the batch if it
    // cannot produce them, so a pathologically short sample fails on the
    // flashcard step for reasons that have nothing to do with reading .xlsx —
    // and this script exists to test reading .xlsx.
    'xl/sharedStrings.xml': `<sst>${GLOSSARY.flat().map((v) => `<si><t>${v}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml':
      `<worksheet><sheetData>${GLOSSARY.map(
        (_, r) =>
          `<row r="${r + 1}"><c r="A${r + 1}" t="s"><v>${r * 2}</v></c>` +
          `<c r="B${r + 1}" t="s"><v>${r * 2 + 1}</v></c></row>`,
      ).join('')}</sheetData></worksheet>`,
  });

  const document = pack({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml':
      '<w:document><w:body>' +
      '<w:p><w:r><w:t>Week 1: Introduction to Databases</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>A database stores information in tables so that it can be ' +
      'queried and updated reliably by many people at once.</w:t></w:r></w:p>' +
      '</w:body></w:document>',
  });

  return [
    ['lecture.pptx', deck],
    ['glossary.xlsx', workbook],
    ['week1.docx', document],
    [
      'notes.txt',
      Buffer.from(
        'Week 2 notes\nAn index makes lookups faster as a table grows larger.',
        'utf8',
      ),
    ],
  ];
};

const createdPaths = [];
let userId;
let kitId;

const setup = async () => {
  const user = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, locale, plan_tier)
     VALUES ($1, $2, 'x', 'km', 'plus') RETURNING id`,
    [MARKER, `${MARKER}@example.test`],
  );
  userId = user.rows[0].id;

  const kit = await pool.query(
    'INSERT INTO study_kits (user_id, title) VALUES ($1, $2) RETURNING id',
    [userId, MARKER],
  );
  kitId = kit.rows[0].id;
};

const makeSource = async (name, bytes) => {
  const storagePath = `${userId}/${name}`;
  const absolute = absoluteUploadPath(storagePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  createdPaths.push(absolute);

  const { id } = await sourcesDb.create({
    kitId,
    userId,
    kind: 'document',
    title: name,
    originalFilename: name,
    storagePath,
    mimeType: MIME_BY_EXT[extname(name).toLowerCase()],
    byteSize: bytes.length,
  });
  return id;
};

const cleanup = async () => {
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  for (const path of createdPaths) await rm(path, { force: true });
};

const run = async () => {
  console.log(`\nprovider: ${getAI().name}\n`);
  await setup();

  const argv = process.argv.slice(2);
  const cases = argv.length
    ? await Promise.all(argv.map(async (path) => [basename(path), await readFile(path)]))
    : samples();

  for (const [name, bytes] of cases) {
    console.log(name);
    const id = await makeSource(name, bytes);
    await ingestService.processSource(id);

    const source = await sourcesDb.findByIdUnscoped(id);
    check(
      'reaches ready',
      source.status === 'ready',
      source.error_message ?? `status=${source.status}`,
    );
    if (source.status !== 'ready') {
      console.log('');
      continue;
    }

    const { rows: chunks } = await pool.query(
      `SELECT content, page_number, metadata FROM document_chunks
        WHERE source_id = $1 ORDER BY chunk_index`,
      [id],
    );
    check('chunks were written', chunks.length > 0, `${chunks.length} chunk(s)`);

    // The citation unit is the whole point of this path over a plain text dump.
    const numbered = chunks.filter((chunk) => chunk.page_number !== null);
    check(
      'every chunk carries the part it came from',
      chunks.length > 0 && numbered.length === chunks.length,
      `${numbered.length}/${chunks.length} numbered`,
    );

    const unit = chunks[0]?.metadata?.unit;
    check('the part is labelled with a unit that fits the format', Boolean(unit), `unit=${unit}`);

    check(
      'the numbering starts at 1 and never goes backwards',
      (numbered[0]?.page_number ?? 0) >= 1 &&
        numbered.every((chunk, i) => i === 0 || chunk.page_number >= numbered[i - 1].page_number),
      numbered.map((chunk) => chunk.page_number).join(','),
    );

    const { rows: materials } = await pool.query(
      `SELECT (SELECT count(*) FROM summaries  WHERE source_id = $1)::int AS summaries,
              (SELECT count(*) FROM flashcards WHERE source_id = $1)::int AS flashcards`,
      [id],
    );
    check(
      'study materials were generated from it',
      materials[0].summaries > 0 && materials[0].flashcards > 0,
      JSON.stringify(materials[0]),
    );
    console.log('');
  }
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

console.log(failures === 0 ? 'all checks passed' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
