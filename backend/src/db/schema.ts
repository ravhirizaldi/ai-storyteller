/** TypeScript type definitions for all database tables */

export interface Story {
  id: string;
  title: string;
  genre: string | null;
  language: string;
  system_prompt: string | null;
  style_prompt: string | null;
  story_bible: string | null;
  current_scene_state: string | null;
  current_timeline_state: string | null;
  generation_mode: string;
  temperature: number;
  max_output_tokens: number;
  scene_lock: boolean;
  allow_time_skip: boolean;
  allow_location_change: boolean;
  allow_major_plot_progress: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Character {
  id: string;
  story_id: string;
  name: string;
  role: string | null;
  description: string | null;
  personality: string | null;
  relationship_notes: string | null;
  current_state: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StoryMessage {
  id: string;
  story_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  token_count: number | null;
  created_at: Date;
}

export interface StoryMemory {
  id: string;
  story_id: string;
  type: string;
  content: string;
  /** pgvector embedding stored as array */
  embedding: number[] | null;
  importance: number;
  source_message_id: string | null;
  /** If true, the memory is always surfaced into the prompt regardless
   *  of importance/recency. Controlled from the sidebar's pin toggle. */
  is_pinned: boolean;
  created_at: Date;
}

export interface PlotThread {
  id: string;
  story_id: string;
  title: string;
  status: 'active' | 'resolved' | 'dormant';
  content: string | null;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StoryJob {
  id: string;
  story_id: string;
  type: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
