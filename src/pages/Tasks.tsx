import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Clock, AlertCircle, ChevronDown, Trash2, Edit, RotateCcw, Share2 } from 'lucide-react';
import { Page, PageHeader, EmptyState } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, PRIORITY_LABELS, STATUS_LABELS } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { useTasks } from '@/hooks/useTasks';
import { exportToAppleCalendar, exportToAppleReminders, getGoogleCalendarUrl } from '@/services/calendarExport';
import { formatTaskTime, getTaskTimes } from '@/utils/taskTime';
import type { Task, Priority, TaskStatus } from '@/types';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const FILTERS = [
  { value: 'all',      label: 'Tutte' },
  { value: 'today',    label: 'Oggi' },
  { value: 'overdue',  label: 'Scadute' },
  { value: 'upcoming', label: 'Future' },
  { value: 'done',     label: 'Fatte' },
];

interface TaskFormData {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  dueTime: string;
  endTime: string;
  category: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
  dueTime: '',
  endTime: '',
  category: '',
};

export function Tasks() {
  const [searchParams] = useSearchParams();
  const { allTasks, todayTasks, overdueTasks, createTask, updateTask, completeTask, deleteTask } = useTasks();
  const [filter, setFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportTask, setExportTask] = useState<Task | null>(null);

  // Apri form se arriva da query param
  useEffect(() => {
    if (searchParams.get('new')) {
      setIsFormOpen(true);
    }
  }, [searchParams]);

  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    const { start, end } = getTaskTimes(task);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate || '',
      dueTime: start || '',
      endTime: task.endTime || end || '',
      category: task.category || '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Il titolo è obbligatorio');
      return;
    }
    setIsSaving(true);
    try {
      let dueTimeVal = form.dueTime.trim() || undefined;
      const endTimeVal = form.endTime.trim() || undefined;
      if (dueTimeVal && endTimeVal && !dueTimeVal.includes('-')) {
        dueTimeVal = `${dueTimeVal} - ${endTimeVal}`;
      }

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: form.title,
          description: form.description,
          priority: form.priority,
          status: form.status,
          dueDate: form.dueDate || undefined,
          dueTime: dueTimeVal,
          endTime: endTimeVal,
          category: form.category || undefined,
        });
        toast.success('Attività aggiornata');
      } else {
        await createTask({
          title: form.title,
          description: form.description,
          priority: form.priority,
          status: form.status,
          dueDate: form.dueDate || undefined,
          dueTime: dueTimeVal,
          endTime: endTimeVal,
          category: form.category || undefined,
        });
        toast.success('Attività creata');
      }
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa attività?')) return;
    await deleteTask(id);
    toast.success('Attività eliminata');
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  const filteredTasks = (() => {
    switch (filter) {
      case 'today':    return todayTasks;
      case 'overdue':  return overdueTasks;
      case 'done':     return allTasks.filter((t) => t.status === 'done');
      case 'upcoming': return allTasks.filter((t) => t.dueDate && t.dueDate > today && t.status !== 'done');
      default:         return allTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
    }
  })();

  return (
    <Page>
      <PageHeader
        title="Attività"
        subtitle={`${filteredTasks.length} ${filter === 'all' ? 'attive' : ''}`}
        right={
          <Button variant="primary" size="icon" onClick={openCreate} aria-label="Nuova attività">
            <Plus size={20} />
          </Button>
        }
      />

      {/* Filtri */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-4 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              filter === f.value
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                : 'bg-surface-200 text-slate-400 hover:text-slate-200'
            )}
          >
            {f.label}
            {f.value === 'overdue' && overdueTasks.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {overdueTasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista attività */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title="Nessuna attività"
          description={filter === 'all' ? 'Crea la tua prima attività' : 'Nessuna attività in questa categoria'}
          action={
            filter === 'all' && (
              <Button variant="primary" size="md" onClick={openCreate}>
                <Plus size={16} />
                Nuova attività
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <Card key={task.id} variant="default" padding="sm">
              <div className="flex items-start gap-3">
                {/* Checkbox completamento */}
                <button
                  onClick={() => task.status !== 'done' ? completeTask(task.id) : updateTask(task.id, { status: 'todo', completedAt: undefined })}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all duration-200 flex items-center justify-center',
                    task.status === 'done'
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-surface-400 hover:border-brand-500 hover:bg-brand-500/10'
                  )}
                  aria-label={task.status === 'done' ? 'Riapri' : 'Completa'}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Contenuto */}
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                >
                  <p className={cn(
                    'text-sm font-medium leading-snug',
                    task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100'
                  )}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.dueDate && (
                      <span className={cn(
                        'text-xs flex items-center gap-1',
                        task.dueDate < format(new Date(), 'yyyy-MM-dd') && task.status !== 'done'
                          ? 'text-red-400'
                          : 'text-slate-400'
                      )}>
                        <Clock size={11} className="text-brand-400" />
                        {format(new Date(task.dueDate + 'T12:00:00'), 'd MMM', { locale: it })}
                        {formatTaskTime(task) && ` • ${formatTaskTime(task)}`}
                      </span>
                    )}
                    <Badge variant="priority" priority={task.priority} size="sm">
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                    {task.category && (
                      <Badge size="sm">{task.category}</Badge>
                    )}
                  </div>
                </button>

                {/* Azioni */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExportTask(task)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-brand-300 hover:bg-brand-500/10 transition-all"
                    title="Esporta su Apple Calendar / Promemoria"
                    aria-label="Esporta"
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    onClick={() => openEdit(task)}
                    className="p-1.5 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-surface-200 transition-all"
                    aria-label="Modifica"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label="Elimina"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Descrizione espansa */}
              {expandedId === task.id && task.description && (
                <div className="mt-3 pt-3 border-t border-surface-300/30">
                  <p className="text-sm text-slate-400">{task.description}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Form creazione/modifica */}
      <BottomSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTask ? 'Modifica attività' : 'Nuova attività'}
      >
        <div className="p-4 space-y-4">
          <Input
            label="Titolo *"
            placeholder="Cosa devi fare?"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
          <Textarea
            label="Descrizione"
            placeholder="Dettagli opzionali..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Input
                label="Scadenza"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Inizio"
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Fine"
                type="time"
                value={form.endTime}
                placeholder="Opzionale"
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priorità"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
              options={[
                { value: 'low',    label: '🟢 Bassa' },
                { value: 'medium', label: '🔵 Media' },
                { value: 'high',   label: '🟡 Alta' },
                { value: 'urgent', label: '🔴 Urgente' },
              ]}
            />
            <Select
              label="Stato"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
              options={[
                { value: 'todo',        label: 'Da fare' },
                { value: 'in_progress', label: 'In corso' },
                { value: 'done',        label: 'Fatto' },
                { value: 'cancelled',   label: 'Annullato' },
              ]}
            />
          </div>
          <Input
            label="Categoria"
            placeholder="Es: Lavoro, Casa, Sport..."
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setIsFormOpen(false)}>Annulla</Button>
            <Button variant="primary" fullWidth onClick={handleSave} loading={isSaving}>
              {editingTask ? 'Aggiorna' : 'Crea attività'}
            </Button>
          </div>
        </div>
      </BottomSheet>
      {/* Modale Esporta su Apple Calendar / Promemoria / Google */}
      <BottomSheet
        isOpen={!!exportTask}
        onClose={() => setExportTask(null)}
        title="Esporta su iPhone"
      >
        {exportTask && (
          <div className="p-4 space-y-3">
            <div className="bg-surface-150 p-3 rounded-xl border border-surface-300/60 mb-2">
              <p className="text-sm font-semibold text-slate-100">{exportTask.title}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                {exportTask.dueDate && <span>📅 {format(new Date(exportTask.dueDate + 'T12:00:00'), 'd MMMM', { locale: it })}</span>}
                {formatTaskTime(exportTask) && <span>🕐 {formatTaskTime(exportTask)}</span>}
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Esporta questo impegno con un solo tocco:
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
    </Page>
  );
}
