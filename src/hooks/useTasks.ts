import { useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { taskTimeSortKey } from '@/utils/taskTime';
import type { Task, TaskStatus, Priority } from '@/types';
import { format } from 'date-fns';

export function useTasks() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  // Attività di oggi (non eliminate)
  const todayTasks = useLiveQuery(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.tasks
      .where('dueDate')
      .equals(today)
      .filter((t) => !t.deletedAt && t.status !== 'cancelled' && t.userId === userId)
      .sortBy('sortOrder');
  }, [userId]);

  // Tutte le attività attive
  const allTasks = useLiveQuery(() =>
    db.tasks
      .filter((t) => !t.deletedAt && t.userId === userId)
      .sortBy('updatedAt')
      .then((tasks) => tasks.reverse()),
    [userId]
  );

  // Attività arretrate
  const overdueTasks = useLiveQuery(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.tasks
      .filter(
        (t) =>
          !t.deletedAt &&
          t.userId === userId &&
          t.status !== 'done' &&
          t.status !== 'cancelled' &&
          !!t.dueDate &&
          t.dueDate < today
      )
      .sortBy('dueDate');
  }, [userId]);

  const createTask = useCallback(
    async (data: Omit<Task, 'localId' | 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'version'>) => {
      const id = generateId();
      const now = nowISO();
      const task: Task = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
      };
      await db.tasks.add(task);
      await syncEngine.enqueue('task', id, 'create', task as unknown as Record<string, unknown>);
      return task;
    },
    [userId]
  );

  const updateTask = useCallback(
    async (id: string, changes: Partial<Task>) => {
      const existing = await db.tasks.where('id').equals(id).first();
      if (!existing) return;

      const updated = {
        ...changes,
        updatedAt: nowISO(),
        syncStatus: 'pending' as const,
        version: (existing.version || 1) + 1,
      };
      await db.tasks.where('id').equals(id).modify(updated);
      await syncEngine.enqueue('task', id, 'update', { ...existing, ...updated } as unknown as Record<string, unknown>);
    },
    []
  );

  const completeTask = useCallback(
    async (id: string) => {
      await updateTask(id, {
        status: 'done',
        completedAt: nowISO(),
      });
    },
    [updateTask]
  );

  const deleteTask = useCallback(
    async (id: string, hard = false) => {
      if (hard) {
        await db.tasks.where('id').equals(id).delete();
      } else {
        await updateTask(id, { deletedAt: nowISO(), status: 'cancelled' });
        await syncEngine.enqueue('task', id, 'delete', { id });
      }
    },
    [updateTask]
  );

  const getTasksByDate = useCallback(
    (date: string) =>
      db.tasks
        .where('dueDate')
        .equals(date)
        .filter((t) => !t.deletedAt && t.userId === userId)
        .toArray()
        .then((items) => items.sort((a, b) => taskTimeSortKey(a).localeCompare(taskTimeSortKey(b)))),
    [userId]
  );

  return {
    todayTasks: todayTasks ?? [],
    allTasks: allTasks ?? [],
    overdueTasks: overdueTasks ?? [],
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    getTasksByDate,
  };
}
