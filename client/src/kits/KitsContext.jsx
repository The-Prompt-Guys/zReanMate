import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { kitDetailFiles, otherKitFiles, kits as seedKits } from '../mock/fixtures.js';

/**
 * Prototype kit list. The backend is still on hold, so create/add flows mutate
 * this in-memory list so a new kit actually shows up on the Kits tab.
 */

const ACCENTS = ['blue', 'violet', 'amber', 'teal'];
const ICONS = ['document', 'database', 'code', 'share'];

const KitsContext = createContext(null);

/**
 * The demo file list belongs to the Database kit specifically — it is what
 * docs/screens/03-study-kits/03 shows. Seeding it per-kit rather than using it
 * as a fallback matters: a fallback hands every other kit, including one the
 * user just created, six files that are not theirs.
 */
const SEED_FILES = { 'kit-database': kitDetailFiles, ...otherKitFiles };

export const KitsProvider = ({ children }) => {
  const [kits, setKits] = useState(seedKits);
  const [filesByKit, setFilesByKit] = useState(SEED_FILES);

  const addKit = useCallback((partial = {}) => {
    const title = partial.title?.trim() || 'New study kit';
    const created = {
      id: `kit-${Date.now()}`,
      title,
      titleKm: partial.titleKm?.trim() || title,
      icon: partial.icon || 'document',
      accent: partial.accent || 'blue',
      cardCount: partial.cardCount ?? 0,
      progress: partial.progress ?? 0,
      status: partial.status || 'in_progress',
      sourceKind: partial.sourceKind || 'topic',
    };
    setKits((prev) => {
      const i = prev.length;
      created.icon = partial.icon || ICONS[i % ICONS.length];
      created.accent = partial.accent || ACCENTS[i % ACCENTS.length];
      return [{ ...created }, ...prev];
    });
    return created;
  }, []);

  const getKit = useCallback((id) => kits.find((kit) => kit.id === id), [kits]);

  /** A kit with no files of its own has none — never another kit's. */
  const getFiles = useCallback((kitId) => filesByKit[kitId] ?? [], [filesByKit]);

  const addFile = useCallback((kitId, partial = {}) => {
    const created = {
      id: `f-${Date.now()}`,
      name: partial.name || 'New material',
      kind: partial.kind || 'document',
      size: partial.size || '—',
      ...partial,
    };
    setFilesByKit((prev) => {
      const existing = prev[kitId] ?? [];
      return { ...prev, [kitId]: [created, ...existing] };
    });
    return created;
  }, []);

  const value = useMemo(
    () => ({ kits, addKit, getKit, getFiles, addFile }),
    [kits, addKit, getKit, getFiles, addFile],
  );

  return <KitsContext.Provider value={value}>{children}</KitsContext.Provider>;
};

export const useKits = () => {
  const context = useContext(KitsContext);
  if (!context) throw new Error('useKits must be used inside <KitsProvider>');
  return context;
};
