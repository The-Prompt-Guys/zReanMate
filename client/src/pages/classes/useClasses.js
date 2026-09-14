import { useCallback, useEffect, useState } from 'react';

import { api, toFormError } from '../../lib/api.js';

export const useClasses = () => {
  const [classes, setClasses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/classes');
      setClasses(data.classes); setStatus('ready'); setError(null);
    } catch (err) { setError(toFormError(err)); setStatus('error'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const join = useCallback(async (code) => {
    await api.post('/classes/join', { code });
    await refresh();
  }, [refresh]);
  return { classes, status, error, refresh, join };
};

export const useClassDetail = (classId) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const response = await api.get(`/classes/${classId}`);
      setData(response.data); setStatus('ready'); setError(null);
    } catch (err) { setError(toFormError(err)); setStatus('error'); }
  }, [classId]);
  useEffect(() => { refresh(); }, [refresh]);
  const completeItem = useCallback(async (itemId) => {
    await api.post(`/classes/lesson-items/${itemId}/complete`);
    await refresh();
  }, [refresh]);
  return { data, status, error, refresh, completeItem };
};

