import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { supabase, isSupabaseConfigured } from '@/db/remote/supabase';
import type { SyncQueueItem, SyncEntityType, SyncOperation } from '@/types';

// Mappa nomi tabelle locali → remote Supabase
const TABLE_MAP: Record<SyncEntityType, string> = {
  task:         'tasks',
  template:     'templates',
  event:        'events',
  wishlistItem: 'wishlist_items',
  savedLink:    'saved_links',
  recipe:       'recipes',
  diaryEntry:   'diary_entries',
  idea:         'ideas',
  inboxItem:    'inbox_items',
};

// Converti chiavi camelCase → snake_case per Supabase
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}

class SyncEngine {
  private isSyncing = false;
  private retryDelays = [1000, 5000, 15000, 60000]; // ms

  async enqueue(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, unknown>
  ): Promise<void> {
    const idempotencyKey = `${entityId}__${operation}__${Date.now()}`;
    await db.syncQueue.add({
      entityType,
      entityId,
      operation,
      payload,
      createdAt: nowISO(),
      retryCount: 0,
      idempotencyKey,
    });
  }

  async flush(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) return { success: 0, failed: 0 };
    if (!navigator.onLine) return { success: 0, failed: 0 };
    if (!isSupabaseConfigured()) return { success: 0, failed: 0 };

    // Verifica autenticazione
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: 0, failed: 0 };

    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      // Prendi max 50 operazioni pendenti, ordinate per data di creazione
      const queue = await db.syncQueue
        .orderBy('createdAt')
        .limit(50)
        .toArray();

      for (const item of queue) {
        const ok = await this.processQueueItem(item, session.user.id);
        if (ok) {
          success++;
          await db.syncQueue.delete(item.id!);
        } else {
          failed++;
          if (item.retryCount >= 4) {
            // Troppi tentativi: lascia in coda con errore
            await db.syncQueue.update(item.id!, {
              retryCount: item.retryCount + 1,
              lastError: 'Max retries reached',
            });
          } else {
            await db.syncQueue.update(item.id!, {
              retryCount: item.retryCount + 1,
            });
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return { success, failed };
  }

  private async processQueueItem(
    item: SyncQueueItem,
    userId: string
  ): Promise<boolean> {
    const tableName = TABLE_MAP[item.entityType];
    if (!tableName) return false;

    try {
      if (item.operation === 'delete') {
        // Soft delete su Supabase
        const { error } = await supabase
          .from(tableName)
          .update({ deleted_at: nowISO() })
          .eq('id', item.entityId)
          .eq('user_id', userId);
        return !error;
      }

      // Create o Update: upsert idempotente
      const payload = toSnakeCase({ ...item.payload, userId });
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, {
          onConflict: 'id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Sync error [${item.entityType}/${item.entityId}]:`, error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Sync exception:', err);
      return false;
    }
  }

  // Pull: scarica modifiche remote e aggiorna IndexedDB
  async pullFromRemote(): Promise<void> {
    if (!navigator.onLine || !isSupabaseConfigured()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    // Per ogni tabella, scarica gli elementi aggiornati nelle ultime 24h
    // o tutti se è la prima sync
    const lastSync = localStorage.getItem('last_pull_at');
    const since = lastSync || '2020-01-01T00:00:00.000Z';

    const entities: Array<[SyncEntityType, string]> = [
      ['task', 'tasks'],
      ['template', 'templates'],
      ['event', 'events'],
      ['wishlistItem', 'wishlist_items'],
      ['savedLink', 'saved_links'],
      ['recipe', 'recipes'],
      ['diaryEntry', 'diary_entries'],
      ['idea', 'ideas'],
      ['inboxItem', 'inbox_items'],
    ];

    for (const [localType, remoteTable] of entities) {
      try {
        const { data, error } = await supabase
          .from(remoteTable)
          .select('*')
          .eq('user_id', userId)
          .gte('updated_at', since)
          .order('updated_at', { ascending: true })
          .limit(500);

        if (error || !data) continue;

        // Per ogni record remoto, aggiorna o inserisci nel DB locale
        for (const remote of data) {
          await this.mergeRemoteRecord(localType, remote);
        }
      } catch (err) {
        console.error(`Pull error for ${remoteTable}:`, err);
      }
    }

    localStorage.setItem('last_pull_at', nowISO());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async mergeRemoteRecord(entityType: SyncEntityType, remote: any): Promise<void> {
    // Converti snake_case → camelCase
    const local = this.toCamelCase(remote);
    local.syncStatus = 'synced';

    // Controlla se esiste già in locale
    const tableMap: Record<SyncEntityType, Dexie.Table> = {
      task: db.tasks as unknown as Dexie.Table,
      template: db.templates as unknown as Dexie.Table,
      event: db.events as unknown as Dexie.Table,
      wishlistItem: db.wishlist as unknown as Dexie.Table,
      savedLink: db.links as unknown as Dexie.Table,
      recipe: db.recipes as unknown as Dexie.Table,
      diaryEntry: db.diary as unknown as Dexie.Table,
      idea: db.ideas as unknown as Dexie.Table,
      inboxItem: db.inbox as unknown as Dexie.Table,
    };

    const table = tableMap[entityType];
    const existing = await table.where('id').equals(local.id).first();

    if (!existing) {
      await table.add(local);
    } else {
      // Conflict resolution: last-write-wins basato su updatedAt
      const localObj = existing as Record<string, unknown>;
      const remoteDate = new Date((local.updatedAt as string) || 0).getTime();
      const localDate = new Date((localObj.updatedAt as string) || 0).getTime();

      if (remoteDate > localDate || localObj.syncStatus === 'synced') {
        await table.where('id').equals(local.id).modify(local);
      }
      // Se locale è più recente e in pending, mantieni locale (sarà pushato)
    }
  }

  private toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  async getPendingCount(): Promise<number> {
    return db.syncQueue.count();
  }
}

// Importa tipo Dexie per il tableMap
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Dexie {
  interface Table {
    where(key: string): { equals(val: unknown): { first(): Promise<unknown>; modify(changes: unknown): Promise<unknown> } };
    add(item: unknown): Promise<unknown>;
  }
}

export const syncEngine = new SyncEngine();

// Avvia sync automatica al ritorno online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncEngine.flush().catch(console.error);
    syncEngine.pullFromRemote().catch(console.error);
  });
}
