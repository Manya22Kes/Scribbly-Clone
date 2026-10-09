const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function roomCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function graphemes(text) {
  return [...segmenter.segment(text)].map((part) => part.segment)
}

export function normalize(text, language = 'en') {
  let value = String(text ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
  if (language === 'es') {
    value = value.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
  }
  return value
}

export function clamp(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function levenshtein(a, b) {
  if (a.length === 0) return b.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = row
  }
  return prev[b.length]
}

export function isClose(guess, word) {
  const a = graphemes(guess)
  const b = graphemes(word)
  if (b.length < 4 || guess === word) return false
  return levenshtein(a, b) === 1
}

export function maskWord(word, revealed) {
  return graphemes(word).map((ch, i) => {
    if (ch === ' ') return ' '
    return revealed.has(i) ? ch : '_'
  })
}

export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 16)
}

export function cleanWordList(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/[,\n]/)
  const words = raw
    .map((w) => String(w).normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((w) => w.length >= 2 && w.length <= 24 && /^[\p{L}\p{M} ]+$/u.test(w))
  return [...new Set(words)].slice(0, 100)
}
