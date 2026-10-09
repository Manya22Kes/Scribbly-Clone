export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turn_end' | 'game_over'

export interface Settings {
  maxPlayers: number
  rounds: number
  drawTime: number
  wordCount: number
  hints: number
  wordMode: 'normal' | 'hidden' | 'combination'
  category: string
  language: string
  customWords: string[]
  customOnly: boolean
}

export interface PlayerInfo {
  id: string
  name: string
  avatar: number
  score: number
  ready: boolean
  hasGuessed: boolean
  isDrawer: boolean
}

export interface Spectator {
  id: string
  name: string
  avatar: number
}

export interface Gain {
  id: string
  name: string
  points: number
}

export interface GameState {
  roomId: string
  isPrivate: boolean
  hostId: string
  you: string
  isSpectator: boolean
  hasReplay: boolean
  spectators: Spectator[]
  settings: Settings
  phase: Phase
  round: number
  totalRounds: number
  players: PlayerInfo[]
  drawerId?: string | null
  timeLeft?: number | null
  word?: string | null
  mask?: string[] | null
  wordOptions?: string[] | null
  result?: { word: string; gains: Gain[] } | null
  leaderboard?: { id: string; name: string; avatar: number; score: number }[] | null
}

export interface ViewState extends GameState {
  deadline: number | null
}

export interface ChatMessage {
  kind: 'chat' | 'system' | 'correct' | 'close'
  text: string
  playerId: string | null
  playerName: string | null
}

export interface Stroke {
  color: string
  size: number
  points: [number, number][]
}

export interface ReplayData {
  word: string
  drawerName: string
  strokes: Stroke[]
}

export const CATEGORIES = ['all', 'animals', 'objects', 'actions', 'food']

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
]

export const DEFAULT_SETTINGS: Settings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  wordMode: 'normal',
  category: 'all',
  language: 'en',
  customWords: [],
  customOnly: false,
}
