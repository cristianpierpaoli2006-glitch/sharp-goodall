import { useEffect, useCallback } from 'react';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useOnlineStatus } from './useOnlineStatus';

export function useSync() {
  const isOnline = useOnlineStatus();
  const sync = useAppStore((s) => s.sync);
  const setSyncState = sync?.setSyncState;
  const setPendingCount = sync?.setPendingCount;
  const setLastSyncAt = sync?.setLastSyncAt;

  const runSync = useCallback(async () => {
    if (!isOnline) {
      if (setSyncState) setSyncState('offline');
      return;
    }

    if (setSyncState) setSyncState('syncing');
    try {
      await syncEngine.pullFromRemote();
      const { failed } = await syncEngine.flush();
      const pending = await syncEngine.getPendingCount();
      if (setPendingCount) setPendingCount(pending);

      if (failed > 0 || pending > 0) {
        if (setSyncState) setSyncState('error');
      } else {
        if (setSyncState) setSyncState('synced');
        if (setLastSyncAt) setLastSyncAt(new Date().toISOString());
      }
    } catch {
      if (setSyncState) setSyncState('error');
    }
  }, [isOnline, setSyncState, setPendingCount, setLastSyncAt]);

  // Aggiorna stato quando cambia connessione
  useEffect(() => {
    if (!isOnline) {
      if (setSyncState) setSyncState('offline');
    } else {
      runSync();
    }
  }, [isOnline, runSync, setSyncState]);

  // Sync periodica ogni 5 minuti
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) runSync();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, runSync]);

  // Aggiorna pending count periodicamente
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const count = await syncEngine.getPendingCount();
        if (setPendingCount) setPendingCount(count);
      } catch (e) {
        console.warn('Errore lettura pendingCount:', e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [setPendingCount]);

  return {
    runSync,
    syncNow: runSync,
    isSyncing: sync?.syncState === 'syncing',
    pendingCount: sync?.pendingCount || 0,
  };
}
