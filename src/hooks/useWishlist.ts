import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { WishlistItem, WishlistItemStatus } from '@/types';

export function useWishlist() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const items = useLiveQuery(() =>
    db.wishlist
      .filter((item) => !item.deletedAt && item.userId === userId)
      .sortBy('createdAt')
      .then((items) => items.reverse()),
    [userId]
  );

  const favorites = useLiveQuery(() =>
    db.wishlist
      .filter((item) => !item.deletedAt && item.userId === userId && item.isFavorite && item.status === 'want')
      .sortBy('priority'),
    [userId]
  );

  const addItem = useCallback(
    async (data: Omit<WishlistItem, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const item: WishlistItem = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        isFavorite: data.isFavorite ?? false,
        status: data.status || 'want',
        priority: data.priority || 'medium',
      };
      await db.wishlist.add(item);
      await syncEngine.enqueue('wishlistItem', id, 'create', item as unknown as Record<string, unknown>);
      return item;
    },
    [userId]
  );

  const updateItem = useCallback(async (id: string, changes: Partial<WishlistItem>) => {
    const existing = await db.wishlist.where('id').equals(id).first();
    if (!existing) return;
    const updated = { ...changes, updatedAt: nowISO(), syncStatus: 'pending' as const, version: (existing.version || 1) + 1 };
    await db.wishlist.where('id').equals(id).modify(updated);
    await syncEngine.enqueue('wishlistItem', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.wishlist.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('wishlistItem', id, 'delete', { id });
  }, []);

  return {
    items: items ?? [],
    favorites: favorites ?? [],
    addItem,
    updateItem,
    deleteItem,
  };
}
