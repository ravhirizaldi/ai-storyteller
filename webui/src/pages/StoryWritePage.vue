<template>
  <div class="flex flex-1 overflow-hidden relative">
    <!-- Main writing area -->
    <div class="flex flex-col flex-1 overflow-hidden min-w-0">
      <!-- Header -->
      <div
        class="bg-white border-b border-ink-100 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 gap-2 dark:bg-ink-900 dark:border-ink-800"
      >
        <div class="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <RouterLink
            to="/"
            class="btn-ghost btn-sm p-1.5"
            title="Kembali ke daftar cerita"
          >
            <ArrowLeft class="w-4 h-4" />
          </RouterLink>
          <div class="min-w-0 flex-1">
            <h1
              class="font-semibold text-ink-900 text-sm truncate dark:text-ink-100"
            >
              {{ currentStory?.title ?? "Memuat..." }}
            </h1>
            <div class="flex items-center gap-2">
              <span
                v-if="currentStory?.genre"
                class="text-xs text-ink-400 truncate"
                >{{ currentStory.genre }}</span
              >
              <span
                v-if="currentStory?.language"
                class="text-xs text-ink-300 hidden sm:inline"
                >·</span
              >
              <span
                v-if="currentStory?.language"
                class="text-xs text-ink-400 hidden sm:inline"
                >{{ languageLabel(currentStory.language) }}</span
              >
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          <RouterLink
            :to="`/stories/${storyId}/bible`"
            class="btn-secondary btn-sm hidden sm:inline-flex"
          >
            <BookMarked class="w-3.5 h-3.5" /> Bible
          </RouterLink>
          <button
            class="btn-ghost btn-sm p-2"
            :title="theme === 'dark' ? 'Mode terang' : 'Mode gelap'"
            @click="toggleTheme"
          >
            <Sun v-if="theme === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
          <RouterLink
            :to="`/stories/${storyId}/settings`"
            class="btn-ghost btn-sm p-2"
            title="Pengaturan cerita"
          >
            <Settings class="w-4 h-4" />
          </RouterLink>
          <button
            class="btn-ghost btn-sm p-2 xl:hidden"
            @click="sidebarOpen = !sidebarOpen"
            :title="sidebarOpen ? 'Tutup panel' : 'Buka panel'"
          >
            <PanelRightClose v-if="sidebarOpen" class="w-4 h-4" />
            <PanelRightOpen v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Messages area -->
      <div
        class="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative messages-scroll"
        ref="scrollEl"
        @scroll="handleScroll"
      >
        <div v-if="loadingMessages" class="flex justify-center py-12">
          <div class="spinner w-6 h-6" />
        </div>

        <div
          v-else-if="displayMessages.length === 0 && !streamingText"
          class="flex flex-col items-center justify-center h-full gap-4 text-center py-12 max-w-md mx-auto"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-parchment-200 flex items-center justify-center dark:bg-ink-800"
          >
            <Feather class="w-8 h-8 text-ink-400" />
          </div>
          <div>
            <p
              class="font-semibold text-ink-800 text-lg dark:text-ink-100"
            >
              Mulai ceritamu
            </p>
            <p class="text-sm text-ink-500 mt-1.5 leading-relaxed dark:text-ink-400">
              Tulis arahan di bawah untuk menghasilkan adegan pembuka. Coba
              sesuatu seperti
              <em class="italic"
                >"Lanjutkan dari perspektif Aria saat ia membuka pintu"</em
              >.
            </p>
          </div>
        </div>

        <div v-else class="max-w-3xl mx-auto w-full">
          <div v-if="loadingOlder" class="flex justify-center py-4">
            <div class="spinner w-5 h-5 text-ink-300" />
          </div>
          <MessageBubble
            v-for="msg in displayMessages"
            :key="msg.id"
            :message="msg"
            :can-delete="!isGenerating && !msg.id.startsWith('temp-')"
            @edit="onEditMessage"
            @delete="onDeleteMessage"
          />
        </div>

        <!-- Streaming placeholder -->
        <div
          v-if="streamingText"
          class="flex gap-3 mb-6 max-w-3xl mx-auto w-full"
        >
          <div
            class="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-xs font-semibold text-parchment-50 mt-1 flex-shrink-0 dark:bg-ink-100 dark:text-ink-900"
          >
            AI
          </div>
          <div class="flex-1 min-w-0">
            <div
              class="bg-white border border-ink-100 rounded-2xl rounded-tl-sm px-4 py-3 dark:bg-ink-900/60 dark:border-ink-800"
            >
              <div
                class="prose-story text-[15px] whitespace-pre-wrap streaming-cursor"
                v-html="renderedStreamingText"
              />
            </div>
          </div>
        </div>

        <!-- Jump-to-bottom button -->
        <button
          v-if="showJumpToBottom"
          class="sticky bottom-3 float-right mr-2 bg-ink-800 text-parchment-50 rounded-full shadow-lg p-2 hover:bg-ink-900 transition-colors"
          @click="() => scrollToBottom(true)"
          title="Loncat ke pesan terbaru"
        >
          <ArrowDown class="w-4 h-4" />
        </button>
      </div>

      <!-- Error banner -->
      <div
        v-if="genError"
        class="mx-4 md:mx-6 mb-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2"
      >
        <AlertCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
        <p class="text-sm text-red-700 flex-1">{{ genError }}</p>
        <button
          v-if="lastUserMessage"
          class="text-xs text-red-700 hover:text-red-900 font-medium whitespace-nowrap"
          @click="retryLast"
        >
          Coba lagi
        </button>
        <button
          class="text-red-500 hover:text-red-700"
          @click="genError = null"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Input area -->
      <div
        class="bg-gradient-to-b from-transparent to-parchment-50/60 px-3 md:px-6 pt-2 pb-3 md:pb-4 flex-shrink-0 dark:to-ink-950/70"
      >
        <div class="max-w-3xl mx-auto">
          <!-- Composer card: toolbar + textarea + footer inside one rounded shell -->
          <div class="composer overflow-hidden">
            <!-- Top toolbar: mode / scene-lock / temp / regen -->
            <div
              class="flex items-center justify-between gap-2 flex-wrap px-3 pt-2.5 pb-2 border-b border-ink-100/60 dark:border-ink-800/70"
            >
              <div class="flex items-center gap-2 flex-wrap min-w-0">
                <div class="relative" :title="modeDescription">
                  <select
                    v-model="overrideMode"
                    class="chip chip-neutral pr-7 pl-3 cursor-pointer appearance-none bg-no-repeat"
                    style="
                      background-image: url(&quot;data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22 viewBox=%220 0 10 6%22><path fill=%22none%22 stroke=%22%23525252%22 stroke-width=%221.4%22 d=%22M1 1l4 4 4-4%22/></svg>&quot;);
                      background-position: right 0.65rem center;
                      background-size: 9px 5px;
                    "
                  >
                    <option value="slow_scene">Slow Scene</option>
                    <option value="balanced">Balanced</option>
                    <option value="progress_story">Progress</option>
                    <option value="cinematic">Cinematic</option>
                  </select>
                </div>
                <button
                  type="button"
                  :class="overrideSceneLock ? 'chip-active' : 'chip-neutral'"
                  :title="
                    overrideSceneLock
                      ? 'Scene lock aktif: AI tetap di adegan ini'
                      : 'Scene lock nonaktif: AI bisa pindah adegan'
                  "
                  @click="overrideSceneLock = !overrideSceneLock"
                >
                  <Lock v-if="overrideSceneLock" class="w-3 h-3" />
                  <LockOpen v-else class="w-3 h-3" />
                  <span>Scene</span>
                </button>
                <span
                  class="chip chip-neutral hidden sm:inline-flex"
                  title="Temperature generasi (dari setting cerita)"
                >
                  <Thermometer class="w-3 h-3" />
                  {{ overrideTemp.toFixed(2) }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="canRegenerate && !isGenerating"
                  type="button"
                  class="chip chip-neutral"
                  @click="regenerateLast"
                  title="Regenerasi respons AI terakhir"
                >
                  <RotateCcw class="w-3 h-3" />
                  <span>Regen</span>
                </button>
              </div>
            </div>

            <!-- Textarea row -->
            <div class="flex gap-2 md:gap-3 items-end px-3 pt-2.5 pb-2.5">
              <textarea
                v-model="userInput"
                class="flex-1 min-h-[44px] max-h-[40vh] resize-none bg-transparent border-0 outline-none focus:ring-0 px-1 py-1 text-[15px] leading-[1.55] text-ink-900 placeholder:text-ink-400 dark:text-ink-100 dark:placeholder:text-ink-500"
                :placeholder="inputPlaceholder"
                :disabled="isGenerating"
                @keydown="onKeydown"
                @input="autoResize"
                ref="inputEl"
                id="story-input"
                rows="1"
              />
              <button
                v-if="!isGenerating"
                class="icon-btn-primary flex-shrink-0"
                @click="generate"
                :disabled="!userInput.trim()"
                id="btn-generate"
                title="Kirim (Enter)"
              >
                <Send class="w-4 h-4" />
              </button>
              <button
                v-else
                class="icon-btn-danger flex-shrink-0 animate-pulse"
                @click="stopGeneration"
                id="btn-stop"
                title="Hentikan generasi"
              >
                <Square class="w-3.5 h-3.5 fill-current" />
              </button>
            </div>

            <!-- Footer: hint + counter -->
            <div
              class="flex items-center justify-between gap-2 px-3 pb-2 text-[11px] text-ink-400 dark:text-ink-500"
            >
              <p class="flex items-center gap-1.5 truncate">
                <Zap class="w-3 h-3 flex-shrink-0" />
                <span class="truncate">
                  <kbd
                    class="px-1 py-0.5 rounded border border-ink-200 bg-parchment-50 text-[10px] text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400"
                    >Enter</kbd
                  >
                  kirim ·
                  <kbd
                    class="px-1 py-0.5 rounded border border-ink-200 bg-parchment-50 text-[10px] text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400"
                    >Shift+Enter</kbd
                  >
                  baris baru
                </span>
              </p>
              <p
                v-if="userInput.length > 0"
                class="flex-shrink-0 tabular-nums"
                :class="
                  userInput.trim().length > 1500
                    ? 'text-amber-600'
                    : 'text-ink-400'
                "
              >
                {{ userInput.trim().length }} karakter
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right sidebar (fixed on desktop, animated drawer on smaller screens) -->
    <aside
      class="border-l border-ink-100 bg-white flex-shrink-0 overflow-hidden flex-col z-20 w-72 xl:static xl:flex xl:translate-x-0 xl:shadow-none fixed right-0 top-0 bottom-0 sidebar-drawer flex dark:bg-ink-900 dark:border-ink-800"
      :class="[
        sidebarOpen
          ? 'translate-x-0 shadow-2xl xl:shadow-none'
          : 'translate-x-full xl:translate-x-0',
      ]"
      :aria-hidden="!sidebarOpen && !isXl"
    >
      <div class="w-full h-full flex flex-col sidebar-drawer-content">
        <StorySidebar :story-id="storyId" :story="currentStory" />
      </div>
    </aside>
    <!-- Mobile backdrop with fade transition -->
    <transition
      enter-active-class="sidebar-backdrop"
      leave-active-class="sidebar-backdrop"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 bg-black/40 xl:hidden z-10"
        @click="sidebarOpen = false"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
  watch,
} from "vue";
import { useRoute, RouterLink } from "vue-router";
import {
  ArrowLeft,
  BookMarked,
  Settings,
  Feather,
  Send,
  AlertCircle,
  X,
  Zap,
  Square,
  RotateCcw,
  ArrowDown,
  PanelRightClose,
  PanelRightOpen,
  Lock,
  LockOpen,
  Thermometer,
  Sun,
  Moon,
} from "lucide-vue-next";
import { useTheme } from "../composables/useTheme";
import { useStoryStore } from "../stores/storyStore";
import MessageBubble from "../components/story/MessageBubble.vue";
import StorySidebar from "../components/story/StorySidebar.vue";
import { streamStoryGeneration } from "../lib/stream";
import { languageLabel } from "../lib/utils";
import { messagesApi } from "../lib/api";
import type { StoryMessage } from "../lib/api";
import { renderInlineMarkdown } from "../lib/inlineMarkdown";

const route = useRoute();
const store = useStoryStore();
const { theme, toggle: toggleTheme } = useTheme();

const storyId = computed(() => route.params.storyId as string);
const currentStory = computed(() => store.currentStory);

// Local list of messages to display (includes optimistic entries)
const displayMessages = ref<StoryMessage[]>([]);

const loadingMessages = ref(false);
const userInput = ref("");
const isGenerating = ref(false);
const streamingText = ref("");
const genError = ref<string | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const loadingOlder = ref(false);
const lastUserMessage = ref<string | null>(null);
const sidebarOpen = ref(false);
const showJumpToBottom = ref(false);
// autoStick stays on as long as the viewport is near the bottom. It flips
// OFF the instant the user expresses intent to scroll up (wheel / touch /
// PageUp / ArrowUp) and only re-engages when the user returns to bottom
// manually (scroll down themselves or click the jump-to-bottom button).
const autoStick = ref(true);
let userScrollLockUntilBottom = false;
let pendingScrollFrame: number | null = null;
let abortController: AbortController | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const overrideMode = ref("balanced");
const overrideSceneLock = ref(true);
const overrideTemp = ref(0.55);

const modeDescriptions: Record<string, string> = {
  slow_scene:
    "Slow Scene — Fokus atmosfer, dialog, dan nuansa. Plot hampir tidak maju.",
  balanced:
    "Balanced — Progres cerita moderat, beat yang memuaskan tiap giliran.",
  progress_story:
    "Progress — Plot maju lebih terasa, tetap satu beat per giliran.",
  cinematic: "Cinematic — Deskripsi kaya, framing dramatis, adegan visual.",
};
const modeDescription = computed(
  () => modeDescriptions[overrideMode.value] ?? "",
);
const inputPlaceholder = computed(() =>
  displayMessages.value.length === 0
    ? "Tulis adegan pembuka... (Enter untuk kirim, Shift+Enter baris baru)"
    : "Lanjutkan ceritamu... (Enter untuk kirim, Shift+Enter baris baru)",
);
const canRegenerate = computed(() => {
  const last = displayMessages.value[displayMessages.value.length - 1];
  return last && last.role === "assistant" && displayMessages.value.length >= 2;
});
const renderedStreamingText = computed(() =>
  renderInlineMarkdown(streamingText.value),
);

// Track xl viewport (>= 1280px) so the sidebar drawer's aria-hidden stays
// false on desktop even when sidebarOpen is false (the drawer is not
// actually hidden on desktop — the open/close toggle only matters < xl).
const isXl = ref(false);
let xlMql: MediaQueryList | null = null;
function onXlChange(e: MediaQueryListEvent | MediaQueryList) {
  isXl.value = e.matches;
}

async function scrollToBottom(force = false) {
  // Respect user intent: if they've scrolled up mid-stream, don't yank them
  // back to bottom on each incoming chunk. Only `force=true` (send, regen,
  // jump-to-bottom button, initial mount) overrides that.
  if (!force) {
    if (!autoStick.value || userScrollLockUntilBottom) return;
  }
  await nextTick();
  // Coalesce rapid streaming-chunk calls into one per animation frame so
  // we don't fight the browser's scroll on every token.
  if (pendingScrollFrame !== null) cancelAnimationFrame(pendingScrollFrame);
  pendingScrollFrame = requestAnimationFrame(() => {
    pendingScrollFrame = null;
    if (scrollEl.value) {
      scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
    }
  });
  if (force) {
    userScrollLockUntilBottom = false;
    autoStick.value = true;
  }
}

// Immediately treat any explicit user scroll-up intent as a lock.
function onUserScrollIntent(e: WheelEvent | TouchEvent | KeyboardEvent) {
  if (!scrollEl.value) return;
  let goingUp = false;
  if (e instanceof WheelEvent) {
    goingUp = e.deltaY < 0;
  } else if (e instanceof KeyboardEvent) {
    goingUp = ["ArrowUp", "PageUp", "Home"].includes(e.key);
  } else {
    // TouchEvent — treat any touchmove as potential user scroll; handleScroll
    // will refine based on position.
    goingUp = true;
  }
  if (goingUp) {
    autoStick.value = false;
    userScrollLockUntilBottom = true;
  }
}

function autoResize() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = "auto";
  const maxH = Math.max(160, Math.floor(window.innerHeight * 0.4));
  el.style.height = Math.min(el.scrollHeight, maxH) + "px";
}

async function handleScroll() {
  if (!scrollEl.value) return;
  const el = scrollEl.value;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  // If the user has manually returned near the bottom, re-engage auto-stick
  // and drop the lock. Otherwise, preserve their scroll-up intent so
  // incoming chunks don't drag them back down.
  if (nearBottom) {
    userScrollLockUntilBottom = false;
    autoStick.value = true;
  } else if (!userScrollLockUntilBottom) {
    autoStick.value = false;
  }
  showJumpToBottom.value = !nearBottom && displayMessages.value.length > 0;

  if (loadingOlder.value || !store.hasMoreMessages) return;

  if (el.scrollTop < 100) {
    loadingOlder.value = true;
    const oldHeight = el.scrollHeight;

    const oldestMsg = store.sortedMessages[0];
    if (oldestMsg) {
      await store.fetchMessages(storyId.value, oldestMsg.id);

      await nextTick();
      if (scrollEl.value) {
        const newHeight = scrollEl.value.scrollHeight;
        scrollEl.value.scrollTop =
          newHeight - oldHeight + scrollEl.value.scrollTop;
      }
    }

    loadingOlder.value = false;
  }
}

onMounted(async () => {
  loadingMessages.value = true;
  await Promise.all([
    store.fetchStory(storyId.value),
    store.fetchMessages(storyId.value),
    store.fetchCharacters(storyId.value),
    store.fetchMemories(storyId.value),
    store.fetchPlotThreads(storyId.value),
  ]);

  const s = store.currentStory;
  if (s) {
    overrideMode.value = s.generation_mode || "balanced";
    overrideSceneLock.value = s.scene_lock ?? true;
    overrideTemp.value = Number(s.temperature) || 0.55;
  }

  displayMessages.value = [...store.sortedMessages];
  loadingMessages.value = false;
  loadDraft();
  await scrollToBottom(true);
  nextTick(autoResize);

  // Attach intent listeners so the moment the user scrolls up (wheel,
  // touch drag, arrow keys) we stop force-sticking to bottom, even if
  // streaming chunks are still landing.
  const el = scrollEl.value;
  if (el) {
    el.addEventListener("wheel", onUserScrollIntent, { passive: true });
    el.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    el.addEventListener("keydown", onUserScrollIntent as EventListener);
  }

  // Track xl viewport for correct aria-hidden on the sidebar drawer.
  if (typeof window !== "undefined") {
    xlMql = window.matchMedia("(min-width: 1280px)");
    onXlChange(xlMql);
    xlMql.addEventListener("change", onXlChange);
  }
});

onBeforeUnmount(() => {
  abortController?.abort();
  if (refreshTimer) clearTimeout(refreshTimer);
  if (pendingScrollFrame !== null) cancelAnimationFrame(pendingScrollFrame);
  const el = scrollEl.value;
  if (el) {
    el.removeEventListener("wheel", onUserScrollIntent);
    el.removeEventListener("touchmove", onUserScrollIntent);
    el.removeEventListener("keydown", onUserScrollIntent as EventListener);
  }
  if (xlMql) {
    xlMql.removeEventListener("change", onXlChange);
    xlMql = null;
  }
});

watch(
  () => store.sortedMessages,
  (msgs) => {
    // Only overwrite if we're not mid-stream — otherwise optimistic bubbles flicker.
    if (!isGenerating.value) {
      displayMessages.value = [...msgs];
    }
  },
  { deep: true },
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    generate();
    return;
  }
  // ArrowUp on an empty composer: recall the last user message (terminal-style
  // history). Doesn't overwrite content you've already typed.
  if (e.key === "ArrowUp" && !userInput.value) {
    const lastUser = [...displayMessages.value]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUser && lastUser.content) {
      e.preventDefault();
      userInput.value = lastUser.content;
      nextTick(() => {
        autoResize();
        inputEl.value?.setSelectionRange(
          lastUser.content.length,
          lastUser.content.length,
        );
      });
    }
  }
}

async function onEditMessage(messageId: string, newContent: string) {
  try {
    await messagesApi.update(storyId.value, messageId, newContent);
    // Optimistic local update so the edit is visible instantly, then refresh
    // from the server to pick up any server-side transformations.
    const local = displayMessages.value.find((m) => m.id === messageId);
    if (local) local.content = newContent;
    await store.fetchMessages(storyId.value);
    if (!isGenerating.value) {
      displayMessages.value = [...store.sortedMessages];
    }
  } catch (err) {
    genError.value =
      err instanceof Error ? err.message : "Gagal menyimpan perubahan.";
  }
}

async function onDeleteMessage(messageId: string) {
  try {
    await messagesApi.deleteTurn(storyId.value, messageId);
    await store.fetchMessages(storyId.value);
    if (!isGenerating.value) {
      displayMessages.value = [...store.sortedMessages];
    }
  } catch (err) {
    genError.value =
      err instanceof Error ? err.message : "Gagal menghapus pesan.";
  }
}

function stopGeneration() {
  abortController?.abort();
}

async function runGeneration(message: string) {
  genError.value = null;
  isGenerating.value = true;
  streamingText.value = "";
  autoStick.value = true;
  lastUserMessage.value = message;

  // Optimistic user message
  const tempUser: StoryMessage = {
    id: `temp-user-${Date.now()}`,
    story_id: storyId.value,
    role: "user",
    content: message,
    token_count: null,
    created_at: new Date().toISOString(),
  };
  displayMessages.value.push(tempUser);
  await scrollToBottom(true);

  let fullText = "";
  abortController = new AbortController();

  await streamStoryGeneration(storyId.value, message, {
    signal: abortController.signal,
    generationOverride: {
      mode: overrideMode.value,
      temperature: overrideTemp.value,
      sceneLock: overrideSceneLock.value,
    },
    onChunk(chunk) {
      fullText += chunk;
      streamingText.value = fullText;
      scrollToBottom();
    },
    async onDone() {
      finalizeGeneration(fullText);
    },
    onAbort() {
      // Keep whatever was streamed so far — the server saves it too.
      finalizeGeneration(fullText || "[generasi dihentikan]");
    },
    onError(err) {
      genError.value = err.message;
      isGenerating.value = false;
      streamingText.value = "";
      // Remove optimistic user message so the user can retry from input.
      displayMessages.value = displayMessages.value.filter(
        (m) => m.id !== tempUser.id,
      );
      if (!userInput.value.trim()) userInput.value = message;
      nextTick(autoResize);
    },
  });
}

async function finalizeGeneration(text: string) {
  const tempAssistant: StoryMessage = {
    id: `temp-ast-${Date.now()}`,
    story_id: storyId.value,
    role: "assistant",
    content: text,
    token_count: null,
    created_at: new Date().toISOString(),
  };
  displayMessages.value.push(tempAssistant);
  streamingText.value = "";
  isGenerating.value = false;
  abortController = null;
  await scrollToBottom();

  // Single debounced refresh. Background memory job is async on the backend —
  // give it a moment, then resync story/messages/memories once.
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (isGenerating.value) return;
    await Promise.all([
      store.fetchMessages(storyId.value),
      store.fetchStory(storyId.value),
      store.fetchMemories(storyId.value),
      store.fetchPlotThreads(storyId.value),
    ]);
    if (!isGenerating.value) {
      displayMessages.value = [...store.sortedMessages];
    }
  }, 3000);
}

async function generate() {
  const message = userInput.value.trim();
  if (!message || isGenerating.value) return;
  userInput.value = "";
  clearDraft();
  nextTick(autoResize);
  await runGeneration(message);
}

// ─── Draft auto-save ─────────────────────────────────────
// Persist whatever the user is typing to localStorage so a reload, tab
// close, or accidental nav doesn't eat their prompt. Keyed per-story so
// different stories don't clobber each other's drafts.
function draftKey() {
  return `storyDraft:${storyId.value}`;
}
function loadDraft() {
  try {
    const saved = localStorage.getItem(draftKey());
    if (saved && !userInput.value) {
      userInput.value = saved;
      nextTick(autoResize);
    }
  } catch {
    /* ignore */
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    /* ignore */
  }
}
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
watch(userInput, (val) => {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    try {
      if (val.trim()) {
        localStorage.setItem(draftKey(), val);
      } else {
        localStorage.removeItem(draftKey());
      }
    } catch {
      /* ignore */
    }
  }, 400);
});

async function retryLast() {
  if (!lastUserMessage.value || isGenerating.value) return;
  const msg = lastUserMessage.value;
  genError.value = null;
  await runGeneration(msg);
}

async function regenerateLast() {
  if (isGenerating.value) return;
  // Find the last user message in the conversation.
  const msgs = [...displayMessages.value];
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i]!.role !== "user") i--;
  if (i < 0) return;
  const userMsg = msgs[i]!;

  // Delete the stored user+assistant pair on the server BEFORE regenerating —
  // otherwise the next server-side generate call would duplicate both rows
  // and the post-generation refresh would surface duplicates.
  try {
    await messagesApi.deleteLastExchange(storyId.value);
  } catch (err) {
    genError.value =
      err instanceof Error
        ? `Gagal menghapus respons lama: ${err.message}`
        : "Gagal menghapus respons lama.";
    return;
  }

  // Drop the trailing user+assistant pair from the display so the regenerated
  // bubble takes their place visually.
  displayMessages.value = msgs.slice(0, i);
  await runGeneration(userMsg.content);
}
</script>
