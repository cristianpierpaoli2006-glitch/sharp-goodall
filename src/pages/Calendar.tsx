import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isToday, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays
} from 'date-fns';
import { it } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock,
  Trash2, Layers, Check, Share2, RotateCcw
} from 'lucide-react';
import { Page, PageHeader, EmptyState } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, PRIORITY_LABELS } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { useTasks } from '@/hooks/useTasks';
import { useTemplates, type RoutineItem } from '@/hooks/useTemplates';
import { useAppStore } from '@/stores/useAppStore';
import {
  exportToAppleCalendar, exportToAppleReminders,
  exportDayToAppleCalendar, getGoogleCalendarUrl
} from '@/services/calendarExport';
import { formatTaskTime, taskTimeSortKey, stripLeadingEmoji } from '@/utils/taskTime';
import { cn } from '@/utils/cn';
import type { Task, Priority } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAnonymousUserId } from '@/db/local/db';
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'day';

export function Calendar() {
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();
  const setQuickCaptureOpen = useAppStore((s) => s.setQuickCaptureOpen);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Modale Routine / Attività Predefinite
  const [isRoutineSheetOpen, setIsRoutineSheetOpen] = useState(false);
  const [isNewRoutineOpen, setIsNewRoutineOpen] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineHasTime, setNewRoutineHasTime] = useState(false);
  const [newRoutineTime, setNewRoutineTime] = useState('09:00');
  const [newRoutinePriority, setNewRoutinePriority] = useState<Priority>('medium');
  const [newRoutineCategory, setNewRoutineCategory] = useState('');

  // Modale Esportazione Apple / Google
  const [exportTask, setExportTask] = useState<Task | null>(null);

  // Dialog scelta inserimento routine con o senza orario
  const [selectedRoutineToApply, setSelectedRoutineToApply] = useState<RoutineItem | null>(null);

  const { completeTask, deleteTask } = useTasks();
  const {
    allRoutines,
    hasHiddenRoutines,
    createTemplate,
    deleteRoutine,
    resetBuiltInRoutines,
    applyRoutineToDate,
  } = useTemplates();

  // Attività del giorno selezionato (ordinamento sicuro in memoria, include sia orari che tutto-il-giorno)
  const selectedDayTasks = useLiveQuery(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return db.tasks
      .filter((t) => !t.deletedAt && t.userId === userId && t.dueDate === dateStr)
      .toArray()
      .then((items) => items.sort((a, b) => taskTimeSortKey(a).localeCompare(taskTimeSortKey(b))));
  }, [selectedDate, userId]) ?? [];

  // Attività del mese corrente (per i pallini nel calendario)
  const monthTasks = useLiveQuery(() => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    return db.tasks
      .filter((t) => !t.deletedAt && t.userId === userId && !!t.dueDate && t.dueDate >= start && t.dueDate <= end)
      .toArray();
  }, [currentDate, userId]) ?? [];

  const safeMonthTasks = monthTasks || [];
  const tasksByDate = safeMonthTasks.reduce((acc, task) => {
    if (task.dueDate) {
      if (!acc[task.dueDate]) acc[task.dueDate] = [];
      acc[task.dueDate].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  // Celle del calendario mensile
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Giorni della settimana corrente
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Cancellazione diretta dell'attività con notifica
  const handleDeleteTask = async (id: string, title: string) => {
    await deleteTask(id);
    toast.success(`Attività "${title}" eliminata`);
  };

  // Inserimento rapido routine predefinita con opzione orario
  const executeApplyRoutine = async (routine: RoutineItem, overrideTime?: string | null) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    await applyRoutineToDate(routine, dateStr, overrideTime);
    const timeLabel = overrideTime ? `alle ${overrideTime}` : (overrideTime === null || !routine.dueTime ? 'senza orario' : `alle ${routine.dueTime}`);
    toast.success(`"${routine.name}" inserita ${timeLabel}!`);
    setSelectedRoutineToApply(null);
    setIsRoutineSheetOpen(false);
  };

  // Cancellazione di una routine (sia custom che predefinita)
  const handleDeleteRoutine = async (e: React.MouseEvent, routine: RoutineItem) => {
    e.stopPropagation();
    if (!confirm(`Vuoi cancellare la routine "${routine.name}"?`)) return;
    await deleteRoutine(routine.id);
    toast.success(`Routine "${routine.name}" cancellata`);
  };

  // Salvataggio nuova routine personalizzata
  const handleCreateCustomRoutine = async () => {
    if (!newRoutineName.trim()) {
      toast.error('Inserisci il nome della routine');
      return;
    }
    await createTemplate({
      name: newRoutineName.trim(),
      priority: newRoutinePriority,
      defaultTime: newRoutineHasTime ? newRoutineTime : undefined,
      category: newRoutineCategory || 'Personale',
    });
    toast.success(`Routine "${newRoutineName}" creata con successo!`);
    setNewRoutineName('');
    setNewRoutineHasTime(false);
    setIsNewRoutineOpen(false);
  };

  // Esportazione intera giornata su Apple Calendar
  const handleExportFullDay = () => {
    if (selectedDayTasks.length === 0) {
      toast.error('Nessun impegno da esportare in questa giornata');
      return;
    }
    const label = format(selectedDate, 'd MMMM', { locale: it });
    exportDayToAppleCalendar(selectedDayTasks, label);
    toast.success(`Esportazione Apple Calendar avviata per ${label}!`);
  };

  return (
    <Page>
      <PageHeader
        title="Calendario"
        right={
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRoutineSheetOpen(true)}
              className="text-xs"
            >
              <Layers size={13} />
              Routine
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Oggi
            </Button>
          </div>
        }
      />

      {/* Switcher vista */}
      <div className="flex bg-surface-200 rounded-2xl p-1 mb-4">
        {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200',
              viewMode === v
                ? 'bg-brand-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {v === 'month' ? 'Mese' : v === 'week' ? 'Settimana' : 'Giorno'}
          </button>
        ))}
      </div>

      {/* Navigazione mese */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 rounded-xl hover:bg-surface-200 text-slate-400 active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base font-semibold text-slate-100 capitalize">
          {format(currentDate, viewMode === 'day' ? 'd MMMM yyyy' : 'MMMM yyyy', { locale: it })}
        </h2>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 rounded-xl hover:bg-surface-200 text-slate-400 active:scale-95 transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {viewMode === 'month' && (
        <>
          {/* Intestazione giorni */}
          <div className="grid grid-cols-7 mb-2">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Griglia mese */}
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {calDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const tasks = tasksByDate[dateStr] || [];
              const isSelected = isSameDay(day, selectedDate);
              const isCurrent = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const hasOverdue = tasks.some((t) => t.status !== 'done' && t.dueDate && t.dueDate < format(new Date(), 'yyyy-MM-dd'));

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'flex flex-col items-center py-2 rounded-2xl transition-all duration-200 active:scale-95',
                    isSelected && 'bg-brand-500',
                    isCurrent && !isSelected && 'bg-surface-200',
                    !isCurrentMonth && 'opacity-30'
                  )}
                >
                  <span className={cn(
                    'text-sm font-medium leading-none',
                    isSelected ? 'text-white' : isCurrent ? 'text-brand-400' : 'text-slate-300'
                  )}>
                    {format(day, 'd')}
                  </span>
                  {tasks.length > 0 && (
                    <div className="flex gap-0.5 mt-1.5">
                      {tasks.slice(0, 3).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-1 h-1 rounded-full',
                            isSelected ? 'bg-white/70' :
                            hasOverdue ? 'bg-red-400' : 'bg-brand-400'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {viewMode === 'week' && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const tasks = tasksByDate[dateStr] || [];
            const isSelected = isSameDay(day, selectedDate);
            const isCurrent = isToday(day);
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex-1 flex flex-col items-center py-3 rounded-2xl transition-all duration-200 min-w-[44px]',
                  isSelected ? 'bg-brand-500' : isCurrent ? 'bg-surface-200' : 'bg-surface-100'
                )}
              >
                <span className={cn('text-xs mb-1', isSelected ? 'text-white/70' : 'text-slate-500')}>
                  {format(day, 'EEE', { locale: it }).slice(0, 3)}
                </span>
                <span className={cn('text-base font-bold', isSelected ? 'text-white' : isCurrent ? 'text-brand-400' : 'text-slate-200')}>
                  {format(day, 'd')}
                </span>
                {tasks.length > 0 && (
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1', isSelected ? 'bg-white/60' : 'bg-brand-400')} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Attività del giorno selezionato */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">
              {isToday(selectedDate)
                ? 'Oggi'
                : format(selectedDate, 'EEEE d MMMM', { locale: it })}
            </h3>
            <p className="text-[11px] text-slate-500">
              {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'impegno' : 'impegni'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedDayTasks.length > 0 && (
              <button
                onClick={handleExportFullDay}
                className="p-1.5 rounded-xl bg-surface-200 text-slate-300 hover:text-brand-300 hover:bg-surface-300 transition-all text-xs flex items-center gap-1 px-2.5"
                title="Esporta giornata su Apple Calendar"
              >
                <Share2 size={13} />
                <span className="text-[11px] font-medium">Esporta (.ics)</span>
              </button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRoutineSheetOpen(true)}
              className="text-xs"
            >
              <Layers size={13} />
              + Routine
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuickCaptureOpen(true)}
            >
              <Plus size={14} />
              Aggiungi
            </Button>
          </div>
        </div>

        {selectedDayTasks.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="Nessun impegno"
            description={`Niente programmato per ${format(selectedDate, 'd MMMM', { locale: it })}`}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setIsRoutineSheetOpen(true)}>
                  <Layers size={13} /> Inserisci routine
                </Button>
                <Button variant="primary" size="sm" onClick={() => setQuickCaptureOpen(true)}>
                  <Plus size={13} /> Scrivi attività
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            {selectedDayTasks.map((task) => (
              <Card key={task.id} variant="default" padding="sm" className="group">
                <div className="flex items-start gap-3">
                  {/* Spunta Completamento */}
                  <button
                    onClick={() => completeTask(task.id)}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all flex items-center justify-center',
                      task.status === 'done'
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-surface-400 hover:border-brand-500 hover:bg-brand-500/10'
                    )}
                    aria-label="Completa"
                  >
                    {task.status === 'done' && (
                      <Check size={14} className="text-white" strokeWidth={3} />
                    )}
                  </button>

                  {/* Informazioni Attività */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-medium leading-snug',
                      task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-100'
                    )}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {formatTaskTime(task) ? (
                        <span className="text-xs text-slate-300 font-medium flex items-center gap-1">
                          <Clock size={11} className="text-brand-400" />
                          {formatTaskTime(task)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Tutto il giorno
                        </span>
                      )}
                      <Badge variant="priority" priority={task.priority} size="sm">
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      {task.category && (
                        <Badge size="sm">{task.category}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Azioni Rapide: Esporta su Apple / Elimina */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => setExportTask(task)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-brand-300 hover:bg-brand-500/10 transition-all active:scale-90"
                      title="Esporta su Apple Calendar / Promemoria"
                      aria-label="Esporta impegno"
                    >
                      <Share2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
                      title="Cancella dal calendario"
                      aria-label="Cancella attività"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* BottomSheet: Esporta su Apple Calendar / Promemoria / Google */}
      <BottomSheet
        isOpen={!!exportTask}
        onClose={() => setExportTask(null)}
        title="Esporta Impegno su iPhone"
      >
        {exportTask && (
          <div className="p-4 space-y-3">
            <div className="bg-surface-150 p-3 rounded-xl border border-surface-300/60 mb-2">
              <p className="text-sm font-semibold text-slate-100">{exportTask.title}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                {exportTask.dueDate && <span>📅 {format(new Date(exportTask.dueDate + 'T12:00:00'), 'd MMMM', { locale: it })}</span>}
                {formatTaskTime(exportTask) ? <span>🕐 {formatTaskTime(exportTask)}</span> : <span>📅 Senza orario</span>}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Scegli dove vuoi inviare questo impegno con un solo click:
            </p>

            <button
              onClick={() => {
                exportToAppleCalendar(exportTask);
                toast.success('Apertura su Apple Calendar in corso...');
                setExportTask(null);
              }}
              className="w-full flex items-center gap-3 p-3.5 bg-surface-200 hover:bg-surface-250 border border-surface-300/70 rounded-2xl text-left active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold text-lg">
                🍎
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100 group-hover:text-red-300 transition-colors">
                  Aggiungi ad Apple Calendar
                </p>
                <p className="text-xs text-slate-500">Apre l'app Calendario nativa di iOS (.ics)</p>
              </div>
            </button>

            <button
              onClick={() => {
                exportToAppleReminders(exportTask);
                toast.success('Apertura su Promemoria Apple in corso...');
                setExportTask(null);
              }}
              className="w-full flex items-center gap-3 p-3.5 bg-surface-200 hover:bg-surface-250 border border-surface-300/70 rounded-2xl text-left active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center font-bold text-lg">
                🔔
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100 group-hover:text-orange-300 transition-colors">
                  Aggiungi a Promemoria iPhone
                </p>
                <p className="text-xs text-slate-500">Invia l'attività all'app Promemoria (.ics VTODO)</p>
              </div>
            </button>

            <button
              onClick={() => {
                window.open(getGoogleCalendarUrl(exportTask), '_blank');
                setExportTask(null);
              }}
              className="w-full flex items-center gap-3 p-3.5 bg-surface-200 hover:bg-surface-250 border border-surface-300/70 rounded-2xl text-left active:scale-98 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold text-lg">
                🌐
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                  Aggiungi a Google Calendar
                </p>
                <p className="text-xs text-slate-500">Apre Google Calendar con l'evento precompilato</p>
              </div>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* BottomSheet: Routine & Attività Predefinite */}
      <BottomSheet
        isOpen={isRoutineSheetOpen}
        onClose={() => {
          setIsRoutineSheetOpen(false);
          setIsNewRoutineOpen(false);
          setSelectedRoutineToApply(null);
        }}
        title={`Routine per ${format(selectedDate, 'd MMMM', { locale: it })}`}
      >
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Se l'utente ha toccato una routine che ha un orario, gli offre la scelta rapida */}
          {selectedRoutineToApply ? (
            <div className="bg-surface-150 p-4 rounded-2xl border border-surface-300/70 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedRoutineToApply.icon}</span>
                <p className="text-sm font-semibold text-slate-100">{selectedRoutineToApply.name}</p>
              </div>
              <p className="text-xs text-slate-400">
                Come preferisci inserire questa routine nella giornata?
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {selectedRoutineToApply.dueTime && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => executeApplyRoutine(selectedRoutineToApply, selectedRoutineToApply.dueTime)}
                  >
                    <Clock size={13} /> Con orario ({selectedRoutineToApply.dueTime})
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => executeApplyRoutine(selectedRoutineToApply, null)}
                  className={!selectedRoutineToApply.dueTime ? 'col-span-2' : ''}
                >
                  <CalendarIcon size={13} /> Senza orario fisso
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setSelectedRoutineToApply(null)}
              >
                Indietro
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Tocca una routine per aggiungerla al giorno:
                </p>
                {hasHiddenRoutines && (
                  <button
                    onClick={resetBuiltInRoutines}
                    className="text-[11px] text-brand-400 flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw size={10} /> Ripristina predefinite
                  </button>
                )}
              </div>

              {/* Elenco completo Routine (con possibilità di eliminazione diretta) */}
              <div className="grid grid-cols-2 gap-2">
                {allRoutines.map((routine) => (
                  <div
                    key={routine.id}
                    onClick={() => {
                      if (routine.dueTime) {
                        setSelectedRoutineToApply(routine);
                      } else {
                        executeApplyRoutine(routine, null);
                      }
                    }}
                    className="bg-surface-200 border border-surface-300/60 rounded-xl p-3 text-left hover:border-brand-500/50 hover:bg-surface-250 active:scale-95 transition-all cursor-pointer relative group"
                  >
                    {/* Pulsante Cancella Routine */}
                    <button
                      onClick={(e) => handleDeleteRoutine(e, routine)}
                      className="absolute top-2 right-2 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors z-10"
                      title="Cancella questa routine"
                      aria-label="Cancella routine"
                    >
                      <Trash2 size={13} />
                    </button>

                    <div className="flex items-center gap-1.5 mb-1.5 pr-5">
                      <span className="text-lg">{routine.icon}</span>
                      <Badge variant="priority" priority={routine.priority} size="sm">
                        {PRIORITY_LABELS[routine.priority]}
                      </Badge>
                    </div>

                    <p className="text-xs font-semibold text-slate-200 group-hover:text-brand-300 transition-colors line-clamp-1">
                      {stripLeadingEmoji(routine.name)}
                    </p>

                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      {routine.dueTime ? (
                        <span className="text-brand-300 flex items-center gap-1">
                          <Clock size={10} /> {routine.dueTime}
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <CalendarIcon size={10} /> Senza orario
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Crea Nuova Routine Personalizzata */}
              <div className="pt-2 border-t border-surface-300/40">
                {!isNewRoutineOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => setIsNewRoutineOpen(true)}
                  >
                    <Plus size={14} /> Crea nuova routine personalizzata
                  </Button>
                ) : (
                  <div className="bg-surface-150 border border-surface-300/60 rounded-xl p-3.5 space-y-3">
                    <p className="text-xs font-semibold text-slate-200">Nuova Routine</p>

                    <Input
                      label="Nome Routine *"
                      placeholder="Es: Yoga serale, Chiamata genitori..."
                      value={newRoutineName}
                      onChange={(e) => setNewRoutineName(e.target.value)}
                      autoFocus
                    />

                    {/* Scelta orario fisso vs senza orario */}
                    <div className="bg-surface-200 p-2.5 rounded-xl border border-surface-300/60 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRoutineHasTime}
                          onChange={(e) => setNewRoutineHasTime(e.target.checked)}
                          className="w-4 h-4 rounded accent-brand-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-200">
                          Imposta un orario fisso predefinito
                        </span>
                      </label>

                      {newRoutineHasTime ? (
                        <div className="pt-1">
                          <Input
                            label="Orario"
                            type="time"
                            value={newRoutineTime}
                            onChange={(e) => setNewRoutineTime(e.target.value)}
                          />
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Nessun orario fisso: l'attività sarà valida per tutta la giornata.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        label="Priorità"
                        value={newRoutinePriority}
                        onChange={(e) => setNewRoutinePriority(e.target.value as Priority)}
                        options={[
                          { value: 'low', label: '🟢 Bassa' },
                          { value: 'medium', label: '🔵 Media' },
                          { value: 'high', label: '🟡 Alta' },
                          { value: 'urgent', label: '🔴 Urgente' },
                        ]}
                      />
                      <Input
                        label="Categoria"
                        placeholder="Es: Salute, Hobby..."
                        value={newRoutineCategory}
                        onChange={(e) => setNewRoutineCategory(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" size="sm" fullWidth onClick={() => setIsNewRoutineOpen(false)}>
                        Annulla
                      </Button>
                      <Button variant="primary" size="sm" fullWidth onClick={handleCreateCustomRoutine}>
                        Salva Routine
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </BottomSheet>
    </Page>
  );
}
