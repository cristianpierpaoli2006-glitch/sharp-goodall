import { useLiveQuery } from 'dexie-react-hooks';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckSquare, ChevronRight, Inbox, ShoppingBag, Flame, TrendingUp, Clock, AlertCircle, Plus, Sparkles, Search } from 'lucide-react';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { Badge, PRIORITY_LABELS } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { useTasks } from '@/hooks/useTasks';
import { useInbox } from '@/hooks/useInbox';
import { useWishlist } from '@/hooks/useWishlist';
import { useAppStore } from '@/stores/useAppStore';
import { db } from '@/db/local/db';
import { getAnonymousUserId } from '@/db/local/db';
import { cn } from '@/utils/cn';
import { formatTaskTime } from '@/utils/taskTime';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const setOpen = useAppStore((s) => s.setQuickCaptureOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const { todayTasks, overdueTasks, completeTask } = useTasks();
  const { unprocessedItems } = useInbox();
  const { favorites: wishlistFavorites } = useWishlist();

  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Buongiorno';
    if (h < 18) return 'Buon pomeriggio';
    return 'Buona sera';
  })();

  const safeTodayTasks = todayTasks || [];
  const safeOverdueTasks = overdueTasks || [];
  const safeUnprocessedItems = unprocessedItems || [];
  const safeWishlistFavorites = wishlistFavorites || [];

  const doneTodayCount = safeTodayTasks.filter((t) => t.status === 'done').length;
  const todoTodayCount = safeTodayTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
  const progress = safeTodayTasks.length > 0 ? Math.round((doneTodayCount / safeTodayTasks.length) * 100) : 0;

  return (
    <Page className="pt-0">
      {/* Header gradient */}
      <div className="px-4 pt-safe">
        <div className="pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm">{format(today, 'EEEE d MMMM', { locale: it })}</p>
              <h1 className="text-2xl font-bold text-slate-50 tracking-tight mt-0.5">{greeting} 👋</h1>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-slate-400 hover:text-slate-200 transition-colors"
                title="Cerca"
                aria-label="Cerca in tutta l'app"
              >
                <Search size={18} />
              </button>
              <SyncIndicator />
            </div>
          </div>
        </div>

        {/* Progress bar giornaliera */}
        {safeTodayTasks.length > 0 && (
          <Card variant="glass" className="mb-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-400" />
                <span className="text-sm font-medium text-slate-200">Avanzamento oggi</span>
              </div>
              <span className="text-sm font-bold text-brand-400">{progress}%</span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {doneTodayCount} di {safeTodayTasks.length} attività completate
            </p>
          </Card>
        )}

        {/* Attività in ritardo */}
        {safeOverdueTasks.length > 0 && (
          <Section>
            <Card variant="outlined" className="border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-sm font-semibold text-red-400">{safeOverdueTasks.length} in ritardo</span>
                <Link to="/tasks" className="ml-auto text-xs text-slate-500">
                  Vedi tutte →
                </Link>
              </div>
              <div className="space-y-2">
                {safeOverdueTasks.slice(0, 2).map((task) => (
                  <div key={task.id} className="flex items-center gap-3">
                    <button
                      onClick={() => completeTask(task.id)}
                      className="w-5 h-5 rounded-full border-2 border-red-500/50 flex-shrink-0 hover:bg-red-500/20 transition-colors"
                      aria-label="Completa"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{task.title}</p>
                      {task.dueDate && (
                        <p className="text-xs text-red-400">
                          Scaduta {format(new Date(task.dueDate + 'T12:00:00'), 'd MMM', { locale: it })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        )}

        {/* Attività di oggi */}
        <Section
          title="Oggi"
          right={
            <Link to="/tasks" className="text-xs text-brand-400">
              Vedi tutte
            </Link>
          }
        >
          {todoTodayCount === 0 ? (
            <Card variant="default" className="text-center py-8">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm text-slate-400">Nessuna attività per oggi</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="mt-3"
              >
                <Plus size={14} />
                Aggiungi attività
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {safeTodayTasks
                .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
                .slice(0, 5)
                .map((task) => (
                  <Card key={task.id} variant="default" padding="sm">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => completeTask(task.id)}
                        className="w-6 h-6 rounded-full border-2 border-surface-400 flex-shrink-0 hover:border-brand-500 hover:bg-brand-500/20 transition-all duration-200 active:scale-90"
                        aria-label="Completa attività"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {formatTaskTime(task) && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={10} className="text-brand-400" />
                              {formatTaskTime(task)}
                            </span>
                          )}
                          <Badge variant="priority" priority={task.priority} size="sm">
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </Section>

        {/* Inbox universale */}
        {safeUnprocessedItems.length > 0 && (
          <Section
            title="Inbox"
            right={
              <Link to="/archive?tab=inbox" className="text-xs text-brand-400">
                Vedi tutto
              </Link>
            }
          >
            <Card variant="default">
              <div className="space-y-2">
                {safeUnprocessedItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-1">
                    <Inbox size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-300 line-clamp-2 flex-1">{item.content}</p>
                  </div>
                ))}
              </div>
              {safeUnprocessedItems.length > 3 && (
                <p className="text-xs text-slate-500 mt-3 text-center">
                  +{safeUnprocessedItems.length - 3} altri elementi
                </p>
              )}
            </Card>
          </Section>
        )}

        {/* Wishlist in evidenza */}
        {safeWishlistFavorites.length > 0 && (
          <Section
            title="Wishlist"
            right={
              <Link to="/archive?tab=wishlist" className="text-xs text-brand-400">
                Vedi tutto
              </Link>
            }
          >
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {safeWishlistFavorites.slice(0, 5).map((item) => (
                <Card key={item.id} variant="default" padding="sm" className="flex-shrink-0 w-36">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-20 object-cover rounded-xl mb-2"
                    />
                  ) : (
                    <div className="w-full h-20 bg-surface-200 rounded-xl mb-2 flex items-center justify-center">
                      <ShoppingBag size={24} className="text-slate-600" />
                    </div>
                  )}
                  <p className="text-xs font-medium text-slate-200 line-clamp-2">{item.name}</p>
                  {item.price && (
                    <p className="text-xs text-brand-400 mt-1">€{item.price}</p>
                  )}
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* Quick actions */}
        <Section title="Azione rapida">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOpen(true)}
              className="bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/30 rounded-2xl p-4 text-left active:scale-95 transition-transform"
            >
              <Sparkles size={20} className="text-brand-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">Cattura rapida</p>
              <p className="text-xs text-slate-500 mt-0.5">Salva qualsiasi cosa</p>
            </button>
            <Link
              to="/tasks?new=1"
              className="bg-surface-100 border border-surface-300/50 rounded-2xl p-4 text-left active:scale-95 transition-transform block"
            >
              <CheckSquare size={20} className="text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">Nuova attività</p>
              <p className="text-xs text-slate-500 mt-0.5">Con tutti i dettagli</p>
            </Link>
          </div>
        </Section>
      </div>
    </Page>
  );
}
