/**
 * The parts of the in-app camera that are worth testing on their own.
 *
 * The sheet that uses these owns a live MediaStream and a <video> element,
 * neither of which exists outside a browser. Everything here is the decision
 * making around that — which camera to ask for, what a failure means, how a
 * frame becomes the same kind of File the picker would have produced — so it
 * can be exercised without one.
 */

/**
 * `capture` on a file input asks a PHONE for its camera and is ignored
 * everywhere else, which is why the app has a camera of its own. Kept as the
 * fallback for the case the camera cannot be opened at all.
 */
export const CAPTURE_FALLBACK_ATTRIBUTE = 'environment';

/** What the shutter writes. JPEG because a photo of a page is a photograph. */
export const CAPTURE_MIME_TYPE = 'image/jpeg';

/**
 * Quality for the captured frame.
 *
 * High, and deliberately not the default 0.92-and-forget. This image is going
 * to a vision model to be read, and JPEG artifacts land hardest on exactly what
 * matters — thin strokes, Khmer diacritics, a subscript in an equation. A
 * smaller file is not worth a misread word that becomes a wrong flashcard.
 */
export const CAPTURE_QUALITY = 0.95;

/**
 * Constraints for the camera.
 *
 * The rear camera is requested as a preference rather than a requirement:
 * `facingMode: { ideal }` falls back to whatever camera exists, where
 * `{ exact: 'environment' }` throws OverconstrainedError on every laptop. A
 * student at a desk with one webcam should still be able to photograph a page.
 *
 * The resolution is an `ideal` for the same reason — a hint that gets the
 * sharpest stream the device has, which is what OCR needs, without failing on
 * a device that cannot manage it.
 */
export const cameraConstraints = () => ({
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
});

/**
 * True when this browser can open a camera at all.
 *
 * `navigator.mediaDevices` is undefined — not merely unusable — on an insecure
 * origin, so a page served over plain http to a phone on the LAN reaches this
 * and takes the file-picker path instead of throwing on an undefined property.
 */
export const supportsCamera = (nav = typeof navigator === 'undefined' ? undefined : navigator) =>
  Boolean(nav?.mediaDevices?.getUserMedia);

/**
 * Sorts a getUserMedia rejection into what the student should be told.
 *
 * The distinction that matters is `denied` versus everything else: a denied
 * permission cannot be recovered by retrying, because the browser will not ask
 * twice. Offering "Try again" there sends the student round a loop that cannot
 * succeed, so that case gets the gallery instead.
 *
 * Error names come from the Media Capture spec, and browsers disagree on which
 * they use for the same situation — Firefox says NotFoundError where Chrome
 * says DevicesNotFoundError — so the aliases are not redundant.
 */
export const classifyCameraError = (error) => {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'noCamera';
    case 'NotReadableError':
    case 'TrackStartError':
      // Another app already holds the camera. Retrying works once they let go.
      return 'inUse';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'noCamera';
    default:
      return 'failed';
  }
};

/** Which i18n key explains a given failure. */
export const cameraErrorKey = (reason) =>
  ({
    denied: 'kits.cameraDenied',
    noCamera: 'kits.cameraNotFound',
    inUse: 'kits.cameraInUse',
    failed: 'kits.cameraFailed',
  })[reason] ?? 'kits.cameraFailed';

/**
 * Whether offering "Try again" could plausibly work.
 *
 * A denied permission is the one case where it cannot: the browser remembers
 * the refusal and will not prompt again, so the button would do nothing twice.
 */
export const isRetryable = (reason) => reason !== 'denied';

/**
 * The size to write, capped on the long edge.
 *
 * Preserves the aspect ratio, and never scales UP — a 640px webcam frame stays
 * 640px rather than being interpolated into a larger file with no more detail
 * in it.
 *
 * The cap exists because the image is sent to the model base64-encoded, which
 * inflates it by a third; an unbounded 4K frame from a modern phone makes a
 * request big enough to time out on the connections this app is used over.
 */
export const fitWithin = (width, height, maxEdge = 2048) => {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
};

/**
 * Names the captured file.
 *
 * Timestamped rather than fixed, so two photos taken into the same kit do not
 * arrive as two files called "photo.jpg" that no one can tell apart in the
 * material list.
 */
export const captureFilename = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `photo-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`
  );
};

/**
 * Draws the current video frame to a canvas and resolves a File.
 *
 * A File rather than a Blob because that is what the upload path already takes
 * from the picker — the sheet hands one to the same `uploadFile` the gallery
 * route uses, so there is one upload path and not two.
 *
 * `videoWidth`/`videoHeight` are the real frame size; the element's CSS size is
 * whatever the layout made it, and reading that instead would save a photo at
 * the size of the preview box.
 */
export const captureFrame = (video, canvas, { maxEdge = 2048, now = new Date() } = {}) => {
  const source = { width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0 };
  if (!source.width || !source.height) {
    // The stream is attached but has not produced a frame yet. Capturing here
    // would write a blank image, so the caller keeps the shutter disabled
    // until the video reports a size.
    return Promise.reject(new Error('camera has not produced a frame yet'));
  }

  const { width, height } = fitWithin(source.width, source.height, maxEdge);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('could not read the captured frame'));
        return resolve(
          new File([blob], captureFilename(now), {
            type: CAPTURE_MIME_TYPE,
            lastModified: now.getTime(),
          }),
        );
      },
      CAPTURE_MIME_TYPE,
      CAPTURE_QUALITY,
    );
  });
};

/**
 * Stops every track on a stream.
 *
 * Dropping the reference is NOT enough: the camera stays open and the hardware
 * light stays on until the tracks are stopped, which to a student looks like
 * the app is still watching them. Every exit from the camera sheet goes through
 * here, and it is safe to call twice.
 */
export const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};
