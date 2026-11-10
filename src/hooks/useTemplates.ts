import { useState, useEffect, useCallback } from 'react';
import { db, generateId, nowISO, getAnonymousUserId } from '@/db/local/db';
import { syncEngine } from '@/sync/SyncEngine';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { stripLeadingEmoji } from '@/utils/taskTime';
import type { Template, Priority } from '@/types';

export interface RoutineItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  priority: Priority;
  dueTime?: string; // undefined = senza orario fisso
  description?: string;
  isCustom?: boolean;
}

export const INITIAL_BUILT_IN_ROUTINES: RoutineItem[] = [
  { id: 'gym',      name: '🏋️ Allenamento / Palestra',    icon: '🏋️', category: 'Salute',     priority: 'high',   dueTime: '18:00', description: 'Sessione di allenamento' },
  { id: 'grocery',  name: '🛒 Spesa e Commissioni',       icon: '🛒', category: 'Casa',       priority: 'medium', dueTime: '10:30', description: 'Acquisti per la settimana' },
  { id: 'cleaning', name: '🧹 Pulizie e Riordino',        icon: '🧹', category: 'Casa',       priority: 'low',                      description: 'Riordino stanze (senza orario)' },
  { id: 'deepwork', name: '💻 Lavoro Profondo / Focus',   icon: '💻', category: 'Lavoro',     priority: 'high',   dueTime: '09:00', description: 'Sessione concentrata senza distrazioni' },
  { id: 'study',    name: '📚 Studio / Lettura',          icon: '📚', category: 'Crescita',   priority: 'medium',                   description: 'Lettura o studio (senza orario)' },
  { id: 'review',   name: '📋 Pianificazione Settimanale', icon: '📋', category: 'Organizz.', priority: 'medium', dueTime: '19:00', description: 'Revisione obiettivi ed impegni' },
  { id: 'walk',     name: '🚶 Passeggiata all\'Aperto',    icon: '🚶', category: 'Benessere',  priority: 'low',                      description: 'Camminata 30 minuti (senza orario)' },
  { id: 'meds',     name: '💊 Controllo Farmaci / Medico',icon: '💊', category: 'Salute',     priority: 'urgent', dueTime: '08:30', description: 'Visita o prescrizioni' },
];

export function useTemplates() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  // ID delle routine predefinite eliminate/nascoste dall'utente
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('plh_hidden_routines');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const customTemplates = useLiveQuery(() =>
    db.templates
      .filter((t) => !t.deletedAt && t.userId === userId)
      .sortBy('usageCount')
      .then((items) => items.reverse()),
    [userId]
  );

  // Crea nuova routine (con orario fisso opzionale)
  const createTemplate = useCallback(
    async (data: {
      name: string;
      icon?: string;
      priority: Priority;
      category?: string;
      defaultTime?: string; // se undefined o vuoto = senza orario fisso
      description?: string;
    }) => {
      const id = generateId();
      const now = nowISO();
      const template: Template = {
        id,
        userId,
        name: data.name,
        icon: data.icon || '📌',
        category: data.category || 'Routine',
        description: data.description,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        version: 1,
        tasks: [
          {
            title: data.name,
            description: data.description,
            priority: data.priority,
            category: data.category,
            offsetTime: data.defaultTime || undefined,
          },
        ],
      };

      await db.templates.add(template);
      await syncEngine.enqueue('template', id, 'create', template as unknown as Record<string, unknown>);
      return template;
    },
    [userId]
  );

  // Cancella una routine (sia essa creata dall'utente o built-in)
  const deleteRoutine = useCallback(
    async (routineId: string) => {
      // 1. Prova a cancellarla da IndexedDB se è custom
      const existing = await db.templates.where('id').equals(routineId).first();
      if (existing) {
        const changes = { deletedAt: nowISO(), updatedAt: nowISO(), syncStatus: 'pending' as const };
        await db.templates.where('id').equals(routineId).modify(changes);
        await syncEngine.enqueue('template', routineId, 'delete', { id: routineId });
      }

      // 2. Se è built-in o custom, aggiungila a hiddenIds
      setHiddenIds((prev) => {
        const next = Array.from(new Set([...prev, routineId]));
        localStorage.setItem('plh_hidden_routines', JSON.stringify(next));
        return next;
      });
    },
    []
  );

  // Ripristina tutte le routine predefinite
  const resetBuiltInRoutines = useCallback(() => {
    localStorage.removeItem('plh_hidden_routines');
    setHiddenIds([]);
  }, []);

  // Inserisce una routine direttamente nella data scelta con un solo tocco
  const applyRoutineToDate = useCallback(
    async (
      routine: { name: string; priority?: Priority; category?: string; dueTime?: string; description?: string },
      dateStr: string,
      overrideTime?: string | null
    ) => {
      const id = generateId();
      const now = nowISO();

      // Determina l'orario effettivo:
      // se overrideTime è passato (o null per togliere), usa overrideTime, altrimenti il default della routine
      const finalTime = overrideTime !== undefined ? (overrideTime || undefined) : routine.dueTime;

      const task = {
        id,
        userId,
        title: stripLeadingEmoji(routine.name),
        description: routine.description || '',
        status: 'todo' as const,
        priority: routine.priority || 'medium',
        dueDate: dateStr,
        dueTime: finalTime,
        category: routine.category || 'Routine',
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending' as const,
        version: 1,
      };

      await db.tasks.add(task);
      await syncEngine.enqueue('task', id, 'create', task as unknown as Record<string, unknown>);
      return task;
    },
    [userId]
  );

  // Routine predefinite visibili (escluse quelle cancellate dall'utente)
  const visibleBuiltInRoutines = INITIAL_BUILT_IN_ROUTINES.filter(
    (r) => !hiddenIds.includes(r.id)
  );

  // Routine personalizzate mappate
  const mappedCustomRoutines: RoutineItem[] = (customTemplates || [])
    .filter((t) => !hiddenIds.includes(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon || '📌',
      category: t.category || 'Personale',
      priority: t.tasks[0]?.priority || 'medium',
      dueTime: t.tasks[0]?.offsetTime,
      description: t.description,
      isCustom: true,
    }));

  return {
    allRoutines: [...mappedCustomRoutines, ...visibleBuiltInRoutines],
    customTemplates: mappedCustomRoutines,
    builtInRoutines: visibleBuiltInRoutines,
    hasHiddenRoutines: hiddenIds.length > 0,
    createTemplate,
    deleteRoutine,
    resetBuiltInRoutines,
    applyRoutineToDate,
  };
}
