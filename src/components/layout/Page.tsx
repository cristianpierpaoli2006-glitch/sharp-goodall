import React from 'react';
import { cn } from '@/utils/cn';

interface PageProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

// Wrapper per ogni pagina - gestisce safe area iPhone
export function Page({ children, className, noPadding = false }: PageProps) {
  return (
    <main className={cn(
      'min-h-screen bg-surface-0',
      'pt-safe',                 // safe area top (notch)
      'pb-[88px]',               // spazio per bottom nav + safe area
      !noPadding && 'px-4',
      className
    )}>
      {children}
    </main>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, right, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between pt-4 pb-2', className)}>
      <div>
        <h1 className="text-2xl font-bold text-slate-50 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2 mt-1">{right}</div>}
    </div>
  );
}

// Sezione card riutilizzabile
interface SectionProps {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, right, children, className }: SectionProps) {
  return (
    <section className={cn('mb-6', className)}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Empty state riutilizzabile
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-surface-200 flex items-center justify-center mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-6 max-w-[260px]">{description}</p>}
      {action}
    </div>
  );
}
