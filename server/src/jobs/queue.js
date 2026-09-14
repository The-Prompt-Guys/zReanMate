/**
 * Modular in-process job queue.
 *
 * Runs async background work (PDF extraction, YouTube ingest, embedding) without
 * blocking Express response cycles.
 */

const handlers = new Map();
const queue = [];
let isProcessing = false;

const runNext = async () => {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const job = queue.shift();
  const handler = handlers.get(job.type);

  if (!handler) {
    console.error(`[jobs] no handler registered for job type "${job.type}"`);
    isProcessing = false;
    runNext();
    return;
  }

  try {
    await handler(job.payload);
  } catch (err) {
    console.error(`[jobs] job "${job.type}" failed:`, err);
  } finally {
    isProcessing = false;
    // Process next item on next tick
    setImmediate(runNext);
  }
};

export const jobQueue = {
  register(type, handler) {
    handlers.set(type, handler);
  },

  enqueue(type, payload) {
    queue.push({ type, payload, queuedAt: Date.now() });
    setImmediate(runNext);
  },

  size() {
    return queue.length;
  },
};
