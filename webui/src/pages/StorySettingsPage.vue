<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 bg-parchment-50/95 backdrop-blur-sm border-b border-ink-100 px-8 py-4 z-10">
      <div class="flex items-center gap-3">
        <RouterLink :to="`/stories/${storyId}/write`" class="btn-ghost btn-sm p-1.5">
          <ArrowLeft class="w-4 h-4" />
        </RouterLink>
        <div>
          <h1 class="text-lg font-bold text-ink-900">Pengaturan Cerita</h1>
          <p class="text-xs text-ink-400">{{ currentStory?.title ?? '' }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span v-if="saved" class="text-xs text-sage-600">✓ Tersimpan</span>
          <button class="btn-primary btn-sm" @click="saveAll" :disabled="saving" id="btn-save-settings">
            <Save class="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="spinner w-6 h-6" />
    </div>

    <div v-else class="max-w-2xl mx-auto px-8 py-6 space-y-6">
      <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 p-4">
        <p class="text-sm text-red-700">{{ error }}</p>
      </div>

      <!-- Basic Info -->
      <div class="card p-6 space-y-4">
        <h2 class="font-semibold text-ink-800 text-sm uppercase tracking-wider">Informasi Dasar</h2>

        <div>
          <label class="label" for="settings-title">Judul Cerita</label>
          <input id="settings-title" v-model="form.title" class="input" placeholder="Judul cerita..." />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label" for="settings-genre">Genre</label>
            <input id="settings-genre" v-model="form.genre" class="input" placeholder="Fantasi, Romance..." />
          </div>
          <div>
            <label class="label" for="settings-language">Bahasa</label>
            <select id="settings-language" v-model="form.language" class="select">
              <option value="id">🇮🇩 Indonesia</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Generation Settings -->
      <div class="card p-6 space-y-4">
        <h2 class="font-semibold text-ink-800 text-sm uppercase tracking-wider">Pengaturan Generasi & Pacing</h2>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label" for="settings-mode">Mode Generasi</label>
            <select id="settings-mode" v-model="form.generation_mode" class="select">
              <option value="slow_scene">Slow Scene (Fokus Detail)</option>
              <option value="balanced">Balanced (Seimbang)</option>
              <option value="progress_story">Progress Story (Lebih Cepat)</option>
              <option value="cinematic">Cinematic (Dramatis)</option>
            </select>
          </div>
          <div>
            <label class="label" for="settings-tokens">Max Output Tokens</label>
            <input id="settings-tokens" type="number" v-model="form.max_output_tokens" class="input" min="100" max="4000" />
          </div>
        </div>

        <div>
          <label class="label flex justify-between" for="settings-temperature">
            <span>Temperature</span>
            <span class="text-ink-500">{{ form.temperature }}</span>
          </label>
          <input id="settings-temperature" type="range" v-model.number="form.temperature" class="w-full" min="0" max="1" step="0.05" />
        </div>

        <div class="space-y-2 pt-2 border-t border-ink-100">
          <label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" v-model="form.scene_lock" class="rounded border-ink-300 text-sage-600 focus:ring-sage-500" />
            Lock Current Scene (Kunci Adegan Saat Ini)
          </label>
          <label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" v-model="form.allow_time_skip" class="rounded border-ink-300 text-sage-600 focus:ring-sage-500" />
            Izinkan Time Skip
          </label>
          <label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" v-model="form.allow_location_change" class="rounded border-ink-300 text-sage-600 focus:ring-sage-500" />
            Izinkan Perpindahan Lokasi
          </label>
          <label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" v-model="form.allow_major_plot_progress" class="rounded border-ink-300 text-sage-600 focus:ring-sage-500" />
            Izinkan Progres Plot Utama
          </label>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="card p-6 border-red-200 space-y-6">
        <div>
          <h2 class="font-semibold text-red-700 text-sm uppercase tracking-wider mb-3">Reset Progress Cerita</h2>
          <p class="text-xs text-ink-500 mb-4">
            Ini akan menghapus seluruh riwayat pesan, ingatan, dan mengembalikan cerita ke kondisi awal. Karakter, Story Bible, dan Pengaturan Sistem TETAP dipertahankan.
          </p>
          <button class="btn-secondary btn-sm text-red-600 border-red-200 hover:bg-red-50" @click="confirmReset" id="btn-reset-story">
            <Trash2 class="w-3.5 h-3.5" /> Reset Progress Cerita
          </button>
        </div>

        <div class="pt-6 border-t border-red-100">
          <h2 class="font-semibold text-red-700 text-sm uppercase tracking-wider mb-3">Hapus Cerita</h2>
          <p class="text-xs text-ink-500 mb-4">
            Menghapus cerita akan menghapus semua pesan, karakter, memori, dan data terkait secara permanen. Tindakan ini tidak bisa dibatalkan.
          </p>
          <button class="btn-danger btn-sm" @click="confirmDelete" id="btn-delete-story">
            <Trash2 class="w-3.5 h-3.5" /> Hapus Cerita Ini
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { ArrowLeft, Save, Trash2 } from 'lucide-vue-next'
import { useStoryStore } from '../stores/storyStore'

const route = useRoute()
const router = useRouter()
const store = useStoryStore()
const storyId = route.params.storyId as string

const currentStory = ref(store.currentStory)
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref<string | null>(null)

const form = ref({
  title: '',
  genre: '',
  language: 'id',
  generation_mode: 'slow_scene',
  temperature: 0.45,
  max_output_tokens: 1200,
  scene_lock: true,
  allow_time_skip: false,
  allow_location_change: false,
  allow_major_plot_progress: false,
})

onMounted(async () => {
  loading.value = true
  try {
    await store.fetchStory(storyId)
    const s = store.currentStory
    currentStory.value = s
    if (s) {
      form.value = {
        title: s.title,
        genre: s.genre ?? '',
        language: s.language,
        generation_mode: s.generation_mode ?? 'slow_scene',
        temperature: Number(s.temperature) || 0.45,
        max_output_tokens: s.max_output_tokens ?? 1200,
        scene_lock: s.scene_lock ?? true,
        allow_time_skip: s.allow_time_skip ?? false,
        allow_location_change: s.allow_location_change ?? false,
        allow_major_plot_progress: s.allow_major_plot_progress ?? false,
      }
    }
  } finally {
    loading.value = false
  }
})

async function saveAll() {
  saving.value = true
  saved.value = false
  error.value = null
  try {
    await store.updateStory(storyId, {
      title: form.value.title,
      genre: form.value.genre || undefined,
      language: form.value.language,
      generationMode: form.value.generation_mode,
      temperature: Number(form.value.temperature),
      maxOutputTokens: Number(form.value.max_output_tokens),
      sceneLock: form.value.scene_lock,
      allowTimeSkip: form.value.allow_time_skip,
      allowLocationChange: form.value.allow_location_change,
      allowMajorPlotProgress: form.value.allow_major_plot_progress,
    } as any)
    currentStory.value = store.currentStory
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}

async function confirmReset() {
  if (!confirm(`Reset progress cerita "${currentStory.value?.title}"? Pesan dan memori akan hilang, tapi pengaturan dan karakter tetap dipertahankan.`)) return
  try {
    await store.resetStoryProgress(storyId)
    router.push(`/stories/${storyId}/write`)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Gagal mereset cerita'
  }
}

async function confirmDelete() {
  if (!confirm(`Hapus cerita "${currentStory.value?.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
  try {
    await store.deleteStory(storyId)
    router.push('/')
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Gagal menghapus'
  }
}
</script>
