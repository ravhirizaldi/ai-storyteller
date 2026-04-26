<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div class="sticky top-0 bg-parchment-50/95 backdrop-blur-sm border-b border-ink-100 px-8 py-4 z-10">
      <div class="flex items-center gap-3">
        <RouterLink :to="`/stories/${storyId}/write`" class="btn-ghost btn-sm p-1.5">
          <ArrowLeft class="w-4 h-4" />
        </RouterLink>
        <div>
          <h1 class="text-lg font-bold text-ink-900">Story Bible</h1>
          <p class="text-xs text-ink-400">{{ currentStory?.title ?? '' }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <span v-if="saving" class="text-xs text-ink-400 flex items-center gap-1">
            <span class="spinner w-3 h-3" /> Menyimpan...
          </span>
          <span v-else-if="savedAt" class="text-xs text-sage-600">✓ Tersimpan</span>
          <button class="btn-primary btn-sm" @click="saveAll" :disabled="saving" id="btn-save-bible">
            <Save class="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="spinner w-6 h-6" />
    </div>

    <div v-else class="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <!-- Error -->
      <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 p-4">
        <p class="text-sm text-red-700">{{ error }}</p>
      </div>

      <!-- System Prompt -->
      <div class="card p-6 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-ink-800">System Prompt</h2>
            <p class="text-xs text-ink-400 mt-0.5">Instruksi inti untuk perilaku AI storyteller</p>
          </div>
          <button class="btn-ghost btn-sm text-xs" @click="resetSystemPrompt">Default</button>
        </div>
        <textarea
          v-model="form.systemPrompt"
          class="textarea font-mono text-xs min-h-[160px]"
          placeholder="System prompt untuk AI..."
        />
      </div>

      <!-- Style Prompt -->
      <div class="card p-6 space-y-3">
        <div>
          <h2 class="font-semibold text-ink-800">Style Prompt</h2>
          <p class="text-xs text-ink-400 mt-0.5">Aturan gaya penulisan yang spesifik (opsional)</p>
        </div>
        <textarea
          v-model="form.stylePrompt"
          class="textarea text-sm min-h-[100px]"
          placeholder="Tulis dengan kalimat pendek dan tegas. Hindari metafora klise. Gunakan dialog yang alami..."
        />
      </div>

      <!-- Story Bible -->
      <div class="card p-6 space-y-3">
        <div>
          <h2 class="font-semibold text-ink-800">Story Bible</h2>
          <p class="text-xs text-ink-400 mt-0.5">Dunia, latar, aturan, dan konteks cerita jangka panjang</p>
        </div>
        <textarea
          v-model="form.storyBible"
          class="textarea text-sm min-h-[200px]"
          placeholder="Deskripsikan dunia ceritamu di sini. Sistem sihir, latar dunia, fakta-fakta penting, batasan-batasan yang harus dipatuhi AI..."
        />
      </div>

      <!-- Current Scene State -->
      <div class="card p-6 space-y-3">
        <div>
          <h2 class="font-semibold text-ink-800">Kondisi Adegan Saat Ini</h2>
          <p class="text-xs text-ink-400 mt-0.5">
            Diperbarui otomatis oleh AI — bisa diedit manual jika perlu
          </p>
        </div>
        <textarea
          v-model="form.currentSceneState"
          class="textarea text-sm min-h-[120px]"
          placeholder="Di mana adegan berlangsung sekarang, siapa yang ada, apa yang sedang terjadi, suasana, waktu..."
        />
      </div>

      <!-- Timeline State -->
      <div class="card p-6 space-y-3">
        <div>
          <h2 class="font-semibold text-ink-800">Timeline State</h2>
          <p class="text-xs text-ink-400 mt-0.5">Informasi waktu dan kronologi cerita (opsional)</p>
        </div>
        <textarea
          v-model="form.currentTimelineState"
          class="textarea text-sm min-h-[100px]"
          placeholder="Hari ke-3 sejak protagonis tiba di kota. Sore hari, 2 jam sebelum matahari terbenam..."
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ArrowLeft, Save } from 'lucide-vue-next'
import { useStoryStore } from '../stores/storyStore'

const route = useRoute()
const store = useStoryStore()
const storyId = route.params.storyId as string

const currentStory = ref(store.currentStory)
const loading = ref(false)
const saving = ref(false)
const savedAt = ref(false)
const error = ref<string | null>(null)

const DEFAULT_SYSTEM_PROMPT = `Kamu adalah mesin cerita interaktif panjang (slow-burn text adventure).
Tulis dalam bahasa Indonesia yang natural kecuali pengaturan cerita meminta lain.
Lanjutkan adegan saat ini secara perlahan dan detail.

ATURAN PACING & BERCERITA (SANGAT PENTING):
1. PACING SANGAT LAMBAT: Fokus pada atmosfer, emosi, detail lingkungan, dan pikiran karakter.
2. JANGAN MEMAJUKAN PLOT TERLALU CEPAT: Jangan memasukkan rentetan kejadian penting (seperti mendapat email krusial lalu langsung bertemu seseorang) dalam satu respons. Pecah adegan menjadi momen-momen kecil.
3. JANGAN MENGAMBIL ALIH KARAKTER PENGGUNA: Biarkan pengguna bereaksi terhadap satu kejadian kecil sebelum kejadian berikutnya terjadi.
4. Jaga konsistensi karakter, hubungan, dan kesinambungan emosional.
5. Jangan ajukan pertanyaan kepada pengguna di akhir respons. Jangan tulis judul bab.
6. Ikuti story bible dan kondisi adegan saat ini di atas segalanya, namun ungkapkan elemen-elemen tersebut secara perlahan, bukan sekaligus.`

const form = ref({
  systemPrompt: '',
  stylePrompt: '',
  storyBible: '',
  currentSceneState: '',
  currentTimelineState: '',
})

onMounted(async () => {
  loading.value = true
  try {
    await store.fetchStory(storyId)
    const s = store.currentStory
    currentStory.value = s
    if (s) {
      form.value = {
        systemPrompt: s.system_prompt ?? DEFAULT_SYSTEM_PROMPT,
        stylePrompt: s.style_prompt ?? '',
        storyBible: s.story_bible ?? '',
        currentSceneState: s.current_scene_state ?? '',
        currentTimelineState: s.current_timeline_state ?? '',
      }
    }
  } finally {
    loading.value = false
  }
})

function resetSystemPrompt() {
  form.value.systemPrompt = DEFAULT_SYSTEM_PROMPT
}

async function saveAll() {
  saving.value = true
  savedAt.value = false
  error.value = null
  try {
    await store.updateStory(storyId, {
      systemPrompt: form.value.systemPrompt,
      stylePrompt: form.value.stylePrompt,
      storyBible: form.value.storyBible,
      currentSceneState: form.value.currentSceneState,
      currentTimelineState: form.value.currentTimelineState,
    } as any)
    savedAt.value = true
    setTimeout(() => { savedAt.value = false }, 3000)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Gagal menyimpan'
  } finally {
    saving.value = false
  }
}
</script>
