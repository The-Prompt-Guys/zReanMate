import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

import { INGEST_ERROR_CODES, IngestError } from './errors.js';

const FREE_PDF_PAGE_LIMIT = 50;

/**
 * Extracts text page-by-page from a PDF file.
 *
 * pdf-parse v2 is a rewrite: it exports the `PDFParse` class rather than a
 * default function, and the v1 `pagerender` hook is gone. Line reconstruction
 * that v1 left to the caller is now built in (`lineEnforce`, on by default),
 * so the old hand-rolled transform[5] comparison is no longer needed.
 *
 * @param {string|Buffer} source - File path or Buffer
 * @param {{ planTier?: string }} [options]
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNumber: number, text: string }>, fullText: string }>}
 */
export const extractPdf = async (source, { planTier = 'free' } = {}) => {
  const dataBuffer = Buffer.isBuffer(source) ? source : await readFile(source);

  // pdf.js takes ownership of the TypedArray it is handed, so pass a copy —
  // a caller that reuses its Buffer would otherwise find it detached.
  const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });

  try {
    // Page count comes from document metadata, so an over-limit PDF is
    // rejected before paying to extract text from every page.
    let pageCount;
    try {
      ({ total: pageCount } = await parser.getInfo());
    } catch (err) {
      throw new IngestError(
        INGEST_ERROR_CODES.EXTRACT_FAILED,
        `Could not extract text from PDF: ${err.message}`,
      );
    }

    // Free-plan limit enforcement: 50-page PDF limit before generating embeddings
    if (planTier !== 'plus' && pageCount > FREE_PDF_PAGE_LIMIT) {
      throw new IngestError(
        INGEST_ERROR_CODES.PAGE_LIMIT_EXCEEDED,
        `Free plan allows up to ${FREE_PDF_PAGE_LIMIT} pages per PDF (this document has ${pageCount} pages). Please upgrade to Plus for larger documents.`,
        { pageCount, limit: FREE_PDF_PAGE_LIMIT },
      );
    }

    let parsed;
    try {
      parsed = await parser.getText();
    } catch (err) {
      throw new IngestError(
        INGEST_ERROR_CODES.EXTRACT_FAILED,
        `Could not extract text from PDF: ${err.message}`,
      );
    }

    // Sort pages by pageNumber in ascending order
    const pages = parsed.pages
      .map((page) => ({ pageNumber: page.num, text: (page.text ?? '').trim() }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // Image-only pages contribute nothing and would just pad the joins.
    const fullText = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (!fullText) {
      throw new IngestError(
        INGEST_ERROR_CODES.EMPTY_CONTENT,
        'No readable text could be found in this PDF document.',
      );
    }

    return {
      pageCount: pageCount || pages.length,
      pages,
      fullText,
    };
  } finally {
    // Releases the pdf.js worker; without this the process keeps a handle open.
    await parser.destroy();
  }
};
