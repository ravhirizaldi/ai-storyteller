<template>
  <!-- Single message bubble -->
  <div
    class="flex gap-3 mb-6 animate-fade-in"
    :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
  >
    <!-- Avatar -->
    <div
      class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold mt-1"
      :class="
        message.role === 'user'
          ? 'bg-sage-600 text-white'
          : 'bg-ink-800 text-parchment-50'
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
            ? 'bg-sage-50 border border-sage-200 rounded-tr-sm'
            : 'bg-white border border-ink-100 rounded-tl-sm'
        "
      >
        <!-- User: show as-is -->
        <p
          v-if="message.role === 'user'"
          class="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap break-words"
        >
          {{ message.content }}
        </p>
        <!-- Assistant: prose style with inline-only markdown rendering.
             We escape-then-render via renderInlineMarkdown so the only HTML
             reaching the DOM is <em> / <strong>; everything else is
             text-safe. -->
        <div
          v-else
          class="prose-story text-[15px] whitespace-pre-wrap break-words"
          :class="{ 'streaming-cursor': isStreaming }"
          v-html="renderedContent"
        />
      </div>
      <p
        class="text-xs text-ink-300 mt-1 px-1"
        :class="message.role === 'user' ? 'text-right' : 'text-left'"
      >
        {{ formatDateTime(message.created_at) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { StoryMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { renderInlineMarkdown } from "../../lib/inlineMarkdown";

const props = defineProps<{
  message: StoryMessage;
  isStreaming?: boolean;
}>();

const renderedContent = computed(() =>
  renderInlineMarkdown(props.message.content ?? ""),
);
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
</style>
