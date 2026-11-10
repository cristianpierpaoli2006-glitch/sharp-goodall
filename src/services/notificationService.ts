import { db, getAnonymousUserId } from '@/db/local/db';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ===================================================
// SINTETIZZATORE AUDIO (Web Audio API - Offline & Leggero)
// ===================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Suono rintocco dolce per promemoria e notifiche */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5, A5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.55);
    });
  } catch (e) {
    console.debug('Audio playback skipped:', e);
  }
}

/** Suono trillo per fine timer ricetta / timer cucina */
export function playTimerDoneSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const arpeggio = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    arpeggio.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.001, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.65);
    });
  } catch (e) {
    console.debug('Timer sound skipped:', e);
  }
}

// ===================================================
// PERMESSI & SCHEDULER NOTIFICHE LOCALI
// ===================================================

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function isNotificationGranted(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

const notifiedTaskMap = new Set<string>();

/** Controlla le attività di oggi con orario e notifica se è arrivato il momento */
export async function checkDueTasks(): Promise<void> {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowHHMM = format(new Date(), 'HH:mm');

    const tasks = await db.tasks
      .where('dueDate')
      .equals(todayStr)
      .filter((t) => !t.deletedAt && t.status !== 'done' && t.status !== 'cancelled' && !!t.dueTime)
      .toArray();

    for (const task of tasks) {
      if (!task.dueTime) continue;
      const cleanStart = task.dueTime.includes('-') ? task.dueTime.split('-')[0].trim() : task.dueTime.trim();

      // Notifica esattamente all'orario prefissato
      if (cleanStart === nowHHMM) {
        const notifKey = `${task.id}_${todayStr}_${nowHHMM}`;
        if (!notifiedTaskMap.has(notifKey)) {
          notifiedTaskMap.add(notifKey);

          // Suono audio
          playNotificationSound();

          // Notifica nativa PWA / browser
          if (isNotificationGranted()) {
            try {
              new Notification(`⏰ Promemoria: ${task.title}`, {
                body: task.description || `In programma per adesso (${nowHHMM})`,
                icon: '/icons/icon-192.png',
                tag: task.id,
              });
            } catch {
              // Fallback
            }
          }

          // Feedback toast in-app
          toast.info(`Promemoria: ${task.title}`, {
            description: `Orario previsto: ${nowHHMM}`,
            duration: 6000,
          });
        }
      }
    }
  } catch (err) {
    console.debug('Check due tasks failed:', err);
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function initNotificationScheduler(): () => void {
  // Esegui subito e poi ogni 30 secondi
  checkDueTasks();
  if (!schedulerTimer) {
    schedulerTimer = setInterval(checkDueTasks, 30000);
  }

  return () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  };
}
