const DAY_MS = 24 * 60 * 60 * 1000;

function assertQuality(quality) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('SM-2 quality must be an integer from 0 to 5');
  }
}

/**
 * Calculate one SM-2 review without mutating the persisted review state.
 * Interval growth uses the ease factor that existed before this review, as in
 * the original algorithm; the adjusted ease applies to subsequent reviews.
 */
export function scheduleSm2Review(state, quality, reviewedAt = new Date()) {
  assertQuality(quality);

  const at = new Date(reviewedAt);
  if (Number.isNaN(at.getTime())) throw new TypeError('reviewedAt must be a valid date');

  const easeFactor = Number(state?.easeFactor ?? 2.5);
  const repetitions = Number(state?.repetitions ?? 0);
  const previousInterval = Number(state?.intervalDays ?? 0);
  const lapses = Number(state?.lapses ?? 0);

  let intervalDays;
  let nextRepetitions;
  let nextLapses = lapses;

  if (quality < 3) {
    intervalDays = 1;
    nextRepetitions = 0;
    nextLapses += 1;
  } else {
    intervalDays = repetitions === 0
      ? 1
      : repetitions === 1
        ? 6
        : Math.max(1, Math.round(previousInterval * easeFactor));
    nextRepetitions = repetitions + 1;
  }

  const distanceFromPerfect = 5 - quality;
  const easeDelta = 0.1 - distanceFromPerfect * (0.08 + distanceFromPerfect * 0.02);
  const nextEaseFactor = Math.max(1.3, easeFactor + easeDelta);

  return {
    easeFactor: Number(nextEaseFactor.toFixed(2)),
    intervalDays,
    repetitions: nextRepetitions,
    lapses: nextLapses,
    dueAt: new Date(at.getTime() + intervalDays * DAY_MS),
    lastReviewedAt: at,
  };
}

