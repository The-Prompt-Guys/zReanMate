import assert from 'node:assert/strict';
import test from 'node:test';

import { zipSync, strToU8 } from 'fflate';

import { OFFICE_FORMATS, detectOoxmlFormat, extractDocument, formatForMimeType } from '../src/ingest/office.js';

/**
 * OOXML packages built here rather than committed as binary fixtures, so the
 * shape each test depends on is visible in the test.
 *
 * Real files are covered separately by `npm run check:office`, which runs
 * against documents Office actually produced — these two do different jobs and
 * neither replaces the other. What is pinned here is the handling that is easy
 * to get plausibly wrong: shared strings, date serials, slide ordering and the
 * numbering of parts that yield no text.
 */

const pack = (files) =>
  Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

const MIME = {
  docx: OFFICE_FORMATS.docx.mimeType,
  xlsx: OFFICE_FORMATS.xlsx.mimeType,
  pptx: OFFICE_FORMATS.pptx.mimeType,
  text: 'text/plain',
};

// --- Word ------------------------------------------------------------------

const docx = (paragraphs) =>
  pack({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml':
      '<w:document><w:body>' +
      paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('') +
      '</w:body></w:document>',
  });

test('a Word document yields its paragraphs in order', async () => {
  const result = await extractDocument(docx(['Chapter 1', 'A database stores rows.']), {
    mimeType: MIME.docx,
  });
  assert.equal(result.format, 'docx');
  assert.equal(result.fullText, 'Chapter 1\nA database stores rows.');
});

test('Word text is cited by section, because the format has no pages', async () => {
  // Pagination depends on the font and paper of whoever opens the file, so
  // claiming a page number would be inventing precision.
  assert.equal(OFFICE_FORMATS.docx.unit, 'section');
});

test('a long Word document is divided into numbered sections', async () => {
  const result = await extractDocument(
    docx(Array.from({ length: 95 }, (_, i) => `Paragraph ${i + 1}`)),
    { mimeType: MIME.docx, planTier: 'plus' },
  );
  assert.equal(result.sectionCount, 3);
  assert.deepEqual(result.sections.map((s) => s.number), [1, 2, 3]);
  assert.ok(result.sections[0].text.startsWith('Paragraph 1'));
});

test('XML entities in Word text are decoded, and ampersands last', async () => {
  // &amp;lt; is how a document stores the literal text "&lt;". Unescaping the
  // ampersand first would turn it into a "<" and inject markup into content.
  const result = await extractDocument(docx(['Tom &amp; Jerry', '&amp;lt;not a tag&amp;gt;', '5 &lt; 6']), {
    mimeType: MIME.docx,
  });
  assert.equal(result.fullText, 'Tom & Jerry\n&lt;not a tag&gt;\n5 < 6');
});

test('Khmer text survives extraction unchanged', async () => {
  const khmer = 'មូលដ្ឋានទិន្នន័យរក្សាទុកព័ត៌មាន';
  const result = await extractDocument(docx([khmer]), { mimeType: MIME.docx });
  assert.equal(result.fullText, khmer);
});

// --- Excel -----------------------------------------------------------------

const xlsx = ({ sheets, strings = [], styles = null }) =>
  pack({
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml':
      '<workbook><sheets>' +
      sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships>' +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      '</Relationships>',
    'xl/sharedStrings.xml':
      `<sst>${strings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`,
    ...(styles ? { 'xl/styles.xml': styles } : {}),
    ...Object.fromEntries(sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, s.xml])),
  });

const row = (r, cells) =>
  `<row r="${r}">${cells.map((c) => `<c r="${c.ref}"${c.t ? ` t="${c.t}"` : ''}${c.s !== undefined ? ` s="${c.s}"` : ''}><v>${c.v}</v></c>`).join('')}</row>`;

test('shared strings are resolved, not left as the integers they are stored as', async () => {
  const result = await extractDocument(
    xlsx({
      strings: ['Term', 'Definition', 'Primary key'],
      sheets: [
        {
          name: 'Glossary',
          xml: `<worksheet><sheetData>${row(1, [
            { ref: 'A1', t: 's', v: 0 },
            { ref: 'B1', t: 's', v: 1 },
          ])}${row(2, [{ ref: 'A2', t: 's', v: 2 }, { ref: 'B2', v: '42' }])}</sheetData></worksheet>`,
        },
      ],
    }),
    { mimeType: MIME.xlsx },
  );
  assert.equal(result.format, 'xlsx');
  assert.equal(result.fullText, 'Glossary\nTerm\tDefinition\nPrimary key\t42');
});

test('columns are kept apart, so a term stays attached to its definition', async () => {
  const result = await extractDocument(
    xlsx({
      strings: ['Index', 'Makes lookups faster'],
      sheets: [
        {
          name: 'S',
          xml: `<worksheet><sheetData>${row(1, [
            { ref: 'A1', t: 's', v: 0 },
            { ref: 'B1', t: 's', v: 1 },
          ])}</sheetData></worksheet>`,
        },
      ],
    }),
    { mimeType: MIME.xlsx },
  );
  // Tab, not comma: cell values routinely contain commas.
  assert.ok(result.fullText.includes('Index\tMakes lookups faster'));
});

test('a date cell is rendered as a date, not as the serial number it is stored as', async () => {
  // numFmtId 14 is the built-in short date, and style index 1 uses it.
  const styles = '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
  const result = await extractDocument(
    xlsx({
      styles,
      sheets: [
        {
          name: 'Dates',
          // Excel serial 45292 is 2024-01-01, so 45678 is 386 days later:
          // 2025-01-21, crossing the 2024 leap year.
          xml: `<worksheet><sheetData>${row(1, [
            { ref: 'A1', s: 1, v: '45678' },
            { ref: 'B1', s: 0, v: '45678' },
          ])}</sheetData></worksheet>`,
        },
      ],
    }),
    { mimeType: MIME.xlsx },
  );
  assert.ok(result.fullText.includes('2025-01-21'), result.fullText);
  // The unformatted cell keeps its number — it is a number, not a date.
  assert.ok(result.fullText.includes('45678'), result.fullText);
});

test('booleans read as words rather than as 0 and 1', async () => {
  const result = await extractDocument(
    xlsx({
      sheets: [
        {
          name: 'B',
          xml: `<worksheet><sheetData>${row(1, [
            { ref: 'A1', t: 'b', v: '1' },
            { ref: 'B1', t: 'b', v: '0' },
          ])}</sheetData></worksheet>`,
        },
      ],
    }),
    { mimeType: MIME.xlsx },
  );
  assert.ok(result.fullText.includes('TRUE\tFALSE'));
});

test('an empty sheet does not renumber the sheets after it', async () => {
  const result = await extractDocument(
    xlsx({
      strings: ['first', 'third'],
      sheets: [
        { name: 'One', xml: `<worksheet><sheetData>${row(1, [{ ref: 'A1', t: 's', v: 0 }])}</sheetData></worksheet>` },
        { name: 'Two', xml: '<worksheet><sheetData/></worksheet>' },
        { name: 'Three', xml: `<worksheet><sheetData>${row(1, [{ ref: 'A1', t: 's', v: 1 }])}</sheetData></worksheet>` },
      ],
    }),
    { mimeType: MIME.xlsx },
  );
  // Sheet 3 must still be sheet 3, or a citation opens the wrong tab.
  assert.deepEqual(result.sections.map((s) => s.number), [1, 3]);
  assert.equal(result.sections[1].title, 'Three');
});

// --- PowerPoint ------------------------------------------------------------

const pptx = ({ slides, order = null, notes = {} }) => {
  const ids = slides.map((_, i) => `rId${i + 1}`);
  const sequence = order ?? ids;
  return pack({
    '[Content_Types].xml': '<Types/>',
    'ppt/presentation.xml': `<presentation><sldIdLst>${sequence
      .map((id, i) => `<p:sldId id="${256 + i}" r:id="${id}"/>`)
      .join('')}</sldIdLst></presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships>${slides
      .map((_, i) => `<Relationship Id="rId${i + 1}" Target="slides/slide${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
    ...Object.fromEntries(
      slides.map((lines, i) => [
        `ppt/slides/slide${i + 1}.xml`,
        `<p:sld><p:cSld>${lines
          .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
          .join('')}</p:cSld></p:sld>`,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(notes).map(([slideIndex, text]) => [
        `ppt/slides/_rels/slide${Number(slideIndex) + 1}.xml.rels`,
        `<Relationships><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${Number(slideIndex) + 1}.xml"/></Relationships>`,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(notes).map(([slideIndex, text]) => [
        `ppt/notesSlides/notesSlide${Number(slideIndex) + 1}.xml`,
        `<p:notes><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:notes>`,
      ]),
    ),
  });
};

test('slides come out in presentation order, not in file-name order', async () => {
  // A reordered deck keeps its original file names and rewrites the id list,
  // so numbering by file name cites the wrong slide.
  const result = await extractDocument(
    pptx({
      slides: [['First file'], ['Second file'], ['Third file']],
      order: ['rId3', 'rId1', 'rId2'],
    }),
    { mimeType: MIME.pptx },
  );
  assert.equal(result.format, 'pptx');
  assert.deepEqual(
    result.sections.map((s) => s.text),
    ['Third file', 'First file', 'Second file'],
  );
});

test('a picture-only slide does not renumber the slides after it', async () => {
  const result = await extractDocument(
    pptx({ slides: [['Intro'], [], ['Conclusion']] }),
    { mimeType: MIME.pptx },
  );
  // "Conclusion" is slide 3 in PowerPoint and must be slide 3 in a citation.
  assert.deepEqual(result.sections.map((s) => s.number), [1, 3]);
  assert.equal(result.sections[1].text, 'Conclusion');
});

test('speaker notes are attached to the slide that owns them', async () => {
  // Only slides WITH notes get a notesSlide, so notesSlide1 can belong to
  // slide 3. Pairing them by number puts the text on the wrong slide.
  const result = await extractDocument(
    pptx({ slides: [['Slide one'], ['Slide two'], ['Slide three']], notes: { 2: 'The three rules are…' } }),
    { mimeType: MIME.pptx },
  );
  const withNotes = result.sections.filter((s) => s.text.includes('Speaker notes:'));
  assert.equal(withNotes.length, 1);
  assert.equal(withNotes[0].number, 3);
  assert.ok(withNotes[0].text.includes('The three rules are…'));
});

test('a slide title becomes the section title', async () => {
  const result = await extractDocument(pptx({ slides: [['Normalization', 'Three rules']] }), {
    mimeType: MIME.pptx,
  });
  assert.equal(result.sections[0].title, 'Normalization');
});

// --- Plain text ------------------------------------------------------------

test('a plain text file is read as one section', async () => {
  const result = await extractDocument(Buffer.from('line one\r\nline two\r\n', 'utf8'), {
    mimeType: 'text/plain',
  });
  assert.equal(result.format, 'text');
  assert.equal(result.sectionCount, 1);
  // CRLF normalised, so Windows notes do not chunk with stray carriage returns.
  assert.equal(result.fullText, 'line one\nline two');
});

test('a CSV is read as text rather than being rejected', async () => {
  const result = await extractDocument(Buffer.from('term,definition\nindex,faster lookups', 'utf8'), {
    mimeType: 'text/csv',
  });
  assert.ok(result.fullText.includes('faster lookups'));
});

// --- Detection and failures ------------------------------------------------

test('the real format is read from the package, not from what the upload claimed', async () => {
  // A .xlsx renamed to .docx passes the extension and magic-byte checks, since
  // all three formats are ZIPs. Only the contents tell the truth.
  const result = await extractDocument(
    xlsx({ strings: ['hello'], sheets: [{ name: 'S', xml: `<worksheet><sheetData>${row(1, [{ ref: 'A1', t: 's', v: 0 }])}</sheetData></worksheet>` }] }),
    { mimeType: MIME.docx },
  );
  assert.equal(result.format, 'xlsx');
});

test('detectOoxmlFormat identifies each package by its marker part', () => {
  const zip = (files) => Object.fromEntries(Object.keys(files).map((k) => [k, new Uint8Array()]));
  assert.equal(detectOoxmlFormat(zip({ 'word/document.xml': 1 })), 'docx');
  assert.equal(detectOoxmlFormat(zip({ 'xl/workbook.xml': 1 })), 'xlsx');
  assert.equal(detectOoxmlFormat(zip({ 'ppt/presentation.xml': 1 })), 'pptx');
  assert.equal(detectOoxmlFormat(zip({ 'mimetype': 1 })), null);
});

test('mime types map to the format that reads them', () => {
  assert.equal(formatForMimeType(MIME.docx), 'docx');
  assert.equal(formatForMimeType(MIME.xlsx), 'xlsx');
  assert.equal(formatForMimeType(MIME.pptx), 'pptx');
  assert.equal(formatForMimeType('text/markdown'), 'text');
  assert.equal(formatForMimeType('application/msword'), null);
});

test('a ZIP that is not an Office file is reported as such', async () => {
  await assert.rejects(
    extractDocument(pack({ 'random.txt': 'hello' }), { mimeType: MIME.docx }),
    (err) => err.code === 'extract_failed' && /Word, Excel or PowerPoint/.test(err.message),
  );
});

test('a file that is not a ZIP at all fails with a readable reason', async () => {
  await assert.rejects(
    extractDocument(Buffer.from('not a zip at all', 'utf8'), { mimeType: MIME.docx }),
    (err) => err.code === 'extract_failed' && /corrupt or password-protected/.test(err.message),
  );
});

test('an empty file is reported as a broken upload', async () => {
  await assert.rejects(
    extractDocument(Buffer.alloc(0), { mimeType: MIME.docx }),
    (err) => err.code === 'extract_failed' && /empty/i.test(err.message),
  );
});

test('a document with no readable text fails instead of going through empty', async () => {
  await assert.rejects(extractDocument(docx([]), { mimeType: MIME.docx }), (err) => err.code === 'empty_content');
  await assert.rejects(
    extractDocument(Buffer.from('   \n  ', 'utf8'), { mimeType: 'text/plain' }),
    (err) => err.code === 'empty_content',
  );
});

test('the free plan is capped on parts, and Plus is not', async () => {
  const big = pptx({ slides: Array.from({ length: 60 }, (_, i) => [`Slide ${i + 1}`]) });

  await assert.rejects(
    extractDocument(big, { mimeType: MIME.pptx, planTier: 'free' }),
    (err) => err.code === 'page_limit_exceeded' && /slides/.test(err.message),
  );

  const allowed = await extractDocument(big, { mimeType: MIME.pptx, planTier: 'plus' });
  assert.equal(allowed.sectionCount, 60);
});

test('the limit message names the unit that fits the format', async () => {
  const sheets = Array.from({ length: 60 }, (_, i) => ({
    name: `S${i + 1}`,
    xml: `<worksheet><sheetData><row r="1"><c r="A1"><v>${i}</v></c></row></sheetData></worksheet>`,
  }));
  await assert.rejects(
    extractDocument(xlsx({ sheets }), { mimeType: MIME.xlsx, planTier: 'free' }),
    // "50 pages" would be nonsense for a spreadsheet.
    (err) => /sheets per document/.test(err.message),
  );
});
