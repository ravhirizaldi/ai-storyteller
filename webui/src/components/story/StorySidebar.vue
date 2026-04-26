<template>
  <!-- Sidebar panel with tabs for story metadata -->
  <div class="flex flex-col h-full">
    <!-- Tabs -->
    <div class="flex gap-1 p-2 bg-parchment-50 border-b border-ink-100 flex-wrap">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'"
        @click="activeTab = tab.id"
        :id="`tab-${tab.id}`"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto p-3">
      <!-- SCENE STATE -->
      <div v-if="activeTab === 'scene'">
        <h3 class="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Kondisi Adegan Saat Ini</h3>
        <textarea
          class="textarea text-xs font-mono min-h-[160px]"
          placeholder="Tulis kondisi adegan saat ini..."
          :value="story?.current_scene_state ?? ''"
          @blur="updateField('currentSceneState', ($event.target as HTMLTextAreaElement).value)"
        />
        <p class="text-xs text-ink-400 mt-1">Otomatis diperbarui oleh AI setelah generasi</p>
      </div>

      <!-- CHARACTERS -->
      <div v-if="activeTab === 'characters'">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold text-ink-500 uppercase tracking-wider">Karakter</h3>
          <button class="btn-secondary btn-sm" @click="showCharForm = !showCharForm" id="btn-add-character">
            <Plus class="w-3 h-3" /> Tambah
          </button>
        </div>

        <!-- Add character form -->
        <div v-if="showCharForm" class="card p-3 mb-3 space-y-2">
          <input v-model="newChar.name" class="input text-xs" placeholder="Nama karakter *" />
          <input v-model="newChar.role" class="input text-xs" placeholder="Peran (protagonist, antagonis...)" />
          <textarea v-model="newChar.description" class="textarea text-xs min-h-[60px]" placeholder="Deskripsi..." />
          <textarea v-model="newChar.personality" class="textarea text-xs min-h-[60px]" placeholder="Kepribadian..." />
          <div class="flex gap-2">
            <button class="btn-primary btn-sm flex-1" @click="saveCharacter" :disabled="!newChar.name">Simpan</button>
            <button class="btn-secondary btn-sm" @click="showCharForm = false; resetCharForm()">Batal</button>
          </div>
        </div>

        <!-- Character list -->
        <div v-if="characters.length === 0" class="text-center py-8 text-ink-400 text-xs">
          Belum ada karakter
        </div>
        <div v-for="ch in characters" :key="ch.id" class="card p-3 mb-2">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-ink-800">{{ ch.name }}</p>
              <p v-if="ch.role" class="text-xs text-ink-500">{{ ch.role }}</p>
            </div>
            <button class="btn-ghost btn-sm p-1 text-red-400 hover:text-red-600" @click="removeCharacter(ch.id)">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
          <p v-if="ch.current_state" class="text-xs text-ink-600 mt-1 pt-1 border-t border-ink-50">
            {{ ch.current_state }}
          </p>
        </div>
      </div>

      <!-- MEMORIES -->
      <div v-if="activeTab === 'memories'">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold text-ink-500 uppercase tracking-wider">Memori</h3>
          <button class="btn-secondary btn-sm" @click="showMemForm = !showMemForm" id="btn-add-memory">
            <Plus class="w-3 h-3" /> Tambah
          </button>
        </div>

        <div v-if="showMemForm" class="card p-3 mb-3 space-y-2">
          <input v-model="newMem.type" class="input text-xs" placeholder="Tipe (fakta, peristiwa, hubungan...)" />
          <textarea v-model="newMem.content" class="textarea text-xs min-h-[80px]" placeholder="Isi memori..." />
          <select v-model="newMem.importance" class="select text-xs">
            <option :value="1">Penting: 1</option>
            <option :value="2">Penting: 2</option>
            <option :value="3">Penting: 3</option>
            <option :value="4">Penting: 4</option>
            <option :value="5">Penting: 5</option>
          </select>
          <div class="flex gap-2">
            <button class="btn-primary btn-sm flex-1" @click="saveMemory" :disabled="!newMem.content">Simpan</button>
            <button class="btn-secondary btn-sm" @click="showMemForm = false">Batal</button>
          </div>
        </div>

        <div v-if="memories.length === 0" class="text-center py-8 text-ink-400 text-xs">
          Belum ada memori
        </div>
        <div v-for="mem in memories" :key="mem.id" class="card p-3 mb-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="badge bg-parchment-200 text-ink-600">{{ mem.type }}</span>
                <span class="text-xs text-ink-400">★{{ mem.importance }}</span>
              </div>
              <p class="text-xs text-ink-700 leading-relaxed">{{ mem.content }}</p>
            </div>
            <button class="btn-ghost btn-sm p-1 text-red-400" @click="removeMemory(mem.id)">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- PLOT THREADS -->
      <div v-if="activeTab === 'plot'">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold text-ink-500 uppercase tracking-wider">Plot Thread</h3>
          <button class="btn-secondary btn-sm" @click="showPlotForm = !showPlotForm" id="btn-add-plot">
            <Plus class="w-3 h-3" /> Tambah
          </button>
        </div>

        <div v-if="showPlotForm" class="card p-3 mb-3 space-y-2">
          <input v-model="newPlot.title" class="input text-xs" placeholder="Judul plot thread..." />
          <textarea v-model="newPlot.content" class="textarea text-xs min-h-[60px]" placeholder="Deskripsi..." />
          <div class="flex gap-2">
            <button class="btn-primary btn-sm flex-1" @click="savePlotThread" :disabled="!newPlot.title">Simpan</button>
            <button class="btn-secondary btn-sm" @click="showPlotForm = false">Batal</button>
          </div>
        </div>

        <div v-if="plotThreads.length === 0" class="text-center py-8 text-ink-400 text-xs">
          Belum ada plot thread
        </div>
        <div v-for="pt in plotThreads" :key="pt.id" class="card p-3 mb-2">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <p class="font-medium text-xs text-ink-800">{{ pt.title }}</p>
                <span :class="statusBadge(pt.status)">{{ pt.status }}</span>
              </div>
              <p v-if="pt.content" class="text-xs text-ink-600">{{ pt.content }}</p>
            </div>
            <div class="flex flex-col gap-1">
              <button
                v-if="pt.status === 'active'"
                class="btn-ghost btn-sm p-1 text-sage-600"
                @click="resolvePlot(pt.id)"
                title="Tandai selesai"
              >
                <Check class="w-3 h-3" />
              </button>
              <button class="btn-ghost btn-sm p-1 text-red-400" @click="removePlotThread(pt.id)">
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SETTINGS -->
      <div v-if="activeTab === 'settings'">
        <h3 class="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3">Pengaturan Cepat</h3>
        <div class="space-y-3">
          <div>
            <label class="label text-xs">Bahasa</label>
            <select
              class="select text-xs"
              :value="story?.language ?? 'id'"
              @change="updateField('language', ($event.target as HTMLSelectElement).value)"
            >
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label class="label text-xs">Genre</label>
            <input
              class="input text-xs"
              :value="story?.genre ?? ''"
              placeholder="Fantasi, Romance, Thriller..."
              @blur="updateField('genre', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <RouterLink
            v-if="storyId"
            :to="`/stories/${storyId}/settings`"
            class="btn-secondary btn-sm w-full justify-center"
          >
            Semua Pengaturan
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Plus, Trash2, Check } from 'lucide-vue-next'
import { useStoryStore } from '../../stores/storyStore'
import type { Story } from '../../lib/api'

const props = defineProps<{ storyId: string; story: Story | null }>()
const store = useStoryStore()

const characters = computed(() => store.characters)
const memories = computed(() => store.memories)
const plotThreads = computed(() => store.plotThreads)

const tabs = [
  { id: 'scene', label: 'Adegan' },
  { id: 'characters', label: 'Karakter' },
  { id: 'memories', label: 'Memori' },
  { id: 'plot', label: 'Plot' },
  { id: 'settings', label: 'Setelan' },
]
const activeTab = ref('scene')

// Character form
const showCharForm = ref(false)
const newChar = ref({ name: '', role: '', description: '', personality: '' })
function resetCharForm() { newChar.value = { name: '', role: '', description: '', personality: '' } }
async function saveCharacter() {
  await store.createCharacter(props.storyId, newChar.value as any)
  showCharForm.value = false
  resetCharForm()
}
async function removeCharacter(id: string) {
  if (confirm('Hapus karakter ini?')) await store.deleteCharacter(id)
}

// Memory form
const showMemForm = ref(false)
const newMem = ref({ type: 'fakta', content: '', importance: 1 })
async function saveMemory() {
  await store.createMemory(props.storyId, newMem.value)
  showMemForm.value = false
  newMem.value = { type: 'fakta', content: '', importance: 1 }
}
async function removeMemory(id: string) {
  if (confirm('Hapus memori ini?')) await store.deleteMemory(id)
}

// Plot thread form
const showPlotForm = ref(false)
const newPlot = ref({ title: '', content: '' })
async function savePlotThread() {
  await store.createPlotThread(props.storyId, newPlot.value)
  showPlotForm.value = false
  newPlot.value = { title: '', content: '' }
}
async function removePlotThread(id: string) {
  if (confirm('Hapus plot thread ini?')) await store.deletePlotThread(id)
}
async function resolvePlot(id: string) {
  await store.updatePlotThread(id, { status: 'resolved' })
}

async function updateField(field: string, value: string) {
  if (!props.storyId) return
  await store.updateStory(props.storyId, { [field]: value })
}

function statusBadge(status: string) {
  if (status === 'active') return 'badge-active'
  if (status === 'resolved') return 'badge-resolved'
  return 'badge-dormant'
}
</script>
