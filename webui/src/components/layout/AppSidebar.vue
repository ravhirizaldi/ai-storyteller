<template>
  <nav class="sidebar w-64 flex-shrink-0">
    <!-- Logo -->
    <div class="px-5 py-5 border-b border-ink-100">
      <RouterLink to="/" class="flex items-center gap-2 group">
        <div class="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center">
          <BookOpen class="w-4 h-4 text-parchment-50" />
        </div>
        <div>
          <p class="font-semibold text-ink-900 text-sm leading-none">AI Storyteller</p>
          <p class="text-xs text-ink-400 mt-0.5">Local Engine</p>
        </div>
      </RouterLink>
    </div>

    <!-- Main Nav -->
    <div class="flex-1 px-3 py-4">
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-1"
        :class="isActive('/') ? 'bg-ink-800 text-white' : 'text-ink-700 hover:bg-parchment-100'"
      >
        <Library class="w-4 h-4" />
        Semua Cerita
      </RouterLink>

      <RouterLink
        to="/stories/new"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-1"
        :class="isActive('/stories/new') ? 'bg-ink-800 text-white' : 'text-ink-700 hover:bg-parchment-100'"
      >
        <PlusCircle class="w-4 h-4" />
        Cerita Baru
      </RouterLink>

      <!-- Current story links -->
      <template v-if="storyId">
        <div class="mt-4 mb-2 px-3">
          <p class="text-xs font-semibold text-ink-400 uppercase tracking-wider">Cerita Aktif</p>
        </div>

        <RouterLink
          :to="`/stories/${storyId}/write`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-1"
          :class="isActive(`/stories/${storyId}/write`) ? 'bg-ink-800 text-white' : 'text-ink-700 hover:bg-parchment-100'"
        >
          <Feather class="w-4 h-4" />
          Tulis
        </RouterLink>

        <RouterLink
          :to="`/stories/${storyId}/bible`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-1"
          :class="isActive(`/stories/${storyId}/bible`) ? 'bg-ink-800 text-white' : 'text-ink-700 hover:bg-parchment-100'"
        >
          <BookMarked class="w-4 h-4" />
          Story Bible
        </RouterLink>

        <RouterLink
          :to="`/stories/${storyId}/settings`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-1"
          :class="isActive(`/stories/${storyId}/settings`) ? 'bg-ink-800 text-white' : 'text-ink-700 hover:bg-parchment-100'"
        >
          <Settings class="w-4 h-4" />
          Pengaturan
        </RouterLink>
      </template>
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-ink-100">
      <p class="text-xs text-ink-400 text-center">Grok powered · Local</p>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { BookOpen, Library, PlusCircle, Feather, BookMarked, Settings } from 'lucide-vue-next'

const route = useRoute()
const storyId = computed(() => route.params.storyId as string | undefined)

function isActive(path: string): boolean {
  return route.path === path
}
</script>
