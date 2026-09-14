import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { BottomSheet, SheetOption } from '../../components/BottomSheet.jsx';
import { ArrowRightIcon, Button, TextField } from '../../components/ui.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { api, toFormError } from '../../lib/api.js';
import { formatBytes } from '../../lib/format.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * What the server's fileFilter accepts (server/src/middleware/upload.js). Kept
 * in step by hand — the accept attribute is a convenience for the file picker,
 * never the check that matters; the server re-validates mime, extension and
 * magic bytes on every upload.
 */
const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp';
const ACCEPT_PDF = 'application/pdf';

/**
 * The four "add material" sheets, from docs/screens/03-study-kits/02, 04, 05
 * and 06. When opened from a kit detail page (`/kits/:kitId/add`), they stay
 * scoped to that kit; otherwise they run from the Kits tab (`/kits/new`).
 */

const useAddMaterialPaths = () => {
  const { kitId } = useParams();
  const root = kitId ? `/kits/${kitId}/add` : '/kits/new';
  const closeTo = kitId ? `/kits/${kitId}` : '/kits';
  return { kitId, root, closeTo };
};

/** 04-add-youtube-url-popup — the chooser. */
export const AddMaterialSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const { root, closeTo } = useAddMaterialPaths();
  const [leaving, setLeaving] = useState(null);
  const leaveTimer = useRef();

  useEffect(
    () => () => {
      window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  /**
   * Every option leaves the same way: this sheet slides out to the left and
   * the chosen one slides in from the right, so the four routes feel like one
   * stack rather than four unrelated popups. The 300ms matches
   * `.sheet-slide-to-left` in index.css — shorten one and they tear.
   */
  const slideTo = (step) => {
    if (leaving) return;
    setLeaving(step);
    leaveTimer.current = window.setTimeout(() => navigate(`${root}/${step}`), 300);
  };

  return (
    <BottomSheet closeTo={closeTo} labelledBy="add-material-title" transition={leaving ? 'to-left' : 'up'}>
      <h2 id="add-material-title" className="text-2xl font-bold text-navy-900">
        {t('dashboard.addMaterial')}
      </h2>
      <p className="mt-1 text-base text-navy-600">{t('kits.addMaterialSubtitle')}</p>

      <div className="mt-5 space-y-3">
        <SheetOption
          onClick={() => slideTo('photo')}
          tone="blue"
          icon={<PhotoIcon />}
          title={t('kits.uploadPhoto')}
          description={t('kits.uploadPhotoHint')}
        />
        <SheetOption
          onClick={() => slideTo('pdf')}
          tone="violet"
          icon={<PdfIcon />}
          title={t('kits.uploadPdf')}
          description={t('kits.uploadPdfHint')}
        />
        <SheetOption
          onClick={() => slideTo('youtube')}
          tone="amber"
          icon={<PlayIcon />}
          title={t('kits.addYoutubeUrl')}
          description={t('kits.addYoutubeUrlHint')}
        />
        <SheetOption
          onClick={() => slideTo('topic')}
          tone="green"
          icon={<SparkIcon />}
          title={t('kits.enterTopic')}
          description={t('kits.enterTopicHint')}
        />
      </div>
    </BottomSheet>
  );
};

/**
 * Upload progress for a real request.
 *
 * The bar is driven by axios's onUploadProgress, so it advances with bytes on
 * the wire and stops where the wire stops. The YouTube sheet below still runs a
 * timer, because nothing is being uploaded there — it is waiting on work the
 * server has not been taught to do yet. Keeping the two apart matters: a fake
 * bar next to a real one teaches you to distrust both.
 */
export const UploadingSheet = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { uploadFile } = useKits();
  const { kitId, root, closeTo } = useAddMaterialPaths();

  const file = location.state?.file ?? null;
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    // A File cannot survive a reload — router state is gone on refresh — so
    // send the user back to pick again rather than showing an empty bar.
    if (!file || !kitId) {
      navigate(root, { replace: true });
      return;
    }
    if (started.current) return;
    started.current = true;

    uploadFile(kitId, file, { onProgress: setPercent })
      .then(() => navigate(closeTo, { replace: true }))
      .catch(setError);
  }, [file, kitId, navigate, root, closeTo, uploadFile]);

  const message = () => {
    if (!error) return null;
    if (error.code === 'file_too_large') {
      return t('kits.uploadTooLarge', { limit: formatBytes(error.details?.limit, language) });
    }
    if (error.code === 'unsupported_file_type') return t('kits.uploadWrongType');
    return error.message ?? t('kits.uploadFailed');
  };

  return (
    <BottomSheet closeTo={closeTo} labelledBy="uploading-title">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-20 place-items-center rounded-2xl bg-tint-100 text-navy-800">
          <PdfIcon />
        </span>
        <h2 id="uploading-title" className="mt-5 text-2xl font-bold text-navy-900">
          {error ? t('kits.uploadFailed') : t('kits.processingTitle')}
        </h2>
        {file && (
          <p className="mt-2 max-w-full truncate text-base text-navy-600">
            {file.name} · {formatBytes(file.size, language)}
          </p>
        )}
      </div>

      {error ? (
        <div className="mt-6">
          <p className="rounded-card bg-danger-50 px-4 py-3 text-center text-base text-danger-600">
            {message()}
          </p>
          <div className="mt-5 space-y-3">
            <Button onClick={() => navigate(root, { replace: true })}>
              {t('kits.uploadAnother')}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate(closeTo, { replace: true })}
                className="font-semibold text-navy-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-tint-100"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('kits.uploading', { percent })}
          >
            <span
              className="block h-full rounded-full bg-navy-800 transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-3 text-center text-base text-navy-600">
            {t('kits.uploading', { percent })}
          </p>
        </div>
      )}
    </BottomSheet>
  );
};

/** 05-youtube-url-entry. */
export const YouTubeUrlSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const { addKit, isDemo } = useKits();
  const { kitId, root } = useAddMaterialPaths();
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!url.trim() || submitting) return;

    if (isDemo) {
      navigate(`${root}/processing`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let targetKitId = kitId;
      if (!targetKitId) {
        const createdKit = await addKit({
          title: 'YouTube study kit',
          titleKm: 'ឯកសារសិក្សា YouTube',
          sourceKind: 'youtube',
        });
        targetKitId = createdKit.id;
      }

      const { data } = await api.post(`/kits/${targetKitId}/sources`, {
        kind: 'youtube',
        url: url.trim(),
      });

      navigate(`/kits/${targetKitId}/add/processing`, {
        state: { kitId: targetKitId, sourceId: data.source.id },
      });
    } catch (err) {
      setError(toFormError(err));
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet closeTo={root} labelledBy="youtube-title" transition="from-right">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <PlayIcon />
        </span>
        <div className="min-w-0">
          <h2 id="youtube-title" className="text-2xl font-bold text-navy-900">
            {t('kits.youtubeTitle')}
          </h2>
          <p className="mt-1 text-base text-navy-600">{t('kits.youtubeSubtitle')}</p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <TextField
          label={t('kits.youtubeTitle')}
          placeholder={t('kits.youtubePlaceholder')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          type="url"
          inputMode="url"
          required
        />

        {error && (
          <p className="rounded-card bg-danger-50 px-4 py-3 text-center text-base text-danger-600">
            {error.message ?? t('kits.createFailed')}
          </p>
        )}

        <Button type="submit" disabled={submitting || !url.trim()}>
          {submitting ? t('kits.creating') : t('kits.createStudyKit')}
          {!submitting && <ArrowRightIcon />}
        </Button>
        <p className="text-center text-sm text-ink-500">{t('kits.youtubeFootnote')}</p>
      </form>
    </BottomSheet>
  );
};

/**
 * Photo and PDF both need the same sheet: a word about what the file is for,
 * then the OS picker. They slide in like the YouTube sheet so every option in
 * the chooser behaves the same way.
 *
 * A file cannot be uploaded until a kit exists, so when this runs from the
 * Kits tab the kit is created the moment a file is chosen — not before, or an
 * abandoned picker would leave an empty kit against the free-plan cap.
 */
const PickFileSheet = ({ kind }) => {
  const t = useT();
  const navigate = useNavigate();
  const { addKit } = useKits();
  const { kitId, root } = useAddMaterialPaths();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isPhoto = kind === 'photo';
  const accept = isPhoto ? ACCEPT_IMAGE : ACCEPT_PDF;

  const onFileChosen = async (event) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError(null);

    try {
      let targetKitId = kitId;
      if (!targetKitId) {
        const created = await addKit({
          title: file.name.replace(/\.[^.]+$/, '') || t('kits.uploadPdf'),
          sourceKind: isPhoto ? 'image' : 'pdf',
        });
        targetKitId = created.id;
      }
      // The File rides in router state: out of the URL, and gone the moment
      // the upload screen unmounts.
      navigate(`/kits/${targetKitId}/add/uploading`, { state: { file } });
    } catch (err) {
      setError(toFormError(err));
      setBusy(false);
    }
  };

  return (
    <BottomSheet closeTo={root} labelledBy="pick-file-title" transition="from-right">
      <div className="flex items-start gap-4">
        <span
          className={`grid size-14 shrink-0 place-items-center rounded-2xl ${
            isPhoto ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
          }`}
        >
          {isPhoto ? <PhotoIcon /> : <PdfIcon />}
        </span>
        <div className="min-w-0">
          <h2 id="pick-file-title" className="text-2xl font-bold text-navy-900">
            {t(isPhoto ? 'kits.photoTitle' : 'kits.pdfTitle')}
          </h2>
          <p className="mt-1 text-base text-navy-600">
            {t(isPhoto ? 'kits.photoSubtitle' : 'kits.pdfSubtitle')}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={onFileChosen}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="mt-6 space-y-5">
        {error && (
          <p className="rounded-card bg-danger-50 px-4 py-3 text-center text-base text-danger-600">
            {error.message ?? t('kits.createFailed')}
          </p>
        )}
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            inputRef.current.value = '';
            inputRef.current.click();
          }}
        >
          {busy ? t('kits.creating') : t(isPhoto ? 'kits.choosePhoto' : 'kits.choosePdf')}
          {!busy && <ArrowRightIcon />}
        </Button>
        <p className="text-center text-sm text-ink-500">
          {t(isPhoto ? 'kits.photoFootnote' : 'kits.pdfFootnote')}
        </p>
      </div>
    </BottomSheet>
  );
};

export const PhotoPickSheet = () => <PickFileSheet kind="photo" />;
export const PdfPickSheet = () => <PickFileSheet kind="pdf" />;

/** The topic sheet — the same shape as the YouTube one, a field and a submit. */
export const TopicSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const { addKit } = useKits();
  const { kitId, root } = useAddMaterialPaths();
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const title = topic.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      let targetKitId = kitId;
      if (!targetKitId) {
        const created = await addKit({ title, sourceKind: 'topic' });
        targetKitId = created.id;
      }

      const { data } = await api.post(`/kits/${targetKitId}/sources`, { kind: 'topic', title });

      navigate(`/kits/${targetKitId}/add/processing`, {
        state: { kitId: targetKitId, sourceId: data.source.id },
      });
    } catch (err) {
      setError(toFormError(err));
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet closeTo={root} labelledBy="topic-title" transition="from-right">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-green-100 text-green-700">
          <SparkIcon />
        </span>
        <div className="min-w-0">
          <h2 id="topic-title" className="text-2xl font-bold text-navy-900">
            {t('kits.topicTitle')}
          </h2>
          <p className="mt-1 text-base text-navy-600">{t('kits.topicSubtitle')}</p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <TextField
          label={t('kits.topicTitle')}
          placeholder={t('kits.topicPlaceholder')}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          required
        />

        {error && (
          <p className="rounded-card bg-danger-50 px-4 py-3 text-center text-base text-danger-600">
            {error.message ?? t('kits.createFailed')}
          </p>
        )}

        <Button type="submit" disabled={submitting || !topic.trim()}>
          {submitting ? t('kits.creating') : t('kits.createStudyKit')}
          {!submitting && <ArrowRightIcon />}
        </Button>
        <p className="text-center text-sm text-ink-500">{t('kits.topicFootnote')}</p>
      </form>
    </BottomSheet>
  );
};

/** 06-youtube-processing — three staged bars. */
const STAGES = ['kits.stageReading', 'kits.stageFlashcards', 'kits.stagePreparing'];

export const ProcessingSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { addKit, addFile, isDemo, refresh, loadFiles } = useKits();
  const { kitId, closeTo, root } = useAddMaterialPaths();

  const stateKitId = location.state?.kitId || kitId;
  const stateSourceId = location.state?.sourceId;

  const [progress, setProgress] = useState(0);
  const [_source, setSource] = useState(null);
  const [pollError, setPollError] = useState(null);
  const finished = useRef(false);

  // Prototype fallback (timer-driven)
  useEffect(() => {
    if (!isDemo && stateSourceId && stateKitId) return;

    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 300) {
          clearInterval(timer);
          if (!finished.current) {
            finished.current = true;
            if (kitId) {
              addFile(kitId, {
                name: 'Intro to Databases — full lecture',
                kind: 'youtube',
                size: '5h 02m',
              });
              navigate(closeTo);
            } else {
              const created = addKit({
                title: 'YouTube study kit',
                titleKm: 'ឯកសារសិក្សា YouTube',
                sourceKind: 'youtube',
                cardCount: 6,
                progress: 5,
              });
              navigate(`/kits/${created.id}`);
            }
          }
          return p;
        }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [addFile, addKit, closeTo, isDemo, kitId, navigate, stateKitId, stateSourceId]);

  // Live polling mode
  useEffect(() => {
    if (isDemo || !stateSourceId || !stateKitId) return;

    let isMounted = true;
    let pollTimer;

    const poll = async () => {
      try {
        const { data } = await api.get(`/kits/${stateKitId}/sources/${stateSourceId}`);
        if (!isMounted) return;
        const currentSource = data.source;
        setSource(currentSource);

        const stage = currentSource.stage || 'reading';
        const pct = currentSource.progressPercent ?? 0;

        if (currentSource.status === 'ready' || stage === 'ready') {
          setProgress(300);
          await refresh();
          await loadFiles(stateKitId).catch(() => {});
          navigate(`/kits/${stateKitId}`, { replace: true });
        } else if (currentSource.status === 'failed') {
          setPollError(currentSource.errorMessage || t('kits.processingFailed'));
        } else {
          // Progress bar mapping based on real backend progress
          if (stage === 'extracting' || stage === 'reading') {
            setProgress(Math.max(10, Math.min(100, Math.round(pct * 2))));
          } else if (stage === 'embedding' || stage === 'generating') {
            setProgress(100 + Math.max(10, Math.min(100, Math.round((pct - 30) * 1.5))));
          } else if (stage === 'preparing') {
            setProgress(200 + Math.max(10, Math.min(100, pct)));
          }

          pollTimer = setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!isMounted) return;
        setPollError(err.message || t('kits.processingFailed'));
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(pollTimer);
    };
  }, [isDemo, loadFiles, navigate, refresh, stateKitId, stateSourceId, t]);

  return (
    <BottomSheet closeTo={closeTo} labelledBy="processing-title">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-24 place-items-center rounded-full bg-tint-100">
          <VideoIcon />
        </span>
        <h2 id="processing-title" className="mt-5 text-2xl font-bold text-navy-900">
          {pollError ? t('kits.processingFailed') : t('kits.processingTitle')}
        </h2>
        <p className="mt-2 text-base text-navy-600">
          {pollError ? pollError : t('kits.processingSubtitle')}
        </p>
      </div>

      {pollError ? (
        <div className="mt-6 space-y-3">
          <Button onClick={() => navigate(`${root}/youtube`, { replace: true })}>
            {t('kits.uploadAnother')}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate(closeTo, { replace: true })}
              className="font-semibold text-navy-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <ol className="mt-7 space-y-5">
          {STAGES.map((key, i) => {
            const stageProgress = Math.max(0, Math.min(100, progress - i * 100));
            const active = stageProgress > 0;
            return (
              <li key={key}>
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      active ? 'bg-navy-800 text-white' : 'bg-tint-200 text-white'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`font-bold ${active ? 'text-navy-900' : 'text-navy-600/70'}`}>
                    {t(key)}
                  </span>
                </div>
                <div className="ms-11 mt-2 h-2 overflow-hidden rounded-full bg-tint-100">
                  <span
                    className="block h-full rounded-full bg-navy-800 transition-[width] duration-100"
                    style={{ width: `${stageProgress}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!pollError && (
        <p className="mt-6 text-center text-sm text-ink-500">{t('kits.processingFootnote')}</p>
      )}
    </BottomSheet>
  );
};

/** 02-create-study-folder — named "Create a study kit" in the design. */
export const CreateKitSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const { addKit } = useKits();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  return (
    <BottomSheet closeTo="/kits" labelledBy="create-kit-title">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-20 place-items-center rounded-2xl bg-tint-100 text-navy-800">
          <FolderPlusIcon />
        </span>
        <h2 id="create-kit-title" className="mt-5 text-2xl font-bold text-navy-900">
          {t('kits.createKitTitle')}
        </h2>
        <p className="mt-2 text-base text-navy-600">{t('kits.createKitSubtitle')}</p>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting) return;
          setSubmitting(true);
          setError(null);
          try {
            const kit = await addKit({ title: name });
            navigate(`/kits/${kit.id}`);
          } catch (err) {
            setError(err);
            setSubmitting(false);
          }
        }}
      >
        <TextField
          label={t('kits.createKitTitle')}
          placeholder={t('kits.kitNamePlaceholder')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />

        {/* The cap is the one failure with a way out, so it gets the count and
            a route to Plus rather than a bare error line. */}
        {error?.code === 'quota_exceeded' ? (
          <div className="rounded-card bg-gold-400/20 p-4 text-center">
            <p className="text-base font-bold text-navy-900">{t('kits.quotaTitle')}</p>
            <p className="mt-1 text-sm text-navy-700">
              {t('kits.quotaBody', {
                used: error.details?.used ?? 0,
                limit: error.details?.limit ?? 0,
              })}
            </p>
            <Link
              to="/onboarding/plan"
              className="mt-4 inline-flex rounded-full bg-navy-800 px-6 py-3 text-base font-bold text-white"
            >
              {t('kits.upgradeToPlus')}
            </Link>
          </div>
        ) : (
          error && (
            <p className="rounded-card bg-danger-50 px-4 py-3 text-center text-base text-danger-600">
              {error.message ?? t('kits.createFailed')}
            </p>
          )
        )}

        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? t('kits.creating') : t('kits.createStudyKit')}
          {!submitting && <ArrowRightIcon />}
        </Button>
        <p className="text-center text-sm text-ink-500">{t('kits.createKitFootnote')}</p>
      </form>
    </BottomSheet>
  );
};

const svg = {
  viewBox: '0 0 32 32',
  fill: 'none',
  className: 'size-8',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const PhotoIcon = () => (
  <svg {...svg}>
    <rect x="4" y="6" width="24" height="20" rx="3" />
    <circle cx="12" cy="13" r="2.2" />
    <path d="m6 23 7-7 5 5 3-3 5 5" />
  </svg>
);

const PdfIcon = () => (
  <svg {...svg}>
    <path d="M19 4H9a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z" />
    <path d="M19 4v6h6M12 17h8M12 22h5" />
  </svg>
);

const PlayIcon = () => (
  <svg {...svg}>
    <rect x="3" y="7" width="26" height="18" rx="4" />
    <path d="m13 12 8 4-8 4z" fill="currentColor" stroke="none" />
  </svg>
);

const SparkIcon = () => (
  <svg {...svg}>
    <path d="M28 15.5c0 5.8-5.4 10.5-12 10.5a14 14 0 0 1-3.6-.5L5 28l2.2-5.6A9.7 9.7 0 0 1 4 15.5C4 9.7 9.4 5 16 5s12 4.7 12 10.5Z" />
    <path d="m20 11 1.2 2.6L24 15l-2.8 1.4L20 19l-1.2-2.6L16 15l2.8-1.4z" fill="currentColor" stroke="none" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
    <path d="M28 6H14a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3V15z" fill="#0C3C85" />
    <path d="M28 6v9h9" fill="#fff" fillOpacity="0.35" />
    <path d="m20 20 10 6-10 6z" fill="#fff" />
  </svg>
);

const FolderPlusIcon = () => (
  <svg viewBox="0 0 40 40" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10a2 2 0 0 1 2-2h8l3 4h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="29" cy="27" r="6" fill="#0C3C85" stroke="none" />
    <path d="M29 24v6M26 27h6" stroke="#fff" strokeLinecap="round" />
  </svg>
);
