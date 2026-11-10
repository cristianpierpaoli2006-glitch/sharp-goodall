import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, X, Inbox, CheckSquare, ShoppingBag, Link2, ChefHat,
  Lightbulb, FileText, Calendar, Clock, DollarSign, Target, Users
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/useAppStore';
import { formatLocal, classifyWithGemini } from '@/services/aiClassifier';
import { useTasks } from '@/hooks/useTasks';
import { useInbox } from '@/hooks/useInbox';
import { useWishlist } from '@/hooks/useWishlist';
import { useLinks } from '@/hooks/useLinks';
import { useRecipes } from '@/hooks/useRecipes';
import { useDiary } from '@/hooks/useDiary';
import type { QuickCaptureResult, InboxItemType, Priority, RecipeDifficulty } from '@/types';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const TYPE_CONFIG: Record<InboxItemType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  task:    { icon: CheckSquare, label: 'Attività',  color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  url:     { icon: Link2,       label: 'Link Web',  color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  product: { icon: ShoppingBag, label: 'Wishlist',  color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  recipe:  { icon: ChefHat,     label: 'Ricetta',   color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  idea:    { icon: Lightbulb,   label: 'Idea',      color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  note:    { icon: FileText,    label: 'Nota',      color: 'text-slate-300',   bg: 'bg-slate-500/15' },
  text:    { icon: Inbox,       label: 'Inbox',     color: 'text-slate-400',   bg: 'bg-slate-600/15' },
};

const ALL_TYPES: InboxItemType[] = ['task', 'product', 'recipe', 'url', 'idea', 'note', 'text'];

export function QuickCapture() {
  const isOpen = useAppStore((s) => s.isQuickCaptureOpen);
  const setOpen = useAppStore((s) => s.setQuickCaptureOpen);
  const initialText = useAppStore((s) => s.quickCaptureInitialText);
  const setInitialText = useAppStore((s) => s.setQuickCaptureInitialText);
  const settings = useAppStore((s) => s.settings);

  const [text, setText] = useState('');
  const [result, setResult] = useState<QuickCaptureResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<InboxItemType | null>(null);

  // Campi formattati modificabili inline nel preview
  const [customTitle, setCustomTitle] = useState('');
  const [customPriority, setCustomPriority] = useState<Priority>('medium');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');
  const [customTime, setCustomTime] = useState<string>('');
  const [customEndTime, setCustomEndTime] = useState<string>('');
  const [customServings, setCustomServings] = useState<string>('');
  const [customRecipeTime, setCustomRecipeTime] = useState<string>('');
  const [customIngredients, setCustomIngredients] = useState<string>('');
  const [customDifficulty, setCustomDifficulty] = useState<RecipeDifficulty>('medium');
  const [customNotes, setCustomNotes] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const classifyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { createTask } = useTasks();
  const { addToInbox } = useInbox();
  const { addItem: addWishlistItem } = useWishlist();
  const { addLink } = useLinks();
  const { addRecipe } = useRecipes();
  const { addEntry: addDiaryEntry, addIdea } = useDiary();

  // Inizializza testo se passato da fuori
  useEffect(() => {
    if (isOpen && initialText) {
      setText(initialText);
      setInitialText('');
    }
  }, [isOpen, initialText, setInitialText]);

  // Auto-focus e reset
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    } else {
      setText('');
      setResult(null);
      setSelectedType(null);
      resetFields();
    }
  }, [isOpen]);

  const resetFields = () => {
    setCustomTitle('');
    setCustomPriority('medium');
    setCustomPrice('');
    setCustomPurpose('');
    setCustomUrl('');
    setCustomDate('');
    setCustomTime('');
    setCustomEndTime('');
    setCustomServings('');
    setCustomRecipeTime('');
    setCustomIngredients('');
    setCustomDifficulty('medium');
    setCustomNotes('');
  };

  const applyParsedToFields = (r: QuickCaptureResult) => {
    const p = r.parsed;
    setCustomTitle(p.title || '');
    if (p.priority) setCustomPriority(p.priority);
    setCustomPrice(p.price !== undefined ? p.price.toString() : '');
    setCustomPurpose(p.purpose || '');
    setCustomUrl(p.url || '');
    setCustomDate(p.date || '');
    setCustomTime(p.time || '');
    setCustomEndTime(p.endTime || '');
    setCustomRecipeTime(p.totalTime !== undefined ? p.totalTime.toString() : '');
    setCustomServings(p.servings !== undefined ? p.servings.toString() : '');
    setCustomIngredients(p.ingredients && p.ingredients.length > 0 ? p.ingredients.join(', ') : '');
    if (p.difficulty) setCustomDifficulty(p.difficulty);
    setCustomNotes(p.notes || '');
  };

  // Classificazione ed estrazione formattata ISTANTANEA + AI refinement
  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResult(null);
      setSelectedType(null);
      resetFields();
      return;
    }

    // 1. Parsing locale istantaneo a 0ms (nessun delay visivo per l'utente)
    const local = formatLocal(trimmed);
    setResult(local);
    setSelectedType(local.type);
    applyParsedToFields(local);

    // 2. Se Gemini è abilitato, arricchimento con intelligenza artificiale
    clearTimeout(classifyTimeoutRef.current);
    const apiKey = settings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;

    if (settings.enableGemini && apiKey && navigator.onLine) {
      classifyTimeoutRef.current = setTimeout(async () => {
        setIsClassifying(true);
        try {
          const ai = await classifyWithGemini(trimmed, apiKey);
          if (ai) {
            setResult(ai);
            setSelectedType(ai.type);
            applyParsedToFields(ai);
          }
        } catch {
          // Fallback trasparente sul parsing locale già attivo
        } finally {
          setIsClassifying(false);
        }
      }, 500);
    }

    return () => clearTimeout(classifyTimeoutRef.current);
  }, [text, settings.enableGemini, settings.geminiApiKey]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSaving(true);

    const type = selectedType || result?.type || 'text';
    const parsed = result?.parsed || {};
    const finalTitle = customTitle.trim() || parsed.title || trimmed.slice(0, 80);
    const finalPriority = customPriority || parsed.priority || 'medium';

    try {
      switch (type) {
        case 'task': {
          let timeDisplay = customTime.trim() || parsed.time;
          const endDisplay = customEndTime.trim() || parsed.endTime;
          if (timeDisplay && endDisplay && !timeDisplay.includes('-')) {
            timeDisplay = `${timeDisplay} - ${endDisplay}`;
          }

          await createTask({
            title: finalTitle,
            description: customNotes.trim() || parsed.notes || undefined,
            status: 'todo',
            priority: finalPriority,
            dueDate: customDate.trim() || parsed.date,
            dueTime: timeDisplay,
            endTime: endDisplay,
          });
          toast.success(`Attività "${finalTitle}" creata!`);
          break;
        }

        case 'product': {
          const priceNum = customPrice ? parseFloat(customPrice.replace(',', '.')) : parsed.price;
          const purposeFinal = customPurpose.trim() || parsed.purpose || customNotes.trim() || parsed.notes;

          await addWishlistItem({
            name: finalTitle,
            url: customUrl.trim() || parsed.url,
            price: Number.isFinite(priceNum) ? priceNum : undefined,
            notes: purposeFinal || undefined,
            priority: finalPriority,
            status: 'want',
            isFavorite: false,
          });
          toast.success(`Prodotto "${finalTitle}" aggiunto alla wishlist!`);
          break;
        }

        case 'recipe': {
          const timeNum = customRecipeTime ? parseInt(customRecipeTime, 10) : parsed.totalTime;
          const servingsNum = customServings ? parseInt(customServings, 10) : parsed.servings;
          const rawIngs = customIngredients
            ? customIngredients.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
            : parsed.ingredients || [];

          await addRecipe({
            title: finalTitle,
            description: customNotes.trim() || parsed.notes || undefined,
            notes: customNotes.trim() || parsed.notes || undefined,
            sourceUrl: customUrl.trim() || parsed.url,
            ingredients: rawIngs.map((name) => ({ name, quantity: 1, unit: '' })),
            steps: [],
            difficulty: customDifficulty || parsed.difficulty || 'medium',
            servings: servingsNum || 4,
            totalTime: timeNum || undefined,
            status: 'want_to_try',
            isFavorite: false,
          });
          toast.success(`Ricetta "${finalTitle}" salvata!`);
          break;
        }

        case 'url': {
          const urlToSave = customUrl.trim() || parsed.url;
          if (urlToSave) {
            let domain = '';
            try {
              domain = new URL(urlToSave).hostname.replace(/^www\./, '');
            } catch {
              domain = urlToSave;
            }

            await addLink({
              url: urlToSave,
              title: finalTitle,
              domain,
              notes: customNotes.trim() || parsed.notes || undefined,
              category: 'tool',
              isFavorite: false,
              isArchived: false,
            });
            toast.success(`Link "${finalTitle}" salvato!`);
          } else {
            await addToInbox(trimmed, 'url');
            toast.success('Salvato nell\'inbox');
          }
          break;
        }

        case 'idea': {
          await addIdea({
            title: finalTitle,
            content: customNotes.trim() || parsed.notes || trimmed,
            status: 'raw',
            priority: finalPriority,
            isFavorite: false,
            tags: parsed.tags,
          });
          toast.success(`Idea "${finalTitle}" salvata!`);
          break;
        }

        case 'note': {
          await addDiaryEntry({
            title: finalTitle !== trimmed ? finalTitle : undefined,
            content: customNotes.trim() || parsed.notes || trimmed,
            date: parsed.date || format(new Date(), 'yyyy-MM-dd'),
            isFavorite: false,
            isPrivate: true,
            tags: parsed.tags,
          });
          toast.success('Nota salvata nel diario!');
          break;
        }

        default: {
          await addToInbox(trimmed, type, parsed.url);
          toast.success('Salvato nell\'inbox');
          break;
        }
      }

      setOpen(false);
    } catch (err) {
      toast.error('Errore nel salvataggio');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const currentType = selectedType || result?.type || 'text';
  const typeConfig = TYPE_CONFIG[currentType] || TYPE_CONFIG.text;

  return (
    <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title="Cattura Rapida & Automatica">
      <div className="p-4 space-y-4">
        {/* Campo input veloce */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi liberamente, es:&#10;• &quot;domani lavoro dalle 8 alle 20&quot;&#10;• &quot;wishlist cuffie sony 250 euro su amazon per il treno&quot;&#10;• &quot;ricetta carbonara con guanciale uova pecorino tempo 25 min per 4 persone&quot;&#10;• &quot;Sito per Render https://render.it aiuta a renderizzare&quot;"
            rows={3}
            className={cn(
              'w-full bg-surface-200 border border-surface-300/60 rounded-2xl',
              'text-slate-100 placeholder-slate-500 text-sm leading-relaxed',
              'p-3.5 pr-10 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50',
              'focus:border-brand-500/60 transition-all duration-200'
            )}
          />
          {isClassifying && (
            <div className="absolute right-3 top-3">
              <Sparkles size={16} className="text-yellow-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Anteprima e Formattazione Automatica Live con campi specifici */}
        {text.trim() && result && (
          <div className="bg-surface-150 border border-surface-300/60 rounded-2xl p-3.5 space-y-3 animate-fade-in shadow-inner">
            {/* Header Tipo e Badge Destinazione */}
            <div className="flex items-center justify-between">
              <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold', typeConfig.bg, typeConfig.color)}>
                <typeConfig.icon size={14} />
                <span>{typeConfig.label}</span>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles size={11} className="text-brand-400" /> Formattazione attiva
              </span>
            </div>

            {/* Titolo Principale Estratto */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                {currentType === 'product' ? '🏷️ Nome Prodotto' : currentType === 'recipe' ? '🍳 Titolo Ricetta' : 'Titolo'}
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Titolo pulito..."
                className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-100 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* SEZIONE: ATTIVITÀ (DATA E ORARI EDITABILI) */}
            {currentType === 'task' && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Calendar size={11} className="text-brand-400" />
                      <span>Data</span>
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Clock size={11} className="text-indigo-400" />
                      <span>Inizio</span>
                    </label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Clock size={11} className="text-purple-400" />
                      <span>Fine</span>
                    </label>
                    <input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      placeholder="Opzionale"
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Dettagli / Note</label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Note opzionali sull'attività..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* SEZIONE: PRODOTTO / WISHLIST */}
            {currentType === 'product' && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">💰 Costo (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="Es: 150"
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">🔗 Eventuale Link</label>
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://amazon.it/..."
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                    <Target size={12} className="text-amber-400" />
                    <span>🎯 A che mi serve? (Motivo / Utilizzo)</span>
                  </label>
                  <input
                    type="text"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    placeholder="Es: Per isolarmi in treno quando lavoro..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* SEZIONE: RICETTA */}
            {currentType === 'recipe' && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">⏱️ Tempo (min)</label>
                    <input
                      type="number"
                      value={customRecipeTime}
                      onChange={(e) => setCustomRecipeTime(e.target.value)}
                      placeholder="Es: 25"
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                      <Users size={11} />
                      <span>Porzioni</span>
                    </label>
                    <input
                      type="number"
                      value={customServings}
                      onChange={(e) => setCustomServings(e.target.value)}
                      placeholder="Es: 4"
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Difficoltà</label>
                    <select
                      value={customDifficulty}
                      onChange={(e) => setCustomDifficulty(e.target.value as RecipeDifficulty)}
                      className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="easy">Facile</option>
                      <option value="medium">Media</option>
                      <option value="hard">Difficile</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">🥗 Ingredienti</label>
                  <input
                    type="text"
                    value={customIngredients}
                    onChange={(e) => setCustomIngredients(e.target.value)}
                    placeholder="Es: guanciale, pecorino, uova, pepe"
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">📝 Procedimento / Note</label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Passaggi della ricetta..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">🔗 Eventuale Link</label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://giallozafferano.it/..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* SEZIONE: LINK WEB */}
            {currentType === 'url' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">🔗 URL</label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Note sul link</label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Descrizione o scopo del link..."
                    className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* SEZIONE: NOTA O IDEA */}
            {(currentType === 'note' || currentType === 'idea' || currentType === 'text') && (
              <div className="pt-1">
                <label className="text-[11px] text-slate-400 block mb-1">Contenuto / Note</label>
                <textarea
                  value={customNotes || text}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-surface-200 border border-surface-300/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>
            )}

            {/* Priorità rilevata con possibilità di cambio al tocco */}
            <div className="pt-2 border-t border-surface-300/30">
              <p className="text-[10px] text-slate-400 mb-1">Priorità:</p>
              <div className="flex gap-1.5">
                {[
                  { value: 'low', label: '🟢 Bassa' },
                  { value: 'medium', label: '🔵 Media' },
                  { value: 'high', label: '🟡 Alta' },
                  { value: 'urgent', label: '🔴 Urgente' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setCustomPriority(p.value as Priority)}
                    className={cn(
                      'text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium',
                      customPriority === p.value
                        ? 'bg-surface-300 text-white font-bold ring-1 ring-brand-400 border-brand-400/50'
                        : 'bg-surface-200 text-slate-400 border-surface-300/50 hover:text-slate-200'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destinazione / Cambio rapido tipo */}
            <div className="pt-2 border-t border-surface-300/30">
              <p className="text-[10px] text-slate-400 mb-1.5">Salva come:</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map((t) => {
                  const cfg = TYPE_CONFIG[t];
                  const isSelected = currentType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedType(t)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
                        isSelected
                          ? cn(cfg.bg, cfg.color, 'border-current/40 shadow-sm')
                          : 'bg-surface-200 text-slate-400 border-surface-300/40 hover:bg-surface-300'
                      )}
                    >
                      <cfg.icon size={11} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pulsanti Azione */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            <X size={16} />
            Annulla
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={isSaving}
            disabled={!text.trim()}
            className="flex-1"
          >
            <Send size={16} />
            Salva
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}