import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, SyncState } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface AuthState {
  userId: string | null;
  email: string | null;
  user?: any;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface SyncStore {
  syncState: SyncState;
  pendingCount: number;
  lastSyncAt: string | null;
  setSyncState: (state: SyncState) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (at: string) => void;
}

interface AppStore {
  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;

  // Auth
  auth: AuthState;
  setAuth: (auth: Partial<AuthState>) => void;
  clearAuth: () => void;

  // Sync
  sync: SyncStore;

  // UI state
  isQuickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;

  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  quickCaptureInitialText: string;
  setQuickCaptureInitialText: (text: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Settings
      settings: DEFAULT_SETTINGS,
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),

      // Auth
      auth: {
        userId: null,
        email: null,
        isAuthenticated: false,
        isLoading: true,
      },
      setAuth: (auth) =>
        set((state) => ({ auth: { ...state.auth, ...auth } })),
      clearAuth: () =>
        set({
          auth: {
            userId: null,
            email: null,
            isAuthenticated: false,
            isLoading: false,
          },
        }),

      // Sync
      sync: {
        syncState: 'offline',
        pendingCount: 0,
        lastSyncAt: null,
        setSyncState: (syncState) =>
          set((state) => ({ sync: { ...state.sync, syncState } })),
        setPendingCount: (pendingCount) =>
          set((state) => ({ sync: { ...state.sync, pendingCount } })),
        setLastSyncAt: (lastSyncAt) =>
          set((state) => ({ sync: { ...state.sync, lastSyncAt } })),
      },

      // UI
      isQuickCaptureOpen: false,
      setQuickCaptureOpen: (isQuickCaptureOpen) => set({ isQuickCaptureOpen }),

      isSearchOpen: false,
      setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),

      quickCaptureInitialText: '',
      setQuickCaptureInitialText: (quickCaptureInitialText) => set({ quickCaptureInitialText }),
    }),
    {
      name: 'plh-app-store',
      // Persisti SOLO le impostazioni dell'utente, mai lo stato o i metodi runtime di sync
      partialize: (state) => ({
        settings: state.settings,
      }),
      // Assicura che lo stato sync e auth abbiano sempre i valori di default e i metodi
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...(persistedState || {}),
        sync: currentState.sync,
        auth: currentState.auth,
      }),
    }
  )
);
