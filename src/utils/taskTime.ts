import type { Task } from '@/types';

/**
 * Restituisce orario di inizio e fine di un'attività.
 * Gestisce anche i dati salvati in passato nel formato "08:00 - 20:00" dentro dueTime.
 */
export function getTaskTimes(task: Pick<Task, 'dueTime' | 'endTime'>): { start?: string; end?: string } {
  const raw = task.dueTime?.trim();
  if (!raw) return { start: undefined, end: task.endTime || undefined };

  if (raw.includes('-')) {
    const [s, e] = raw.split('-').map((p) => p.trim());
    return { start: s || undefined, end: task.endTime || e || undefined };
  }
  return { start: raw, end: task.endTime || undefined };
}

/** Testo leggibile dell'orario: "08:00 – 20:00", "08:00" oppure undefined */
export function formatTaskTime(task: Pick<Task, 'dueTime' | 'endTime'>): string | undefined {
  const { start, end } = getTaskTimes(task);
  if (!start) return undefined;
  return end ? `${start} – ${end}` : start;
}

/** Chiave di ordinamento per orario (attività senza orario in fondo) */
export function taskTimeSortKey(task: Pick<Task, 'dueTime' | 'endTime'>): string {
  return getTaskTimes(task).start || '99:99';
}

/** Rimuove l'emoji iniziale da un nome (es. "🏋️ Palestra" → "Palestra") senza toccare lettere accentate */
export function stripLeadingEmoji(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\s]+/u, '').trim() || text.trim();
}
