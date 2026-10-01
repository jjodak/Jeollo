import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getHeritageCatalog } from '../services/heritageContentService.js';
import { mergeCollectionCatalog } from '../utils/heritageContent.js';
import { acquireStamp, mergeStampRecords, readStampCollection, removeImportedGuestStamps, STAMP_STORAGE_KEY } from '../services/stampCollectionService.js';
import { readMemberCollection, readMemberStamp, saveMemberStamps } from '../services/memberCollectionService.js';
import { useAuth } from './AuthProvider.jsx';

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const { user, memberReady, guest, authReady } = useAuth();
  const owner = memberReady ? user.id : 'guest';
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [collectionOwner, setCollectionOwner] = useState(null);
  const [collected, setCollected] = useState([]);
  const [scanIds, setScanIds] = useState([]);
  const [syncStatus, setSyncStatus] = useState('ready');
  const [syncError, setSyncError] = useState('');
  const [syncRevision, setSyncRevision] = useState(0);
  const savingRef = useRef(Promise.resolve());
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
    refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    let alive = true;
    setCollected([]);
    setScanIds([]);
    setCollectionOwner(owner);
    setSyncError('');
    if (!authReady || (!memberReady && !guest)) return;
    if (memberReady) {
      setSyncStatus('loading');
      (async () => {
        const imported = readStampCollection();
        if (imported.length) await saveMemberStamps(imported, { userId: user.id, scanned: true });
        const remote = await readMemberCollection(user.id);
        if (!alive || ownerRef.current !== owner) return;
        if (imported.length) removeImportedGuestStamps(imported.filter((item) => remote.stamps.some((row) => row.id === item.id)));
        setCollected(remote.stamps);
        setScanIds(remote.scans.map((row) => row.heritage_id));
        setStorageError(false);
        setSyncStatus('ready');
      })().catch((error) => { if (alive) { setSyncError(error.message); setSyncStatus('error'); } });
      return () => { alive = false; };
    }
    const read = () => {
      try {
        setCollected(readStampCollection());
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    };
    read();
    setSyncStatus('ready');
    const onStorage = (event) => {
      if (event.key === STAMP_STORAGE_KEY || event.key === null) read();
    };
    window.addEventListener('storage', onStorage);
    return () => { alive = false; window.removeEventListener('storage', onStorage); };
  }, [owner, memberReady, user?.id, guest, authReady, syncRevision]);

  const collect = useCallback(async (heritage) => {
    if (memberReady) {
      if (syncStatus !== 'ready') throw new Error('회원 기록을 동기화한 뒤 다시 시도해주세요.');
      const saveOwner = owner;
      const operation = savingRef.current.catch(() => {}).then(async () => {
        if (ownerRef.current !== saveOwner) throw new Error('계정이 변경되었어요. 다시 시도해주세요.');
        const existing = await readMemberStamp(saveOwner, heritage.id);
        const item = { ...heritage, acquiredAt: existing?.acquired_at ?? new Date().toISOString() };
        const saved = await saveMemberStamps([item], { scanned: true, userId: saveOwner });
        const savedStamp = saved?.find((row) => row.heritage_id === heritage.id);
        if (!savedStamp) throw new Error('문화유산이 변경되어 스탬프를 저장하지 못했어요. 다시 스캔해주세요.');
        item.acquiredAt = savedStamp.acquired_at;
        if (ownerRef.current !== saveOwner) return { item, isNew: !existing };
        setCollected((prev) => mergeStampRecords(prev, [item]));
        setScanIds((prev) => [...new Set([...prev, item.id])]);
        setSyncError('');
        return { item, isNew: !existing };
      });
      savingRef.current = operation;
      try { return await operation; } catch (error) { if (ownerRef.current === saveOwner) setSyncError(error.message); throw error; }
    }
    try {
      const result = acquireStamp(heritage);
      setCollected(result.items);
      setStorageError(false);
      return result;
    } catch {
      setStorageError(true);
      throw new Error('스탬프를 저장하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요.');
    }
  }, [memberReady, owner, syncStatus]);

  const visibleCollected = collectionOwner === owner ? collected : [];
  const entries = useMemo(() => mergeCollectionCatalog(catalog, visibleCollected), [catalog, visibleCollected]);
  const stamps = useMemo(() => entries.filter((entry) => entry.acquiredAt)
    .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt)), [entries]);
  const scannedCount = memberReady ? scanIds.length : stamps.length;
  const refreshCollection = useCallback(() => setSyncRevision((prev) => prev + 1), []);
  const resetGuestCollection = useCallback(() => {
    if (memberReady) return;
    localStorage.removeItem(STAMP_STORAGE_KEY); setCollected([]); setStorageError(false);
  }, [memberReady]);
  const value = useMemo(() => ({ entries, stamps, scannedCount, collect, status, storageError, refreshCatalog,
    syncStatus, syncError, refreshCollection, resetGuestCollection }),
    [entries, stamps, scannedCount, collect, status, storageError, refreshCatalog, syncStatus, syncError, refreshCollection, resetGuestCollection]);
  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  return useContext(CollectionContext);
}
