import { NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, CheckSquare, Archive, Settings, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/stores/useAppStore';
import { useInbox } from '@/hooks/useInbox';

const navItems = [
  { to: '/',          icon: Home,        label: 'Home'       },
  { to: '/calendar',  icon: Calendar,    label: 'Calendario' },
  { to: '/tasks',     icon: CheckSquare, label: 'Attività'   },
  { to: '/archive',   icon: Archive,     label: 'Archivio'   },
  { to: '/settings',  icon: Settings,    label: 'Impostaz.'  },
];

export function BottomNav() {
  const location = useLocation();
  const setQuickCaptureOpen = useAppStore((s) => s.setQuickCaptureOpen);
  const { unprocessedCount } = useInbox();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="bg-surface-50/95 backdrop-blur-xl border-t border-surface-300/40">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {navItems.slice(0, 2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition-all duration-200',
                'min-w-[52px]',
                isActive
                  ? 'text-brand-400'
                  : 'text-slate-500 active:text-slate-300'
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'p-1.5 rounded-xl transition-all duration-200',
                    isActive && 'bg-brand-500/20'
                  )}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Quick Capture FAB centrale */}
          <button
            id="quick-capture-btn"
            onClick={() => setQuickCaptureOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2"
            aria-label="Cattura rapida"
          >
            <div className="w-14 h-14 -mt-6 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/40 active:scale-95 transition-transform duration-150">
              <Plus size={26} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-medium text-slate-500 leading-none mt-0.5">Cattura</span>
          </button>

          {navItems.slice(2).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition-all duration-200',
                'min-w-[52px] relative',
                isActive
                  ? 'text-brand-400'
                  : 'text-slate-500 active:text-slate-300'
              )}
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'p-1.5 rounded-xl transition-all duration-200 relative',
                    isActive && 'bg-brand-500/20'
                  )}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                    {/* Badge inbox */}
                    {to === '/archive' && unprocessedCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                        {unprocessedCount > 9 ? '9+' : unprocessedCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
