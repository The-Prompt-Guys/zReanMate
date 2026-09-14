import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, toFormError } from '../lib/api.js';
import { isDemo, loadDemoFixtures } from '../mock/mode.js';

/**
 * Study kits, server-backed (docs/API-CONTRACT.md §3).
 *
 * The kit list is held here because three screens read it — the Kits tab, the
 * dashboard grid and every kit header — and refetching per screen would make
 * the same list flicker three times.
 *
 * Files are NOT held here. They belong to one kit at a time and only the detail
 * screen shows them, so they are fetched per kit and cached by id; a global
 * file list would have to be invalidated on every upload from anywhere.
 */
const KitsContext = createContext(null);

const DEMO = isDemo();

/**
 * Prototype seed, unchanged from when this context was in-memory. Kept so
 * VITE_PROTOTYPE_KITS=true still reviews the screens with no server, which is
 * the whole point of the per-flow switch.
 */
let demoSeedFiles = {};

/** Fixture kits carry a `progress` the API calls the same thing; no mapping needed. */
const PROTOTYPE_ACCENTS = ['blue', 'violet', 'amber', 'teal'];
const PROTOTYPE_ICONS = ['document', 'database', 'code', 'share'];

export const KitsProvider = ({ children }) => {
  const [kits, setKits] = useState([]);
  // loading | ready | error — the Kits tab needs to tell "still fetching" from
  // "fetched, genuinely empty", which are the same render without this.
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [filesByKit, setFilesByKit] = useState({});

  const refresh = useCallback(async () => {
    if (DEMO) {
      const { kitDetailFiles, otherKitFiles, kits: seedKits } = await loadDemoFixtures();
      demoSeedFiles = { 'kit-database': kitDetailFiles, ...otherKitFiles };
      setKits(seedKits);
      setFilesByKit(demoSeedFiles);
      setStatus('ready');
      return;
    }
    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'));
    setError(null);
    try {
      const { data } = await api.get('/kits');
      setKits(data.kits);
      setStatus('ready');
    } catch (err) {
      setError(toFormError(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Throws the normalised error rather than swallowing it: the create sheet has
   * to tell a quota rejection from a network failure, and only the caller knows
   * which screen is asking.
   */
  const addKit = useCallback(
    async (partial = {}) => {
      const title = partial.title?.trim() || 'New study kit';

      if (DEMO) {
        const created = {
          id: `kit-${Date.now()}`,
          title,
          titleKm: partial.titleKm?.trim() || title,
          icon: partial.icon || PROTOTYPE_ICONS[kits.length % PROTOTYPE_ICONS.length],
          accent: partial.accent || PROTOTYPE_ACCENTS[kits.length % PROTOTYPE_ACCENTS.length],
          cardCount: partial.cardCount ?? 0,
          fileCount: 0,
          progress: partial.progress ?? 0,
          status: partial.status || 'in_progress',
          sourceKind: partial.sourceKind || 'topic',
        };
        setKits((prev) => [created, ...prev]);
        return created;
      }

      try {
        const { data } = await api.post('/kits', {
          title,
          ...(partial.titleKm && { titleKm: partial.titleKm.trim() }),
          ...(partial.icon && { icon: partial.icon }),
          ...(partial.accent && { accent: partial.accent }),
        });
        setKits((prev) => [data.kit, ...prev]);
        return data.kit;
      } catch (err) {
        throw toFormError(err);
      }
    },
    [kits.length],
  );

  const removeKit = useCallback(async (kitId) => {
    if (DEMO) {
      setKits((prev) => prev.filter((kit) => kit.id !== kitId));
      return;
    }
    try {
      await api.delete(`/kits/${kitId}`);
      setKits((prev) => prev.filter((kit) => kit.id !== kitId));
      setFilesByKit((prev) => {
        const next = { ...prev };
        delete next[kitId];
        return next;
      });
    } catch (err) {
      throw toFormError(err);
    }
  }, []);

  const getKit = useCallback((id) => kits.find((kit) => kit.id === id), [kits]);

  /**
   * Reads the cache only. The detail screen calls loadFiles() in an effect and
   * renders from here, so this stays synchronous and the component keeps the
   * shape it had when the list was in memory.
   */
  const getFiles = useCallback((kitId) => filesByKit[kitId] ?? [], [filesByKit]);

  /** A kit with no files of its own has none — never another kit's. */
  const loadFiles = useCallback(async (kitId) => {
    if (DEMO) return demoSeedFiles[kitId] ?? [];
    const { data } = await api.get(`/kits/${kitId}/sources`);
    setFilesByKit((prev) => ({ ...prev, [kitId]: data.sources }));
    return data.sources;
  }, []);

  /**
   * `onProgress` receives 0-100 from axios's real upload events, not a timer.
   * Browsers report `total` as 0 for some multipart bodies, so the guard below
   * keeps a bar from jumping to NaN%.
   */
  const uploadFile = useCallback(async (kitId, file, { onProgress } = {}) => {
    if (DEMO) {
      const created = {
        id: `f-${Date.now()}`,
        name: file?.name ?? 'New material',
        kind: file?.type?.startsWith('image/') ? 'image' : 'pdf',
        byteSize: file?.size ?? 0,
        status: 'pending',
      };
      setFilesByKit((prev) => ({ ...prev, [kitId]: [created, ...(prev[kitId] ?? [])] }));
      return created;
    }

    const body = new FormData();
    body.append('file', file);

    try {
      const { data } = await api.post(`/kits/${kitId}/sources`, body, {
        // Let the browser set multipart/form-data with its own boundary —
        // the instance default of application/json would break the parse.
        headers: { 'Content-Type': undefined },
        onUploadProgress: (event) => {
          if (!onProgress) return;
          const total = event.total ?? file.size;
          if (!total) return;
          onProgress(Math.min(100, Math.round((event.loaded * 100) / total)));
        },
      });

      setFilesByKit((prev) => ({ ...prev, [kitId]: [data.source, ...(prev[kitId] ?? [])] }));
      // fileCount lives on the kit row, so the header count would go stale.
      setKits((prev) =>
        prev.map((kit) =>
          kit.id === kitId
            ? { ...kit, fileCount: (kit.fileCount ?? 0) + 1, sourceKind: kit.sourceKind ?? data.source.kind }
            : kit,
        ),
      );
      return data.source;
    } catch (err) {
      throw toFormError(err);
    }
  }, []);

  const removeFile = useCallback(async (kitId, fileId) => {
    if (DEMO) {
      setFilesByKit((prev) => ({
        ...prev,
        [kitId]: (prev[kitId] ?? []).filter((f) => f.id !== fileId),
      }));
      return;
    }
    try {
      await api.delete(`/kits/${kitId}/sources/${fileId}`);
      setFilesByKit((prev) => ({
        ...prev,
        [kitId]: (prev[kitId] ?? []).filter((f) => f.id !== fileId),
      }));
      setKits((prev) =>
        prev.map((kit) =>
          kit.id === kitId ? { ...kit, fileCount: Math.max(0, (kit.fileCount ?? 1) - 1) } : kit,
        ),
      );
    } catch (err) {
      throw toFormError(err);
    }
  }, []);

  const addFile = useCallback((kitId, source = {}) => {
    const created = {
      id: source.id ?? `f-${Date.now()}`,
      name: source.name ?? 'New material',
      kind: source.kind ?? 'pdf',
      byteSize: source.byteSize ?? 0,
      status: source.status ?? 'pending',
    };
    setFilesByKit((prev) => ({ ...prev, [kitId]: [created, ...(prev[kitId] ?? [])] }));
    return created;
  }, []);

  const value = useMemo(
    () => ({
      kits,
      status,
      error,
      isDemo: DEMO,
      refresh,
      addKit,
      removeKit,
      getKit,
      getFiles,
      loadFiles,
      uploadFile,
      addFile,
      removeFile,
    }),
    [kits, status, error, refresh, addKit, removeKit, getKit, getFiles, loadFiles, uploadFile, addFile, removeFile],
  );

  return <KitsContext.Provider value={value}>{children}</KitsContext.Provider>;
};

export const useKits = () => {
  const context = useContext(KitsContext);
  if (!context) throw new Error('useKits must be used inside <KitsProvider>');
  return context;
};
