import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  BottomSheet,
  SheetButton,
  SheetFootnote,
  SheetSubtitle,
  SheetTitle,
} from '../../components/BottomSheet.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { toFormError } from '../../lib/api.js';
import { useT } from '../../i18n/index.js';
import {
  cameraConstraints,
  cameraErrorKey,
  captureFrame,
  classifyCameraError,
  isRetryable,
  stopStream,
  supportsCamera,
} from './camera.js';

/**
 * The in-app camera — docs/screens/03-study-kits/11.
 *
 * The photo sheet's "Take a photo" used to be a file input carrying the
 * `capture` attribute, which asks a phone for its camera and is ignored
 * everywhere else. On a laptop it opened a file browser, so the one option
 * named "Take a photo" was the one that could not take a photo. This opens a
 * real camera through getUserMedia, which works wherever the browser does, and
 * falls back to that same picker when it cannot.
 *
 * Three states, one sheet: `starting` while permission is being asked for,
 * `live` with the preview and shutter, and `review` holding a still. Review is
 * not a nicety — a blurred photo of a page is only discovered when the OCR
 * comes back empty, several steps and one upload later, and by then the student
 * has no idea which part went wrong.
 */
export const CameraSheet = () => {
  const t = useT();
  const navigate = useNavigate();
  const { kitId } = useParams();
  const { addKit } = useKits();

  const root = kitId ? `/kits/${kitId}/add` : '/kits/new';
  const photoRoot = `${root}/photo`;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fallbackInputRef = useRef(null);
  // The object URL for the still being reviewed. Held in a ref as well as in
  // state because the cleanup effect must revoke the CURRENT one without
  // re-running — and therefore tearing down the camera — every time it changes.
  const previewUrlRef = useRef(null);

  const [phase, setPhase] = useState('starting');
  const [error, setError] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const releaseCamera = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /**
   * Opens the camera.
   *
   * Re-runs when `attempt` changes, which is what the retry button bumps. The
   * `cancelled` flag matters more than usual here: getUserMedia resolves with a
   * live camera, so a stream that arrives after the student has already closed
   * the sheet has to be stopped rather than merely dropped, or the hardware
   * light stays on with nothing on screen.
   */
  useEffect(() => {
    if (!supportsCamera()) {
      setError({ key: 'kits.cameraUnsupported', retryable: false });
      setPhase('error');
      return undefined;
    }

    let cancelled = false;
    setPhase('starting');
    setError(null);
    setReady(false);

    navigator.mediaDevices
      .getUserMedia(cameraConstraints())
      .then((stream) => {
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // iOS Safari will not start a stream without this, and autoPlay
          // alone is not enough. A rejected play() is not fatal: the student
          // can still tap the preview, so it is swallowed rather than shown.
          videoRef.current.play?.().catch(() => {});
        }
        return setPhase('live');
      })
      .catch((err) => {
        if (cancelled) return;
        const reason = classifyCameraError(err);
        setError({ key: cameraErrorKey(reason), retryable: isRetryable(reason) });
        setPhase('error');
      });

    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, [attempt, releaseCamera]);

  // Revoking on unmount only. Tying this to `previewUrl` would revoke the URL
  // the <img> is currently showing the moment a second photo replaced it.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const showPreview = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCaptured(file);
    setPhase('review');
  };

  const onShutter = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const file = await captureFrame(videoRef.current, canvasRef.current);
      // The camera is released as soon as there is a still to look at: holding
      // it open behind the review screen keeps the light on for a preview the
      // student is no longer being filmed for.
      releaseCamera();
      showPreview(file);
    } catch {
      setError({ key: 'kits.cameraCaptureFailed', retryable: true });
    } finally {
      setBusy(false);
    }
  };

  const onRetake = () => {
    setCaptured(null);
    setPreviewUrl(null);
    setError(null);
    // Bumping the attempt re-runs the effect, which opens the camera again.
    setAttempt((n) => n + 1);
  };

  /**
   * Hands the still to the upload path.
   *
   * The same handoff the gallery picker uses — a File in router state, and the
   * kit created only now, so a student who opens the camera and backs out does
   * not leave an empty kit against the free-plan cap.
   */
  const onUse = async () => {
    if (!captured || busy) return;
    setBusy(true);
    setError(null);
    try {
      let targetKitId = kitId;
      if (!targetKitId) {
        const created = await addKit({ title: t('kits.uploadPhoto'), sourceKind: 'image' });
        targetKitId = created.id;
      }
      releaseCamera();
      navigate(`/kits/${targetKitId}/add/uploading`, {
        replace: true,
        state: { file: captured },
      });
    } catch (err) {
      setError({ message: toFormError(err).message ?? t('kits.createFailed'), retryable: true });
      setBusy(false);
    }
  };

  /**
   * The last resort, for a browser that cannot open a camera at all. `capture`
   * still gets a phone's own camera app, and a desktop gets its file dialog —
   * which is the best available when there is no camera to open.
   */
  const onFallbackFile = (event) => {
    const file = event.target.files?.[0];
    if (file) showPreview(file);
  };

  const message = error?.message ?? (error?.key ? t(error.key) : null);

  return (
    <BottomSheet closeTo={photoRoot} labelledBy="camera-title" transition="from-right">
      <SheetTitle id="camera-title">
        {t(phase === 'review' ? 'kits.cameraReviewTitle' : 'kits.cameraTitle')}
      </SheetTitle>
      <SheetSubtitle>
        {t(phase === 'review' ? 'kits.cameraReviewSubtitle' : 'kits.cameraSubtitle')}
      </SheetSubtitle>

      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onFallbackFile}
        tabIndex={-1}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* 3:4 upright, the shape of a page held in one hand. */}
      <div className="relative mt-5 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-navy-900">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => setReady(true)}
          className={`size-full object-cover ${phase === 'live' ? '' : 'invisible'}`}
        />

        {phase === 'review' && previewUrl && (
          <img src={previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}

        {phase === 'starting' && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-base font-bold text-white/90">
            {t('kits.cameraStarting')}
          </p>
        )}

        {phase === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <p className="text-base font-medium text-white/90">{message}</p>
          </div>
        )}

        {/* The guide frame: where to put the page. Only while the camera is
            live, and never over the still — on a review it would read as a
            crop that is about to be applied, which it is not. */}
        {phase === 'live' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-5 rounded-xl border-2 border-white/45"
          />
        )}
      </div>

      {phase === 'error' ? (
        <div className="mt-5 space-y-3">
          {error?.retryable && (
            <SheetButton disabled={busy} onClick={() => setAttempt((n) => n + 1)}>
              {t('common.retry')}
            </SheetButton>
          )}
          <button
            type="button"
            onClick={() => navigate(photoRoot, { replace: true })}
            className="w-full rounded-full bg-canvas px-6 py-3.5 text-base font-bold text-ink-900 ring-1 ring-tint-200"
          >
            {t('kits.chooseFromGallery')}
          </button>
        </div>
      ) : phase === 'review' ? (
        <div className="mt-5 space-y-3">
          {message && (
            <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-center text-base font-medium text-danger-600">
              {message}
            </p>
          )}
          <SheetButton disabled={busy} onClick={onUse}>
            {busy ? t('kits.creating') : t('kits.cameraUsePhoto')}
          </SheetButton>
          <button
            type="button"
            disabled={busy}
            onClick={onRetake}
            className="w-full rounded-full bg-canvas px-6 py-3.5 text-base font-bold text-ink-900 ring-1 ring-tint-200 disabled:opacity-60"
          >
            {t('kits.cameraRetake')}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {message && (
            <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-center text-base font-medium text-danger-600">
              {message}
            </p>
          )}
          {/* Disabled until the video reports a frame size — capturing before
              that writes a blank image. */}
          <button
            type="button"
            onClick={onShutter}
            disabled={phase !== 'live' || !ready || busy}
            aria-label={t('kits.cameraShutter')}
            className="mx-auto grid size-18 place-items-center rounded-full bg-white ring-4 ring-link-700 transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className="size-14 rounded-full bg-link-700" />
          </button>
          <SheetFootnote>{t('kits.cameraSubtitle')}</SheetFootnote>
        </div>
      )}
    </BottomSheet>
  );
};
