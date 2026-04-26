<template>
  <div class="flex flex-1 overflow-hidden">
    <!-- Main writing area -->
    <div class="flex flex-col flex-1 overflow-hidden">
      <!-- Header -->
      <div class="bg-white border-b border-ink-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <RouterLink to="/" class="btn-ghost btn-sm p-1.5">
            <ArrowLeft class="w-4 h-4" />
          </RouterLink>
          <div class="min-w-0">
            <h1 class="font-semibold text-ink-900 text-sm truncate">
              {{ currentStory?.title ?? 'Memuat...' }}
            </h1>
            <div class="flex items-center gap-2">
              <span v-if="currentStory?.genre" class="text-xs text-ink-400">{{ currentStory.genre }}</span>
              <span v-if="currentStory?.language" class="text-xs text-ink-300">·</span>
              <span v-if="currentStory?.language" class="text-xs text-ink-400">{{ languageLabel(currentStory.language) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink :to="`/stories/${storyId}/bible`" class="btn-secondary btn-sm">
            <BookMarked class="w-3.5 h-3.5" /> Bible
          </RouterLink>
          <RouterLink :to="`/stories/${storyId}/settings`" class="btn-ghost btn-sm p-2">
            <Settings class="w-4 h-4" />
          </RouterLink>
        </div>
      </div>

      <!-- Messages area -->
      <div class="flex-1 overflow-y-auto px-6 py-6" ref="scrollEl" @scroll="handleScroll">
        <div v-if="loadingMessages" class="flex justify-center py-12">
          <div class="spinner w-6 h-6" />
        </div>

        <div v-else-if="displayMessages.length === 0 && !streamingText" class="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
          <div class="w-14 h-14 rounded-2xl bg-parchment-200 flex items-center justify-center">
            <Feather class="w-7 h-7 text-ink-400" />
          </div>
          <div>
            <p class="font-semibold text-ink-700">Mulai ceritamu</p>
            <p class="text-sm text-ink-400 mt-1">Tulis arahan di bawah untuk memulai</p>
          </div>
        </div>

        <div v-else>
          <div v-if="loadingOlder" class="flex justify-center py-4">
            <div class="spinner w-5 h-5 text-ink-300" />
          </div>
          <MessageBubble
            v-for="msg in displayMessages"
            :key="msg.id"
            :message="msg"
          />
        </div>

        <!-- Streaming placeholder -->
        <div v-if="streamingText" class="flex gap-3 mb-6">
          <div class="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-xs font-semibold text-parchment-50 mt-1 flex-shrink-0">
            AI
          </div>
          <div class="max-w-[80%]">
            <div class="bg-white border border-ink-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div class="prose-story text-sm whitespace-pre-wrap streaming-cursor">{{ streamingText }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error banner -->
      <div v-if="genError" class="mx-6 mb-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
        <AlertCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
        <p class="text-sm text-red-700 flex-1">{{ genError }}</p>
        <button class="text-red-500 hover:text-red-700" @click="genError = null">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Input area -->
      <div class="bg-white border-t border-ink-100 px-6 py-4 flex-shrink-0">
        <!-- Compact Control Bar -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <select v-model="overrideMode" class="select select-sm py-1 h-7 text-xs border-ink-200 min-w-[120px]">
              <option value="slow_scene">Slow Scene</option>
              <option value="balanced">Balanced</option>
              <option value="progress_story">Progress</option>
              <option value="cinematic">Cinematic</option>
            </select>
            <label class="flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer" title="Scene Lock">
              <input type="checkbox" v-model="overrideSceneLock" class="rounded w-3.5 h-3.5 border-ink-300 text-sage-600 focus:ring-sage-500" />
              <span>Lock Scene</span>
            </label>
            <div class="text-xs text-ink-500 ml-2">
              Temp: {{ overrideTemp }}
            </div>
          </div>
        </div>

        <div class="flex gap-3 items-end">
          <textarea
            v-model="userInput"
            class="textarea flex-1 min-h-[52px] max-h-40 resize-none text-sm"
            placeholder="Tulis arahan ceritamu... (Enter untuk generate, Shift+Enter untuk baris baru)"
            :disabled="isGenerating"
            @keydown="onKeydown"
            id="story-input"
            rows="2"
          />
          <button
            class="btn-primary flex-shrink-0 h-[52px] px-5"
            @click="generate"
            :disabled="isGenerating || !userInput.trim()"
            id="btn-generate"
          >
            <span v-if="isGenerating" class="spinner w-4 h-4" />
            <Send v-else class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-ink-400 mt-2 flex items-center gap-1">
          <Zap class="w-3 h-3" />
          Streaming aktif · Memory diproses di background setelah generasi
        </p>
      </div>
    </div>

    <!-- Right sidebar -->
    <div class="w-72 border-l border-ink-100 bg-white flex-shrink-0 overflow-hidden flex flex-col">
      <StorySidebar :story-id="storyId" :story="currentStory" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ArrowLeft, BookMarked, Settings, Feather, Send, AlertCircle, X, Zap } from 'lucide-vue-next'
import { useStoryStore } from '../stores/storyStore'
import MessageBubble from '../components/story/MessageBubble.vue'
import StorySidebar from '../components/story/StorySidebar.vue'
import { streamStoryGeneration } from '../lib/stream'
import { languageLabel } from '../lib/utils'
import type { StoryMessage } from '../lib/api'

const route = useRoute()
const store = useStoryStore()

const storyId = computed(() => route.params.storyId as string)
const currentStory = computed(() => store.currentStory)

// Local list of messages to display (includes optimistic entries)
const displayMessages = ref<StoryMessage[]>([])

const loadingMessages = ref(false)
const userInput = ref('')
const isGenerating = ref(false)
const streamingText = ref('')
const genError = ref<string | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const loadingOlder = ref(false)

const overrideMode = ref('slow_scene')
const overrideSceneLock = ref(true)
const overrideTemp = ref(0.45)

async function scrollToBottom() {
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
}

async function handleScroll() {
  if (!scrollEl.value || loadingOlder.value || !store.hasMoreMessages) return
  
  if (scrollEl.value.scrollTop < 100) {
    loadingOlder.value = true
    const oldHeight = scrollEl.value.scrollHeight
    
    const oldestMsg = store.sortedMessages[0]
    if (oldestMsg) {
      await store.fetchMessages(storyId.value, oldestMsg.id)
      
      await nextTick()
      if (scrollEl.value) {
        const newHeight = scrollEl.value.scrollHeight
        scrollEl.value.scrollTop = newHeight - oldHeight + scrollEl.value.scrollTop
      }
    }
    
    loadingOlder.value = false
  }
}

onMounted(async () => {
  loadingMessages.value = true
  await Promise.all([
    store.fetchStory(storyId.value),
    store.fetchMessages(storyId.value),
    store.fetchCharacters(storyId.value),
    store.fetchMemories(storyId.value),
    store.fetchPlotThreads(storyId.value),
  ])
  
  const s = store.currentStory
  if (s) {
    overrideMode.value = s.generation_mode || 'slow_scene'
    overrideSceneLock.value = s.scene_lock ?? true
    overrideTemp.value = Number(s.temperature) || 0.45
  }

  displayMessages.value = [...store.sortedMessages]
  loadingMessages.value = false
  await scrollToBottom()
})

watch(() => store.sortedMessages, (msgs) => {
  displayMessages.value = [...msgs]
}, { deep: true })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    generate()
  }
}

async function generate() {
  const message = userInput.value.trim()
  if (!message || isGenerating.value) return

  genError.value = null
  isGenerating.value = true
  streamingText.value = ''
  userInput.value = ''

  // Optimistic user message
  const tempUser: StoryMessage = {
    id: `temp-user-${Date.now()}`,
    story_id: storyId.value,
    role: 'user',
    content: message,
    token_count: null,
    created_at: new Date().toISOString(),
  }
  displayMessages.value.push(tempUser)
  await scrollToBottom()

  let fullText = ''

  await streamStoryGeneration(storyId.value, message, {
    generationOverride: {
      mode: overrideMode.value,
      temperature: overrideTemp.value,
      sceneLock: overrideSceneLock.value,
    },
    onChunk(chunk) {
      fullText += chunk
      streamingText.value = fullText
      scrollToBottom()
    },
    async onDone() {
      // Create optimistic assistant message
      const tempAssistant: StoryMessage = {
        id: `temp-ast-${Date.now()}`,
        story_id: storyId.value,
        role: 'assistant',
        content: fullText,
        token_count: null,
        created_at: new Date().toISOString(),
      }
      displayMessages.value.push(tempAssistant)

      streamingText.value = ''
      isGenerating.value = false
      await scrollToBottom()

      // Refresh messages from server after a short delay to ensure backend DB write completes
      setTimeout(async () => {
        await store.fetchMessages(storyId.value)
        // Only update if we're not currently generating another message
        if (!isGenerating.value) {
          displayMessages.value = [...store.sortedMessages]
        }
      }, 1500)

      // Refresh story state (background jobs may have updated scene state)
      setTimeout(async () => {
        await store.fetchStory(storyId.value)
        await store.fetchMemories(storyId.value)
      }, 4000)
    },
    onError(err) {
      genError.value = err.message
      isGenerating.value = false
      streamingText.value = ''
      // Remove optimistic message
      displayMessages.value = displayMessages.value.filter((m) => m.id !== tempUser.id)
    },
  })
}
</script>
