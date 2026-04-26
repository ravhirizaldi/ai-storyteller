import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storiesApi, messagesApi, charactersApi, memoriesApi, plotThreadsApi } from '../lib/api'
import type { Story, StoryMessage, Character, StoryMemory, PlotThread } from '../lib/api'

export const useStoryStore = defineStore('story', () => {
  // ─── State ─────────────────────────────────────────────
  const stories = ref<Story[]>([])
  const currentStory = ref<Story | null>(null)
  const messages = ref<StoryMessage[]>([])
  const characters = ref<Character[]>([])
  const memories = ref<StoryMemory[]>([])
  const plotThreads = ref<PlotThread[]>([])
  const hasMoreMessages = ref(true)

  const loading = ref(false)
  const error = ref<string | null>(null)

  // ─── Getters ────────────────────────────────────────────
  const activeThreads = computed(() => plotThreads.value.filter((pt) => pt.status === 'active'))
  const sortedMessages = computed(() =>
    [...messages.value].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  )

  // ─── Actions ────────────────────────────────────────────
  async function fetchStories() {
    loading.value = true
    error.value = null
    try {
      stories.value = await storiesApi.list()
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load stories'
    } finally {
      loading.value = false
    }
  }

  async function fetchStory(id: string) {
    loading.value = true
    error.value = null
    try {
      currentStory.value = await storiesApi.get(id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load story'
    } finally {
      loading.value = false
    }
  }

  async function createStory(data: Parameters<typeof storiesApi.create>[0]) {
    const story = await storiesApi.create(data)
    stories.value.unshift(story)
    return story
  }

  async function updateStory(id: string, data: Partial<Story>) {
    const updated = await storiesApi.update(id, data)
    const idx = stories.value.findIndex((s) => s.id === id)
    if (idx !== -1) stories.value[idx] = updated
    if (currentStory.value?.id === id) currentStory.value = updated
    return updated
  }

  async function deleteStory(id: string) {
    await storiesApi.delete(id)
    stories.value = stories.value.filter((s) => s.id !== id)
    if (currentStory.value?.id === id) currentStory.value = null
  }

  async function resetStoryProgress(id: string) {
    await storiesApi.resetProgress(id)
    if (currentStory.value?.id === id) {
      messages.value = []
      hasMoreMessages.value = true
      memories.value = []
      // Refresh story to get cleared scene state
      await fetchStory(id)
      await fetchPlotThreads(id)
      await fetchCharacters(id)
    }
  }

  async function fetchMessages(storyId: string, cursor?: string) {
    const newMessages = await messagesApi.list(storyId, cursor)
    hasMoreMessages.value = newMessages.length === 10
    if (cursor) {
      // Append old messages at the top
      messages.value = [...newMessages, ...messages.value]
    } else {
      messages.value = newMessages
    }
  }

  function appendMessage(msg: StoryMessage) {
    messages.value.push(msg)
  }

  async function fetchCharacters(storyId: string) {
    characters.value = await charactersApi.list(storyId)
  }

  async function createCharacter(storyId: string, data: Parameters<typeof charactersApi.create>[1]) {
    const ch = await charactersApi.create(storyId, data)
    characters.value.push(ch)
    return ch
  }

  async function updateCharacter(id: string, data: Partial<Character>) {
    const ch = await charactersApi.update(id, data)
    const idx = characters.value.findIndex((c) => c.id === id)
    if (idx !== -1) characters.value[idx] = ch
    return ch
  }

  async function deleteCharacter(id: string) {
    await charactersApi.delete(id)
    characters.value = characters.value.filter((c) => c.id !== id)
  }

  async function fetchMemories(storyId: string) {
    memories.value = await memoriesApi.list(storyId)
  }

  async function createMemory(storyId: string, data: Parameters<typeof memoriesApi.create>[1]) {
    const mem = await memoriesApi.create(storyId, data)
    memories.value.unshift(mem)
    return mem
  }

  async function deleteMemory(id: string) {
    await memoriesApi.delete(id)
    memories.value = memories.value.filter((m) => m.id !== id)
  }

  async function fetchPlotThreads(storyId: string) {
    plotThreads.value = await plotThreadsApi.list(storyId)
  }

  async function createPlotThread(storyId: string, data: Parameters<typeof plotThreadsApi.create>[1]) {
    const pt = await plotThreadsApi.create(storyId, data)
    plotThreads.value.unshift(pt)
    return pt
  }

  async function updatePlotThread(id: string, data: Partial<PlotThread>) {
    const pt = await plotThreadsApi.update(id, data)
    const idx = plotThreads.value.findIndex((p) => p.id === id)
    if (idx !== -1) plotThreads.value[idx] = pt
    return pt
  }

  async function deletePlotThread(id: string) {
    await plotThreadsApi.delete(id)
    plotThreads.value = plotThreads.value.filter((p) => p.id !== id)
  }

  function clearStoryData() {
    currentStory.value = null
    messages.value = []
    hasMoreMessages.value = true
    characters.value = []
    memories.value = []
    plotThreads.value = []
  }

  return {
    // State
    stories, currentStory, messages, characters, memories, plotThreads, hasMoreMessages,
    loading, error,
    // Getters
    activeThreads, sortedMessages,
    // Actions
    fetchStories, fetchStory, createStory, updateStory, deleteStory, resetStoryProgress,
    fetchMessages, appendMessage,
    fetchCharacters, createCharacter, updateCharacter, deleteCharacter,
    fetchMemories, createMemory, deleteMemory,
    fetchPlotThreads, createPlotThread, updatePlotThread, deletePlotThread,
    clearStoryData,
  }
})
