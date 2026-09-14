import { useCallback, useEffect, useState } from 'react';

import { useKits } from '../../kits/KitsContext.jsx';
import { api, toFormError } from '../../lib/api.js';

export const useStudySource = (kitId) => {
  const { kits, getKit, getFiles, loadFiles } = useKits();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadFiles(kitId).then(() => !cancelled && setStatus('ready')).catch((err) => {
      if (!cancelled) { setError(toFormError(err)); setStatus('error'); }
    });
    return () => { cancelled = true; };
  }, [kitId, loadFiles]);

  const files = getFiles(kitId);
  return { kit: getKit(kitId) ?? kits[0], source: files.find((item) => item.status === 'ready') ?? files[0], status, error };
};

export const useSourceSummaries = (source, language) => {
  const [summary, setSummary] = useState(null);
  const [chapterData, setChapterData] = useState(null);
  const [error, setError] = useState(null);
  const [plusRequired, setPlusRequired] = useState(false);

  const refresh = useCallback(async () => {
    if (!source?.id || source.status !== 'ready') return;
    const [summaryResponse, chaptersResponse] = await Promise.allSettled([
      api.post(`/sources/${source.id}/summarize`, { language }),
      api.post(`/sources/${source.id}/chapters`, { language, chapterCount: 12 }),
    ]);
    if (summaryResponse.status === 'fulfilled') setSummary(summaryResponse.value.data);
    else setError(toFormError(summaryResponse.reason));
    if (chaptersResponse.status === 'fulfilled') {
      setChapterData(chaptersResponse.value.data); setPlusRequired(false);
    } else if (chaptersResponse.reason?.response?.status === 403 && chaptersResponse.reason.response.data?.error === 'feature_unavailable') {
      setPlusRequired(true);
    } else setError(toFormError(chaptersResponse.reason));
  }, [source, language]);

  useEffect(() => { refresh(); }, [refresh]);
  const generating = summary?.status !== 'ready' || (chapterData && chapterData.status !== 'ready');
  useEffect(() => {
    if (!source?.id || !generating) return undefined;
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [source?.id, generating, refresh]);
  return { summary, chapterData, error, plusRequired, refresh };
};
