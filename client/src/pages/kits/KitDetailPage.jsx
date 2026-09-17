import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { KitsHeader, KitFolderTile } from '../../layouts/AppLayout.jsx';
import { ChevronRightIcon, Fab } from '../../components/ui.jsx';
import { materialCount } from './KitsPage.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { formatRelativeTime } from '../../lib/format.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * One study kit and the materials in it.
 *
 * The reference drops the search field, the All/Recent pills and the sort
 * control this screen used to carry — a kit holds a handful of materials, and
 * the floating button is the only action.
 */
export const KitDetailPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId } = useParams();
  const { kits, status: kitsStatus, getKit, getFiles, loadFiles } = useKits();
  const [filesStatus, setFilesStatus] = useState('loading');

  const kit = getKit(kitId) ?? kits[0];
  const kitFiles = getFiles(kitId);

  // Files belong to one kit, so they are fetched per kit rather than held for
  // every kit at once. The cancelled flag stops a slow response for the
  // previous kit from landing after the user has already opened another.
  useEffect(() => {
    if (!kitId) return undefined;
    let cancelled = false;
    setFilesStatus('loading');
    loadFiles(kitId)
      .then(() => !cancelled && setFilesStatus('ready'))
      .catch(() => !cancelled && setFilesStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [kitId, loadFiles]);

  // The kit list is still loading, so there is nothing to render a header from.
  if (!kit) {
    return (
      <main>
        <KitsHeader to="/kits" title={t('kits.title')} tile={<KitFolderTile />} />
        <div className="px-5 pt-6">
          {kitsStatus === 'error' ? (
            <p className="text-base text-mist-500">{t('kits.loadFailed')}</p>
          ) : (
            <div className="animate-pulse space-y-3" aria-busy="true" aria-label={t('common.loading')}>
              <span className="block h-20 rounded-2xl bg-white" />
              <span className="block h-20 rounded-2xl bg-white" />
            </div>
          )}
        </div>
      </main>
    );
  }

  const title = language === 'km' ? (kit.titleKm ?? kit.title) : kit.title;
  // fileCount rides on the kit row, so the header is right on first paint
  // instead of reading 0 until the file list resolves.
  const count = filesStatus === 'ready' ? kitFiles.length : (kit.fileCount ?? 0);

  return (
    <main>
      <KitsHeader
        to="/kits"
        title={title}
        meta={materialCount(t, count)}
        tile={<KitFolderTile />}
        action={
          <Link
            to={`/kits/${kit.id}/delete`}
            aria-label={t('kits.kitMenu')}
            className="-mr-1 inline-flex rounded-lg p-1 transition-opacity hover:opacity-80"
          >
            <KebabIcon />
          </Link>
        }
      />

      <div className="space-y-3 px-5 pt-4">
        {filesStatus === 'loading' && (
          <ul className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
            {[0, 1].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-3.5 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70">
                <span className="size-14 shrink-0 rounded-xl bg-tile-blue" />
                <span className="min-w-0 flex-1">
                  <span className="block h-4 w-3/5 rounded bg-tile-blue" />
                  <span className="mt-2 block h-3 w-1/3 rounded bg-tile-blue/70" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {filesStatus === 'error' && (
          <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
            <p className="text-base font-bold text-deep-900">{t('kits.filesLoadFailed')}</p>
            <button
              type="button"
              onClick={() => {
                setFilesStatus('loading');
                loadFiles(kitId)
                  .then(() => setFilesStatus('ready'))
                  .catch(() => setFilesStatus('error'));
              }}
              className="mt-4 rounded-full bg-link-700 px-6 py-3 text-base font-bold text-white"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {filesStatus === 'ready' &&
          (kitFiles.length === 0 ? (
            <EmptyKit />
          ) : (
            <ul className="space-y-3">
              {kitFiles.map((file) => (
                <li key={file.id}>
                  <MaterialRow kitId={kit.id} file={file} />
                </li>
              ))}
            </ul>
          ))}
      </div>

      <Fab to={`/kits/${kit.id}/add`} label={t('kits.addMore')} />
    </main>
  );
};

/** One material: thumbnail, name, when it was analyzed, and its kind. */
const MaterialRow = ({ kitId, file }) => {
  const t = useT();
  const { language } = useLanguage();
  const when = formatRelativeTime(file.createdAt, language);
  const ready = file.status === 'ready';

  // The ⋮ is a sibling of the row link, not a child: a button inside an anchor
  // is invalid markup, and nesting one makes the whole row ambiguous to tap.
  return (
    <div className="relative">
    <Link
      to={`/study/${kitId}?sourceId=${file.id}`}
      className="flex items-center gap-3.5 rounded-2xl bg-white p-3.5 pe-12 shadow-sm ring-1 ring-tint-200/70 transition-colors hover:bg-wash-50"
    >
      <Thumbnail kind={file.kind} mimeType={file.mimeType} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-extrabold text-deep-900">{file.name}</span>
        <span className="block text-sm font-medium text-ink-600">
          {ready
            ? when
              ? t('kits.analyzed', { when })
              : t('kits.analyzedJustNow')
            : t(`kits.fileStatus_${file.status ?? 'pending'}`)}
        </span>
        {ready && (
          <span className="mt-1.5 inline-flex rounded-full bg-tile-blue px-3 py-1 text-sm font-bold text-link-700">
            {t('kits.readyToStudy')}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5 text-sky-600">
        <KindMark kind={file.kind} mimeType={file.mimeType} />
        <ChevronRightIcon className="size-5" />
      </span>
    </Link>
      <Link
        to={`/kits/${kitId}/files/${file.id}/delete`}
        aria-label={t('kits.fileMenu')}
        className="absolute end-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-600 transition-colors hover:bg-tint-100"
      >
        <KebabIcon className="size-5" />
      </Link>
    </div>
  );
};

/** The ⋮ from docs/screens/03-study-kits/03, on the kit header and each row. */
const KebabIcon = ({ className = 'size-7' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

/** A page-with-content thumbnail, tinted by the material's kind. */
const Thumbnail = ({ kind, mimeType }) => (
  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-wash-50 ring-1 ring-tint-200/70">
    <svg viewBox="0 0 32 32" className="size-9" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="24" height="26" rx="3" fill="#fff" />
      <path d="M8 8h11M8 12h9M8 16h5M8 20h4M8 24h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink-400" />
      <rect x="14" y="15" width="14" height="12" rx="2.5" className={TINTS[tintKey(kind, mimeType)] ?? TINTS.document} fill="currentColor" />
      <g className="text-white">
        {kind === 'youtube' ? (
          <path d="m19 18 5 3-5 3z" fill="currentColor" />
        ) : kind === 'image' ? (
          <>
            <circle cx="18" cy="19.5" r="1.3" fill="currentColor" />
            <path d="m15.5 25 3.5-4 2.5 2.5 2-2 3 3.5z" fill="currentColor" />
          </>
        ) : (
          // Ruled lines, not the picture glyph: a photo icon on a spreadsheet
          // reads as "this material is an image", which is the one thing it
          // is not.
          <path
            d="M17 19h8M17 22h8M17 25h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  </span>
);

const TINTS = {
  image: 'text-sky-500',
  pdf: 'text-link-700',
  youtube: 'text-danger-600',
  document: 'text-sky-600',
  docx: 'text-link-700',
  xlsx: 'text-kit-teal',
  pptx: 'text-kit-amber',
};

/**
 * Word, Excel and PowerPoint all arrive as kind 'document' — the distinction
 * lives in the mime type, because it changes nothing about how the file is
 * processed and only matters here, where a student picks their lecture deck
 * out of a list of six materials at a glance.
 *
 * The colours are the ones each program is known by. That is not decoration:
 * it is the fastest way to find the right file in a list, and it costs nothing.
 */
const OOXML_TINT_KEYS = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/pdf': 'pdf',
};

const tintKey = (kind, mimeType) =>
  kind === 'document' ? (OOXML_TINT_KEYS[mimeType] ?? 'document') : kind;

/** The small kind badge at the right of a material row. */
const KindMark = ({ kind, mimeType }) => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
    <path
      d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    {kind === 'youtube' ? (
      <path d="m10 12.5 4 2-4 2z" fill="currentColor" />
    ) : kind === 'image' ? (
      <>
        <circle cx="10" cy="12.5" r="1" fill="currentColor" />
        <path d="m8.5 17 2.5-3 1.8 1.8L14.5 14l2 3z" fill="currentColor" />
      </>
    ) : (
      <path d="M8.5 12.5h7M8.5 15.5h7M8.5 18.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    )}
  </svg>
);

/**
 * The empty kit: an open book with its rays and bookmark, on a soft blob.
 *
 * Drawn rather than imported — the brand mark is a flat logo, while the
 * reference's empty state is a fuller illustration with page rules, a shadow
 * and the little plus marks either side.
 */
const EmptyKit = () => {
  const t = useT();
  return (
    <div className="px-4 pt-10 text-center">
      <svg viewBox="0 0 220 160" className="mx-auto w-56" fill="none" aria-hidden="true">
        <path
          d="M36 74c-6-28 18-46 52-48s70 6 84 26 10 48-10 58-58 12-86 6-34-14-40-42Z"
          className="text-tile-blue"
          fill="currentColor"
          fillOpacity="0.75"
        />
        <ellipse cx="112" cy="140" rx="58" ry="7" className="text-tile-blue" fill="currentColor" />
        <path d="M110 40V22M88 46 78 30M132 46l10-16" className="text-gold-300" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <path
          d="M110 62c-12-10-28-14-44-12v62c16-2 32 2 44 12 12-10 28-14 44-12V50c-16-2-32 2-44 12Z"
          fill="#fff"
          className="text-link-700"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path d="M110 62v62" className="text-link-700" stroke="currentColor" strokeWidth="7" />
        <path
          d="M78 68h20M78 80h20M78 92h16M122 68h20M122 80h20M122 92h16"
          className="text-tile-blue"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M138 108v26l10-8 10 8v-26z" className="text-gold-300" fill="currentColor" />
        <path d="M30 66h14M37 59v14M186 88h12M192 82v12" className="text-sky-600" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>

      <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900">
        {t('kits.emptyFilesTitle')}
      </h2>
      <p className="mx-auto mt-2 max-w-[17rem] text-lg font-semibold leading-snug text-mist-500">
        {t('kits.emptyFilesBody')}
      </p>
    </div>
  );
};
