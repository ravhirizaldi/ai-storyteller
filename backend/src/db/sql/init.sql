-- AI Storyteller Database Initialization
-- Run this once before starting the application: pnpm db:init

-- Enable pgvector extension for semantic memory search
-- (Commented out to run without pgvector using FTS fallback)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------
-- STORIES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS stories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  genre                 TEXT,
  language              TEXT NOT NULL DEFAULT 'id',
  system_prompt         TEXT,
  style_prompt          TEXT,
  story_bible           TEXT,
  current_scene_state   TEXT,
  current_timeline_state TEXT,
  generation_mode       TEXT NOT NULL DEFAULT 'slow_scene',
  temperature           NUMERIC NOT NULL DEFAULT 0.45,
  max_output_tokens     INTEGER NOT NULL DEFAULT 1200,
  scene_lock            BOOLEAN NOT NULL DEFAULT true,
  allow_time_skip       BOOLEAN NOT NULL DEFAULT false,
  allow_location_change BOOLEAN NOT NULL DEFAULT false,
  allow_major_plot_progress BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safely add new columns to existing tables
ALTER TABLE stories ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'slow_scene';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS temperature NUMERIC NOT NULL DEFAULT 0.45;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS scene_lock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS allow_time_skip BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS allow_location_change BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS allow_major_plot_progress BOOLEAN NOT NULL DEFAULT false;

-- Context compaction: when the chat grows past the budget, everything older
-- than summarized_up_to_created_at is replaced in the prompt by story_summary.
-- The original messages are NEVER deleted — they stay visible in the UI.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_summary TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS summarized_up_to_created_at TIMESTAMPTZ;

-- -----------------------------------------------
-- CHARACTERS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS characters (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  role                  TEXT,
  description           TEXT,
  personality           TEXT,
  relationship_notes    TEXT,
  current_state         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_story_id ON characters(story_id);

-- -----------------------------------------------
-- STORY MESSAGES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS story_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content               TEXT NOT NULL,
  token_count           INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_messages_story_id ON story_messages(story_id);
CREATE INDEX IF NOT EXISTS idx_story_messages_created_at ON story_messages(story_id, created_at DESC);

-- -----------------------------------------------
-- STORY MEMORIES (FTS Mode Fallback)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS story_memories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL,
  content               TEXT NOT NULL,
  importance            INTEGER NOT NULL DEFAULT 1,
  source_message_id     UUID REFERENCES story_messages(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive column: pinned memories are always surfaced into the prompt
-- regardless of importance or recency. Uses IF NOT EXISTS so this is a
-- no-op on databases that already have the column.
ALTER TABLE story_memories
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_story_memories_story_id ON story_memories(story_id);

-- Full-text search index on memory content
CREATE INDEX IF NOT EXISTS idx_story_memories_content_fts
  ON story_memories USING GIN (to_tsvector('simple', content));

-- -----------------------------------------------
-- PLOT THREADS
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS plot_threads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dormant')),
  content               TEXT,
  last_seen_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plot_threads_story_id ON plot_threads(story_id);

-- -----------------------------------------------
-- STORY JOBS (optional job tracking table)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS story_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id              UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_jobs_story_id ON story_jobs(story_id);
