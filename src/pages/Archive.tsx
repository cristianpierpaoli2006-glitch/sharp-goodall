import { useState, useMemo } from 'react';
import {
  Link2,
  ShoppingBag,
  ChefHat,
  BookOpen,
  Lightbulb,
  Inbox,
  Plus,
  ExternalLink,
  Heart,
  Trash2,
  Star,
  Clock,
  Users,
  Check,
  Target,
  Search,
  DollarSign,
  TrendingDown,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Page, PageHeader, EmptyState } from '@/components/layout/Page';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { RecipeCookingModal } from '@/components/recipes/RecipeCookingModal';
import { useWishlist } from '@/hooks/useWishlist';
import { useLinks } from '@/hooks/useLinks';
import { useRecipes } from '@/hooks/useRecipes';
import { useDiary } from '@/hooks/useDiary';
import { useInbox } from '@/hooks/useInbox';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import type { LinkCategory, Priority, RecipeDifficulty, RecipeStatus, Recipe } from '@/types';
import { useSearchParams } from 'react-router-dom';

const TABS = [
  { id: 'inbox',    label: 'Inbox',    icon: Inbox },
  { id: 'wishlist', label: 'Wishlist', icon: ShoppingBag },
  { id: 'recipes',  label: 'Ricette',  icon: ChefHat },
  { id: 'links',    label: 'Link',     icon: Link2 },
  { id: 'diary',    label: 'Diario',   icon: BookOpen },
  { id: 'ideas',    label: 'Idee',     icon: Lightbulb },
];

const LINK_CATEGORIES: { value: LinkCategory; label: string }[] = [
  { value: 'article',       label: 'Articolo' },
  { value: 'video',         label: 'Video' },
  { value: 'tool',          label: 'Strumento' },
  { value: 'reference',     label: 'Riferimento' },
  { value: 'entertainment', label: 'Intrattenimento' },
  { value: 'shopping',      label: 'Shopping' },
  { value: 'other',         label: 'Altro' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: '🟢 Bassa' },
  { value: 'medium', label: '🔵 Media' },
  { value: 'high',   label: '🟡 Alta' },
  { value: 'urgent', label: '🔴 Urgente' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: '🟢 Facile' },
  { value: 'medium', label: '🟡 Media' },
  { value: 'hard',   label: '🔴 Difficile' },
];

export function Archive() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'wishlist');
  const setQuickCaptureOpen = useAppStore((s) => s.setQuickCaptureOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);

  // Data hooks
  const { items: wishlistItems, addItem: addWishlistItem, updateItem: updateWishlist, deleteItem: deleteWishlist } = useWishlist();
  const { items: linkItems, addLink, deleteLink } = useLinks();
  const { items: recipeItems, addRecipe, updateRecipe, deleteRecipe } = useRecipes();
  const { entries: diaryEntries, ideas, addEntry, deleteEntry, addIdea, deleteIdea } = useDiary();
  const { unprocessedItems, deleteInboxItem } = useInbox();

  // Wishlist Filtro & Budget
  const [wishlistFilter, setWishlistFilter] = useState<'all' | 'want' | 'bought' | 'favorites'>('all');

  const filteredWishlist = useMemo(() => {
    return wishlistItems.filter((item) => {
      if (wishlistFilter === 'want') return item.status === 'want';
      if (wishlistFilter === 'bought') return item.status === 'bought';
      if (wishlistFilter === 'favorites') return item.isFavorite;
      return true;
    });
  }, [wishlistItems, wishlistFilter]);

  const totalPlanned = useMemo(() => {
    return wishlistItems
      .filter((i) => i.status !== 'bought' && i.price !== undefined)
      .reduce((sum, i) => sum + (i.price || 0), 0);
  }, [wishlistItems]);

  const urgentPlanned = useMemo(() => {
    return wishlistItems
      .filter((i) => i.status !== 'bought' && (i.priority === 'urgent' || i.priority === 'high') && i.price !== undefined)
      .reduce((sum, i) => sum + (i.price || 0), 0);
  }, [wishlistItems]);

  const boughtTotal = useMemo(() => {
    return wishlistItems
      .filter((i) => i.status === 'bought' && i.price !== undefined)
      .reduce((sum, i) => sum + (i.price || 0), 0);
  }, [wishlistItems]);

  // Modalità Cucina
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [isCookingOpen, setIsCookingOpen] = useState(false);

  // Modal e form states
  const [isSaving, setIsSaving] = useState(false);

  // Wishlist Form
  const [isAddWishlistOpen, setIsAddWishlistOpen] = useState(false);
  const [wishlistForm, setWishlistForm] = useState({
    name: '',
    url: '',
    price: '',
    purpose: '',
    priority: 'medium' as Priority,
  });

  // Recipe Form
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    title: '',
    totalTime: '',
    servings: '4',
    difficulty: 'medium' as RecipeDifficulty,
    ingredients: '',
    notes: '',
    url: '',
    status: 'want_to_try' as RecipeStatus,
  });

  // Link Form
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ url: '', title: '', category: 'other' as LinkCategory, notes: '' });

  // Idea Form
  const [isAddIdeaOpen, setIsAddIdeaOpen] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: '', content: '' });

  // Diary Form
  const [isAddDiaryOpen, setIsAddDiaryOpen] = useState(false);
  const [diaryForm, setDiaryForm] = useState({ title: '', content: '' });

  // -----------------------------------------------------------------
  // SALVATAGGI
  // -----------------------------------------------------------------

  const handleAddWishlist = async () => {
    if (!wishlistForm.name.trim()) {
      toast.error('Nome prodotto obbligatorio');
      return;
    }
    setIsSaving(true);
    try {
      const priceNum = wishlistForm.price ? parseFloat(wishlistForm.price.replace(',', '.')) : undefined;
      let url = wishlistForm.url.trim();
      if (url && !url.startsWith('http')) url = 'https://' + url;

      await addWishlistItem({
        name: wishlistForm.name.trim(),
        url: url || undefined,
        price: Number.isFinite(priceNum) ? priceNum : undefined,
        notes: wishlistForm.purpose.trim() || undefined,
        priority: wishlistForm.priority,
        status: 'want',
        isFavorite: false,
      });
      toast.success('Prodotto aggiunto alla wishlist');
      setIsAddWishlistOpen(false);
      setWishlistForm({ name: '', url: '', price: '', purpose: '', priority: 'medium' });
    } catch {
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRecipe = async () => {
    if (!recipeForm.title.trim()) {
      toast.error('Titolo ricetta obbligatorio');
      return;
    }
    setIsSaving(true);
    try {
      const timeNum = recipeForm.totalTime ? parseInt(recipeForm.totalTime, 10) : undefined;
      const servingsNum = recipeForm.servings ? parseInt(recipeForm.servings, 10) : 4;
      const ings = recipeForm.ingredients
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, quantity: 1, unit: '' }));
      let url = recipeForm.url.trim();
      if (url && !url.startsWith('http')) url = 'https://' + url;

      await addRecipe({
        title: recipeForm.title.trim(),
        totalTime: Number.isFinite(timeNum) ? timeNum : undefined,
        servings: servingsNum || 4,
        difficulty: recipeForm.difficulty,
        ingredients: ings,
        steps: [],
        notes: recipeForm.notes.trim() || undefined,
        description: recipeForm.notes.trim() || undefined,
        sourceUrl: url || undefined,
        status: recipeForm.status,
        isFavorite: false,
      });
      toast.success('Ricetta salvata');
      setIsAddRecipeOpen(false);
      setRecipeForm({
        title: '',
        totalTime: '',
        servings: '4',
        difficulty: 'medium',
        ingredients: '',
        notes: '',
        url: '',
        status: 'want_to_try',
      });
    } catch {
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkForm.url.trim()) { toast.error('URL obbligatorio'); return; }
    setIsSaving(true);
    try {
      let url = linkForm.url.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      await addLink({
        url,
        title: linkForm.title || url,
        category: linkForm.category,
        notes: linkForm.notes,
        isFavorite: false,
        isArchived: false,
        domain: new URL(url).hostname.replace('www.', ''),
      });
      toast.success('Link salvato');
      setIsAddLinkOpen(false);
      setLinkForm({ url: '', title: '', category: 'other', notes: '' });
    } catch { toast.error('URL non valido'); }
    finally { setIsSaving(false); }
  };

  const handleAddIdea = async () => {
    if (!ideaForm.title.trim()) { toast.error('Titolo obbligatorio'); return; }
    setIsSaving(true);
    try {
      await addIdea({ title: ideaForm.title, content: ideaForm.content, status: 'raw', priority: 'medium', isFavorite: false });
      toast.success('Idea salvata');
      setIsAddIdeaOpen(false);
      setIdeaForm({ title: '', content: '' });
    } finally { setIsSaving(false); }
  };

  const handleAddDiary = async () => {
    if (!diaryForm.content.trim()) { toast.error('Contenuto obbligatorio'); return; }
    setIsSaving(true);
    try {
      await addEntry({
        title: diaryForm.title,
        content: diaryForm.content,
        date: format(new Date(), 'yyyy-MM-dd'),
        isFavorite: false,
        isPrivate: true,
      });
      toast.success('Nota salvata');
      setIsAddDiaryOpen(false);
      setDiaryForm({ title: '', content: '' });
    } finally { setIsSaving(false); }
  };

  return (
    <Page>
      <PageHeader
        title="Archivio"
        right={
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Cerca">
              <Search size={20} />
            </Button>
            <Button variant="primary" size="icon" onClick={() => setQuickCaptureOpen(true)} aria-label="Aggiungi">
              <Plus size={20} />
            </Button>
          </div>
        }
      />

      {/* Tab bar orizzontale */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-4 no-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              activeTab === id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-surface-200 text-slate-400 hover:text-slate-200'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* WISHLIST */}
      {/* ======================================================== */}
      {activeTab === 'wishlist' && (
        <>
          {/* Banner Budget Calcolato */}
          {wishlistItems.length > 0 && (
            <div className="bg-gradient-to-r from-surface-200 to-surface-150 border border-surface-300/60 rounded-2xl p-3.5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" />
                  <span>Budget Wishlist</span>
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  Previsto: €{totalPlanned.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-surface-300/40">
                <div className="text-slate-400">
                  Alta/Urgente: <span className="font-semibold text-amber-300">€{urgentPlanned.toFixed(2)}</span>
                </div>
                <div className="text-right text-slate-400">
                  Già acquistati: <span className="font-semibold text-slate-300">€{boughtTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filtro stato e pulsante aggiungi */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-1 overflow-x-auto no-scrollbar text-xs">
              {[
                { id: 'all', label: 'Tutti' },
                { id: 'want', label: 'Da comprare' },
                { id: 'bought', label: 'Comprati' },
                { id: 'favorites', label: '❤️ Preferiti' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setWishlistFilter(f.id as any)}
                  className={cn(
                    'px-2.5 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
                    wishlistFilter === f.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-surface-200 text-slate-400 hover:text-slate-200'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Button variant="secondary" size="sm" onClick={() => setIsAddWishlistOpen(true)} className="flex-shrink-0">
              <Plus size={14} /> Aggiungi
            </Button>
          </div>

          {filteredWishlist.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={28} />}
              title={wishlistItems.length === 0 ? 'Wishlist vuota' : 'Nessun prodotto con questo filtro'}
              description={wishlistItems.length === 0 ? 'Salva ciò che desideri comprare con link, prezzo e motivo' : 'Prova a selezionare un altro filtro'}
              action={
                <Button variant="primary" size="md" onClick={() => setIsAddWishlistOpen(true)}>
                  <Plus size={16} /> Aggiungi prodotto
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredWishlist.map((item) => (
                <Card
                  key={item.id}
                  variant="default"
                  padding="sm"
                  className={cn(
                    'relative overflow-hidden transition-all',
                    item.status === 'bought' && 'opacity-70 bg-surface-200/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Titolo e badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn(
                          'text-sm font-semibold',
                          item.status === 'bought' ? 'text-slate-400 line-through' : 'text-slate-100'
                        )}>
                          {item.name}
                        </span>
                        {item.price !== undefined && item.price !== null && (
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded-full border',
                            item.status === 'bought'
                              ? 'bg-slate-700/50 text-slate-400 border-slate-600/40'
                              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          )}>
                            €{item.price}
                          </span>
                        )}
                        <Badge size="sm" variant="priority" priority={item.priority}>
                          {item.priority === 'urgent'
                            ? '🔴 Urgente'
                            : item.priority === 'high'
                            ? '🟡 Alta'
                            : item.priority === 'low'
                            ? '🟢 Bassa'
                            : '🔵 Media'}
                        </Badge>
                        {item.status === 'bought' && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                            ✅ Acquistato
                          </span>
                        )}
                      </div>

                      {/* A che mi serve */}
                      {item.notes && (
                        <div className="mt-2 text-xs bg-surface-200/90 rounded-xl p-2.5 border border-amber-500/20">
                          <span className="text-amber-400 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">
                            🎯 A che mi serve
                          </span>
                          <p className="text-slate-300 leading-relaxed">{item.notes}</p>
                        </div>
                      )}

                      {/* Eventuale link */}
                      {item.url && (
                        <div className="mt-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <ExternalLink size={12} />
                            <span className="truncate max-w-[200px]">
                              {(() => {
                                try {
                                  return new URL(item.url).hostname.replace('www.', '');
                                } catch {
                                  return 'Vedi prodotto';
                                }
                              })()}
                            </span>
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Azioni */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() =>
                          updateWishlist(item.id, {
                            status: item.status === 'bought' ? 'want' : 'bought',
                            boughtAt: item.status === 'bought' ? undefined : format(new Date(), 'yyyy-MM-dd'),
                          })
                        }
                        className={cn(
                          'p-2 rounded-xl transition-colors',
                          item.status === 'bought'
                            ? 'text-emerald-400 bg-emerald-500/15'
                            : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                        )}
                        title={item.status === 'bought' ? 'Segna come da comprare' : 'Segna come acquistato'}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        onClick={() => updateWishlist(item.id, { isFavorite: !item.isFavorite })}
                        className={cn(
                          'p-2 rounded-xl transition-colors',
                          item.isFavorite ? 'text-red-400 bg-red-500/10' : 'text-slate-500 hover:text-slate-300'
                        )}
                        title="Preferito"
                      >
                        <Heart size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => deleteWishlist(item.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
                        title="Elimina"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* RICETTE */}
      {/* ======================================================== */}
      {activeTab === 'recipes' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">
              {recipeItems.length} {recipeItems.length === 1 ? 'ricetta' : 'ricette'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setIsAddRecipeOpen(true)}>
              <Plus size={14} /> Aggiungi ricetta
            </Button>
          </div>

          {recipeItems.length === 0 ? (
            <EmptyState
              icon={<ChefHat size={28} />}
              title="Nessuna ricetta"
              description="Aggiungi ricette con tempo, porzioni, ingredienti e procedimento"
              action={
                <Button variant="primary" size="md" onClick={() => setIsAddRecipeOpen(true)}>
                  <Plus size={16} /> Aggiungi ricetta
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recipeItems.map((recipe) => (
                <Card key={recipe.id} variant="default" padding="sm" className="relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Titolo e badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-100">{recipe.title}</span>
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium border',
                          recipe.difficulty === 'easy'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : recipe.difficulty === 'hard'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        )}>
                          {recipe.difficulty === 'easy' ? '🟢 Facile' : recipe.difficulty === 'hard' ? '🔴 Difficile' : '🟡 Media'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border bg-surface-300 text-slate-300 border-surface-400/40">
                          {recipe.status === 'want_to_try' ? '📋 Da provare' : recipe.status === 'tried' ? '✅ Provata' : '❤️ Preferita'}
                        </span>
                      </div>

                      {/* Tempo e porzioni */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5">
                        {recipe.totalTime && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Clock size={12} className="text-brand-400" />
                            {recipe.totalTime} min
                          </span>
                        )}
                        {recipe.servings && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Users size={12} className="text-indigo-400" />
                            {recipe.servings} porzioni
                          </span>
                        )}
                      </div>

                      {/* Ingredienti */}
                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div className="mt-2.5">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                            🥗 Ingredienti
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {recipe.ingredients.map((ing, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] bg-surface-200 text-slate-300 px-2 py-0.5 rounded-md border border-surface-300/60"
                              >
                                {typeof ing === 'string' ? ing : ing.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Procedimento o Note */}
                      {(recipe.notes || recipe.description) && (
                        <div className="mt-2 text-xs bg-surface-200/90 rounded-xl p-2.5 border border-surface-300/40">
                          <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">
                            📝 Procedimento / Note
                          </span>
                          <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                            {recipe.notes || recipe.description}
                          </p>
                        </div>
                      )}

                      {/* Eventuale link / fonte */}
                      {recipe.sourceUrl && (
                        <div className="mt-2">
                          <a
                            href={recipe.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <ExternalLink size={12} />
                            <span className="truncate max-w-[200px]">
                              {(() => {
                                try {
                                  return new URL(recipe.sourceUrl).hostname.replace('www.', '');
                                } catch {
                                  return 'Vedi ricetta online';
                                }
                              })()}
                            </span>
                          </a>
                        </div>
                      )}

                      {/* Tasto Modalità Cucina & Timer */}
                      <div className="mt-3 pt-2 border-t border-surface-300/40">
                        <button
                          onClick={() => {
                            setCookingRecipe(recipe);
                            setIsCookingOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all active:scale-95"
                        >
                          <ChefHat size={14} />
                          <span>Modalità Cucina & Timer {recipe.totalTime ? `(${recipe.totalTime}m)` : ''}</span>
                        </button>
                      </div>
                    </div>

                    {/* Azioni */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() =>
                          updateRecipe(recipe.id, {
                            status: recipe.status === 'tried' ? 'want_to_try' : 'tried',
                          })
                        }
                        className={cn(
                          'p-2 rounded-xl transition-colors',
                          recipe.status === 'tried' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'
                        )}
                        title={recipe.status === 'tried' ? 'Segna da provare' : 'Segna come provata'}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => deleteRecipe(recipe.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
                        title="Elimina"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* LINK */}
      {/* ======================================================== */}
      {activeTab === 'links' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">
              {linkItems.length} {linkItems.length === 1 ? 'link' : 'link'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setIsAddLinkOpen(true)}>
              <Plus size={14} /> Aggiungi link
            </Button>
          </div>
          {linkItems.length === 0 ? (
            <EmptyState
              icon={<Link2 size={28} />}
              title="Nessun link salvato"
              description="Salva siti, articoli e risorse utili"
              action={
                <Button variant="primary" size="md" onClick={() => setIsAddLinkOpen(true)}>
                  <Plus size={16} /> Aggiungi link
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {linkItems.map((link) => (
                <Card key={link.id} variant="default" padding="sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{link.title}</p>
                      <p className="text-xs text-slate-500 truncate">{link.domain}</p>
                      {link.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{link.notes}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-slate-500 hover:text-brand-400"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="p-2 rounded-xl text-slate-600 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* INBOX */}
      {/* ======================================================== */}
      {activeTab === 'inbox' && (
        <>
          {unprocessedItems.length === 0 ? (
            <EmptyState
              icon={<Inbox size={28} />}
              title="Inbox vuota"
              description="Tutti gli elementi sono stati processati"
            />
          ) : (
            <div className="space-y-2">
              {unprocessedItems.map((item) => (
                <Card key={item.id} variant="default" padding="sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{item.content}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(item.createdAt), 'd MMM HH:mm', { locale: it })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteInboxItem(item.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* DIARIO */}
      {/* ======================================================== */}
      {activeTab === 'diary' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">
              {diaryEntries.length} {diaryEntries.length === 1 ? 'nota' : 'note'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setIsAddDiaryOpen(true)}>
              <Plus size={14} /> Nuova nota
            </Button>
          </div>
          {diaryEntries.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} />}
              title="Nessuna nota"
              description="Scrivi i tuoi pensieri e ricordi"
              action={
                <Button variant="primary" size="md" onClick={() => setIsAddDiaryOpen(true)}>
                  <Plus size={16} /> Nuova nota
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {diaryEntries.map((entry) => (
                <Card key={entry.id} variant="default" padding="sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">
                          {format(new Date(entry.date), 'd MMM yyyy', { locale: it })}
                        </span>
                        {entry.isFavorite && <Star size={12} className="text-yellow-400" fill="currentColor" />}
                      </div>
                      {entry.title && <p className="text-sm font-semibold text-slate-200 mb-1">{entry.title}</p>}
                      <p className="text-sm text-slate-400 line-clamp-3">{entry.content}</p>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* IDEE */}
      {/* ======================================================== */}
      {activeTab === 'ideas' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">
              {ideas.length} {ideas.length === 1 ? 'idea' : 'idee'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setIsAddIdeaOpen(true)}>
              <Plus size={14} /> Nuova idea
            </Button>
          </div>
          {ideas.length === 0 ? (
            <EmptyState
              icon={<Lightbulb size={28} />}
              title="Nessuna idea"
              description="Cattura le tue idee prima che svaniscano"
              action={
                <Button variant="primary" size="md" onClick={() => setIsAddIdeaOpen(true)}>
                  <Plus size={16} /> Nuova idea
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {ideas.map((idea) => (
                <Card key={idea.id} variant="default" padding="sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">{idea.title}</p>
                      {idea.content && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{idea.content}</p>}
                      <Badge size="sm" className="mt-2">
                        {idea.status === 'raw'
                          ? '💡 Grezza'
                          : idea.status === 'developing'
                          ? '🔧 In sviluppo'
                          : '✅ Pronta'}
                      </Badge>
                    </div>
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODALI / BOTTOM SHEETS */}
      {/* ======================================================== */}

      {/* Form aggiungi prodotto wishlist */}
      <BottomSheet isOpen={isAddWishlistOpen} onClose={() => setIsAddWishlistOpen(false)} title="Nuovo prodotto Wishlist">
        <div className="p-4 space-y-4">
          <Input
            label="Nome prodotto *"
            placeholder="Es. Cuffie Sony WH-1000XM5, Monitor 4K, ecc."
            value={wishlistForm.name}
            onChange={(e) => setWishlistForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            label="Eventuale Link (Negozio / Sito)"
            placeholder="https://amazon.it/..."
            value={wishlistForm.url}
            onChange={(e) => setWishlistForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Costo stimato (€)"
              placeholder="Es. 89.90"
              type="text"
              inputMode="decimal"
              value={wishlistForm.price}
              onChange={(e) => setWishlistForm((f) => ({ ...f, price: e.target.value }))}
            />
            <Select
              label="Priorità"
              value={wishlistForm.priority}
              onChange={(e) => setWishlistForm((f) => ({ ...f, priority: e.target.value as Priority }))}
              options={PRIORITY_OPTIONS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5 flex items-center gap-1">
              <Target size={13} className="text-amber-400" />
              <span>A che mi serve? (Motivo / Utilizzo)</span>
            </label>
            <Textarea
              placeholder="Es. Per lavorare da casa in tranquillità, per il viaggio in Giappone..."
              value={wishlistForm.purpose}
              onChange={(e) => setWishlistForm((f) => ({ ...f, purpose: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setIsAddWishlistOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" fullWidth onClick={handleAddWishlist} loading={isSaving}>
              Salva prodotto
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Form aggiungi ricetta */}
      <BottomSheet isOpen={isAddRecipeOpen} onClose={() => setIsAddRecipeOpen(false)} title="Nuova Ricetta">
        <div className="p-4 space-y-4">
          <Input
            label="Titolo ricetta *"
            placeholder="Es. Carbonara classica, Torta di mele..."
            value={recipeForm.title}
            onChange={(e) => setRecipeForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Tempo (min)"
              placeholder="Es. 25"
              type="number"
              value={recipeForm.totalTime}
              onChange={(e) => setRecipeForm((f) => ({ ...f, totalTime: e.target.value }))}
            />
            <Input
              label="Porzioni"
              placeholder="Es. 4"
              type="number"
              value={recipeForm.servings}
              onChange={(e) => setRecipeForm((f) => ({ ...f, servings: e.target.value }))}
            />
            <Select
              label="Difficoltà"
              value={recipeForm.difficulty}
              onChange={(e) => setRecipeForm((f) => ({ ...f, difficulty: e.target.value as RecipeDifficulty }))}
              options={DIFFICULTY_OPTIONS}
            />
          </div>
          <Textarea
            label="🥗 Ingredienti (separati da virgola o riga)"
            placeholder="Es: 400g spaghetti, 200g guanciale, 4 tuorli, pecorino romano, pepe nero"
            value={recipeForm.ingredients}
            onChange={(e) => setRecipeForm((f) => ({ ...f, ingredients: e.target.value }))}
            rows={3}
          />
          <Textarea
            label="📝 Procedimento / Note"
            placeholder="Passaggi della preparazione o note personali..."
            value={recipeForm.notes}
            onChange={(e) => setRecipeForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
          <Input
            label="Eventuale Link / Fonte"
            placeholder="https://giallozafferano.it/..."
            value={recipeForm.url}
            onChange={(e) => setRecipeForm((f) => ({ ...f, url: e.target.value }))}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setIsAddRecipeOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" fullWidth onClick={handleAddRecipe} loading={isSaving}>
              Salva ricetta
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Form aggiungi link */}
      <BottomSheet isOpen={isAddLinkOpen} onClose={() => setIsAddLinkOpen(false)} title="Aggiungi link">
        <div className="p-4 space-y-4">
          <Input
            label="URL *"
            placeholder="https://..."
            value={linkForm.url}
            onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
          />
          <Input
            label="Titolo"
            placeholder="Lascia vuoto per usare l'URL"
            value={linkForm.title}
            onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Select
            label="Categoria"
            value={linkForm.category}
            onChange={(e) => setLinkForm((f) => ({ ...f, category: e.target.value as LinkCategory }))}
            options={LINK_CATEGORIES}
          />
          <Textarea
            label="Note"
            placeholder="Note personali..."
            value={linkForm.notes}
            onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setIsAddLinkOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" fullWidth onClick={handleAddLink} loading={isSaving}>
              Salva link
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Form aggiungi idea */}
      <BottomSheet isOpen={isAddIdeaOpen} onClose={() => setIsAddIdeaOpen(false)} title="Nuova idea">
        <div className="p-4 space-y-4">
          <Input
            label="Titolo *"
            placeholder="L'idea in una frase"
            value={ideaForm.title}
            onChange={(e) => setIdeaForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
          <Textarea
            label="Descrizione"
            placeholder="Dettagli, contesto, spunti..."
            value={ideaForm.content}
            onChange={(e) => setIdeaForm((f) => ({ ...f, content: e.target.value }))}
            rows={4}
          />
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setIsAddIdeaOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" fullWidth onClick={handleAddIdea} loading={isSaving}>
              Salva idea
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Form aggiungi nota diario */}
      <BottomSheet isOpen={isAddDiaryOpen} onClose={() => setIsAddDiaryOpen(false)} title="Nuova nota">
        <div className="p-4 space-y-4">
          <Input
            label="Titolo"
            placeholder="Opzionale"
            value={diaryForm.title}
            onChange={(e) => setDiaryForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Textarea
            label="Nota *"
            placeholder="Scrivi i tuoi pensieri..."
            value={diaryForm.content}
            onChange={(e) => setDiaryForm((f) => ({ ...f, content: e.target.value }))}
            rows={6}
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setIsAddDiaryOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" fullWidth onClick={handleAddDiary} loading={isSaving}>
              Salva nota
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Modalità Cucina & Timer */}
      <RecipeCookingModal
        recipe={cookingRecipe}
        isOpen={isCookingOpen}
        onClose={() => {
          setIsCookingOpen(false);
          setCookingRecipe(null);
        }}
      />
    </Page>
  );
}