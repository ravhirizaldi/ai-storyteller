/** Format a date string for display */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Format a date with time */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Truncate text to a max length */
export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

/** Map genre to a readable label */
export function genreLabel(genre: string | null): string {
  if (!genre) return 'Tidak ada genre'
  return genre.charAt(0).toUpperCase() + genre.slice(1)
}

/** Map language code to readable name */
export function languageLabel(lang: string): string {
  const map: Record<string, string> = {
    id: '🇮🇩 Indonesia',
    en: '🇬🇧 English',
    jp: '🇯🇵 Japanese',
  }
  return map[lang] ?? lang
}

/** Generate a readable time-ago string */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}
