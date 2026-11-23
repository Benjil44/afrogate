import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * "Your library" without an account: liked track ids and recently played ids, kept ONLY in this
 * browser's localStorage (no server, no tracking). Storage can be blocked (private mode, policy):
 * every access is try/catch and the app keeps working in memory. Ids are re-validated on read.
 */
const LIKED_KEY = 'afrows.liked';
const RECENT_KEY = 'afrows.recent';
const MAX_LIKED = 500;
const MAX_RECENT = 20;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function readIds(key: string, max: number): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return Array.from(new Set(raw.filter((v): v is string => typeof v === 'string' && ID.test(v)))).slice(0, max);
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: readonly string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* blocked storage: keep the in-memory copy only */
  }
}

interface CollectionState {
  /** Liked ids, most recent first. */
  liked: readonly string[];
  /** Recently played ids, most recent first. */
  recent: readonly string[];
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => void;
  addRecent: (id: string) => void;
}

const CollectionContext = createContext<CollectionState | null>(null);

export function CollectionProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<string[]>(() => readIds(LIKED_KEY, MAX_LIKED));
  const [recent, setRecent] = useState<string[]>(() => readIds(RECENT_KEY, MAX_RECENT));

  const toggleLike = useCallback((id: string) => {
    if (!ID.test(id)) return;
    setLiked((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, MAX_LIKED);
      writeIds(LIKED_KEY, next);
      return next;
    });
  }, []);

  const addRecent = useCallback((id: string) => {
    if (!ID.test(id)) return;
    setRecent((list) => {
      if (list[0] === id) return list;
      const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT);
      writeIds(RECENT_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<CollectionState>(() => {
    const set = new Set(liked);
    return { liked, recent, isLiked: (id) => set.has(id), toggleLike, addRecent };
  }, [liked, recent, toggleLike, addRecent]);

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionState {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider');
  return ctx;
}
