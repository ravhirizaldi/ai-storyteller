import { ref, watch } from "vue";

/**
 * Global theme state. Stored in localStorage under `theme` as "dark" or
 * "light"; unset = follow the OS preference.
 *
 * The initial class is set synchronously in index.html before Vue mounts
 * to avoid a flash of unstyled content; this composable just keeps the
 * class in sync with subsequent toggles and persists the choice.
 */

type Theme = "light" | "dark";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const theme = ref<Theme>(getInitial());

// Single source of truth: whenever `theme` changes, sync the class + storage.
watch(
  theme,
  (t) => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    if (t === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
    try {
      localStorage.setItem("theme", t);
    } catch {
      // ignore (private mode etc.)
    }
  },
  { immediate: true },
);

export function useTheme() {
  const toggle = () => {
    theme.value = theme.value === "dark" ? "light" : "dark";
  };
  const set = (t: Theme) => {
    theme.value = t;
  };
  return { theme, toggle, set };
}
