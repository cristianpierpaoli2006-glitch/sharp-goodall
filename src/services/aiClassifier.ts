import type { QuickCaptureResult, InboxItemType, Priority } from '@/types';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';

// ===================================================
// PARSER LOCALE AVANZATO (offline-first & istantaneo)
// ===================================================

// Lettere (incluse accentate) usate per i confini di parola.
// NB: il \b di JavaScript non considera "ì", "à" ecc. come lettere, quindi "lunedì" non verrebbe mai trovato.
const LETTERS = 'a-zA-Z0-9àèéìíòóùúÀÈÉÌÍÒÓÙÚ';
const NB = `(?:^|[^${LETTERS}])`;     // inizio parola (consuma 1 carattere non-lettera)
const NA = `(?![${LETTERS}])`;         // fine parola

const STANDARD_URL_REGEX = /https?:\/\/[^\s,]+/i;
const MALFORMED_HTTPS_REGEX = /https?\s*:?\s+([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s,]*)/i;
const BARE_DOMAIN_REGEX = /(?:^|[^@\w.])((?:www\.)?[a-zA-Z0-9-]+\.(?:it|com|io|org|net|dev|app|ai|co|eu|info|me|store|shop)(?:\/[^\s,]*)?)(?![\w])/i;

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
};

const WEEKDAYS: Record<string, number> = {
  'lunedì': 1, 'lunedi': 1, 'martedì': 2, 'martedi': 2, 'mercoledì': 3, 'mercoledi': 3,
  'giovedì': 4, 'giovedi': 4, 'venerdì': 5, 'venerdi': 5, 'sabato': 6, 'domenica': 0,
};

function capitalize(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** Cerca una parola/espressione intera (gestendo le lettere accentate). Ritorna il testo trovato. */
function findWord(text: string, pattern: string): string | undefined {
  const m = text.match(new RegExp(`${NB}(${pattern})${NA}`, 'i'));
  return m ? m[1] : undefined;
}

// ---------------------------------------------------
// URL
// ---------------------------------------------------
function extractAndNormalizeUrl(text: string): { url?: string; matchText?: string } {
  const stdMatch = text.match(STANDARD_URL_REGEX);
  if (stdMatch) return { url: stdMatch[0].replace(/[).;]+$/, ''), matchText: stdMatch[0] };

  const malformedMatch = text.match(MALFORMED_HTTPS_REGEX);
  if (malformedMatch) return { url: `https://${malformedMatch[1]}`, matchText: malformedMatch[0] };

  const bareMatch = text.match(BARE_DOMAIN_REGEX);
  if (bareMatch) return { url: `https://${bareMatch[1]}`, matchText: bareMatch[1] };

  return {};
}

// ---------------------------------------------------
// ORARI ("dalle 8 alle 20", "alle 18:30", "alle 9 di sera")
// ---------------------------------------------------
function normalizeTimeString(raw: string, forcePm = false): string | undefined {
  const [hRaw, mRaw] = raw.replace('.', ':').split(':');
  let h = parseInt(hRaw, 10);
  const m = mRaw ? parseInt(mRaw.padEnd(2, '0'), 10) : 0;
  if (!Number.isFinite(h) || h < 0 || h > 24 || m < 0 || m > 59) return undefined;
  if (forcePm && h >= 1 && h < 12) h += 12;
  if (h === 24) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const TIME_NUM = '(\\d{1,2}(?:[:.]\\d{2})?)';

function extractTimes(text: string): { startTime?: string; endTime?: string; matchText?: string } {
  const pm = /\b(?:di\s+sera|stasera|questa\s+sera|del\s+pomeriggio|di\s+pomeriggio|pomeriggio|pm)\b/i.test(text);

  // Intervallo: "dalle 8 alle 20", "dalle 8:30 fino alle 17", "dalle 9 alle 13"
  const rangeRegex = new RegExp(
    `${NB}((?:dalle|dalla|dall'|dall’|da)\\s*(?:ore\\s*)?${TIME_NUM}\\s*(?:fino\\s+)?(?:alle|all'|all’|a)\\s*${TIME_NUM})${NA}`,
    'i'
  );
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const start = normalizeTimeString(rangeMatch[2], pm);
    let end = normalizeTimeString(rangeMatch[3], pm);
    // "dalle 9 alle 6" → fine alle 18
    if (start && end && end <= start) {
      const endH = parseInt(end.split(':')[0], 10);
      if (endH < 12) end = normalizeTimeString(rangeMatch[3], true);
    }
    if (start) return { startTime: start, endTime: end, matchText: rangeMatch[1] };
  }

  // Mezzogiorno / mezzanotte
  const noon = text.match(/(?:a\s+)?mezzogiorno/i);
  if (noon) return { startTime: '12:00', matchText: noon[0] };
  const midnight = text.match(/(?:a\s+)?mezzanotte/i);
  if (midnight) return { startTime: '00:00', matchText: midnight[0] };

  // Singolo orario: "alle 18", "ore 9:30", "h 15"
  const singleRegex = new RegExp(`${NB}((?:alle|all'|all’|ore|h)\\s*${TIME_NUM})${NA}`, 'i');
  const singleMatch = text.match(singleRegex);
  if (singleMatch) {
    const start = normalizeTimeString(singleMatch[2], pm);
    if (start) return { startTime: start, matchText: singleMatch[1] };
  }

  return {};
}

// ---------------------------------------------------
// DATE ("oggi", "domani", "lunedì", "15 marzo", "15/11", "tra 3 giorni")
// ---------------------------------------------------
function extractDate(text: string): { date?: string; matchText?: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  let w: string | undefined;
  if ((w = findWord(text, 'dopodomani'))) return { date: fmt(addDays(now, 2)), matchText: w };
  if ((w = findWord(text, 'domani(?:\\s+mattina|\\s+sera|\\s+pomeriggio)?'))) return { date: fmt(addDays(now, 1)), matchText: w };
  if ((w = findWord(text, 'oggi|stasera|stamattina|stanotte|questa\\s+sera|questo\\s+pomeriggio|oggi\\s+pomeriggio'))) {
    return { date: fmt(now), matchText: w };
  }

  // "tra 3 giorni", "fra 2 settimane"
  const rel = text.match(/(?:tra|fra)\s+(\d{1,2}|un|una|due|tre)\s+(giorn[oi]|settiman[ae])/i);
  if (rel) {
    const words: Record<string, number> = { un: 1, una: 1, due: 2, tre: 3 };
    const n = words[rel[1].toLowerCase()] ?? parseInt(rel[1], 10);
    const days = /settiman/i.test(rel[2]) ? n * 7 : n;
    return { date: fmt(addDays(now, days)), matchText: rel[0] };
  }

  // "settimana prossima" → lunedì prossimo
  if ((w = findWord(text, 'settimana\\s+prossima|prossima\\s+settimana'))) {
    const diff = (1 - now.getDay() + 7) % 7 || 7;
    return { date: fmt(addDays(now, diff)), matchText: w };
  }

  // Giorni della settimana (anche "lunedì prossimo")
  for (const [dayName, dayNum] of Object.entries(WEEKDAYS)) {
    const found = findWord(text, `${dayName}(?:\\s+prossimo|\\s+prossima)?`);
    if (found) {
      const diff = (dayNum - now.getDay() + 7) % 7 || 7;
      return { date: fmt(addDays(now, diff)), matchText: found };
    }
  }

  // "15 marzo", "il 3 dicembre 2026"
  const dmMatch = text.match(/(?:il\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = ITALIAN_MONTHS[dmMatch[2].toLowerCase()];
    const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : now.getFullYear();
    const d = new Date(year, month, day, 12);
    if (!dmMatch[3] && d < addDays(now, -1)) d.setFullYear(d.getFullYear() + 1);
    return { date: fmt(d), matchText: dmMatch[0] };
  }

  // "15/11", "15/11/2026", "15-11-2026" (il trattino solo con l'anno, per non confonderlo con "8-12")
  const numMatch = text.match(/(?:il\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/) || text.match(/(?:il\s+)?(\d{1,2})-(\d{1,2})-(\d{4})(?!\d)/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      let year = numMatch[3] ? parseInt(numMatch[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month, day, 12);
      if (!numMatch[3] && d < addDays(now, -1)) d.setFullYear(d.getFullYear() + 1);
      return { date: fmt(d), matchText: numMatch[0] };
    }
  }

  return {};
}

// ---------------------------------------------------
// PREZZO ("25 euro", "25€", "€ 89,99", "costa 30")
// ---------------------------------------------------
function parsePrice(raw: string): number | undefined {
  let s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, ''); // 1.299,00
  s = s.replace(',', '.');
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : undefined;
}

function extractPrice(text: string): { price?: number; matchText?: string } {
  const NUM = '(\\d+(?:[.,]\\d+)*)';
  const PREFIX = '(?:(?:a|da|per|costo|costa|prezzo|circa|sui|sugli|intorno\\s+ai)\\s+)?';
  const patterns = [
    new RegExp(`${NB}(${PREFIX}${NUM}\\s*(?:€|euro|eur)(?![a-z]))`, 'i'),
    new RegExp(`${NB}(${PREFIX}(?:€|eur)\\s*${NUM})`, 'i'),
    new RegExp(`${NB}((?:costo|costa|prezzo)\\s*:?\\s*${NUM})`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const price = parsePrice(m[2]);
      if (price !== undefined) return { price, matchText: m[1] };
    }
  }
  return {};
}

// ---------------------------------------------------
// WISHLIST: motivo "A che mi serve"
// ---------------------------------------------------
function extractPurpose(text: string): { purpose?: string; matchText?: string } {
  const match = text.match(new RegExp(`${NB}((?:a\\s+che\\s+mi\\s+serv(?:e|ono)\\??:?|mi\\s+serv(?:ono|e)\\s+(?:per|a)|serv(?:ono|e)\\s+(?:per|a)|motivo:?|scopo:?|perch[eé]|per)\\s+([^,.;\\n]+))`, 'i'));
  if (match) {
    let p = match[2].trim();
    // Taglia eventuali negozi rimasti in coda
    p = p.replace(/\s+(?:su|da)\s+(?:amazon|ebay|zalando|ikea|mediaworld|unieuro)\b.*$/i, '').trim();
    if (p.length > 2 && !/^\d/.test(p)) {
      return { purpose: capitalize(p), matchText: match[1] };
    }
  }
  return {};
}

const STORE_SEARCH: Record<string, (q: string) => string> = {
  amazon:  (q) => `https://www.amazon.it/s?k=${encodeURIComponent(q)}`,
  ebay:    (q) => `https://www.ebay.it/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  zalando: (q) => `https://www.zalando.it/catalogo/?q=${encodeURIComponent(q)}`,
  ikea:    (q) => `https://www.ikea.com/it/it/search/?q=${encodeURIComponent(q)}`,
};

function extractStore(text: string): { store?: string; matchText?: string } {
  const m = text.match(/(?:su|da|in)\s+(amazon|ebay|zalando|ikea)(?![a-z])/i) || text.match(/(?:^|\s)(amazon|ebay|zalando|ikea)(?![a-z])/i);
  if (m) return { store: m[1].toLowerCase(), matchText: m[0].trim() };
  return {};
}

// ---------------------------------------------------
// RICETTE: tempo, porzioni, ingredienti, difficoltà, procedimento
// ---------------------------------------------------
const RECIPE_STOP = `(?=\\s+(?:tempo|in\\s+\\d|circa\\s+\\d|per\\s+\\d|x\\s*\\d|\\d+\\s*(?:min|minuti|ore|ora|h|persone|porzioni)|procedimento|preparazione|istruzioni|facile|semplice|veloce|difficile|complessa|media|link|fonte|https?|www\\.)|[.;\\n]|$)`;

function extractRecipeDetails(text: string): {
  totalTime?: number;
  servings?: number;
  ingredients?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  steps?: string;
  matches: string[];
} {
  const matches: string[] = [];

  // Tempo: "25 min", "1 ora", "1h 30", "tempo 40 minuti"
  let totalTime: number | undefined;
  const hm = text.match(/(?:tempo\s*:?\s*|in\s+|circa\s+)?(\d{1,2})\s*(?:h|ore|ora)(?:\s*e?\s*(\d{1,2})\s*(?:min|minuti|m)?)?(?![a-z])/i);
  const mm = text.match(/(?:tempo\s*:?\s*|in\s+|circa\s+)?(\d{1,3})\s*(?:min|minuti|')(?![a-z])/i);
  if (hm && !/(?:alle|ore)\s*$/i.test(text.slice(0, hm.index))) {
    totalTime = parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
    matches.push(hm[0]);
  } else if (mm) {
    totalTime = parseInt(mm[1], 10);
    matches.push(mm[0]);
  }

  // Porzioni: "per 4 persone", "4 porzioni", "x4"
  let servings: number | undefined;
  const sm = text.match(/(?:per|x)\s*(\d{1,2})(?:\s*(?:persone|porzioni|pers\.?))?(?![\d])/i) || text.match(/(\d{1,2})\s*(?:persone|porzioni)/i);
  if (sm) {
    servings = parseInt(sm[1], 10);
    matches.push(sm[0]);
  }

  // Difficoltà
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  const easy = findWord(text, 'facile|semplice|veloce|velocissima|rapida');
  const hard = findWord(text, 'difficile|complessa|elaborata|impegnativa');
  if (easy) { difficulty = 'easy'; matches.push(easy); }
  if (hard) { difficulty = 'hard'; matches.push(hard); }

  // Procedimento: tutto ciò che segue "procedimento:" / "preparazione:"
  let steps: string | undefined;
  const pm = text.match(/(?:procedimento|preparazione|istruzioni|passaggi)\s*:?\s*([\s\S]+)$/i);
  if (pm) {
    steps = capitalize(pm[1].replace(/(?:link|fonte)\s*:?\s*\S+$/i, '').trim());
    matches.push(pm[0]);
  }

  // Ingredienti: "con guanciale, pecorino e uova" o "ingredienti: pasta, uova"
  let ingredients: string[] | undefined;
  const textNoSteps = pm ? text.slice(0, pm.index) : text;
  const im = textNoSteps.match(new RegExp(`(?:ingredienti\\s*:?|con)\\s+([\\s\\S]+?)${RECIPE_STOP}`, 'i'));
  if (im) {
    const list = im[1]
      .split(/\s*(?:,|;|\n|\se\s|\sed\s)\s*/i)
      .map((s) => s.trim().replace(/^(?:e|ed)\s+/i, ''))
      .filter((s) => s.length > 1 && !/^(?:https?|www\.)/i.test(s));
    if (list.length > 0) {
      ingredients = list;
      matches.push(im[0]);
    }
  }

  return { totalTime, servings, ingredients, difficulty, steps, matches };
}

// ---------------------------------------------------
// PRIORITÀ
// ---------------------------------------------------
const PRIORITY_MARKERS = [
  'il\\s+prima\\s+possibile', 'prima\\s+possibile', 'urgentemente', 'urgente', 'asap', 'subito',
  'importantissim[oa]', 'importante', 'priorit[aà]\\s+alta', 'alta\\s+priorit[aà]',
  'priorit[aà]\\s+bassa', 'bassa\\s+priorit[aà]', 'senza\\s+fretta', 'con\\s+calma',
  'quando\\s+ho\\s+tempo', 'se\\s+riesco', 'prima\\s+o\\s+poi', 'non\\s+urgente', 'da\\s+non\\s+dimenticare',
];

function detectPriority(text: string): Priority {
  if (/\b(?:urgente|subito|emergenza|importantissim[oa]|entro\s+oggi|prima\s+possibile|asap|urgentemente|immediat[oa]|immediatamente|scadenza\s+oggi|critico|gravissimo)\b/i.test(text)
      && !/\bnon\s+urgente\b/i.test(text)) {
    return 'urgent';
  }
  if (/\b(?:importante|priorit[aà]\s+alta|alta\s+priorit[aà]|presto|non\s+dimenticare|da\s+non\s+dimenticare|fondamentale|da\s+non\s+perdere|assolutamente|commercialista|tasse|bollett[ae]|multa|medico|visita|dentista|esame|colloquio|scadenza|riunione\s+importante)\b/i.test(text)) {
    return 'high';
  }
  if (/\b(?:quando\s+(?:ho|hai|puoi)\s+tempo|se\s+riesco|senza\s+fretta|bassa\s+priorit[aà]|priorit[aà]\s+bassa|con\s+calma|prima\s+o\s+poi|opzionale|tempo\s+libero|se\s+avanza\s+tempo|quando\s+capita|non\s+urgente|tranquillo|relax)\b/i.test(text)) {
    return 'low';
  }
  return 'medium';
}

// ---------------------------------------------------
// PULIZIA TITOLO
// ---------------------------------------------------
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEADING_FILLERS = /^\s*(?:allora|ok|ehi|nota|promemoria|ricordami\s+di|ricordati\s+di|ricorda\s+di|devo\s+ricordarmi\s+di|devo|dobbiamo|dovrei|bisogna|da\s+fare|vai\s+a|andare\s+a|sito\s+per|link\s+per|link|sito|voglio\s+comprare|vorrei\s+comprare|vorrei|voglio|da\s+comprare|comprare|acquistare|wishlist\s*:?|prodotto\s*:?|ricetta\s+(?:della|del|dei|delle|di|per)\s+|ricetta\s*:?|idea\s+per|idea\s*:?|pensiero\s*:?)\s+/i;
const TRAILING_PREPS = /[\s,\-:;]+(?:a|ad|da|di|del|della|su|sul|sulla|per|con|e|ed|il|lo|la|le|i|gli|un|una|alle|dalle|ore|entro)?\s*$/i;

function cleanTitle(rawText: string, elementsToRemove: (string | undefined)[]): string {
  let cleaned = ` ${rawText} `;

  // Rimuove prima gli elementi più lunghi (es. "dalle 8 alle 20" prima di "alle")
  const toRemove = elementsToRemove.filter((e): e is string => !!e && e.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  for (const el of toRemove) {
    const escaped = escapeRegex(el.trim());
    // Confini di parola compatibili con lettere accentate
    cleaned = cleaned.replace(new RegExp(`(^|[^${LETTERS}])${escaped}(?![${LETTERS}])`, 'gi'), '$1 ');
  }

  // Rimuove marcatori di priorità ("urgente", "con calma"...) che non devono finire nel titolo
  for (const marker of PRIORITY_MARKERS) {
    cleaned = cleaned.replace(new RegExp(`(^|[^${LETTERS}])${marker}(?![${LETTERS}])`, 'gi'), '$1 ');
  }

  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  // Applica più volte la rimozione dei riempitivi iniziali ("devo ricordarmi di comprare...")
  for (let i = 0; i < 3; i++) cleaned = cleaned.replace(LEADING_FILLERS, '');
  for (let i = 0; i < 3; i++) cleaned = cleaned.replace(TRAILING_PREPS, '');
  cleaned = cleaned.replace(/^[\s,\-:;]+/, '').replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();

  if (!cleaned) return capitalize(rawText);
  return capitalize(cleaned);
}

/** Divide "Titolo, note aggiuntive" in titolo + note */
function splitTitleNotes(title: string): { title: string; notes?: string } {
  const idx = title.search(/\s*(?:,|\s-\s|:)\s*/);
  if (idx > 2) {
    const head = title.slice(0, idx).trim();
    const tail = title.slice(idx).replace(/^\s*(?:,|-|:)\s*/, '').trim();
    if (head.length >= 2 && tail.length >= 2) return { title: capitalize(head), notes: capitalize(tail) };
  }
  return { title };
}

// ---------------------------------------------------
// CLASSIFICAZIONE E FORMATTAZIONE LOCALE
// ---------------------------------------------------
const PRODUCT_KEYWORDS = /\b(?:comprare|comprarmi|acquisto|acquistare|wishlist|amazon|ebay|zalando|prezzo|costa|costo|regalo|regalarmi|desidero)\b/i;
const RECIPE_KEYWORDS = /\b(?:ricetta|ricette|cucinare|ingredienti|porzioni|procedimento|forno|pasta\s+(?:con|al|alla|e)|torta|dolce|risotto|carbonara|amatriciana|pizza|biscotti|lasagn[ae]|tiramis[uù]|zuppa|minestra|vellutata|polpette|frittata|sugo|ragù|ragu|focaccia|plumcake|muffin|crostata)\b/i;
const TASK_KEYWORDS = /\b(?:lavoro|lavorare|turno|palestra|allenamento|chiamare|telefonare|inviare|mandare|pagare|ritirare|portare|prenotare|medico|visita|dentista|studiare|preparare|meeting|riunione|appuntamento|call|esame|consegnare|scadenza|pulire|lavare|sistemare|spesa|aggiustare|controllare|iscriversi|rinnovare|fare)\b/i;

export function formatLocal(text: string): QuickCaptureResult {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const { url, matchText: urlMatch } = extractAndNormalizeUrl(trimmed);
  const { date, matchText: dateMatch } = extractDate(trimmed);
  const { startTime, endTime, matchText: timeMatch } = extractTimes(trimmed);
  const { price, matchText: priceMatch } = extractPrice(trimmed);
  const priority = detectPriority(trimmed);
  const hasWhen = !!date || !!startTime;

  // 1. RICETTA (prima del prodotto: "torta 5 euro" è raro, "ricetta" è esplicito)
  if (RECIPE_KEYWORDS.test(trimmed) && !(PRODUCT_KEYWORDS.test(trimmed) && price !== undefined)) {
    const details = extractRecipeDetails(trimmed);
    // Il titolo è la parte di testo prima del primo dettaglio (ingredienti, tempo, porzioni...)
    const beforeDetails = trimmed.split(new RegExp(`\\s+(?:con|ingredienti|tempo|in\\s+\\d|circa\\s+\\d|per\\s+\\d|x\\s*\\d|\\d+\\s*(?:min|minuti|ore|ora|h|persone|porzioni)|procedimento|preparazione|facile|semplice|veloce|difficile|link|fonte)${NA}`, 'i'))[0];
    let title = cleanTitle(beforeDetails, [urlMatch, 'cucinare', 'come fare', 'da provare']);
    if (!title || title.length < 2) title = cleanTitle(trimmed, [urlMatch, ...details.matches]);

    return {
      type: 'recipe',
      confidence: 0.9,
      raw: trimmed,
      parsed: {
        title,
        totalTime: details.totalTime,
        servings: details.servings,
        ingredients: details.ingredients,
        difficulty: details.difficulty,
        url,
        notes: details.steps,
        priority,
      },
    };
  }

  // 2. PRODOTTO / WISHLIST
  const isProduct =
    (PRODUCT_KEYWORDS.test(trimmed) && (!hasWhen || price !== undefined)) ||
    (price !== undefined && !hasWhen);
  if (isProduct) {
    const { purpose, matchText: purposeMatch } = extractPurpose(trimmed);
    const { store, matchText: storeMatch } = extractStore(trimmed);
    const title = cleanTitle(trimmed, [priceMatch, urlMatch, purposeMatch, storeMatch]);
    const finalUrl = url || (store && STORE_SEARCH[store] ? STORE_SEARCH[store](title) : undefined);

    return {
      type: 'product',
      confidence: 0.9,
      raw: trimmed,
      parsed: {
        title,
        price,
        url: finalUrl,
        purpose,
        priority,
      },
    };
  }

  // 3. LINK / URL
  if (url) {
    const matched = urlMatch || url;
    const urlIndex = trimmed.indexOf(matched);
    let title = urlIndex > 0 ? trimmed.slice(0, urlIndex).trim() : '';
    let notes = urlIndex >= 0 ? trimmed.slice(urlIndex + matched.length).replace(/^[,\-:;\s]+/, '').trim() : '';

    if (!title && notes) {
      const split = splitTitleNotes(notes);
      title = split.title;
      notes = split.notes || '';
    }

    let domainTitle = '';
    try {
      domainTitle = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      domainTitle = url;
    }

    return {
      type: 'url',
      confidence: 0.92,
      raw: trimmed,
      parsed: {
        title: title ? cleanTitle(title, [priceMatch]) : capitalize(domainTitle),
        url,
        notes: notes ? capitalize(notes) : undefined,
        priority,
      },
    };
  }

  // 4. ATTIVITÀ / TASK
  if (hasWhen || TASK_KEYWORDS.test(trimmed)) {
    const cleaned = cleanTitle(trimmed, [timeMatch, dateMatch]);
    const { title, notes } = splitTitleNotes(cleaned);

    return {
      type: 'task',
      confidence: 0.88,
      raw: trimmed,
      parsed: {
        title: title || 'Attività',
        date: date || (startTime ? format(new Date(), 'yyyy-MM-dd') : undefined),
        time: startTime,
        endTime,
        notes,
        priority,
      },
    };
  }

  // 5. IDEA
  if (/\b(?:idea|e\s+se|progetto|pensiero\s+per|spunto|potrei|sarebbe\s+bello)\b/i.test(trimmed)) {
    const cleaned = cleanTitle(trimmed, ['e se', 'pensiero per', 'progetto per']);
    const { title, notes } = splitTitleNotes(cleaned);
    return {
      type: 'idea',
      confidence: 0.8,
      raw: trimmed,
      parsed: { title, notes: notes || capitalize(trimmed), priority },
    };
  }

  // 6. Nota generica (diario)
  const { title } = splitTitleNotes(cleanTitle(trimmed, []));
  return {
    type: 'note',
    confidence: 0.6,
    raw: trimmed,
    parsed: {
      title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
      notes: capitalize(trimmed),
      priority,
    },
  };
}

// ===================================================
// PARSER GEMINI (con Prompt di Formattazione Intelligente)
// ===================================================

const GEMINI_SYSTEM_PROMPT = `Sei un assistente per una app personale su iPhone che formatta e organizza testo in italiano in modo pulito e strutturato.
L'utente scriverà pensieri veloci, ad esempio:
- "voglio comprare cuffie sony a 250 euro su amazon per isolarmi in treno quando lavoro" -> type: "product", title: "Cuffie Sony", price: 250, purpose: "Isolarmi in treno quando lavoro", url: se presente.
- "ricetta carbonara con guanciale uova pecorino tempo 25 min per 4 persone" -> type: "recipe", title: "Carbonara", totalTime: 25, servings: 4, ingredients: ["guanciale", "uova", "pecorino"], difficulty: "medium".
- "domani lavoro dalle 8 alle 20" -> type: "task", title: "Lavoro", date: calcola domani YYYY-MM-DD, time: "08:00", endTime: "20:00".
- "Sito per Render https render.it , aiuta a renderizzare" -> type: "url", title: "Render", url: "https://render.it", notes: "Aiuta a renderizzare".

Campi obbligatori da estrarre:
1. "type": "task" | "url" | "product" | "recipe" | "idea" | "note" | "text"
2. "title": Titolo PULITO, conciso e ordinato (senza date, orari, prezzi, link o parole come "devo", "urgente").
3. Se "product":
   - "price": costo numerico o null
   - "purpose": "A che mi serve" (motivo d'uso o necessità espresso dall'utente) o null
   - "url": link o store se presente
4. Se "recipe":
   - "totalTime": tempo totale in minuti (numero) o null
   - "servings": numero porzioni o null
   - "ingredients": array di stringhe degli ingredienti
   - "difficulty": "easy" | "medium" | "hard"
   - "notes": procedimento se indicato, altrimenti null
5. Se "task":
   - "date": YYYY-MM-DD
   - "time": HH:mm
   - "endTime": HH:mm o null
   - "notes": dettagli aggiuntivi o null (NON ripetere titolo, data o orario)
6. "priority": "urgent" | "high" | "medium" | "low"

Rispondi ESCLUSIVAMENTE con un JSON valido nel formato:
{
  "type": "task|url|product|recipe|idea|note|text",
  "confidence": 0.95,
  "title": "Titolo Pulito",
  "date": "YYYY-MM-DD o null",
  "time": "HH:mm o null",
  "endTime": "HH:mm o null",
  "url": "https://... o null",
  "notes": "Note o null",
  "price": 0 o null,
  "purpose": "A che mi serve o null",
  "totalTime": 25 o null,
  "servings": 4 o null,
  "ingredients": ["ing1", "ing2"],
  "difficulty": "easy|medium|hard",
  "priority": "medium",
  "tags": []
}`;

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const VALID_TYPES: InboxItemType[] = ['task', 'url', 'product', 'recipe', 'idea', 'note', 'text'];

async function geminiClassify(text: string, apiKey: string): Promise<QuickCaptureResult | null> {
  const now = new Date();
  const todayStr = `${format(now, 'yyyy-MM-dd')} (${format(now, 'EEEE', { locale: it })})`;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${GEMINI_SYSTEM_PROMPT}\nOggi è: ${todayStr}.` },
                { text: `Testo da formattare: "${text}"` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!VALID_TYPES.includes(parsed.type)) continue;

      const clean = (v: unknown) => (v === null || v === 'null' || v === '' ? undefined : v);

      return {
        type: parsed.type as InboxItemType,
        confidence: parsed.confidence ?? 0.95,
        raw: text,
        parsed: {
          title: clean(parsed.title) as string | undefined,
          date: clean(parsed.date) as string | undefined,
          time: clean(parsed.time) as string | undefined,
          endTime: clean(parsed.endTime) as string | undefined,
          url: clean(parsed.url) as string | undefined,
          notes: clean(parsed.notes) as string | undefined,
          price: clean(parsed.price) !== undefined ? Number(parsed.price) : undefined,
          purpose: clean(parsed.purpose) as string | undefined,
          totalTime: clean(parsed.totalTime) !== undefined ? Number(parsed.totalTime) : undefined,
          servings: clean(parsed.servings) !== undefined ? Number(parsed.servings) : undefined,
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          difficulty: parsed.difficulty || 'medium',
          priority: parsed.priority || 'medium',
          tags: parsed.tags || [],
          content: text,
        },
      };
    } catch {
      // Prova il prossimo modello
    }
  }

  return null;
}

/**
 * Classificazione con Gemini, completata con i campi del parser locale se l'AI ne ha dimenticato qualcuno.
 * Ritorna null se Gemini non è disponibile o fallisce.
 */
export async function classifyWithGemini(text: string, apiKey: string): Promise<QuickCaptureResult | null> {
  if (!text.trim() || !apiKey || !navigator.onLine) return null;
  const ai = await geminiClassify(text, apiKey);
  if (!ai) return null;

  const local = formatLocal(text);
  if (local.type === ai.type) {
    const merged = { ...ai.parsed } as Record<string, unknown>;
    for (const [k, v] of Object.entries(local.parsed)) {
      const cur = merged[k];
      if ((cur === undefined || (Array.isArray(cur) && cur.length === 0)) && v !== undefined) merged[k] = v;
    }
    return { ...ai, parsed: merged as QuickCaptureResult['parsed'] };
  }
  return ai;
}

export async function classifyInput(
  text: string,
  options: { useGemini: boolean; geminiApiKey?: string }
): Promise<QuickCaptureResult> {
  if (!text.trim()) {
    return {
      type: 'text',
      confidence: 0,
      raw: '',
      parsed: {},
    };
  }

  // 1. Prova prima con Gemini se abilitato e online
  if (options.useGemini && options.geminiApiKey) {
    const aiResult = await classifyWithGemini(text, options.geminiApiKey);
    if (aiResult) return aiResult;
  }

  // 2. Motore locale avanzato (immediato e offline)
  return formatLocal(text);
}
