import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cameraConstraints,
  cameraErrorKey,
  captureFilename,
  captureFrame,
  classifyCameraError,
  fitWithin,
  isRetryable,
  stopStream,
  supportsCamera,
} from './camera.js';

test('the rear camera is a preference, not a requirement', () => {
  const { video } = cameraConstraints();
  // { exact: 'environment' } throws OverconstrainedError on any laptop, which
  // would mean no camera at a desk — the case this whole sheet exists for.
  assert.deepEqual(video.facingMode, { ideal: 'environment' });
  assert.equal('exact' in video.facingMode, false);
});

test('camera support is false on an insecure origin, where mediaDevices is undefined', () => {
  assert.equal(supportsCamera(undefined), false);
  assert.equal(supportsCamera({}), false);
  assert.equal(supportsCamera({ mediaDevices: {} }), false);
  assert.equal(supportsCamera({ mediaDevices: { getUserMedia: () => {} } }), true);
});

test('a denied permission is told apart from every other failure', () => {
  for (const name of ['NotAllowedError', 'PermissionDeniedError', 'SecurityError']) {
    assert.equal(classifyCameraError({ name }), 'denied', name);
  }
  assert.equal(classifyCameraError({ name: 'NotFoundError' }), 'noCamera');
  assert.equal(classifyCameraError({ name: 'DevicesNotFoundError' }), 'noCamera');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }), 'inUse');
  assert.equal(classifyCameraError({ name: 'OverconstrainedError' }), 'noCamera');
  assert.equal(classifyCameraError({ name: 'WhoKnows' }), 'failed');
  assert.equal(classifyCameraError(undefined), 'failed');
});

test('only a denied permission hides the retry, because the browser will not ask twice', () => {
  assert.equal(isRetryable('denied'), false);
  for (const reason of ['noCamera', 'inUse', 'failed']) {
    assert.equal(isRetryable(reason), true, reason);
  }
});

test('every failure reason has its own message', () => {
  const keys = ['denied', 'noCamera', 'inUse', 'failed'].map(cameraErrorKey);
  assert.equal(new Set(keys).size, 4);
  assert.equal(cameraErrorKey('something-new'), 'kits.cameraFailed');
});

test('a frame larger than the cap is scaled down, keeping its shape', () => {
  assert.deepEqual(fitWithin(4000, 3000, 2048), { width: 2048, height: 1536 });
  assert.deepEqual(fitWithin(3000, 4000, 2048), { width: 1536, height: 2048 });
});

test('a frame smaller than the cap is left alone rather than interpolated up', () => {
  assert.deepEqual(fitWithin(640, 480, 2048), { width: 640, height: 480 });
});

test('a stream with no frame yet reports no size instead of NaN', () => {
  assert.deepEqual(fitWithin(0, 0, 2048), { width: 0, height: 0 });
});

test('captured files are timestamped so two photos are distinguishable', () => {
  assert.equal(captureFilename(new Date(2026, 8, 16, 9, 5, 3)), 'photo-20260916-090503.jpg');
  assert.notEqual(
    captureFilename(new Date(2026, 8, 16, 9, 5, 3)),
    captureFilename(new Date(2026, 8, 16, 9, 5, 4)),
  );
});

test('stopping a stream stops every track, and tolerates being called twice', () => {
  const stopped = [];
  const track = (id) => ({ stop: () => stopped.push(id) });
  const stream = { getTracks: () => [track('video'), track('audio')] };

  stopStream(stream);
  assert.deepEqual(stopped, ['video', 'audio']);

  // The sheet stops the stream on its way out and again on unmount; neither
  // path may throw, or leaving the camera would break the screen.
  assert.doesNotThrow(() => stopStream(stream));
  assert.doesNotThrow(() => stopStream(null));
  assert.doesNotThrow(() => stopStream({}));
});

// --- captureFrame, against stand-ins for <video> and <canvas> ---------------

const fakeCanvas = ({ blob = new Blob(['x'], { type: 'image/jpeg' }) } = {}) => {
  const calls = { drawn: null, toBlob: null };
  return {
    calls,
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: (_video, x, y, w, h) => {
        calls.drawn = { x, y, w, h };
      },
    }),
    toBlob: (cb, type, quality) => {
      calls.toBlob = { type, quality };
      cb(blob);
    },
  };
};

test('the frame is captured at the stream size, not the size of the preview box', async () => {
  const canvas = fakeCanvas();
  // A video element laid out small on screen still reports the real frame size
  // through videoWidth/videoHeight. Reading the CSS size would save a photo at
  // the size of the preview, which is unreadable.
  const video = { videoWidth: 1920, videoHeight: 1080, clientWidth: 320, clientHeight: 180 };

  const file = await captureFrame(video, canvas, { now: new Date(2026, 8, 16, 9, 5, 3) });

  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1080);
  assert.deepEqual(canvas.calls.drawn, { x: 0, y: 0, w: 1920, h: 1080 });
  assert.equal(file.name, 'photo-20260916-090503.jpg');
  assert.equal(file.type, 'image/jpeg');
});

test('the capture is a File, so it goes up the same path as a picked one', async () => {
  const file = await captureFrame({ videoWidth: 800, videoHeight: 600 }, fakeCanvas(), {});
  assert.ok(file instanceof File);
});

test('an oversized frame is capped before it is drawn', async () => {
  const canvas = fakeCanvas();
  await captureFrame({ videoWidth: 4032, videoHeight: 3024 }, canvas, { maxEdge: 2048 });
  assert.equal(canvas.width, 2048);
  assert.equal(canvas.height, 1536);
});

test('the capture is written as high-quality JPEG, for a model that has to read it', async () => {
  const canvas = fakeCanvas();
  await captureFrame({ videoWidth: 800, videoHeight: 600 }, canvas, {});
  assert.equal(canvas.calls.toBlob.type, 'image/jpeg');
  assert.ok(canvas.calls.toBlob.quality >= 0.9, `quality was ${canvas.calls.toBlob.quality}`);
});

test('capturing before the first frame rejects rather than saving a blank image', async () => {
  await assert.rejects(
    captureFrame({ videoWidth: 0, videoHeight: 0 }, fakeCanvas(), {}),
    /not produced a frame/,
  );
});

test('a canvas that yields no blob rejects rather than resolving an empty file', async () => {
  await assert.rejects(
    captureFrame({ videoWidth: 800, videoHeight: 600 }, fakeCanvas({ blob: null }), {}),
    /could not read the captured frame/,
  );
});
