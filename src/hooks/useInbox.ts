import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { InboxItem, InboxItemType } from '@/types';

export function useInbox() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const unprocessedItems = useLiveQuery(() =>
    db.inbox
      .filter((item) => !item.deletedAt && !item.isProcessed && item.userId === userId)
      .sortBy('createdAt')
      .then((items) => items.reverse()),
    [userId]
  );

  const addToInbox = useCallback(
    async (content: string, type: InboxItemType = 'text', url?: string): Promise<InboxItem> => {
      const id = generateId();
      const now = nowISO();
      const item: InboxItem = {
        id,
        userId,
        content,
        type,
        url,
        isProcessed: false,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
      };
      await db.inbox.add(item);
      await syncEngine.enqueue('inboxItem', id, 'create', item as unknown as Record<string, unknown>);
      return item;
    },
    [userId]
  );

  const processInboxItem = useCallback(
    async (id: string, convertedTo: { type: string; id: string }) => {
      const existing = await db.inbox.where('id').equals(id).first();
      if (!existing) return;
      const changes = {
        isProcessed: true,
        convertedTo,
        updatedAt: nowISO(),
        syncStatus: 'pending' as const,
        version: (existing.version || 1) + 1,
      };
      await db.inbox.where('id').equals(id).modify(changes);
      await syncEngine.enqueue('inboxItem', id, 'update', { ...existing, ...changes } as unknown as Record<string, unknown>);
    },
    []
  );

  const deleteInboxItem = useCallback(async (id: string) => {
    const existing = await db.inbox.where('id').equals(id).first();
    if (!existing) return;
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.inbox.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('inboxItem', id, 'delete', { id });
  }, []);

  return {
    unprocessedItems: unprocessedItems ?? [],
    unprocessedCount: unprocessedItems?.length ?? 0,
    addToInbox,
    processInboxItem,
    deleteInboxItem,
  };
}
