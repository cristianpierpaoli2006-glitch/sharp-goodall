import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, X, CheckSquare, ShoppingBag, ChefHat, Link2, BookOpen, Lightbulb,
  ExternalLink, Calendar, Clock, ArrowRight, Tag
} from 'lucide-react';
import { BottomSheet } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/stores/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAnonymousUserId } from '@/db/local/db';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { formatTaskTime } from '@/utils/taskTime';
import type { Task, WishlistItem, Recipe, SavedLink, DiaryEntry, Idea } from '@/types';

type SearchCategory = 'all' | 'tasks' | 'wishlist' | 'recipes' | 'links' | 'diary' | 'ideas';

interface SearchResultItem {
  id: string;
  type: 'task' | 'wishlist' | 'recipe' | 'link' | 'diary' | 'idea';
  title: string;
  subtitle?: string;
  badge?: string;
  url?: string;
  targetPath: string;
}

export function GlobalSearch() {
  const isOpen = useAppStore((s) => s.isSearchOpen);
  const setOpen = useAppStore((s) => s.setSearchOpen);
  const auth = useAppStore((s) => s.auth);
  const userId = auth.userId || getAnonymousUserId();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus automatico all'apertura
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    } else {
      setQuery('');
      setCategory('all');
    }
  }, [isOpen]);

  // Caricamento dati in memoria per ricerca istantanea
  const tasks = useLiveQuery(() =>
    db.tasks.filter((t) => !t.deletedAt && t.userId === userId).toArray(),
    [userId]
  ) ?? [];

  const wishlist = useLiveQuery(() =>
    db.wishlist.filter((w) => !w.deletedAt && w.userId === userId).toArray(),
    [userId]
  ) ?? [];

  const recipes = useLiveQuery(() =>
    db.recipes.filter((r) => !r.deletedAt && r.userId === userId).toArray(),
    [userId]
  ) ?? [];

  const links = useLiveQuery(() =>
    db.links.filter((l) => !l.deletedAt && l.userId === userId).toArray(),
    [userId]
  ) ?? [];

  const diary = useLiveQuery(() =>
    db.diary.filter((d) => !d.deletedAt && d.userId === userId).toArray(),
    [userId]
  ) ?? [];

  const ideas = useLiveQuery(() =>
    db.ideas.filter((i) => !i.deletedAt && i.userId === userId).toArray(),
    [userId]
  ) ?? [];

  // Risultati filtrati
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const items: SearchResultItem[] = [];

    // 1. Attività
    if (category === 'all' || category === 'tasks') {
      tasks.forEach((t) => {
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchCat = t.category?.toLowerCase().includes(q);
        if (matchTitle || matchDesc || matchCat) {
          const timeStr = formatTaskTime(t);
          items.push({
            id: t.id,
            type: 'task',
            title: t.title,
            subtitle: timeStr ? `${t.dueDate || 'Oggi'} • ${timeStr}` : t.dueDate,
            badge: t.status === 'done' ? '✅ Completata' : 'Attività',
            targetPath: '/tasks',
          });
        }
      });
    }

    // 2. Wishlist
    if (category === 'all' || category === 'wishlist') {
      wishlist.forEach((w) => {
        const matchName = w.name.toLowerCase().includes(q);
        const matchNotes = w.notes?.toLowerCase().includes(q);
        if (matchName || matchNotes) {
          items.push({
            id: w.id,
            type: 'wishlist',
            title: w.name,
            subtitle: w.notes ? `🎯 ${w.notes}` : undefined,
            badge: w.price !== undefined ? `€${w.price}` : 'Wishlist',
            url: w.url,
            targetPath: '/archive?tab=wishlist',
          });
        }
      });
    }

    // 3. Ricette
    if (category === 'all' || category === 'recipes') {
      recipes.forEach((r) => {
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchIngs = r.ingredients?.some((ing) =>
          ing.name.toLowerCase().includes(q)
        );
        const matchNotes = r.notes?.toLowerCase().includes(q);
        if (matchTitle || matchIngs || matchNotes) {
          items.push({
            id: r.id,
            type: 'recipe',
            title: r.title,
            subtitle: r.totalTime ? `⏱ ${r.totalTime} min • ${r.servings || 4} porzioni` : undefined,
            badge: 'Ricetta',
            url: r.sourceUrl,
            targetPath: '/archive?tab=recipes',
          });
        }
      });
    }

    // 4. Link
    if (category === 'all' || category === 'links') {
      links.forEach((l) => {
        const matchTitle = l.title.toLowerCase().includes(q);
        const matchUrl = l.url.toLowerCase().includes(q);
        const matchNotes = l.notes?.toLowerCase().includes(q);
        if (matchTitle || matchUrl || matchNotes) {
          items.push({
            id: l.id,
            type: 'link',
            title: l.title,
            subtitle: l.domain || l.url,
            badge: 'Link',
            url: l.url,
            targetPath: '/archive?tab=links',
          });
        }
      });
    }

    // 5. Diario
    if (category === 'all' || category === 'diary') {
      diary.forEach((d) => {
        const matchTitle = d.title?.toLowerCase().includes(q);
        const matchContent = d.content.toLowerCase().includes(q);
        if (matchTitle || matchContent) {
          items.push({
            id: d.id,
            type: 'diary',
            title: d.title || d.content.slice(0, 40),
            subtitle: d.content.length > 50 ? `${d.content.slice(0, 50)}…` : d.content,
            badge: 'Diario',
            targetPath: '/archive?tab=diary',
          });
        }
      });
    }

    // 6. Idee
    if (category === 'all' || category === 'ideas') {
      ideas.forEach((i) => {
        const matchTitle = i.title.toLowerCase().includes(q);
        const matchContent = i.content?.toLowerCase().includes(q);
        if (matchTitle || matchContent) {
          items.push({
            id: i.id,
            type: 'idea',
            title: i.title,
            subtitle: i.content,
            badge: 'Idea',
            targetPath: '/archive?tab=ideas',
          });
        }
      });
    }

    return items;
  }, [query, category, tasks, wishlist, recipes, links, diary, ideas]);

  const handleSelectResult = (item: SearchResultItem) => {
    setOpen(false);
    navigate(item.targetPath);
  };

  const getCategoryIcon = (type: SearchResultItem['type']) => {
    switch (type) {
      case 'task':     return <CheckSquare size={15} className="text-blue-400" />;
      case 'wishlist': return <ShoppingBag size={15} className="text-amber-400" />;
      case 'recipe':   return <ChefHat size={15} className="text-emerald-400" />;
      case 'link':     return <Link2 size={15} className="text-purple-400" />;
      case 'diary':    return <BookOpen size={15} className="text-pink-400" />;
      case 'idea':     return <Lightbulb size={15} className="text-yellow-400" />;
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={() => setOpen(false)} title="Ricerca Rapida">
      <div className="p-4 space-y-3">
        {/* Barra di ricerca con tasto cancella */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca attività, ricette, prodotti, note, link..."
            className="w-full bg-surface-200 border border-surface-300/80 rounded-2xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filtri categoria */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: 'Tutto' },
            { id: 'tasks', label: 'Attività' },
            { id: 'wishlist', label: 'Wishlist' },
            { id: 'recipes', label: 'Ricette' },
            { id: 'links', label: 'Link' },
            { id: 'diary', label: 'Diario' },
            { id: 'ideas', label: 'Idee' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id as SearchCategory)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap',
                category === c.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-surface-200 text-slate-400 hover:text-slate-200'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Risultati */}
        <div className="max-h-[55vh] overflow-y-auto space-y-2 pt-1 no-scrollbar">
          {!query.trim() ? (
            <div className="py-8 text-center text-slate-500">
              <Search size={32} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs">Digita una parola chiave per cercare in tutta l'app</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <p className="text-sm font-semibold text-slate-400">Nessun risultato</p>
              <p className="text-xs text-slate-500 mt-1">Nessun elemento corrisponde a "{query}"</p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={`${item.type}_${item.id}`}
                onClick={() => handleSelectResult(item)}
                className="flex items-center gap-3 p-3 bg-surface-200 hover:bg-surface-250 border border-surface-300/60 rounded-2xl active:scale-98 transition-all cursor-pointer group"
              >
                <div className="p-2 rounded-xl bg-surface-150 flex-shrink-0">
                  {getCategoryIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-brand-300 transition-colors">
                      {item.title}
                    </p>
                    {item.badge && (
                      <span className="text-[10px] bg-surface-300 text-slate-400 px-2 py-0.2 rounded-md font-medium flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                  )}
                </div>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-brand-400 flex-shrink-0 transition-colors" />
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
