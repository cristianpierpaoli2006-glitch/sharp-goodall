import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SavedLink } from '@/types';

export function useLinks() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const items = useLiveQuery(() =>
    db.links
      .filter((item) => !item.deletedAt && !item.isArchived && item.userId === userId)
      .sortBy('createdAt')
      .then((items) => items.reverse()),
    [userId]
  );

  const addLink = useCallback(
    async (data: Omit<SavedLink, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const link: SavedLink = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        isFavorite: data.isFavorite ?? false,
        isArchived: data.isArchived ?? false,
        category: data.category || 'other',
      };
      await db.links.add(link);
      await syncEngine.enqueue('savedLink', id, 'create', link as unknown as Record<string, unknown>);
      return link;
    },
    [userId]
  );

  const updateLink = useCallback(async (id: string, changes: Partial<SavedLink>) => {
    const existing = await db.links.where('id').equals(id).first();
    if (!existing) return;
    const updated = { ...changes, updatedAt: nowISO(), syncStatus: 'pending' as const, version: (existing.version || 1) + 1 };
    await db.links.where('id').equals(id).modify(updated);
    await syncEngine.enqueue('savedLink', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
  }, []);

  const deleteLink = useCallback(async (id: string) => {
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.links.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('savedLink', id, 'delete', { id });
  }, []);

  return { items: items ?? [], addLink, updateLink, deleteLink };
}
