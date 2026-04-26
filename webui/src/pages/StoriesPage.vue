<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 bg-parchment-50/95 backdrop-blur-sm border-b border-ink-100 px-8 py-5 z-10 dark:bg-ink-950/95 dark:border-ink-800">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-ink-900 dark:text-ink-100">Cerita Saya</h1>
          <p class="text-sm text-ink-500 mt-0.5 dark:text-ink-400">{{ stories.length }} cerita</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn-ghost btn-sm p-2"
            :title="theme === 'dark' ? 'Mode terang' : 'Mode gelap'"
            @click="toggleTheme"
          >
            <Sun v-if="theme === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
          <RouterLink to="/stories/new" class="btn-primary" id="btn-new-story">
            <Plus class="w-4 h-4" />
            Cerita Baru
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="px-8 py-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="spinner w-8 h-8" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="card p-6 text-center">
        <p class="text-red-600 font-medium">{{ error }}</p>
        <button class="btn-secondary mt-3" @click="reload">Coba lagi</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="stories.length === 0" class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="w-16 h-16 rounded-2xl bg-parchment-200 flex items-center justify-center dark:bg-ink-800">
          <BookOpen class="w-8 h-8 text-ink-400" />
        </div>
        <div class="text-center">
          <p class="font-semibold text-ink-700 dark:text-ink-100">Belum ada cerita</p>
          <p class="text-sm text-ink-400 mt-1 dark:text-ink-500">Mulai dengan membuat cerita pertama kamu</p>
        </div>
        <RouterLink to="/stories/new" class="btn-primary">
          <Plus class="w-4 h-4" /> Buat Cerita
        </RouterLink>
      </div>

      <!-- Story grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StoryCard
          v-for="story in stories"
          :key="story.id"
          :story="story"
          @open="openStory"
          @delete="deleteStory"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Plus, BookOpen, Sun, Moon } from 'lucide-vue-next'
import { useStoryStore } from '../stores/storyStore'
import StoryCard from '../components/story/StoryCard.vue'
import { useTheme } from '../composables/useTheme'

const { theme, toggle: toggleTheme } = useTheme()

const router = useRouter()
const store = useStoryStore()

const stories = computed(() => store.stories)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

onMounted(() => store.fetchStories())

function reload() { store.fetchStories() }

function openStory(id: string) {
  router.push(`/stories/${id}/write`)
}

async function deleteStory(id: string) {
  if (!confirm('Hapus cerita ini? Semua pesan dan data akan ikut terhapus.')) return
  await store.deleteStory(id)
}
</script>
