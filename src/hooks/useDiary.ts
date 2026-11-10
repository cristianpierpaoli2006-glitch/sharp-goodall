import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { DiaryEntry, Idea } from '@/types';

export function useDiary() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const entries = useLiveQuery(() =>
    db.diary
      .filter((item) => !item.deletedAt && item.userId === userId)
      .sortBy('date')
      .then((items) => items.reverse()),
    [userId]
  );

  const ideas = useLiveQuery(() =>
    db.ideas
      .filter((item) => !item.deletedAt && item.userId === userId)
      .sortBy('createdAt')
      .then((items) => items.reverse()),
    [userId]
  );

  const addEntry = useCallback(
    async (data: Omit<DiaryEntry, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const entry: DiaryEntry = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        isFavorite: data.isFavorite ?? false,
        isPrivate: data.isPrivate ?? true,
        content: data.content || '',
        date: data.date || now.split('T')[0],
      };
      await db.diary.add(entry);
      await syncEngine.enqueue('diaryEntry', id, 'create', entry as unknown as Record<string, unknown>);
      return entry;
    },
    [userId]
  );

  const updateEntry = useCallback(async (id: string, changes: Partial<DiaryEntry>) => {
    const existing = await db.diary.where('id').equals(id).first();
    if (!existing) return;
    const updated = { ...changes, updatedAt: nowISO(), syncStatus: 'pending' as const, version: (existing.version || 1) + 1 };
    await db.diary.where('id').equals(id).modify(updated);
    await syncEngine.enqueue('diaryEntry', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.diary.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('diaryEntry', id, 'delete', { id });
  }, []);

  const addIdea = useCallback(
    async (data: Omit<Idea, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const idea: Idea = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        isFavorite: data.isFavorite ?? false,
        status: data.status || 'raw',
        priority: data.priority || 'medium',
        title: data.title || '',
      };
      await db.ideas.add(idea);
      await syncEngine.enqueue('idea', id, 'create', idea as unknown as Record<string, unknown>);
      return idea;
    },
    [userId]
  );

  const updateIdea = useCallback(async (id: string, changes: Partial<Idea>) => {
    const existing = await db.ideas.where('id').equals(id).first();
    if (!existing) return;
    const updated = { ...changes, updatedAt: nowISO(), syncStatus: 'pending' as const, version: (existing.version || 1) + 1 };
    await db.ideas.where('id').equals(id).modify(updated);
    await syncEngine.enqueue('idea', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
  }, []);

  const deleteIdea = useCallback(async (id: string) => {
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.ideas.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('idea', id, 'delete', { id });
  }, []);

  return {
    entries: entries ?? [],
    ideas: ideas ?? [],
    addEntry,
    updateEntry,
    deleteEntry,
    addIdea,
    updateIdea,
    deleteIdea,
  };
}
