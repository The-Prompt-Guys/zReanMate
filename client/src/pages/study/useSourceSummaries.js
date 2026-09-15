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
  const source = files.find((item) => item.status === 'ready') ?? files[0];

  // Ingest runs asynchronously, so this page can open while the file is still
  // processing. Without this the source stayed 'processing' for the life of the
  // page: useSourceSummaries refuses to start until it is ready, nothing ever
  // refetched it, and the screen sat on "Generating your summary..." forever —
  // even after ingest had finished. Only a manual reload recovered. Poll until
  // the source reaches a terminal state, then stop.
  const settled = !source || source.status === 'ready' || source.status === 'failed';
  useEffect(() => {
    if (settled) return undefined;
    const timer = window.setInterval(() => {
      loadFiles(kitId).catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [settled, kitId, loadFiles]);

  return { kit: getKit(kitId) ?? kits[0], source, status, error };
};

export const useSourceSummaries = (source, language) => {
  const [summary, setSummary] = useState(null);
  const [chapterData, setChapterData] = useState(null);
  const [error, setError] = useState(null);
  const [plusRequired, setPlusRequired] = useState(false);

  const refresh = useCallback(async () => {
    if (!source?.id || source.status !== 'ready') return;

    // Chapter summaries are Plus-only. Once the server has said so there is
    // nothing to poll for — asking again every 1.5s just collects 403s.
    const requests = [api.post(`/sources/${source.id}/summarize`, { language })];
    if (!plusRequired) {
      requests.push(api.post(`/sources/${source.id}/chapters`, { language, chapterCount: 12 }));
    }
    const [summaryResponse, chaptersResponse] = await Promise.allSettled(requests);

    if (summaryResponse.status === 'fulfilled') { setSummary(summaryResponse.value.data); setError(null); }
    else setError(toFormError(summaryResponse.reason));

    if (!chaptersResponse) return;
    if (chaptersResponse.status === 'fulfilled') {
      setChapterData(chaptersResponse.value.data); setPlusRequired(false);
    } else if (toFormError(chaptersResponse.reason).code === 'feature_unavailable') {
      // A plan gate is not a failure — the screen offers the upgrade instead.
      setPlusRequired(true);
    } else setError(toFormError(chaptersResponse.reason));
  }, [source, language, plusRequired]);

  useEffect(() => { refresh(); }, [refresh]);
  const generating = summary?.status !== 'ready' || (chapterData && chapterData.status !== 'ready');
  useEffect(() => {
    if (!source?.id || !generating) return undefined;
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [source?.id, generating, refresh]);
  return { summary, chapterData, error, plusRequired, refresh };
};
