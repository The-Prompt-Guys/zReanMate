import { readFile } from 'node:fs/promises';
import pdf from 'pdf-parse';

import { INGEST_ERROR_CODES, IngestError } from './errors.js';

const FREE_PDF_PAGE_LIMIT = 50;

/**
 * Extracts text page-by-page from a PDF file.
 *
 * @param {string|Buffer} source - File path or Buffer
 * @param {{ planTier?: string }} [options]
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNumber: number, text: string }>, fullText: string }>}
 */
export const extractPdf = async (source, { planTier = 'free' } = {}) => {
  const dataBuffer = Buffer.isBuffer(source) ? source : await readFile(source);

  const pages = [];

  // Custom pagerender to capture text indexed by page number
  const renderPage = (pageData) => {
    const renderOptions = {
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    };

    return pageData.getTextContent(renderOptions).then((textContent) => {
      let lastY;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += `\n${item.str}`;
        }
        lastY = item.transform[5];
      }
      const pageText = text.trim();
      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text: pageText,
      });
      return pageText;
    });
  };

  let parsed;
  try {
    parsed = await pdf(dataBuffer, {
      pagerender: renderPage,
    });
  } catch (err) {
    throw new IngestError(
      INGEST_ERROR_CODES.EXTRACT_FAILED,
      `Could not extract text from PDF: ${err.message}`,
    );
  }

  const pageCount = parsed.numpages || pages.length;

  // Free-plan limit enforcement: 50-page PDF limit before generating embeddings
  if (planTier !== 'plus' && pageCount > FREE_PDF_PAGE_LIMIT) {
    throw new IngestError(
      INGEST_ERROR_CODES.PAGE_LIMIT_EXCEEDED,
      `Free plan allows up to ${FREE_PDF_PAGE_LIMIT} pages per PDF (this document has ${pageCount} pages). Please upgrade to Plus for larger documents.`,
      { pageCount, limit: FREE_PDF_PAGE_LIMIT },
    );
  }

  // Sort pages by pageNumber in ascending order
  pages.sort((a, b) => a.pageNumber - b.pageNumber);

  const fullText = pages.map((p) => p.text).join('\n\n').trim();
  if (!fullText) {
    throw new IngestError(
      INGEST_ERROR_CODES.EMPTY_CONTENT,
      'No readable text could be found in this PDF document.',
    );
  }

  return {
    pageCount,
    pages,
    fullText,
  };
};
