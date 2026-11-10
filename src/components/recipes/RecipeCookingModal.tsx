import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Check, Users, ChefHat, Sparkles, X, Plus, Minus } from 'lucide-react';
import { BottomSheet } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { playTimerDoneSound } from '@/services/notificationService';
import { cn } from '@/utils/cn';
import type { Recipe } from '@/types';

interface RecipeCookingModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RecipeCookingModal({ recipe, isOpen, onClose }: RecipeCookingModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inizializza timer e checklist quando cambia ricetta o apre
  useEffect(() => {
    if (isOpen && recipe) {
      const minutes = recipe.totalTime || 15;
      setTimeLeft(minutes * 60);
      setIsRunning(false);
      setCheckedIngredients({});
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRunning(false);
    }
  }, [isOpen, recipe]);

  // Gestione countdown
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            playTimerDoneSound();
            if ('vibrate' in navigator) navigator.vibrate([300, 150, 300]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  if (!recipe) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const addMinutes = (amount: number) => {
    setTimeLeft((prev) => Math.max(0, prev + amount * 60));
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft((recipe.totalTime || 15) * 60);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="🧑‍🍳 Modalità Cucina">
      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
        {/* Titolo ricetta */}
        <div className="flex items-center justify-between pb-1 border-b border-surface-300/40">
          <div>
            <h3 className="text-base font-bold text-slate-100">{recipe.title}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              {recipe.servings && (
                <span className="flex items-center gap-1">
                  <Users size={12} className="text-indigo-400" /> {recipe.servings} porzioni
                </span>
              )}
              {recipe.difficulty && (
                <span className="capitalize text-slate-300">
                  {recipe.difficulty === 'easy' ? '🟢 Facile' : recipe.difficulty === 'hard' ? '🔴 Difficile' : '🟡 Media'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TIMER CUCINA DIGITALE */}
        <div className="bg-gradient-to-br from-surface-200 to-surface-150 border border-brand-500/30 rounded-3xl p-5 text-center shadow-lg">
          <div className="flex items-center justify-center gap-2 mb-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
            <Clock size={14} />
            <span>Timer di Cottura</span>
          </div>

          {/* Cifre Giganti */}
          <div className={cn(
            'text-5xl font-mono font-extrabold tracking-tight transition-colors',
            timeLeft === 0 ? 'text-red-400 animate-pulse' : isRunning ? 'text-emerald-400' : 'text-slate-100'
          )}>
            {timeFormatted}
          </div>

          {timeLeft === 0 && (
            <p className="text-xs text-red-400 font-semibold mt-2 animate-bounce">
              🔔 Tempo scaduto! Controlla la cottura!
            </p>
          )}

          {/* Controlli Timer */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => addMinutes(-1)}
              className="p-2 rounded-xl bg-surface-300 hover:bg-surface-400 text-slate-300 text-xs active:scale-95 transition-all"
              title="-1 minuto"
            >
              <Minus size={16} />
            </button>

            <Button
              variant={isRunning ? 'secondary' : 'primary'}
              size="md"
              onClick={() => setIsRunning(!isRunning)}
              className="px-6 font-bold"
            >
              {isRunning ? <><Pause size={16} /> Pausa</> : <><Play size={16} /> Avvia Timer</>}
            </Button>

            <button
              onClick={resetTimer}
              className="p-2 rounded-xl bg-surface-300 hover:bg-surface-400 text-slate-300 active:scale-95 transition-all"
              title="Reimposta"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => addMinutes(5)}
              className="px-2.5 py-2 rounded-xl bg-surface-300 hover:bg-surface-400 text-slate-300 text-xs font-semibold active:scale-95 transition-all"
              title="+5 minuti"
            >
              +5m
            </button>
          </div>
        </div>

        {/* INGREDIENTI CON CHECKLIST SPUNTABILE */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🥗 Ingredienti</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (tocca per spuntare mentre cucini)
                </span>
              </span>
            </div>

            <div className="space-y-1.5">
              {recipe.ingredients.map((ing, idx) => {
                const name = typeof ing === 'string' ? ing : ing.name;
                const isChecked = !!checkedIngredients[idx];

                return (
                  <div
                    key={idx}
                    onClick={() => toggleIngredient(idx)}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none active:scale-98',
                      isChecked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through opacity-75'
                        : 'bg-surface-200 border-surface-300/60 text-slate-200 hover:bg-surface-250'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0',
                      isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-surface-400 bg-surface-300'
                    )}>
                      {isChecked && <Check size={12} strokeWidth={3} />}
                    </div>
                    <span className="text-xs font-medium">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROCEDIMENTO E ISTRUZIONI */}
        {(recipe.notes || recipe.description) && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              📝 Procedimento & Consigli
            </span>
            <div className="bg-surface-200 border border-surface-300/60 rounded-2xl p-3.5 text-xs text-slate-200 leading-relaxed whitespace-pre-line">
              {recipe.notes || recipe.description}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button variant="ghost" fullWidth onClick={onClose}>
            Chiudi modalità cucina
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
