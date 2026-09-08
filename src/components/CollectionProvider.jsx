import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getHeritageCatalog } from '../services/heritageContentService.js';
import { mergeCollectionCatalog } from '../utils/heritageContent.js';
import { acquireStamp, readStampCollection, STAMP_STORAGE_KEY } from '../services/stampCollectionService.js';

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const [collected, setCollected] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [status, setStatus] = useState('loading');
  const [storageError, setStorageError] = useState(false);
  const refreshCatalog = useCallback(async () => {
    setStatus('loading');
    try {
      setCatalog(await getHeritageCatalog({ force: true }));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const read = () => {
      try {
        setCollected(readStampCollection());
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    };
    read();
    refreshCatalog();
    const onStorage = (event) => {
      if (event.key === STAMP_STORAGE_KEY || event.key === null) read();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshCatalog]);

  const collect = useCallback((heritage) => {
    try {
      const result = acquireStamp(heritage);
      setCollected(result.items);
      setStorageError(false);
      return result;
    } catch {
      setStorageError(true);
      throw new Error('스탬프를 저장하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요.');
    }
  }, []);

  const entries = useMemo(() => mergeCollectionCatalog(catalog, collected), [catalog, collected]);
  const stamps = useMemo(() => entries.filter((entry) => entry.acquiredAt)
    .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt)), [entries]);
  const value = useMemo(() => ({ entries, stamps, collect, status, storageError, refreshCatalog }),
    [entries, stamps, collect, status, storageError, refreshCatalog]);
  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
