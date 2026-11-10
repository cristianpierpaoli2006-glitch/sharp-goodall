import React, { useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { BottomNav } from '@/components/layout/BottomNav';
import { QuickCapture } from '@/components/quick-capture/QuickCapture';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { initNotificationScheduler } from '@/services/notificationService';
import { Dashboard } from '@/pages/Dashboard';
import { Calendar } from '@/pages/Calendar';
import { Tasks } from '@/pages/Tasks';
import { Archive } from '@/pages/Archive';
import { Settings } from '@/pages/Settings';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { supabase, isSupabaseConfigured } from '@/db/remote/supabase';
import { useAppStore } from '@/stores/useAppStore';

// Error Boundary per evitare la schermata bianca in caso di errori non gestiti
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-400 mb-4 text-2xl font-bold">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">Si è verificato un errore</h1>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            {this.state.error?.message || 'Errore imprevisto durante il caricamento.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            Ricarica applicazione
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const isOnline = useOnlineStatus();
  const { syncNow } = useSync();
  const setAuth = useAppStore((s) => s.setAuth);

  // Ascolta cambi sessione Supabase solo se configurato
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuth({ isLoading: false });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuth({
          user: session.user,
          userId: session.user.id,
          email: session.user.email ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuth({ isLoading: false });
      }
    }).catch((err) => {
      console.warn('Errore getSession Supabase:', err);
      setAuth({ isLoading: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuth({
          user: session.user,
          userId: session.user.id,
          email: session.user.email ?? null,
          isAuthenticated: true,
        });
      } else {
        setAuth({
          user: null,
          userId: null,
          email: null,
          isAuthenticated: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [setAuth]);

  // Sincronizzazione automatica al ripristino connessione (solo se configurato)
  useEffect(() => {
    if (isOnline && isSupabaseConfigured()) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  // Scheduler notifiche promemoria locali
  useEffect(() => {
    const cleanup = initNotificationScheduler();
    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-surface-0 text-slate-100 flex flex-col font-sans">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>

          {/* Barra di navigazione fissa inferiore */}
          <BottomNav />

          {/* Finestra modale di cattura rapida */}
          <QuickCapture />

          {/* Ricerca Globale Rapida */}
          <GlobalSearch />

          {/* Feedback notifiche tostapane */}
          <Toaster
            position="top-center"
            richColors
            theme="dark"
            toastOptions={{
              duration: 2500,
              className: 'text-sm font-medium',
            }}
          />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
