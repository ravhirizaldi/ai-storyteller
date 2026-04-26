<template>
  <!-- Single message bubble -->
  <div
    class="group flex gap-3 mb-6 animate-fade-in"
    :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
  >
    <!-- Avatar -->
    <div
      class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-1"
      :class="
        message.role === 'user'
          ? 'bg-sage-600 text-white'
          : 'bg-ink-800 text-parchment-50 dark:bg-ink-100 dark:text-ink-900'
      "
    >
      {{ message.role === "user" ? "K" : "AI" }}
    </div>

    <!-- Bubble -->
    <div
      class="relative min-w-0"
      :class="
        message.role === 'user'
          ? 'max-w-[80%] items-end'
          : 'max-w-[92%] md:max-w-[85%] flex-1 items-start'
      "
    >
      <div
        class="rounded-2xl px-4 py-3"
        :class="
          message.role === 'user'
            ? 'bg-sage-50 border border-sage-200 rounded-tr-sm dark:bg-sage-900/30 dark:border-sage-800'
            : 'bg-white border border-ink-100 rounded-tl-sm dark:bg-ink-900/60 dark:border-ink-800'
        "
      >
        <!-- Edit mode: textarea + save/cancel -->
        <div v-if="editing" class="flex flex-col gap-2">
          <textarea
            v-model="draft"
            ref="editTextarea"
            class="w-full min-h-[72px] max-h-[40vh] resize-y bg-transparent border border-ink-200 rounded-lg px-2 py-1.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ink-300 dark:border-ink-700 dark:text-ink-100"
            @keydown.meta.enter.prevent="commitEdit"
            @keydown.ctrl.enter.prevent="commitEdit"
            @keydown.esc.prevent="cancelEdit"
          />
          <div class="flex items-center justify-end gap-2">
            <button
              class="text-xs px-2 py-1 rounded-md text-ink-500 hover:bg-parchment-100 dark:text-ink-400 dark:hover:bg-ink-800"
              @click="cancelEdit"
            >
              Batal
            </button>
            <button
              class="text-xs px-2.5 py-1 rounded-md bg-ink-800 text-parchment-50 hover:bg-ink-900 disabled:opacity-40 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white"
              :disabled="!draft.trim() || draft.trim() === message.content || saving"
              @click="commitEdit"
            >
              {{ saving ? "…" : "Simpan" }}
            </button>
          </div>
        </div>

        <!-- User: show as-is -->
        <p
          v-else-if="message.role === 'user'"
          class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap break-words dark:text-ink-100"
        >
          {{ message.content }}
        </p>
        <!-- Assistant: prose style with inline-only markdown rendering.
             We escape-then-render via renderInlineMarkdown so the only HTML
             reaching the DOM is <em> / <strong>; everything else is
             text-safe. -->
        <div
          v-else
          class="prose-story text-[15px] whitespace-pre-wrap break-words dark:text-ink-100"
          :class="{ 'streaming-cursor': isStreaming }"
          v-html="renderedContent"
        />
      </div>

      <!-- Meta row: timestamp + action buttons that fade in on hover -->
      <div
        class="flex items-center gap-2 mt-1 px-1"
        :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
      >
        <p class="text-xs text-ink-300 dark:text-ink-500">
          {{ formatDateTime(message.created_at) }}
        </p>
        <div
          v-if="!editing && !isStreaming"
          class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
        >
          <button
            v-if="message.role === 'assistant'"
            class="msg-action"
            :title="copied ? 'Tersalin!' : 'Salin teks'"
            @click="copy"
          >
            <Check v-if="copied" class="w-3.5 h-3.5" />
            <Copy v-else class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="message.role === 'user'"
            class="msg-action"
            title="Edit pesan"
            @click="startEdit"
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="canDelete"
            class="msg-action hover:text-red-600"
            :title="
              message.role === 'user'
                ? 'Hapus giliran ini (prompt + respons)'
                : 'Hapus respons'
            "
            @click="handleDelete"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { Copy, Check, Pencil, Trash2 } from "lucide-vue-next";
import type { StoryMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { renderInlineMarkdown } from "../../lib/inlineMarkdown";

const props = defineProps<{
  message: StoryMessage;
  isStreaming?: boolean;
  canDelete?: boolean;
  /** Optional async handler. When provided, `commitEdit` awaits it so
   *  the saving indicator actually reflects request latency and the
   *  form stays open on failure. If omitted, falls back to the emit. */
  onEditAsync?: (messageId: string, newContent: string) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "edit", messageId: string, newContent: string): void;
  (e: "delete", messageId: string): void;
}>();

const renderedContent = computed(() =>
  renderInlineMarkdown(props.message.content ?? ""),
);

const editing = ref(false);
const saving = ref(false);
const draft = ref("");
const editTextarea = ref<HTMLTextAreaElement | null>(null);

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(props.message.content ?? "");
    copied.value = true;
    setTimeout(() => (copied.value = false), 1200);
  } catch {
    // Silently ignore — browser may block clipboard in insecure contexts.
  }
}

async function startEdit() {
  draft.value = props.message.content ?? "";
  editing.value = true;
  await nextTick();
  editTextarea.value?.focus();
  editTextarea.value?.setSelectionRange(
    draft.value.length,
    draft.value.length,
  );
}

function cancelEdit() {
  editing.value = false;
  draft.value = "";
}

async function commitEdit() {
  const next = draft.value.trim();
  if (!next || next === props.message.content || saving.value) return;
  saving.value = true;
  try {
    // Prefer the async callback if the parent wired one up — this lets
    // us actually keep the saving spinner on screen until the PATCH
    // lands, and stay in edit mode if it throws.
    if (props.onEditAsync) {
      await props.onEditAsync(props.message.id, next);
    } else {
      emit("edit", props.message.id, next);
    }
    editing.value = false;
  } catch {
    // Leave the form open so the user can retry without losing their draft.
  } finally {
    saving.value = false;
  }
}

function handleDelete() {
  const label =
    props.message.role === "user"
      ? "Hapus giliran ini? Pesan kamu dan respons AI yang menyertainya akan dihapus."
      : "Hapus respons AI ini?";
  if (!window.confirm(label)) return;
  emit("delete", props.message.id);
}
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
.msg-action {
  @apply inline-flex items-center justify-center w-6 h-6 rounded-md
         text-ink-400 hover:text-ink-700 hover:bg-parchment-100
         transition-colors focus:outline-none focus:ring-1 focus:ring-ink-300
         dark:text-ink-500 dark:hover:text-ink-100 dark:hover:bg-ink-800;
}
</style>
