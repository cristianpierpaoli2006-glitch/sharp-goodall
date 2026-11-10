import { useState, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Trash2, RefreshCw, Sparkles, Moon, Sun, Smartphone, ShieldCheck, Database, Key, LogIn, LogOut, Bell, Volume2 } from 'lucide-react';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SyncIndicator } from '@/components/ui/SyncIndicator';
import { useAppStore } from '@/stores/useAppStore';
import { useSync } from '@/hooks/useSync';
import { exportAllDataAsJson, importDataFromJson, clearAllLocalData } from '@/services/exportService';
import { requestNotificationPermission, isNotificationGranted, playNotificationSound } from '@/services/notificationService';
import { supabase } from '@/db/remote/supabase';
import { toast } from 'sonner';

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const auth = useAppStore((s) => s.auth);
  const setAuth = useAppStore((s) => s.setAuth);
  const { syncNow, isSyncing, pendingCount } = useSync();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(settings.geminiApiKey || '');
  const [hasNotifPermission, setHasNotifPermission] = useState(isNotificationGranted());

  const handleToggleNotifications = async () => {
    if (!hasNotifPermission) {
      const granted = await requestNotificationPermission();
      setHasNotifPermission(granted);
      if (granted) {
        playNotificationSound();
        toast.success('Notifiche e suoni promemoria abilitati!');
      } else {
        toast.error('Permesso notifiche negato dal browser');
      }
    } else {
      playNotificationSound();
      toast.success('Test suono promemoria riprodotto 🔔');
    }
  };

  // Gestione login Supabase
  const handleSignIn = async () => {
    if (!email || !password) {
      toast.error('Inserisci email e password');
      return;
    }
    setIsAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Se non esiste l'utente, prova a registrarlo
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (signUpData.user) {
          setAuth({
            user: signUpData.user,
            userId: signUpData.user.id,
            isAuthenticated: true,
          });
          toast.success('Account creato e autenticato con successo!');
        }
      } else if (data.user) {
        setAuth({
          user: data.user,
          userId: data.user.id,
          isAuthenticated: true,
        });
        toast.success('Accesso effettuato!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Errore di autenticazione');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuth({ user: null, userId: null, isAuthenticated: false });
    toast.success('Disconnesso');
  };

  const handleSaveGeminiKey = () => {
    updateSettings({ geminiApiKey: geminiKeyInput.trim() });
    toast.success('Chiave Gemini salvata localmente');
  };

  // Export JSON
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAllDataAsJson();
      toast.success('Backup scaricato!');
    } catch (err) {
      toast.error('Errore durante il backup');
    } finally {
      setIsExporting(false);
    }
  };

  // Import JSON
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importDataFromJson(text);
      if (res.success) {
        toast.success(`Ripristinati ${res.count} elementi!`);
      } else {
        toast.error(`Errore: ${res.errors.join(', ')}`);
      }
    } catch (err) {
      toast.error('File non valido');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset dati locali
  const handleClearData = async () => {
    const confirmText = prompt('Digita "ELIMINA" per confermare la cancellazione completa dei dati locali:');
    if (confirmText === 'ELIMINA') {
      await clearAllLocalData();
      toast.success('Dati locali cancellati');
      window.location.reload();
    }
  };

  return (
    <Page>
      <PageHeader
        title="Impostazioni"
        subtitle="Configurazione, backup e sincronizzazione"
        right={<SyncIndicator />}
      />

      {/* Sincronizzazione Cloud */}
      <Section title="Sincronizzazione Cloud">
        <Card variant="default" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database size={18} className="text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Supabase Cloud Sync</p>
                <p className="text-xs text-slate-500">
                  {pendingCount > 0 ? `${pendingCount} modifiche in attesa di sync` : 'Tutto sincronizzato'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => syncNow()}
              loading={isSyncing}
            >
              <RefreshCw size={14} /> Sincronizza
            </Button>
          </div>

          <div className="pt-3 border-t border-surface-300/30">
            {auth.isAuthenticated ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Accesso effettuato come:</p>
                  <p className="text-sm font-medium text-slate-200">{auth.user?.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut size={14} /> Esci
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Accedi o crea un account per sincronizzare i tuoi dati su più dispositivi:
                </p>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={handleSignIn}
                  loading={isAuthLoading}
                >
                  <LogIn size={14} /> Accedi / Registrati
                </Button>
              </div>
            )}
          </div>
        </Card>
      </Section>

      {/* Intelligenza Artificiale (Gemini) */}
      <Section title="AI Quick Capture (Gemini)">
        <Card variant="default" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-yellow-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Classificazione Intelligente</p>
                <p className="text-xs text-slate-500">Usa l'API Gemini per riconoscere date, compiti e idee</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.enableGemini}
              onChange={(e) => updateSettings({ enableGemini: e.target.checked })}
              className="w-5 h-5 rounded-lg accent-brand-500 cursor-pointer"
            />
          </div>

          {settings.enableGemini && (
            <div className="space-y-2 pt-2 border-t border-surface-300/30">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <Key size={12} /> Chiave API Gemini (opzionale se già impostata nell'ambiente):
              </label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" size="sm" onClick={handleSaveGeminiKey}>
                  Salva
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                Se non inserisci una chiave, l'app usa il motore di parsing locale istantaneo e offline.
              </p>
            </div>
          )}
        </Card>
      </Section>

      {/* Notifiche e Promemoria Sonori */}
      <Section title="Notifiche & Promemoria Sonori">
        <Card variant="default" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell size={18} className="text-orange-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Avvisi Orari & Notifiche</p>
                <p className="text-xs text-slate-500">
                  {hasNotifPermission ? 'Notifiche e suoni attivi per i tuoi impegni' : 'Attiva i promemoria sonori all\'orario stabilito'}
                </p>
              </div>
            </div>
            <Button
              variant={hasNotifPermission ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleToggleNotifications}
            >
              <Volume2 size={14} />
              {hasNotifPermission ? 'Prova Suono 🔔' : 'Abilita'}
            </Button>
          </div>
        </Card>
      </Section>

      {/* Backup e Dati */}
      <Section title="Backup & Protezione Dati">
        <Card variant="default" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Esporta Backup (JSON)</p>
              <p className="text-xs text-slate-500">Scarica tutte le attività, note, ricette e link</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExport} loading={isExporting}>
              <Download size={14} /> Esporta
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface-300/30">
            <div>
              <p className="text-sm font-medium text-slate-200">Ripristina da Backup</p>
              <p className="text-xs text-slate-500">Carica un file JSON esportato in precedenza</p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Importa
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface-300/30">
            <div>
              <p className="text-sm font-medium text-red-400">Cancella Dati Locali</p>
              <p className="text-xs text-slate-500">Svuota completamente il database IndexedDB del dispositivo</p>
            </div>
            <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={handleClearData}>
              <Trash2 size={14} /> Elimina
            </Button>
          </div>
        </Card>
      </Section>

      {/* Guida Installazione PWA su iPhone */}
      <Section title="Installazione su iPhone">
        <Card variant="default" className="space-y-3">
          <div className="flex items-center gap-2 text-brand-400">
            <Smartphone size={18} />
            <p className="text-sm font-semibold text-slate-200">Come installare l'app su iOS Safari</p>
          </div>
          <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed">
            <li>Apri questa pagina con <strong>Safari</strong> sul tuo iPhone.</li>
            <li>Tocca l'icona <strong>Condividi</strong> (il quadrato con la freccia verso l'alto in basso al centro).</li>
            <li>Scorri le opzioni e seleziona <strong>Aggiungi alla schermata Home</strong>.</li>
            <li>Conferma toccando <strong>Aggiungi</strong> in alto a destra.</li>
            <li>Apri l'app dalla schermata Home per l'esperienza standalone a tutto schermo con supporto offline.</li>
          </ol>
        </Card>
      </Section>

      {/* Info App */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-500">Personal Life Hub v1.0.0</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Offline-first • Privacy Focused • PWA</p>
      </div>
    </Page>
  );
}
