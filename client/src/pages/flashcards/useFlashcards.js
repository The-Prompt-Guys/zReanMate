import { useCallback, useEffect, useState } from 'react';

import { api, toFormError } from '../../lib/api.js';

export const useFlashcards = ({ source, kitId, language }) => {
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
        const due = await api.get('/flashcards/due', { params: { kitId, limit: 100 } });
        setCards(due.data.cards);
      }
    } catch (err) {
      setError(toFormError(err));
      setStatus('error');
    }
  }, [sourceId, sourceStatus, kitId, language]);

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
