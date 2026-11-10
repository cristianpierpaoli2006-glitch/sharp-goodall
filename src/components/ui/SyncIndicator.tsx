import { useAppStore } from '@/stores/useAppStore';
import { CloudOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export function SyncIndicator({ className }: { className?: string }) {
  const sync = useAppStore((s) => s.sync);
  const syncState = sync?.syncState || 'offline';
  const pendingCount = sync?.pendingCount || 0;
  const lastSyncAt = sync?.lastSyncAt;

  const configs = {
    synced:  { icon: CheckCircle2, color: 'text-emerald-400', label: 'Sincronizzato' },
    syncing: { icon: Loader2,      color: 'text-brand-400',   label: 'Sincronizzazione...' },
    offline: { icon: CloudOff,     color: 'text-slate-500',   label: 'Offline' },
    error:   { icon: AlertCircle,  color: 'text-amber-400',   label: pendingCount > 0 ? `${pendingCount} in attesa` : 'Errore' },
  };

  const { icon: Icon, color, label } = configs[syncState] || configs.offline;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon
        size={14}
        className={cn(color, syncState === 'syncing' && 'animate-spin')}
      />
      <span className={cn('text-xs', color)}>{label}</span>
      {lastSyncAt && syncState === 'synced' && (
        <span className="text-xs text-slate-600 ml-1">
          {new Date(lastSyncAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
