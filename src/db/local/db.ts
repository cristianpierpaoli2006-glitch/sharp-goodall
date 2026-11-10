import Dexie, { type Table } from 'dexie';
import type {
  Task, Template, CalendarEvent, WishlistItem, SavedLink,
  Recipe, DiaryEntry, Idea, InboxItem, SyncQueueItem, AppSettings
} from '@/types';

export class PersonalLifeHubDB extends Dexie {
  tasks!:      Table<Task>;
  templates!:  Table<Template>;
  events!:     Table<CalendarEvent>;
  wishlist!:   Table<WishlistItem>;
  links!:      Table<SavedLink>;
  recipes!:    Table<Recipe>;
  diary!:      Table<DiaryEntry>;
  ideas!:      Table<Idea>;
  inbox!:      Table<InboxItem>;
  syncQueue!:  Table<SyncQueueItem>;
  settings!:   Table<{ key: string; value: AppSettings | string | number | boolean }>;

  constructor() {
    super('PersonalLifeHub');

    // Versione 1 — schema base
    this.version(1).stores({
      tasks:     '++localId, id, userId, status, dueDate, priority, syncStatus, updatedAt, deletedAt',
      templates: '++localId, id, userId, syncStatus, updatedAt, deletedAt',
      events:    '++localId, id, userId, startDate, syncStatus, updatedAt, deletedAt',
      wishlist:  '++localId, id, userId, status, priority, syncStatus, updatedAt, deletedAt, isFavorite',
      links:     '++localId, id, userId, url, category, syncStatus, updatedAt, deletedAt, isFavorite, isArchived',
      recipes:   '++localId, id, userId, category, status, syncStatus, updatedAt, deletedAt, isFavorite',
      diary:     '++localId, id, userId, date, syncStatus, updatedAt, deletedAt, isFavorite',
      ideas:     '++localId, id, userId, status, priority, syncStatus, updatedAt, deletedAt, isFavorite',
      inbox:     '++localId, id, userId, type, isProcessed, syncStatus, updatedAt, deletedAt',
      syncQueue: '++id, entityType, entityId, operation, createdAt, retryCount, idempotencyKey',
      settings:  'key',
    });
  }
}

export const db = new PersonalLifeHubDB();

// Utility: genera UUID v4
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Utility: now ISO string
export function nowISO(): string {
  return new Date().toISOString();
}

// Utility: controlla se l'utente è autenticato (placeholder per Supabase)
export function getAnonymousUserId(): string {
  let uid = localStorage.getItem('anon_user_id');
  if (!uid) {
    uid = generateId();
    localStorage.setItem('anon_user_id', uid);
  }
  return uid;
}
