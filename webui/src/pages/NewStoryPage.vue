<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header -->
    <div
      class="sticky top-0 bg-parchment-50/95 backdrop-blur-sm border-b border-ink-100 px-8 py-5 z-10"
    >
      <div class="flex items-center gap-3">
        <button class="btn-ghost btn-sm p-2" @click="router.back()">
          <ArrowLeft class="w-4 h-4" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-ink-900">Cerita Baru</h1>
          <p class="text-sm text-ink-400">Mulai petualangan baru</p>
        </div>
      </div>
    </div>

    <div class="max-w-2xl mx-auto px-8 py-8">
      <form @submit.prevent="create" class="space-y-6">
        <!-- Basic Info -->
        <div class="card p-6 space-y-4">
          <h2
            class="font-semibold text-ink-800 text-sm uppercase tracking-wider"
          >
            Informasi Dasar
          </h2>

          <div>
            <label class="label" for="story-title">Judul Cerita *</label>
            <input
              id="story-title"
              v-model="form.title"
              class="input"
              placeholder="Masukkan judul cerita..."
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label" for="story-genre">Genre</label>
              <input
                id="story-genre"
                v-model="form.genre"
                class="input"
                placeholder="Fantasi, Romance, Thriller..."
              />
            </div>
            <div>
              <label class="label" for="story-language">Bahasa</label>
              <select
                id="story-language"
                v-model="form.language"
                class="select"
              >
                <option value="id">🇮🇩 Indonesia</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Story Bible -->
        <div class="card p-6 space-y-4">
          <h2
            class="font-semibold text-ink-800 text-sm uppercase tracking-wider"
          >
            Story Bible
          </h2>
          <div>
            <label class="label" for="story-bible">Story Bible</label>
            <textarea
              id="story-bible"
              v-model="form.storyBible"
              class="textarea min-h-[120px]"
              placeholder="Dunia, latar, aturan-aturan cerita, konteks utama..."
            />
          </div>
          <div>
            <label class="label" for="story-scene">Kondisi Adegan Awal</label>
            <textarea
              id="story-scene"
              v-model="form.currentSceneState"
              class="textarea min-h-[80px]"
              placeholder="Di mana cerita dimulai, siapa yang ada, apa yang terjadi..."
            />
          </div>
        </div>

        <!-- AI Prompt -->
        <div class="card p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2
              class="font-semibold text-ink-800 text-sm uppercase tracking-wider"
            >
              System Prompt AI
            </h2>
            <button
              type="button"
              class="text-xs text-sage-600 hover:text-sage-700"
              @click="resetSystemPrompt"
            >
              Gunakan Default
            </button>
          </div>
          <div>
            <label class="label" for="system-prompt">System Prompt</label>
            <textarea
              id="system-prompt"
              v-model="form.systemPrompt"
              class="textarea font-mono text-xs min-h-[140px]"
              placeholder="Instruksi untuk AI storyteller..."
            />
          </div>
          <div>
            <label class="label" for="style-prompt"
              >Style Prompt (opsional)</label
            >
            <textarea
              id="style-prompt"
              v-model="form.stylePrompt"
              class="textarea text-sm min-h-[60px]"
              placeholder="Tulis dengan gaya... Gunakan kalimat pendek. Suasana gelap dan misterius..."
            />
          </div>
        </div>

        <!-- Error -->
        <div
          v-if="error"
          class="rounded-lg bg-red-50 border border-red-200 p-4"
        >
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>

        <!-- Submit -->
        <div class="flex gap-3 justify-end">
          <button type="button" class="btn-secondary" @click="router.back()">
            Batal
          </button>
          <button
            type="submit"
            class="btn-primary btn-lg"
            :disabled="submitting || !form.title"
            id="btn-create-story"
          >
            <span v-if="submitting" class="spinner w-4 h-4" />
            <Feather v-else class="w-4 h-4" />
            {{ submitting ? "Membuat..." : "Buat Cerita" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Feather } from "lucide-vue-next";
import { useStoryStore } from "../stores/storyStore";

const router = useRouter();
const store = useStoryStore();

const DEFAULT_SYSTEM_PROMPT = `You are an interactive long-form story engine — a collaborative prose writer, not a chatbot.
Your job is to continue the ongoing scene in vivid, immersive prose that respects every rule of the context above.

## OUTPUT LANGUAGE
Write in the story's configured language. If unspecified, match the user's last message.

## RESPONSE LENGTH (IMPORTANT)
Deliver a satisfying, well-paced beat each turn — neither a one-liner nor a wall of text.
- Default target: 3-6 paragraphs, roughly 250-500 words.
- Short reactive prompts may land at 2-3 paragraphs (~150-300 words).
- Dramatic or action-heavy prompts may stretch to 6-8 paragraphs (~500-700 words).
- Never exceed ~800 words. Never return fewer than 2 real paragraphs.
- Favor quality over quantity: cut any sentence that doesn't add sensation, emotion, action, or subtext.

## CRAFT RULES
1. Show, don't tell. Dramatize emotion through body language, micro-actions, silence, and dialogue beats rather than naming it ("she was nervous").
2. Ground scenes in concrete sensory detail (sight, sound, touch, smell, proprioception) but avoid stacking more than two sensory details per paragraph.
3. Vary sentence length and rhythm. Let short sentences punch. Let longer ones breathe.
4. Use subtext in dialogue; characters rarely say exactly what they mean.
5. Maintain consistent POV, tense, and voice. Match the tone established by prior messages.
6. Avoid clichés, purple prose, and filler ("suddenly", "little did they know", "he couldn't help but...").

## ANTI-AI TELLS (write like a human, not a model)
These patterns are dead giveaways that text was AI-generated. Avoid them.
1. Em-dash overuse. Hard limit: AT MOST ONE em-dash (—) per paragraph, and only for a genuine interruption or aside. Prefer a period, comma, colon, semicolon, or parentheses. Never use em-dashes as decorative style ("he paused — slowly — and breathed").
2. Forbidden AI-ism phrases (never use, in any language):
   - "a tapestry of", "a symphony of", "a dance of", "a testament to", "in the grand scheme of things"
   - "not just X, but Y" / "not merely X but also Y" escalation patterns
   - "delve into", "dive deep into", "unpack", "navigate the complexities of"
   - "it's important to note", "it's worth noting", "it goes without saying"
   - "hustle and bustle", "quiet hum", "palpable tension", "electric atmosphere"
   - "whirlwind", "kaleidoscope of emotions", "cacophony of"
   - In Bahasa: "menari-nari", "bagaikan simfoni", "penuh dengan", "seolah waktu berhenti", "perlahan tapi pasti"
3. No vague generic sensory filler ("a strange feeling", "something shifted", "the air felt different") unless it is immediately anchored by a concrete detail in the same sentence.
4. No tricolons-of-abstractions ("the pain, the fear, the hope"). If you list three things, make them concrete and specific.
5. No list-of-three adjectives stacked on a noun ("a cold, quiet, waiting room"). Pick the strongest one or rewrite.
6. Don't summarize the emotional beat at the end of a paragraph ("and in that moment, he knew he was truly alone"). End on an action or image instead.

## STORY DISCIPLINE
1. Obey the USER'S DIRECTION literally and minimally. Their last message is the blueprint for THIS beat. If the user says they are sitting quietly and smoking, the scene is a quiet cigarette — do not invent extra actions, phone calls, mental simulations, flashbacks, or plot moves they didn't ask for.
2. The STORY BIBLE is *background worldbuilding*, not a script. Do NOT progress its "big motivation" / grand reveal / secret project on your own initiative. Bible context only activates when the user's prompt actually points there.
3. Obey the RUNTIME GENERATION CONTROLS strictly. If scene lock is on: stay in-scene, don't skip time, don't change location, don't resolve the scene.
4. Honor the STORY BIBLE, CURRENT SCENE STATE, CHARACTERS, and MEMORIES for consistency — but they constrain you, they don't compel you to advance them.
5. Never speak, decide, or act on behalf of the user's character beyond what they wrote. No inserted internal monologue that commits them to actions. No invented dialogue from their mouth unless clearly prompted.
6. Don't summarize future events, skip ahead, or say "and then later..." unless the user explicitly asks.
7. When the user's prompt is mundane/static (idling, zoning out, scrolling a phone, a cigarette, a coffee), keep the beat mundane and atmospheric. Tiny sensory details > plot motion.
8. Introduce new plot elements, characters, or revelations organically and one at a time, ONLY when the user's direction invites them.

## FORMATTING
- Write continuous prose. No chapter titles, headings, bullet lists, tables, code blocks, or section breaks.
- Place dialogue on its own lines where natural; use straight double quotes.
- Inline formatting is allowed and SHOULD be used sparingly for effect:
  - Use \`*italic*\` for internal thoughts / interior monologue, emotional emphasis, or foreign / specialized terms.
    Example: \`*Gila, kenapa gue di sini.*\` or \`Gue benar-benar *tidak* mau ketemu dia.\`
  - Use \`**bold**\` extremely rarely, only for a single explosive word or sound.
- Do NOT use Markdown for anything else: no \`# heading\`, no \`- list\`, no \`[link](url)\`, no \`\`\`code\`\`\`, no tables, no horizontal rules.
- Do NOT wrap entire paragraphs in italic or bold. Inline only.
- No meta commentary ("Here is the next part..."). No out-of-character asides.
- Do not end with a question to the user. End on a concrete sensory, emotional, or action beat that naturally invites their next move.`;

const form = ref({
  title: "",
  genre: "",
  language: "id",
  storyBible: "",
  currentSceneState: "",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  stylePrompt: "",
});

const submitting = ref(false);
const error = ref<string | null>(null);

function resetSystemPrompt() {
  form.value.systemPrompt = DEFAULT_SYSTEM_PROMPT;
}

async function create() {
  if (!form.value.title.trim()) return;
  submitting.value = true;
  error.value = null;
  try {
    const story = await store.createStory({
      title: form.value.title.trim(),
      genre: form.value.genre || undefined,
      language: form.value.language,
      systemPrompt: form.value.systemPrompt || undefined,
      stylePrompt: form.value.stylePrompt || undefined,
      storyBible: form.value.storyBible || undefined,
      currentSceneState: form.value.currentSceneState || undefined,
    } as any);
    router.push(`/stories/${story.id}/write`);
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "Gagal membuat cerita";
  } finally {
    submitting.value = false;
  }
}
</script>
