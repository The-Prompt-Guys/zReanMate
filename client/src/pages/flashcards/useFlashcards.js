import { useCallback, useEffect, useState } from 'react';

import { api, toFormError } from '../../lib/api.js';

/**
 * The deck for a study session.
 *
 * `selectedSourceId` is the file the student picked inside the kit, when they
 * picked one. It scopes the due list as well as the generation, so the session
 * stays on that material. Entered kit-wide (no selection) the deck is still
 * generated from the kit's first ready file but reviews everything due in the
 * kit, which is what the kit-wide entry has always done.
 */
export const useFlashcards = ({ source, kitId, language, selectedSourceId = null }) => {
  const sourceId = source?.id;
  const sourceStatus = source?.status;
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!sourceId || sourceStatus !== 'ready') return;
    try {
      setError(null);
      const generation = await api.post(`/sources/${sourceId}/flashcards`, { language });
      setStatus(generation.data.status);
      if (generation.data.status === 'ready') {
        // Scoped to the source, not the kit: the deck is generated from one
        // file and the due list has to match it, or reviewing cost-analyst1.pdf
        // deals cards from every other material in the kit.
        const due = await api.get('/flashcards/due', {
          params: { kitId, sourceId: selectedSourceId ?? undefined, limit: 100 },
        });
        setCards(due.data.cards);
      }
    } catch (err) {
      setError(toFormError(err));
      setStatus('error');
    }
  }, [sourceId, sourceStatus, kitId, language, selectedSourceId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (status !== 'pending' && status !== 'generating') return undefined;
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [status, refresh]);

  const review = useCallback(async (cardId, quality) => {
    const { data } = await api.post(`/flashcards/${cardId}/review`, { quality });
    return data.review;
  }, []);

  return { cards, setCards, status, error, refresh, review };
};
