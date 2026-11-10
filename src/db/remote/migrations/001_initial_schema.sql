-- ===================================================
-- Personal Life Hub — Supabase SQL Migrations
-- Esegui questo script nel SQL Editor di Supabase
-- ===================================================

-- Estensione per UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------
-- Funzione helper per updated_at automatico
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------
-- TASKS
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,
  sync_status  TEXT NOT NULL DEFAULT 'synced',

  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date     DATE,
  due_time     TEXT,
  duration     INTEGER,
  category     TEXT,
  tags         TEXT[] DEFAULT '{}',
  recurrence   JSONB,
  template_id  UUID,
  reminder_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  is_all_day   BOOLEAN DEFAULT FALSE,
  parent_id    UUID,
  sort_order   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_deleted_at_idx ON tasks(deleted_at);

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_own" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- TEMPLATES
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,

  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT,
  color        TEXT,
  tasks        JSONB NOT NULL DEFAULT '[]',
  category     TEXT,
  usage_count  INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_own" ON templates USING (auth.uid() = user_id);
CREATE POLICY "templates_insert_own" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update_own" ON templates FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- EVENTS (Calendario)
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,

  title        TEXT NOT NULL,
  description  TEXT,
  start_date   DATE NOT NULL,
  start_time   TEXT,
  end_date     DATE,
  end_time     TEXT,
  is_all_day   BOOLEAN DEFAULT FALSE,
  color        TEXT,
  task_id      UUID,
  recurrence   JSONB,
  location     TEXT
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_own" ON events USING (auth.uid() = user_id);
CREATE POLICY "events_insert_own" ON events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_update_own" ON events FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- WISHLIST
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  version        INTEGER NOT NULL DEFAULT 1,

  name           TEXT NOT NULL,
  description    TEXT,
  url            TEXT,
  image_url      TEXT,
  price          DECIMAL(10,2),
  currency       TEXT DEFAULT 'EUR',
  desired_price  DECIMAL(10,2),
  category       TEXT,
  priority       TEXT NOT NULL DEFAULT 'medium',
  status         TEXT NOT NULL DEFAULT 'want',
  tags           TEXT[] DEFAULT '{}',
  notes          TEXT,
  is_favorite    BOOLEAN DEFAULT FALSE,
  bought_at      TIMESTAMPTZ,
  bought_price   DECIMAL(10,2),
  reminder_at    TIMESTAMPTZ
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_own" ON wishlist_items USING (auth.uid() = user_id);
CREATE POLICY "wishlist_insert_own" ON wishlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlist_update_own" ON wishlist_items FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- SAVED LINKS
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,

  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT,
  domain       TEXT,
  category     TEXT NOT NULL DEFAULT 'other',
  tags         TEXT[] DEFAULT '{}',
  notes        TEXT,
  is_favorite  BOOLEAN DEFAULT FALSE,
  is_archived  BOOLEAN DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  favicon      TEXT
);

ALTER TABLE saved_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links_own" ON saved_links USING (auth.uid() = user_id);
CREATE POLICY "links_insert_own" ON saved_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "links_update_own" ON saved_links FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- RECIPES
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  version        INTEGER NOT NULL DEFAULT 1,

  title          TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  category       TEXT,
  cuisine        TEXT,
  difficulty     TEXT NOT NULL DEFAULT 'medium',
  servings       INTEGER NOT NULL DEFAULT 4,
  prep_time      INTEGER,
  cook_time      INTEGER,
  total_time     INTEGER,
  ingredients    JSONB NOT NULL DEFAULT '[]',
  steps          JSONB NOT NULL DEFAULT '[]',
  tags           TEXT[] DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'want_to_try',
  rating         INTEGER,
  notes          TEXT,
  source_url     TEXT,
  is_favorite    BOOLEAN DEFAULT FALSE,
  last_cooked_at TIMESTAMPTZ,
  nutrition_info JSONB
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_own" ON recipes USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert_own" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update_own" ON recipes FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- DIARY ENTRIES
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,

  title        TEXT,
  content      TEXT NOT NULL,
  date         DATE NOT NULL,
  mood         TEXT,
  tags         TEXT[] DEFAULT '{}',
  is_favorite  BOOLEAN DEFAULT FALSE,
  is_private   BOOLEAN DEFAULT TRUE,
  attachments  TEXT[] DEFAULT '{}'
);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_own" ON diary_entries USING (auth.uid() = user_id);
CREATE POLICY "diary_insert_own" ON diary_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diary_update_own" ON diary_entries FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- IDEAS
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ideas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,

  title           TEXT NOT NULL,
  content         TEXT,
  category        TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_favorite     BOOLEAN DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'raw',
  priority        TEXT NOT NULL DEFAULT 'medium',
  related_task_id UUID
);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideas_own" ON ideas USING (auth.uid() = user_id);
CREATE POLICY "ideas_insert_own" ON ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ideas_update_own" ON ideas FOR UPDATE USING (auth.uid() = user_id);

-- ---------------------------------------------------
-- INBOX
-- ---------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  version       INTEGER NOT NULL DEFAULT 1,

  content       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text',
  url           TEXT,
  is_processed  BOOLEAN DEFAULT FALSE,
  converted_to  JSONB,
  metadata      JSONB
);

ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_own" ON inbox_items USING (auth.uid() = user_id);
CREATE POLICY "inbox_insert_own" ON inbox_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inbox_update_own" ON inbox_items FOR UPDATE USING (auth.uid() = user_id);
