# AI Storyteller

A **local-first interactive long-form AI storytelling engine** powered by [Grok (xAI)](https://x.ai/api). Not a chatbot — a full story orchestration system with persistent story state, characters, memories, plot threads, and streaming generation.

---

## What It Does

- Create stories with a **story bible**, scene state, timeline, and writing rules
- **Stream AI-generated prose** live in the browser
- Maintain **characters** with personality, state, and relationship tracking
- Store **long-term memories** extracted by AI after each generation (fact, event, relationship types)
- Manage **plot threads** — active, resolved, or dormant
- **Background memory processing** via BullMQ — never blocks your writing flow
- Full-text semantic memory search (pgvector-ready for embedding upgrades)

---

## Story Pacing & Generation Controls

The system provides precise control over how fast the story progresses to prevent the AI from rushing the plot or skipping important emotional beats. You can adjust these settings per-story or override them temporarily on the write page.

### Generation Modes
- **slow_scene (Default):** Focuses on immediate continuation. Strict scene lock. Focuses on dialogue, small physical actions, atmosphere, emotional nuance, and realistic pacing. It does not write an ending for the scene. Recommended temperature: `0.4 to 0.5`. Max tokens: `900 to 1400`.
  - *Why default?* To encourage a "slow-burn" interactive experience where you don't lose control over the characters or get railroaded through major events without your input.
- **balanced:** Moderate progression allowed, but still avoids abrupt jumps. Recommended temperature: `0.55`. Max tokens: `1400 to 2000`.
- **progress_story:** Allows gradual plot progression but respects scene/location limits. Recommended temperature: `0.6`. Max tokens: `1800 to 2600`.
- **cinematic:** Richer descriptions and stronger dramatic framing. Recommended temperature: `0.65`. Max tokens: `1800 to 2600`.

### Scene Lock & Pacing Toggles
- **Lock Current Scene:** Explicitly forbids the AI from resolving the scene, skipping time, or changing locations.
- **Allow Time Skip & Location Change:** By default, these are `false`. If you want the AI to fast-forward to a new location or time, you must toggle these on.
- **Allow Major Plot Progression:** If `false`, the AI is forbidden from escalating stakes, introducing major new characters, or resolving major events unless explicitly requested.

### AI Model Usage
- **Story Generation:** Uses `grok-4-1-fast-non-reasoning` for low-latency streaming and creative prose generation. Applies temperature and max tokens from your settings.
- **Reasoning & Analysis:** Uses `grok-4-1-fast-reasoning` at a very low temperature (`0.15`) for background tasks like memory extraction, summarizing, and updating plot/character states.

### Background Memory Worker Restraints
The background memory worker is strictly instructed to avoid "over-initiative". It will:
- Only describe the **current known situation** in the scene state (no future assumptions).
- Only create new plot threads if the AI clearly introduces an unresolved conflict, mystery, or pending consequence. It will ignore minor atmosphere or casual dialogue.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, Vite, TypeScript, Tailwind CSS, Pinia, Vue Router |
| Backend | Fastify, Node.js, TypeScript |
| AI | Grok (xAI) via OpenAI-compatible SDK |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Logger | Pino (pretty in dev) |

---

## Folder Structure

```
ai_storyteller/
├── package.json            # Workspace root (concurrently scripts)
├── pnpm-workspace.yaml
├── .env.example
├── README.md
├── backend/
│   ├── src/
│   │   ├── config/env.ts           # Zod-validated env
│   │   ├── db/
│   │   │   ├── client.ts           # pg Pool
│   │   │   ├── schema.ts           # TypeScript table types
│   │   │   ├── migrate.ts          # Init script runner
│   │   │   └── sql/init.sql        # CREATE TABLE + extensions
│   │   ├── lib/
│   │   │   ├── logger.ts           # Pino logger
│   │   │   ├── errors.ts           # AppError hierarchy
│   │   │   └── ids.ts              # UUID generation
│   │   ├── providers/grok/
│   │   │   ├── grokClient.ts       # OpenAI client → x.ai/v1
│   │   │   ├── grokText.ts         # Non-streaming text
│   │   │   ├── grokStreaming.ts     # SSE streaming
│   │   │   ├── grokStructured.ts   # JSON schema outputs
│   │   │   └── grokImage.ts        # grok-imagine-image
│   │   ├── modules/
│   │   │   ├── stories/            # CRUD service
│   │   │   ├── messages/           # Message service
│   │   │   ├── characters/         # Character service
│   │   │   ├── memories/           # Memory + FTS search
│   │   │   ├── plotThreads/        # Plot thread service
│   │   │   └── generation/         # Story orchestration engine
│   │   ├── queues/
│   │   │   ├── connection.ts       # Redis singleton (ioredis)
│   │   │   ├── storyQueue.ts       # BullMQ queue definition
│   │   │   └── workers/
│   │   │       └── storyWorker.ts  # Background memory worker
│   │   ├── routes/index.ts         # All API route handlers
│   │   ├── app.ts                  # Fastify app builder
│   │   └── main.ts                 # Entry point
└── webui/
    └── src/
        ├── lib/
        │   ├── api.ts              # Typed API client
        │   ├── stream.ts           # SSE streaming client
        │   └── utils.ts            # Format helpers
        ├── stores/storyStore.ts    # Pinia store
        ├── router/index.ts         # Vue Router
        ├── components/
        │   ├── layout/AppSidebar.vue
        │   └── story/
        │       ├── StoryCard.vue
        │       ├── MessageBubble.vue
        │       └── StorySidebar.vue
        └── pages/
            ├── StoriesPage.vue
            ├── NewStoryPage.vue
            ├── StoryWritePage.vue
            ├── StoryBiblePage.vue
            └── StorySettingsPage.vue
```

---

## Requirements

- **Node.js** >= 20
- **pnpm** >= 9
- **PostgreSQL** running on port 5432 (with pgvector support)
- **Redis** running on port 6379
- **xAI API Key** from [console.x.ai](https://console.x.ai)

---

## Environment Variables

### Backend (`backend/.env`)

Copy from `backend/.env.example`:

```env
NODE_ENV=development
PORT=4000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123
POSTGRES_DB=ai_storytelling
DATABASE_URL=postgresql://admin:admin123@localhost:5432/ai_storytelling

REDIS_HOST=localhost
REDIS_PORT=6379

XAI_API_KEY=xai-your-key-here
```

### WebUI (`webui/.env`)

Copy from `webui/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

---

## Installation & Setup

```bash
# 1. Clone and enter the project
cd ai_storyteller

# 2. Install all dependencies (root + backend + webui)
pnpm install

# 3. Copy and configure backend env
cp backend/.env.example backend/.env
# Edit backend/.env — set XAI_API_KEY

# 4. Copy webui env (defaults are fine for local dev)
cp webui/.env.example webui/.env

# 5. Initialize the database
cd backend
pnpm db:init
cd ..
```

---

## Running

### Start everything together (recommended)

From the root directory:

```bash
pnpm dev
```

This starts three processes concurrently:
- **BACKEND** — Fastify API on `http://localhost:4000`
- **WORKER** — BullMQ story-jobs worker
- **WEBUI** — Vite dev server on `http://localhost:5173`

### Start individually

```bash
# Backend API only
cd backend && pnpm dev

# BullMQ worker only
cd backend && pnpm worker

# WebUI only
cd webui && pnpm dev
```

---

## Database

### Initialize (run once)

```bash
cd backend
pnpm db:init
```

This runs `src/db/sql/init.sql` which:
1. Enables `CREATE EXTENSION IF NOT EXISTS vector` (pgvector)
2. Creates all tables: `stories`, `characters`, `story_messages`, `story_memories`, `plot_threads`, `story_jobs`
3. Creates appropriate indexes (FTS, vector ivfflat, foreign keys)

The script is **idempotent** — safe to run multiple times.

### Schema overview

| Table | Purpose |
|---|---|
| `stories` | Story metadata, system prompt, bible, scene state |
| `characters` | Character profiles and current state |
| `story_messages` | Full message history (user + assistant) |
| `story_memories` | Extracted facts/events, importance score, optional 1536-dim vector |
| `plot_threads` | Named plot threads with status tracking |
| `story_jobs` | Optional job audit table |

---

## Redis & BullMQ

Redis is used as the BullMQ broker. Queue name: `story-jobs`.

**Job: `process-story-memory`**

Triggered automatically after every story generation. The worker:
1. Sends the user+assistant exchange to Grok (reasoning model) for structured analysis
2. Extracts important memories and saves them to `story_memories`
3. Updates `current_scene_state` on the story if it changed
4. Updates character `current_state` for characters that changed
5. Updates plot thread status/progress if threads advanced

The user-facing stream completes **before** this job runs — background processing never blocks writing.

---

## pgvector & Semantic Memory

The `story_memories` table has an `embedding VECTOR(1536)` column ready for semantic search.

**Current mode:** PostgreSQL full-text search (FTS) via `to_tsvector('simple', content)` — works out of the box with no embedding provider.

**To enable true semantic search:**
1. Add an embedding provider (e.g., OpenAI `text-embedding-3-small`, or a local model)
2. Generate embeddings when creating memories in `memoriesService.ts`
3. Replace the `searchMemoriesByText()` function with a cosine similarity query:
   ```sql
   SELECT * FROM story_memories
   WHERE story_id = $1
   ORDER BY embedding <=> $2::vector
   LIMIT $3
   ```

The schema and index (`ivfflat`) are already in place.

---

## Grok AI Models

| Model | Used for |
|---|---|
| `grok-4-1-fast-non-reasoning` | Story prose generation (streaming), fast user-facing responses, lightweight rewriting |
| `grok-4-1-fast-reasoning` | Structured memory extraction, scene state analysis, plot continuity, character state updates |
| `grok-imagine-image` | Story cover / scene / character image generation |

### Provider abstraction

The Grok provider lives in `backend/src/providers/grok/`. To add OpenAI or Anthropic later:
1. Create `backend/src/providers/openai/` with the same interface
2. Update `generationService.ts` to select the provider via config

---

## Streaming

Story generation uses **Server-Sent Events (SSE)**:

1. Frontend POSTs to `POST /api/stories/:storyId/generate/stream`
2. Backend sets `Content-Type: text/event-stream` and starts streaming chunks:
   ```
   data: {"chunk": "Langit "}\n\n
   data: {"chunk": "malam "}\n\n
   data: [DONE]\n\n
   ```
3. Frontend reads via `fetch` + `ReadableStream` in `src/lib/stream.ts`
4. Text appears live in the prose area as it's generated

After the stream ends, messages are saved to the database and a BullMQ job is queued.

Non-streaming fallback is available at `POST /api/stories/:storyId/generate`.

---

## Main API Endpoints

```
GET  /health

GET  /api/stories
POST /api/stories
GET  /api/stories/:storyId
PATCH /api/stories/:storyId
DELETE /api/stories/:storyId

GET  /api/stories/:storyId/messages
POST /api/stories/:storyId/messages
POST /api/stories/:storyId/generate
POST /api/stories/:storyId/generate/stream

GET  /api/stories/:storyId/characters
POST /api/stories/:storyId/characters
PATCH /api/characters/:characterId
DELETE /api/characters/:characterId

GET  /api/stories/:storyId/memories
POST /api/stories/:storyId/memories
DELETE /api/memories/:memoryId

GET  /api/stories/:storyId/plot-threads
POST /api/stories/:storyId/plot-threads
PATCH /api/plot-threads/:plotThreadId
DELETE /api/plot-threads/:plotThreadId

POST /api/stories/:storyId/jobs/summarize
POST /api/stories/:storyId/images/generate
```

---

## Troubleshooting (WSL + Docker Desktop Windows)

### PostgreSQL not reachable from WSL

Docker Desktop on Windows exposes PostgreSQL at `localhost` via port forwarding. From WSL2, `localhost` should work, but if not:

```bash
# Find the Windows host IP from WSL
cat /etc/resolv.conf | grep nameserver
# Use that IP as POSTGRES_HOST in backend/.env
```

Or ensure **"Expose daemon on tcp://localhost:2375 without TLS"** is enabled in Docker Desktop settings.

### Redis not reachable from WSL

Same pattern — `localhost` works via Docker Desktop port forwarding. If not, try `host.docker.internal` or the nameserver IP.

### pgvector extension not available

If `pnpm db:init` fails with `extension "vector" does not exist`:

1. Make sure you're using the `pgvector/pgvector:pg16` Docker image (or similar with pgvector built in)
2. Or manually install pgvector into your PostgreSQL container:
   ```bash
   docker exec -it <container> bash
   apt-get install postgresql-16-pgvector
   ```
3. If pgvector is unavailable, the app still works using FTS-only memory search — remove the `embedding VECTOR(1536)` column and the vector index line from `init.sql`.

### Port already in use

```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### XAI_API_KEY not set

The backend will exit at startup with a clear error:
```
❌ Invalid environment variables: { XAI_API_KEY: [ ... ] }
```
Set `XAI_API_KEY=xai-...` in `backend/.env`.

---

## Notes

- No authentication — this is a local-only development tool
- All data is stored locally in PostgreSQL
- The BullMQ worker must be running for memory extraction to work (started by `pnpm dev` root command)
- Story generation will work without the worker — memories just won't be extracted until it's running
- Image generation is optional — requires `XAI_API_KEY` and calls `grok-imagine-image`
- Default story language is Indonesian (`id`) — change per story or via system prompt
