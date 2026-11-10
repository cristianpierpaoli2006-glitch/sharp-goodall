import { cn } from '@/utils/cn';
import type { Priority, TaskStatus } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'priority' | 'status' | 'category';
  priority?: Priority;
  status?: TaskStatus;
  className?: string;
  size?: 'sm' | 'md';
}

const priorityStyles: Record<Priority, string> = {
  low:    'bg-slate-700/60 text-slate-400 border-slate-600/40',
  medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  high:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusStyles: Record<TaskStatus, string> = {
  todo:        'bg-slate-700/60 text-slate-400 border-slate-600/40',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  done:        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled:   'bg-red-500/15 text-red-400 border-red-500/30',
};

export function Badge({ children, variant = 'default', priority, status, className, size = 'sm' }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 font-medium border rounded-full';
  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  let colorStyle = 'bg-surface-300 text-slate-400 border-surface-400/40';
  if (variant === 'priority' && priority) colorStyle = priorityStyles[priority];
  if (variant === 'status' && status) colorStyle = statusStyles[status];

  return (
    <span className={cn(base, sizes[size], colorStyle, className)}>
      {children}
    </span>
  );
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low:    'Bassa',
  medium: 'Media',
  high:   'Alta',
  urgent: 'Urgente',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'Da fare',
  in_progress: 'In corso',
  done:        'Completato',
  cancelled:   'Annullato',
};
