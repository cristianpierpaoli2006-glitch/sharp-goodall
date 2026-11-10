import { db, getAnonymousUserId } from '@/db/local/db';

interface ExportData {
  exportedAt: string;
  version: string;
  tasks: unknown[];
  templates: unknown[];
  events: unknown[];
  wishlist: unknown[];
  links: unknown[];
  recipes: unknown[];
  diary: unknown[];
  ideas: unknown[];
  inbox: unknown[];
}

export async function exportAllData(userId: string): Promise<ExportData> {
  const [tasks, templates, events, wishlist, links, recipes, diary, ideas, inbox] = await Promise.all([
    db.tasks.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.templates.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.events.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.wishlist.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.links.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.recipes.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.diary.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.ideas.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
    db.inbox.filter((t) => t.userId === userId && !t.deletedAt).toArray(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    tasks,
    templates,
    events,
    wishlist,
    links,
    recipes,
    diary,
    ideas,
    inbox,
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportAndDownload(userId: string): Promise<void> {
  const data = await exportAllData(userId);
  const date = new Date().toISOString().split('T')[0];
  downloadJson(data, `personal-life-hub-backup-${date}.json`);
}

export async function importFromJson(jsonString: string, userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonString) as ExportData;

    if (!data.version || !data.exportedAt) {
      return { success: false, message: 'File di backup non valido' };
    }

    // Importa ogni categoria (non sovrascrive elementi esistenti per ID)
    const importEntity = async (table: Dexie.Table, items: unknown[], newUserId: string) => {
      for (const item of items as Record<string, unknown>[]) {
        const existing = await table.where('id').equals(item.id as string).first();
        if (!existing) {
          await table.add({ ...item, userId: newUserId, syncStatus: 'pending', localId: undefined });
        }
      }
    };

    await importEntity(db.tasks as unknown as Dexie.Table, data.tasks, userId);
    await importEntity(db.templates as unknown as Dexie.Table, data.templates, userId);
    await importEntity(db.events as unknown as Dexie.Table, data.events, userId);
    await importEntity(db.wishlist as unknown as Dexie.Table, data.wishlist, userId);
    await importEntity(db.links as unknown as Dexie.Table, data.links, userId);
    await importEntity(db.recipes as unknown as Dexie.Table, data.recipes, userId);
    await importEntity(db.diary as unknown as Dexie.Table, data.diary, userId);
    await importEntity(db.ideas as unknown as Dexie.Table, data.ideas, userId);
    await importEntity(db.inbox as unknown as Dexie.Table, data.inbox, userId);

    return { success: true, message: 'Backup importato con successo' };
  } catch (err) {
    return { success: false, message: `Errore di importazione: ${err}` };
  }
}

export async function exportAllDataAsJson(userId?: string): Promise<void> {
  const uid = userId || getAnonymousUserId();
  await exportAndDownload(uid);
}

export async function importDataFromJson(jsonString: string, userId?: string): Promise<{ success: boolean; count: number; errors: string[] }> {
  const uid = userId || getAnonymousUserId();
  const res = await importFromJson(jsonString, uid);
  return { success: res.success, count: 1, errors: res.success ? [] : [res.message] };
}

export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    db.tasks.clear(),
    db.templates.clear(),
    db.events.clear(),
    db.wishlist.clear(),
    db.links.clear(),
    db.recipes.clear(),
    db.diary.clear(),
    db.ideas.clear(),
    db.inbox.clear(),
    db.syncQueue.clear(),
  ]);
}

// Dichiarazione tipo Dexie
declare namespace Dexie {
  interface Table {
    where(key: string): { equals(val: unknown): { first(): Promise<unknown> } };
    add(item: unknown): Promise<unknown>;
  }
}
