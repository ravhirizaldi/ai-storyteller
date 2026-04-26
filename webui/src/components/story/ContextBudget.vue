<template>
  <!-- Compact pill that shows how much of the model's context window the
       story is currently filling. Green under 50%, amber at 50-75%, red
       past 75%. Click to compact older messages into a summary. -->
  <div
    class="context-budget"
    :class="tone"
    :title="tooltip"
  >
    <Gauge class="w-3.5 h-3.5 flex-shrink-0" />
    <div class="hidden sm:flex flex-col items-start leading-tight">
      <span class="text-[10px] uppercase tracking-wide opacity-70">Konteks</span>
      <span class="text-[11px] font-semibold tabular-nums">{{ percentLabel }}</span>
    </div>
    <span class="sm:hidden text-[11px] font-semibold tabular-nums">{{ percentLabel }}</span>
    <button
      v-if="canCompact"
      class="btn-ghost btn-sm p-1 ml-0.5"
      :disabled="compacting"
      :title="compactTitle"
      @click.stop="emit('compact')"
    >
      <Loader2 v-if="compacting" class="w-3 h-3 animate-spin" />
      <Minimize2 v-else class="w-3 h-3" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Gauge, Loader2, Minimize2 } from "lucide-vue-next";
import type { ContextUsage } from "../../lib/api";

const props = defineProps<{
  usage: ContextUsage;
  compacting?: boolean;
}>();

const emit = defineEmits<{ (e: "compact"): void }>();

const percent = computed(() =>
  Math.min(999, Math.round(props.usage.fraction * 100)),
);
const percentLabel = computed(() => `${percent.value}%`);

const tone = computed(() => {
  if (props.usage.fraction > 0.75) return "tone-danger";
  if (props.usage.fraction > 0.5) return "tone-warn";
  return "tone-ok";
});

// Only offer manual compaction once there are enough live messages to
// meaningfully fold. Below this, the summary would be lower-fidelity
// than just keeping the raw turns.
const canCompact = computed(() => props.usage.messageCount >= 8);

const compactTitle = computed(() =>
  props.compacting
    ? "Sedang meringkas…"
    : "Ringkas pesan lama jadi satu blok 'story so far'",
);

const tooltip = computed(() => {
  const parts = [
    `~${props.usage.estimatedTokens.toLocaleString()} / ${props.usage.budget.toLocaleString()} token`,
    `${props.usage.messageCount} pesan aktif`,
  ];
  if (props.usage.summarizedMessageCount > 0) {
    parts.push(`${props.usage.summarizedMessageCount} sudah diringkas`);
  }
  if (props.usage.shouldCompact) {
    parts.push("Disarankan: ringkas pesan lama");
  }
  return parts.join(" · ");
});
</script>

<style scoped>
.context-budget {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  cursor: default;
}
.tone-ok {
  background: rgb(236 253 245);
  border-color: rgb(167 243 208);
  color: rgb(6 95 70);
}
.tone-warn {
  background: rgb(255 251 235);
  border-color: rgb(253 224 71);
  color: rgb(146 64 14);
}
.tone-danger {
  background: rgb(254 242 242);
  border-color: rgb(252 165 165);
  color: rgb(153 27 27);
}
:global(.dark) .tone-ok {
  background: rgba(5, 46, 22, 0.4);
  border-color: rgba(16, 185, 129, 0.35);
  color: rgb(110 231 183);
}
:global(.dark) .tone-warn {
  background: rgba(69, 26, 3, 0.4);
  border-color: rgba(251, 191, 36, 0.4);
  color: rgb(251 191 36);
}
:global(.dark) .tone-danger {
  background: rgba(69, 10, 10, 0.45);
  border-color: rgba(248, 113, 113, 0.45);
  color: rgb(252 165 165);
}
</style>
