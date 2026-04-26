<template>
  <!-- Story card -->
  <div
    class="card-hover p-5 group"
    @click="$emit('open', story.id)"
    :id="`story-card-${story.id}`"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-ink-900 text-sm leading-snug truncate mb-1 group-hover:text-ink-700">
          {{ story.title }}
        </h3>
        <div class="flex items-center gap-2 flex-wrap mb-2">
          <span v-if="story.genre" class="badge bg-parchment-200 text-ink-600">{{ story.genre }}</span>
          <span class="badge bg-sage-100 text-sage-700">{{ languageLabel(story.language) }}</span>
        </div>
        <p v-if="story.story_bible" class="text-xs text-ink-400 line-clamp-2">
          {{ truncate(story.story_bible, 100) }}
        </p>
        <p v-else class="text-xs text-ink-300 italic">Belum ada story bible</p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="btn-ghost btn-sm p-1.5 rounded-lg"
          @click.stop="$emit('open', story.id)"
          title="Buka cerita"
        >
          <Feather class="w-3.5 h-3.5" />
        </button>
        <button
          class="btn-ghost btn-sm p-1.5 rounded-lg text-red-500 hover:bg-red-50"
          @click.stop="$emit('delete', story.id)"
          title="Hapus cerita"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between mt-3 pt-3 border-t border-ink-50">
      <span class="text-xs text-ink-400">{{ timeAgo(story.updated_at) }}</span>
      <button
        class="text-xs text-sage-600 font-medium hover:text-sage-700 flex items-center gap-1"
        @click.stop="$emit('open', story.id)"
      >
        Tulis <ArrowRight class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Feather, Trash2, ArrowRight } from 'lucide-vue-next'
import type { Story } from '../../lib/api'
import { truncate, languageLabel, timeAgo } from '../../lib/utils'

defineProps<{ story: Story }>()
defineEmits<{
  open: [id: string]
  delete: [id: string]
}>()
</script>
