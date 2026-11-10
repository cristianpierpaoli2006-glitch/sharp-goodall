import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Recipe } from '@/types';

export function useRecipes() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const items = useLiveQuery(() =>
    db.recipes
      .filter((item) => !item.deletedAt && item.userId === userId)
      .sortBy('createdAt')
      .then((items) => items.reverse()),
    [userId]
  );

  const favorites = useLiveQuery(() =>
    db.recipes
      .filter((item) => !item.deletedAt && item.userId === userId && item.isFavorite)
      .sortBy('title'),
    [userId]
  );

  const addRecipe = useCallback(
    async (data: Omit<Recipe, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const recipe: Recipe = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        isFavorite: data.isFavorite ?? false,
        status: data.status || 'want_to_try',
        difficulty: data.difficulty || 'medium',
        servings: data.servings || 4,
        ingredients: data.ingredients || [],
        steps: data.steps || [],
      };
      await db.recipes.add(recipe);
      await syncEngine.enqueue('recipe', id, 'create', recipe as unknown as Record<string, unknown>);
      return recipe;
    },
    [userId]
  );

  const updateRecipe = useCallback(async (id: string, changes: Partial<Recipe>) => {
    const existing = await db.recipes.where('id').equals(id).first();
    if (!existing) return;
    const updated = { ...changes, updatedAt: nowISO(), syncStatus: 'pending' as const, version: (existing.version || 1) + 1 };
    await db.recipes.where('id').equals(id).modify(updated);
    await syncEngine.enqueue('recipe', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
  }, []);

  const deleteRecipe = useCallback(async (id: string) => {
    const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
    await db.recipes.where('id').equals(id).modify(changes);
    await syncEngine.enqueue('recipe', id, 'delete', { id });
  }, []);

  return { items: items ?? [], favorites: favorites ?? [], addRecipe, updateRecipe, deleteRecipe };
}
