import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

import multer from 'multer';

import { env } from '../config/env.js';
import { ApiError } from './errors.js';

/**
 * File uploads: multer to local disk, path in the database (CLAUDE.md, Stack).
 *
 * PDFs, images, Office documents and plain text. Three checks, because the
 * first two are cheap and the third is the only honest one:
 *
 *   1. mimetype   — the browser's Content-Type. Client-supplied, so advisory.
 *   2. extension  — also client-supplied, but catches the ordinary mistake.
 *   3. magic bytes — read off disk after the write, and the only check a
 *                    deliberately mislabelled file cannot walk past.
 *
 * Multer streams to disk before any handler runs, so a rejected file has
 * already been written. Every rejection path below unlinks it.
 */

/** The local file header every ZIP, and so every OOXML file, starts with. */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Extensions and signatures we accept, keyed by the mime type we store. */
const ACCEPTED = {
  'application/pdf': {
    kind: 'pdf',
    extensions: ['.pdf'],
    // %PDF
    magic: [[0x25, 0x50, 0x44, 0x46]],
  },
  'image/jpeg': {
    kind: 'image',
    extensions: ['.jpg', '.jpeg'],
    magic: [[0xff, 0xd8, 0xff]],
  },
  'image/png': {
    kind: 'image',
    extensions: ['.png'],
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  'image/webp': {
    kind: 'image',
    // RIFF....WEBP — bytes 8-11 carry the format, so this one is checked below.
    extensions: ['.webp'],
    magic: [[0x52, 0x49, 0x46, 0x46]],
  },

  // Word, Excel and PowerPoint are ZIP containers, so all three carry the same
  // signature and magic bytes can only prove "this is a zip". That is still
  // worth checking — it catches a renamed .exe — but it cannot tell a .docx
  // from a .xlsx. Nothing here tries to: the extractor identifies the package
  // by its contents (detectOoxmlFormat), so a mislabelled Office file is read
  // correctly instead of being rejected on a technicality.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    kind: 'document',
    extensions: ['.docx'],
    magic: [ZIP_MAGIC],
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    kind: 'document',
    extensions: ['.xlsx'],
    magic: [ZIP_MAGIC],
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    kind: 'document',
    extensions: ['.pptx'],
    magic: [ZIP_MAGIC],
  },

  // Plain text has no signature to check — any byte sequence is a legal text
  // file — so these rely on the extension and on the extractor refusing
  // anything that does not decode. `magic: []` says that explicitly rather
  // than leaving the field off and having the check read as an oversight.
  'text/plain': { kind: 'document', extensions: ['.txt', '.text'], magic: [] },
  'text/markdown': { kind: 'document', extensions: ['.md', '.markdown'], magic: [] },
  'text/csv': { kind: 'document', extensions: ['.csv'], magic: [] },
};

/**
 * Formats a student is likely to try, that this app cannot read, and what to
 * tell them instead.
 *
 * The pre-2007 binary formats share nothing with their modern namesakes — a
 * .doc is not a renamed .docx — so accepting one and failing later would cost
 * the student an upload and a wait to be told the same thing. Rejecting it at
 * the door with the actual fix is faster and kinder, and Save As is a step
 * every one of these programs has.
 *
 * Keyed by extension because that is what a student recognises, and because
 * browsers disagree about the mime type of a .doc.
 */
export const LEGACY_FORMAT_ADVICE = {
  '.doc': { convertTo: '.docx', advice: 'Open it in Word and choose File → Save As → Word Document (.docx).' },
  '.xls': { convertTo: '.xlsx', advice: 'Open it in Excel and choose File → Save As → Excel Workbook (.xlsx).' },
  '.ppt': { convertTo: '.pptx', advice: 'Open it in PowerPoint and choose File → Save As → PowerPoint Presentation (.pptx).' },
  '.pages': { convertTo: '.docx', advice: 'Open it in Pages and choose File → Export To → Word (.docx).' },
  '.numbers': { convertTo: '.xlsx', advice: 'Open it in Numbers and choose File → Export To → Excel (.xlsx).' },
  '.key': { convertTo: '.pptx', advice: 'Open it in Keynote and choose File → Export To → PowerPoint (.pptx).' },
  '.odt': { convertTo: '.docx', advice: 'Open it and choose File → Save As → Word Document (.docx).' },
  '.ods': { convertTo: '.xlsx', advice: 'Open it and choose File → Save As → Excel Workbook (.xlsx).' },
  '.odp': { convertTo: '.pptx', advice: 'Open it and choose File → Save As → PowerPoint Presentation (.pptx).' },
  '.rtf': { convertTo: '.docx', advice: 'Open it in Word and choose File → Save As → Word Document (.docx).' },
};

export const ACCEPTED_MIME_TYPES = Object.keys(ACCEPTED);

/** Absolute root every upload must stay inside. */
export const uploadRoot = resolve(process.cwd(), env.uploadDir);

/**
 * kit_sources.storage_path is stored RELATIVE to uploadRoot — "<userId>/<uuid>.pdf",
 * never an absolute path. Two reasons: the upload directory can move between
 * environments without rewriting rows, and a relative path cannot smuggle a
 * machine path into the database.
 *
 * These two helpers are the only sanctioned way to cross between the two forms,
 * so the convention lives in one place.
 */
export const relativeUploadPath = (absolutePath) => {
  const target = resolve(absolutePath);
  if (!target.startsWith(uploadRoot + sep)) {
    throw new Error(`Upload landed outside the upload root: ${target}`);
  }
  // Always store POSIX separators so a path written on Windows still resolves
  // on a Linux deploy.
  return target.slice(uploadRoot.length + 1).split(sep).join('/');
};

export const absoluteUploadPath = (storagePath) => join(uploadRoot, storagePath);

/**
 * Files are stored per user so one account's uploads can be inspected or
 * removed as a unit, and named with a UUID so an uploaded name can never steer
 * the path. The original name survives in kit_sources.original_filename.
 */
const storage = multer.diskStorage({
  async destination(req, _file, cb) {
    try {
      const dir = join(uploadRoot, req.auth.userId);
      await mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ACCEPTED[file.mimetype]?.extensions.includes(ext) ? ext : '';
    cb(null, `${randomUUID()}${safeExt}`);
  },
});

/**
 * Exported for tests: this is the only place a student learns that their .doc
 * needs converting, and the advice is easy to break silently.
 */
export const fileFilter = (_req, file, cb) => {
  const ext = extname(file.originalname).toLowerCase();
  const accepted = ACCEPTED[file.mimetype];

  if (!accepted) {
    // A format we know about and cannot read gets the conversion step rather
    // than a list of mime types, which tells a student nothing they can act on.
    const legacy = LEGACY_FORMAT_ADVICE[ext];
    if (legacy) {
      return cb(
        new ApiError(
          415,
          'unsupported_file_type',
          `ReanMate cannot read ${ext} files. ${legacy.advice}`,
          { received: ext, convertTo: legacy.convertTo },
        ),
      );
    }

    return cb(
      new ApiError(
        415,
        'unsupported_file_type',
        'You can upload a PDF, a photo, a Word, Excel or PowerPoint file, or a text file',
        { received: file.mimetype, accepted: ACCEPTED_MIME_TYPES },
      ),
    );
  }

  if (!accepted.extensions.includes(ext)) {
    return cb(
      new ApiError(
        415,
        'unsupported_file_type',
        `A ${file.mimetype} upload must be named ${accepted.extensions.join(' or ')}`,
        { received: ext || '(none)', accepted: accepted.extensions },
      ),
    );
  }

  return cb(null, true);
};

/** Single-file upload under the field name `file`. */
export const uploadSingleFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
}).single('file');

/**
 * Removes a file, refusing any path that escapes the upload root. The paths
 * here are all server-generated, so this guard is belt-and-braces — but it is
 * the difference between a bug and an arbitrary-delete primitive if a path
 * ever reaches this function from somewhere less trustworthy.
 */
export const removeUploadedFile = async (absolutePath) => {
  if (!absolutePath) return;
  const target = resolve(absolutePath);
  if (target !== uploadRoot && !target.startsWith(uploadRoot + sep)) {
    console.error('[upload] refusing to delete outside the upload root:', target);
    return;
  }
  await rm(target, { force: true });
};

/** Reads the first `length` bytes without pulling the whole file into memory. */
const readHeader = async (path, length) =>
  new Promise((resolvePromise, reject) => {
    const chunks = [];
    const stream = createReadStream(path, { start: 0, end: length - 1 });
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

/**
 * Confirms the bytes on disk match the type the client claimed. Throws (after
 * unlinking) when they do not.
 *
 * Returns the `kind` to store in kit_sources — 'pdf' or 'image', both legal
 * values of kit_sources_kind_check.
 */
export const verifyUploadedFile = async (file) => {
  const accepted = ACCEPTED[file.mimetype];

  // multer's size limit truncates rather than failing outright in some stream
  // conditions, so the size on disk is the number worth trusting.
  const { size } = await stat(file.path);
  if (size === 0) {
    await removeUploadedFile(file.path);
    throw ApiError.badRequest('That file is empty');
  }
  if (size > env.maxUploadBytes) {
    await removeUploadedFile(file.path);
    throw new ApiError(413, 'file_too_large', 'That file is too large', {
      byteSize: size,
      limit: env.maxUploadBytes,
    });
  }

  const header = await readHeader(file.path, 12);
  // An empty signature list is "this format has no signature" (plain text),
  // not "nothing matched" — `some` on an empty array is false, which would
  // reject every .txt ever uploaded.
  const matches =
    accepted.magic.length === 0 ||
    accepted.magic.some((signature) => signature.every((byte, i) => header[i] === byte));
  // WEBP is RIFF with the format tag at bytes 8-11; RIFF alone is also WAV/AVI.
  const webpOk =
    file.mimetype !== 'image/webp' || header.subarray(8, 12).toString('ascii') === 'WEBP';

  // The one check a signature-less format can still make. A NUL byte in the
  // first block means this is not text, whatever it was named — and without
  // it a renamed binary would extract into mojibake and be summarised as
  // though it were notes.
  const isSignatureless = accepted.magic.length === 0;
  const textOk = !isSignatureless || !header.includes(0x00);

  if (!matches || !webpOk || !textOk) {
    await removeUploadedFile(file.path);
    throw new ApiError(
      415,
      'unsupported_file_type',
      'That file is not the type its name and Content-Type claim',
      { declared: file.mimetype },
    );
  }

  return { kind: accepted.kind, byteSize: size };
};

/**
 * Wraps the multer middleware so its own errors arrive in the app's envelope
 * rather than as a raw MulterError with a 500.
 */
export const handleUpload = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
  }

  return uploadSingleFile(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(413, 'file_too_large', 'That file is too large', {
            limit: env.maxUploadBytes,
          }),
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          ApiError.badRequest('Upload one file at a time, in a field named "file"'),
        );
      }
      return next(ApiError.badRequest(err.message));
    }

    return next(err);
  });
};
