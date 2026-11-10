// ===================================================
// TIPI GLOBALI — Personal Life Hub
// ===================================================

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

// ---------------------------------------------------
// BASE ENTITY (tutti gli elementi condividono questi campi)
// ---------------------------------------------------
export interface BaseEntity {
  localId?: number;          // IndexedDB auto-increment (solo locale)
  id: string;                // UUID stabile generato lato client
  userId: string;
  createdAt: string;         // ISO string
  updatedAt: string;         // ISO string
  deletedAt?: string;        // soft delete
  syncStatus: SyncStatus;
  version: number;
}

// ---------------------------------------------------
// TASK
// ---------------------------------------------------
export interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;          // ogni N giorni/settimane/mesi
  daysOfWeek?: number[];     // 0=Dom, 1=Lun, ...
  endDate?: string;
  maxOccurrences?: number;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;          // 'YYYY-MM-DD'
  dueTime?: string;          // 'HH:mm' (orario di inizio)
  endTime?: string;          // 'HH:mm' (orario di fine, es. "dalle 8 alle 20")
  duration?: number;         // minuti
  category?: string;
  tags?: string[];
  recurrence?: Recurrence;
  templateId?: string;
  reminderAt?: string;       // ISO string
  completedAt?: string;
  isAllDay?: boolean;
  parentId?: string;         // per sotto-attività
  sortOrder?: number;
}

// ---------------------------------------------------
// TEMPLATE
// ---------------------------------------------------
export interface TemplateTask {
  title: string;
  description?: string;
  priority: Priority;
  duration?: number;
  category?: string;
  offsetDays?: number;       // giorni dall'inizio del template
  offsetTime?: string;
}

export interface Template extends BaseEntity {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  tasks: TemplateTask[];
  category?: string;
  usageCount: number;
  lastUsedAt?: string;
}

// ---------------------------------------------------
// EVENTO CALENDARIO
// ---------------------------------------------------
export interface CalendarEvent extends BaseEntity {
  title: string;
  description?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  isAllDay: boolean;
  color?: string;
  taskId?: string;           // collegato a un'attività
  recurrence?: Recurrence;
  location?: string;
}

// ---------------------------------------------------
// WISHLIST
// ---------------------------------------------------
export type WishlistItemStatus = 'want' | 'maybe' | 'bought' | 'skipped';

export interface WishlistItem extends BaseEntity {
  name: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  desiredPrice?: number;
  category?: string;
  priority: Priority;
  status: WishlistItemStatus;
  tags?: string[];
  notes?: string;
  isFavorite: boolean;
  boughtAt?: string;
  boughtPrice?: number;
  reminderAt?: string;
}

// ---------------------------------------------------
// LINK SALVATI
// ---------------------------------------------------
export type LinkCategory = 'article' | 'video' | 'tool' | 'reference' | 'entertainment' | 'shopping' | 'other';

export interface SavedLink extends BaseEntity {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
  category: LinkCategory;
  tags?: string[];
  notes?: string;
  isFavorite: boolean;
  isArchived: boolean;
  readAt?: string;
  favicon?: string;
}

// ---------------------------------------------------
// RICETTE
// ---------------------------------------------------
export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface RecipeStep {
  stepNumber: number;
  description: string;
  duration?: number;         // minuti
  imageUrl?: string;
}

export type RecipeStatus = 'want_to_try' | 'tried' | 'favorite';
export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export interface Recipe extends BaseEntity {
  title: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  cuisine?: string;
  difficulty: RecipeDifficulty;
  servings: number;
  prepTime?: number;         // minuti
  cookTime?: number;
  totalTime?: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  tags?: string[];
  status: RecipeStatus;
  rating?: number;           // 1-5
  notes?: string;
  sourceUrl?: string;
  isFavorite: boolean;
  lastCookedAt?: string;
  nutritionInfo?: Record<string, string>;
}

// ---------------------------------------------------
// DIARIO
// ---------------------------------------------------
export interface DiaryEntry extends BaseEntity {
  title?: string;
  content: string;
  date: string;              // 'YYYY-MM-DD'
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  tags?: string[];
  isFavorite: boolean;
  isPrivate: boolean;
  attachments?: string[];
}

// ---------------------------------------------------
// IDEE
// ---------------------------------------------------
export interface Idea extends BaseEntity {
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  isFavorite: boolean;
  status: 'raw' | 'developing' | 'ready' | 'implemented' | 'discarded';
  priority: Priority;
  relatedTaskId?: string;
}

// ---------------------------------------------------
// INBOX
// ---------------------------------------------------
export type InboxItemType = 'text' | 'url' | 'task' | 'product' | 'recipe' | 'idea' | 'note';

export interface InboxItem extends BaseEntity {
  content: string;
  type: InboxItemType;
  url?: string;
  isProcessed: boolean;
  convertedTo?: { type: string; id: string };
  metadata?: Record<string, string>;
}

// ---------------------------------------------------
// QUICK CAPTURE
// ---------------------------------------------------
export interface QuickCaptureResult {
  type: InboxItemType;
  confidence: number;        // 0-1
  parsed: {
    title?: string;
    content?: string;
    url?: string;
    date?: string;
    time?: string;
    endTime?: string;
    notes?: string;
    price?: number;
    category?: string;
    priority?: Priority;
    tags?: string[];
    // Campi specifici Ricette
    servings?: number;
    totalTime?: number;
    ingredients?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
    // Campi specifici Wishlist
    purpose?: string; // "A che mi serve"
  };
  raw: string;
}

// ---------------------------------------------------
// SYNC
// ---------------------------------------------------
export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncEntityType = 'task' | 'template' | 'event' | 'wishlistItem' | 'savedLink' | 'recipe' | 'diaryEntry' | 'idea' | 'inboxItem';

export interface SyncQueueItem {
  id?: number;               // auto-increment locale
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  idempotencyKey: string;    // entityId + operation + timestamp
}

// ---------------------------------------------------
// APP STATE
// ---------------------------------------------------
export type AppTheme = 'dark' | 'light' | 'system';
export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

export interface AppSettings {
  theme: AppTheme;
  language: 'it' | 'en';
  enableNotifications: boolean;
  enableGemini: boolean;
  geminiApiKey?: string;
  defaultView: 'dashboard' | 'tasks' | 'calendar';
  dashboardWidgets: DashboardWidget[];
  firstDayOfWeek: 0 | 1;    // 0=Dom, 1=Lun
}

export interface DashboardWidget {
  id: string;
  type: 'today_tasks' | 'next_event' | 'overdue' | 'progress' | 'wishlist' | 'links' | 'favorite_recipes' | 'diary' | 'ideas' | 'inbox';
  title: string;
  isVisible: boolean;
  sortOrder: number;
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'today_tasks',      type: 'today_tasks',      title: 'Attività di oggi',    isVisible: true,  sortOrder: 0 },
  { id: 'progress',         type: 'progress',         title: 'Avanzamento',         isVisible: true,  sortOrder: 1 },
  { id: 'next_event',       type: 'next_event',       title: 'Prossimo impegno',    isVisible: true,  sortOrder: 2 },
  { id: 'overdue',          type: 'overdue',          title: 'In ritardo',          isVisible: true,  sortOrder: 3 },
  { id: 'inbox',            type: 'inbox',            title: 'Inbox',               isVisible: true,  sortOrder: 4 },
  { id: 'wishlist',         type: 'wishlist',         title: 'Wishlist',            isVisible: true,  sortOrder: 5 },
  { id: 'diary',            type: 'diary',            title: 'Note recenti',        isVisible: false, sortOrder: 6 },
  { id: 'ideas',            type: 'ideas',            title: 'Idee',                isVisible: false, sortOrder: 7 },
  { id: 'favorite_recipes', type: 'favorite_recipes', title: 'Ricette preferite',   isVisible: false, sortOrder: 8 },
  { id: 'links',            type: 'links',            title: 'Link salvati',        isVisible: false, sortOrder: 9 },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'it',
  enableNotifications: false,
  enableGemini: false,
  defaultView: 'dashboard',
  dashboardWidgets: DEFAULT_WIDGETS,
  firstDayOfWeek: 1,
};
