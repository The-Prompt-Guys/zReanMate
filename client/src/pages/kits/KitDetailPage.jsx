import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { SearchField, PillSelect } from '../../components/listControls.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { formatBytes } from '../../lib/format.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/03-study-kits/03-study-kit-file-list. */
export const KitDetailPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId } = useParams();
  const { kits, status: kitsStatus, getKit, getFiles, loadFiles } = useKits();
  const [query, setQuery] = useState('');
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
        <NavyHeader>
          <div className="h-14" aria-busy="true" aria-label={t('common.loading')} />
        </NavyHeader>
        <div className="px-5 pt-6">
          {kitsStatus === 'error' ? (
            <p className="text-base text-navy-600">{t('kits.loadFailed')}</p>
          ) : (
            <div className="animate-pulse space-y-3">
              <span className="block h-16 rounded-card bg-white" />
              <span className="block h-16 rounded-card bg-white" />
            </div>
          )}
        </div>
      </main>
    );
  }

  const title = language === 'km' ? kit.titleKm : kit.title;

  const files = kitFiles.filter((file) =>
    query.trim() ? file.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to="/kits" aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            <p className="mt-1 text-base text-white/75">
              {/* fileCount rides on the kit row, so the header is right on first
                  paint instead of showing 0 until the file list resolves. */}
              {t('kits.fileSummary', {
                files: filesStatus === 'ready' ? kitFiles.length : (kit.fileCount ?? 0),
                cards: kit.cardCount ?? 0,
              })}
            </p>
          </div>
          <button type="button" aria-label={t('common.seeAll')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="12" cy="19" r="1.9" />
            </svg>
          </button>
        </div>
      </NavyHeader>

      <div className="space-y-4 px-5 pt-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t('kits.searchFiles')}
              label={t('kits.searchFiles')}
            />
          </div>
          <Link
            to={`/kits/${kit.id}/add`}
            aria-label={t('kits.addMore')}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <PillSelect label={t('kits.allFiles')} active />
          <PillSelect label={t('kits.recentlyAdded')} />
          <button
            type="button"
            aria-label={t('kits.sort')}
            className="ms-auto grid size-11 shrink-0 place-items-center rounded-full bg-tint-100 text-navy-700"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M4 7h12M4 12h8M4 17h5M18 8v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {filesStatus === 'loading' && (
          <ul className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex animate-pulse items-center gap-3.5 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
              >
                <span className="size-12 shrink-0 rounded-xl bg-tint-200" />
                <span className="min-w-0 flex-1">
                  <span className="block h-4 w-3/5 rounded bg-tint-200" />
                  <span className="mt-2 block h-3 w-1/3 rounded bg-tint-100" />
                </span>
              </li>
            ))}
          </ul>
        )}

        {filesStatus === 'error' && (
          <div className="rounded-card bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
            <p className="text-base font-bold text-navy-900">{t('kits.filesLoadFailed')}</p>
            <button
              type="button"
              onClick={() => {
                setFilesStatus('loading');
                loadFiles(kitId)
                  .then(() => setFilesStatus('ready'))
                  .catch(() => setFilesStatus('error'));
              }}
              className="mt-4 rounded-full bg-navy-800 px-6 py-3 text-base font-bold text-white"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {filesStatus === 'ready' &&
          (kitFiles.length === 0 ? (
          <div className="rounded-card border border-dashed border-navy-600/30 bg-tint-100/50 px-6 py-10 text-center">
            <p className="text-lg font-bold text-navy-900">{t('kits.emptyFilesTitle')}</p>
            <p className="mt-1.5 text-base text-navy-600">{t('kits.emptyFilesBody')}</p>
            <Link
              to={`/kits/${kit.id}/add`}
              className="mt-5 inline-flex rounded-full bg-navy-800 px-6 py-3.5 text-base font-bold text-white"
            >
              {t('dashboard.emptyAction')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
          {files.map((file) => (
            <li key={file.id}>
              <Link
                to={`/study/${kit.id}`}
                className="flex items-center gap-3.5 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
              >
                <FileTile kind={file.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-navy-900">{file.name}</span>
                  <span className="block text-sm text-navy-600">
                    {t(`kits.kind_${file.kind}`)} · {formatBytes(file.byteSize, language)}
                    {file.status && file.status !== 'ready' && (
                      <> · {t(`kits.fileStatus_${file.status}`)}</>
                    )}
                  </span>
                </span>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
          </ul>
          ))}

        {kitFiles.length > 0 && (
        <div className="text-center">
          <Link to={`/kits/${kit.id}/add`} className="text-base font-semibold text-navy-700">
            {t('kits.addMore')}
          </Link>
        </div>
        )}
      </div>
    </main>
  );
};

const TILES = {
  pdf: 'bg-tint-200',
  image: 'bg-violet-100',
  youtube: 'bg-amber-100',
  document: 'bg-tint-200',
};

const FileTile = ({ kind }) => (
  <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${TILES[kind] ?? TILES.pdf}`}>
    {kind === 'pdf' && <PdfMark />}
    {kind === 'image' && <ImageMark />}
    {kind === 'youtube' && <PlayMark />}
    {kind === 'document' && <DocMark />}
  </span>
);

const PdfMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
    <path d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z" fill="#fff" stroke="#E2574C" strokeWidth="1.6" />
    <path d="M14 3v4h4" stroke="#E2574C" strokeWidth="1.6" />
    <path d="M9.2 16.5c2.2-3.4 3-6.2 2.2-6.7-.9-.5-1.3 2.6 1.1 4.6 1 .8 2.2 1.2 3 1" stroke="#E2574C" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ImageMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="#6D4AC4" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17 5-5 3.5 3.5L16 12l4 4" strokeLinejoin="round" />
  </svg>
);

const PlayMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
    <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="#E2574C" />
    <path d="m10 9.5 5 2.5-5 2.5z" fill="#fff" />
  </svg>
);

const DocMark = () => (
  <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#2B579A" />
    <path d="m8 9 1.6 6L11 11l1.4 4L14 9" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
