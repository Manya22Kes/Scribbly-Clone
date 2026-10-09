import { readFileSync, readdirSync } from 'node:fs'

const dir = new URL('./words/', import.meta.url)
const bank = {}

for (const file of readdirSync(dir)) {
  if (file.endsWith('.json')) {
    bank[file.replace('.json', '')] = JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
  }
}

export const languages = Object.keys(bank)
export const categories = Object.keys(bank.en)

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function builtIn(language, category) {
  const words = bank[language] ?? bank.en
  if (category && words[category]) return words[category]
  return Object.values(words).flat()
}

export function pickWords(count, { language, category, customWords, customOnly, combination }) {
  const base = builtIn(language, category)
  const pool = customWords.length === 0 ? base : customOnly ? customWords : [...base, ...customWords]
  const unique = [...new Set(pool)]

  if (combination) {
    const options = []
    for (let i = 0; i < count; i++) {
      const [first, second] = shuffle(unique)
      options.push(second ? `${first} ${second}` : first)
    }
    return options
  }

  const picked = shuffle(unique).slice(0, count)
  if (picked.length < count) {
    const filler = shuffle(builtIn(language, category).filter((w) => !picked.includes(w)))
    picked.push(...filler.slice(0, count - picked.length))
  }
  return picked
}
