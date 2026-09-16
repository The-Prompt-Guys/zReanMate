import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ACCEPTED_MIME_TYPES,
  LEGACY_FORMAT_ADVICE,
  fileFilter,
  verifyUploadedFile,
} from '../src/middleware/upload.js';
import { OFFICE_FORMATS } from '../src/ingest/office.js';

/**
 * What the upload gate accepts, and what it says when it refuses.
 *
 * The refusal messages are covered as carefully as the acceptances, because a
 * rejected upload is the only moment a student finds out their file needs
 * converting — and "unsupported_file_type" on its own leaves them stuck with a
 * .doc and no idea what to do next.
 */

const filter = (originalname, mimetype) =>
  new Promise((resolve) => {
    fileFilter({}, { originalname, mimetype }, (err, accepted) => resolve({ err, accepted }));
  });

test('the modern Office formats are accepted', async () => {
  for (const [name, mime] of [
    ['notes.docx', OFFICE_FORMATS.docx.mimeType],
    ['budget.xlsx', OFFICE_FORMATS.xlsx.mimeType],
    ['lecture.pptx', OFFICE_FORMATS.pptx.mimeType],
  ]) {
    const { err, accepted } = await filter(name, mime);
    assert.equal(err, null, `${name}: ${err?.message}`);
    assert.equal(accepted, true);
  }
});

test('plain text, markdown and CSV are accepted', async () => {
  for (const [name, mime] of [
    ['notes.txt', 'text/plain'],
    ['notes.md', 'text/markdown'],
    ['grades.csv', 'text/csv'],
  ]) {
    const { err } = await filter(name, mime);
    assert.equal(err, null, `${name}: ${err?.message}`);
  }
});

test('PDFs and photos still work', async () => {
  for (const [name, mime] of [
    ['week1.pdf', 'application/pdf'],
    ['page.jpg', 'image/jpeg'],
    ['page.png', 'image/png'],
  ]) {
    const { err } = await filter(name, mime);
    assert.equal(err, null, `${name}: ${err?.message}`);
  }
});

test('a legacy .doc is refused with the conversion step, not a mime type', async () => {
  const { err } = await filter('essay.doc', 'application/msword');
  assert.equal(err.status, 415);
  assert.equal(err.code, 'unsupported_file_type');
  // The fix has to be in the message — this is the only place it is ever shown.
  assert.match(err.message, /Save As/);
  assert.match(err.message, /\.docx/);
  assert.equal(err.details.convertTo, '.docx');
});

test('each legacy format is pointed at the right modern one', async () => {
  const expected = {
    '.doc': '.docx',
    '.xls': '.xlsx',
    '.ppt': '.pptx',
    '.pages': '.docx',
    '.numbers': '.xlsx',
    '.key': '.pptx',
    '.odt': '.docx',
    '.ods': '.xlsx',
    '.odp': '.pptx',
    '.rtf': '.docx',
  };
  for (const [ext, convertTo] of Object.entries(expected)) {
    assert.equal(LEGACY_FORMAT_ADVICE[ext]?.convertTo, convertTo, ext);
    // A spreadsheet must not be told to save as a Word document.
    assert.match(LEGACY_FORMAT_ADVICE[ext].advice, new RegExp(`\\${convertTo}\\)`), ext);
  }
});

test('an unknown format is refused with the list of what does work', async () => {
  const { err } = await filter('archive.zip', 'application/zip');
  assert.equal(err.code, 'unsupported_file_type');
  assert.match(err.message, /Word, Excel or PowerPoint/);
  assert.deepEqual(err.details.accepted, ACCEPTED_MIME_TYPES);
});

test('an Office mime type under the wrong extension is refused', async () => {
  const { err } = await filter('notes.docx', OFFICE_FORMATS.xlsx.mimeType);
  assert.equal(err.code, 'unsupported_file_type');
  assert.match(err.message, /must be named \.xlsx/);
});

// --- byte-level verification ----------------------------------------------

let dir;
const onDisk = async (name, bytes) => {
  dir ??= await mkdtemp(join(tmpdir(), 'reanmate-upload-'));
  const path = join(dir, name);
  await writeFile(path, bytes);
  return path;
};

test.after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);

test('an OOXML upload passes the ZIP signature check', async () => {
  const path = await onDisk('a.docx', ZIP);
  const result = await verifyUploadedFile({
    path,
    mimetype: OFFICE_FORMATS.docx.mimeType,
    originalname: 'a.docx',
  });
  assert.equal(result.kind, 'document');
});

test('a file renamed to .docx that is not a ZIP is rejected on its bytes', async () => {
  const path = await onDisk('fake.docx', Buffer.from('MZ this is an executable', 'utf8'));
  await assert.rejects(
    verifyUploadedFile({ path, mimetype: OFFICE_FORMATS.docx.mimeType, originalname: 'fake.docx' }),
    (err) => err.code === 'unsupported_file_type',
  );
});

test('a text file is accepted although it has no signature to check', async () => {
  // `magic: []` means "this format has no signature". An `Array.some` over it
  // is false, so treating that as "nothing matched" would reject every .txt.
  const path = await onDisk('a.txt', Buffer.from('Week 1 notes\nDatabases store rows.', 'utf8'));
  const result = await verifyUploadedFile({ path, mimetype: 'text/plain', originalname: 'a.txt' });
  assert.equal(result.kind, 'document');
});

test('Khmer text is accepted — multi-byte UTF-8 is not mistaken for binary', async () => {
  const path = await onDisk('km.txt', Buffer.from('មូលដ្ឋានទិន្នន័យរក្សាទុកព័ត៌មាន', 'utf8'));
  const result = await verifyUploadedFile({ path, mimetype: 'text/plain', originalname: 'km.txt' });
  assert.equal(result.kind, 'document');
});

test('a binary file renamed to .txt is rejected on its NUL bytes', async () => {
  // The one check a signature-less format can still make. Without it a renamed
  // binary would extract into mojibake and be summarised as though it were notes.
  const path = await onDisk('fake.txt', Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43]));
  await assert.rejects(
    verifyUploadedFile({ path, mimetype: 'text/plain', originalname: 'fake.txt' }),
    (err) => err.code === 'unsupported_file_type',
  );
});

test('an empty upload is rejected before anything tries to read it', async () => {
  const path = await onDisk('empty.docx', Buffer.alloc(0));
  await assert.rejects(
    verifyUploadedFile({ path, mimetype: OFFICE_FORMATS.docx.mimeType, originalname: 'empty.docx' }),
    (err) => /empty/i.test(err.message),
  );
});
