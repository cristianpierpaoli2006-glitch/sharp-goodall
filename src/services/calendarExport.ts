import type { Task } from '@/types';
import { format, parseISO, addHours } from 'date-fns';

// ===================================================
// APPLE CALENDAR (iCalendar .ics RFC 5545)
// ===================================================

function formatIcsDateTime(dateStr: string, timeStr?: string): string {
  // Se c'è sia data che orario (es. 2026-11-10 e 08:00)
  if (timeStr) {
    const cleanTime = timeStr.includes('-') ? timeStr.split('-')[0].trim() : timeStr.trim();
    const [h, m] = cleanTime.split(':').map((n) => n.padStart(2, '0'));
    const cleanDate = dateStr.replace(/-/g, '');
    return `${cleanDate}T${h}${m}00`;
  }
  // Evento tutto il giorno
  return dateStr.replace(/-/g, '');
}

function calculateEndTime(dateStr: string, timeStr?: string, explicitEndTime?: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  if (explicitEndTime) {
    const [h, m] = explicitEndTime.trim().split(':').map((n) => n.padStart(2, '0'));
    return `${cleanDate}T${h}${m}00`;
  }
  if (timeStr && timeStr.includes('-')) {
    const endPart = timeStr.split('-')[1].trim();
    const [h, m] = endPart.split(':').map((n) => n.padStart(2, '0'));
    return `${cleanDate}T${h}${m}00`;
  }
  if (timeStr) {
    // Aggiungi 1 ora come default
    const [h, m] = timeStr.split(':').map(Number);
    const endH = ((h + 1) % 24).toString().padStart(2, '0');
    return `${cleanDate}T${endH}${(m || 0).toString().padStart(2, '0')}00`;
  }
  return cleanDate;
}

// Mappa priorità per iCalendar (1=massima, 5=media, 9=bassa)
function mapPriorityToIcs(priority: string): number {
  switch (priority) {
    case 'urgent': return 1;
    case 'high':   return 3;
    case 'medium': return 5;
    case 'low':    return 9;
    default:       return 5;
  }
}

// Genera contenuto .ics per una singola attività
export function createSingleIcs(task: Task): string {
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  const dateStr = task.dueDate || format(new Date(), 'yyyy-MM-dd');
  const startDt = formatIcsDateTime(dateStr, task.dueTime);
  const endDt = calculateEndTime(dateStr, task.dueTime, task.endTime);
  const isAllDay = !task.dueTime;
  const priorityNum = mapPriorityToIcs(task.priority);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Life Hub//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${task.id}@personallifehub.app`,
    `DTSTAMP:${now}`,
    isAllDay ? `DTSTART;VALUE=DATE:${startDt}` : `DTSTART:${startDt}`,
    isAllDay ? `DTEND;VALUE=DATE:${endDt}` : `DTEND:${endDt}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
    task.description ? `DESCRIPTION:${escapeIcsText(task.description)}` : 'DESCRIPTION:Creato da Personal Life Hub',
    `PRIORITY:${priorityNum}`,
    task.category ? `CATEGORIES:${escapeIcsText(task.category)}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return icsLines.join('\r\n');
}

// Genera un file .ics contenente più attività (es. l'intera giornata o il mese)
export function createMultiIcs(tasks: Task[], calendarName = 'Personal Life Hub'): string {
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Life Hub//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  const events = tasks.map((task) => {
    const dateStr = task.dueDate || format(new Date(), 'yyyy-MM-dd');
    const startDt = formatIcsDateTime(dateStr, task.dueTime);
    const endDt = calculateEndTime(dateStr, task.dueTime, task.endTime);
    const isAllDay = !task.dueTime;
    const priorityNum = mapPriorityToIcs(task.priority);

    return [
      'BEGIN:VEVENT',
      `UID:${task.id}@personallifehub.app`,
      `DTSTAMP:${now}`,
      isAllDay ? `DTSTART;VALUE=DATE:${startDt}` : `DTSTART:${startDt}`,
      isAllDay ? `DTEND;VALUE=DATE:${endDt}` : `DTEND:${endDt}`,
      `SUMMARY:${escapeIcsText(task.title)}`,
      task.description ? `DESCRIPTION:${escapeIcsText(task.description)}` : 'DESCRIPTION:Creato da Personal Life Hub',
      `PRIORITY:${priorityNum}`,
      task.category ? `CATEGORIES:${escapeIcsText(task.category)}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  });

  const footer = ['END:VCALENDAR'];

  return [...header, ...events, ...footer].join('\r\n');
}

// Esporta su Apple Calendar: scarica o apre il file .ics
// Su iPhone Safari, aprire o scaricare un file con MIME "text/calendar" attiva la schermata nativa di Apple Calendar!
export function exportToAppleCalendar(task: Task): void {
  const icsData = createSingleIcs(task);
  downloadOrOpenIcs(icsData, `${sanitizeFilename(task.title)}.ics`);
}

// Esporta tutte le attività di un giorno su Apple Calendar
export function exportDayToAppleCalendar(tasks: Task[], dateLabel: string): void {
  if (tasks.length === 0) return;
  const icsData = createMultiIcs(tasks, `Impegni ${dateLabel}`);
  downloadOrOpenIcs(icsData, `impegni-${dateLabel}.ics`);
}

function downloadOrOpenIcs(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Prova apertura diretta (perfetto per iOS Safari)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // Su iOS aprire un blob di tipo text/calendar avvia Apple Calendar nativo
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ===================================================
// GOOGLE CALENDAR (Web URL diretta)
// ===================================================

export function getGoogleCalendarUrl(task: Task): string {
  const title = encodeURIComponent(task.title);
  const details = encodeURIComponent(task.description || '');
  const dateStr = (task.dueDate || format(new Date(), 'yyyy-MM-dd')).replace(/-/g, '');

  let datesParam = `${dateStr}/${dateStr}`;
  if (task.dueTime) {
    const cleanTime = task.dueTime.includes('-') ? task.dueTime.split('-')[0].trim() : task.dueTime.trim();
    const [h, m] = cleanTime.split(':').map((n) => n.padStart(2, '0'));
    const startIso = `${dateStr}T${h}${m}00`;
    let endIso = '';
    if (task.endTime) {
      const [eh, em] = task.endTime.trim().split(':').map((n) => n.padStart(2, '0'));
      endIso = `${dateStr}T${eh}${em}00`;
    } else if (task.dueTime.includes('-')) {
      const endPart = task.dueTime.split('-')[1].trim();
      const [eh, em] = endPart.split(':').map((n) => n.padStart(2, '0'));
      endIso = `${dateStr}T${eh}${em}00`;
    } else {
      const endH = ((Number(h) + 1) % 24).toString().padStart(2, '0');
      endIso = `${dateStr}T${endH}${m}00`;
    }
    datesParam = `${startIso}/${endIso}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}`;
}

// ===================================================
// APPLE PROMEMORIA (Reminders VTODO o Condivisione)
// ===================================================

// Genera un file .ics con elemento VTODO (standard Promemoria Apple)
export function createAppleReminderIcs(task: Task): string {
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  const dateStr = task.dueDate || format(new Date(), 'yyyy-MM-dd');
  const dueDt = formatIcsDateTime(dateStr, task.dueTime);
  const priorityNum = mapPriorityToIcs(task.priority);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Life Hub//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTODO',
    `UID:${task.id}-todo@personallifehub.app`,
    `DTSTAMP:${now}`,
    `DUE:${dueDt}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
    task.description ? `DESCRIPTION:${escapeIcsText(task.description)}` : '',
    `PRIORITY:${priorityNum}`,
    'STATUS:NEEDS-ACTION',
    'END:VTODO',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function exportToAppleReminders(task: Task): void {
  const icsData = createAppleReminderIcs(task);
  downloadOrOpenIcs(icsData, `promemoria-${sanitizeFilename(task.title)}.ics`);
}

// Utility di sanitizzazione testo iCalendar
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function sanitizeFilename(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/gi, '-').slice(0, 30);
}
