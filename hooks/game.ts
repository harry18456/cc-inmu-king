// The game, as pure functions: letters light up, a full bar is a burst and
// one rank up the chart, #1 is the coronation. Every line the mod shouts is a
// classic catchphrase or one of the mod's own; the song gives its title only.
import type { Art, By, Game, LogItem } from '../types'

export const LETTERS = ['T', 'A', 'D', 'O', 'K', 'O', 'R', 'O'] as const
export const FULL = LETTERS.length
// A lit letter's color: a rainbow, one hue per letter, mid-tone so it reads
// on a dark theme and a light one alike.
export const LETTER_COLORS = ['#e5484d', '#f76b15', '#d4a017', '#30a46c', '#12a594', '#0090ff', '#8e4ec6', '#d6409f'] as const
export const RANK_START = 20
export const RANK_TOP = 1
export const LOG_MAX = 12

export const initialGame = (rank = RANK_START): Game => ({
  energy: 0,
  rank,
  sins: 0,
  muted: false,
  crownPending: false,
  log: [],
})

export type Outcome = { game: Game; bursts: number; crowned: boolean }

// Adds points. Every full bar empties the letters and climbs one rank; the
// climb that reaches #1 is the coronation, and every full bar while at #1
// crowns again.
export function applyPoints(game: Game, points: number): Outcome {
  if (!(points > 0)) return { game, bursts: 0, crowned: false }
  let energy = game.energy + points
  let rank = game.rank
  let bursts = 0
  let crowned = false
  while (energy >= FULL) {
    energy -= FULL
    bursts += 1
    if (rank > RANK_TOP) {
      rank -= 1
      if (rank === RANK_TOP) crowned = true
    } else {
      crowned = true
    }
  }
  return { game: { ...game, energy, rank }, bursts, crowned }
}

export function remember(game: Game, items: readonly LogItem[]): Game {
  return { ...game, log: [...items, ...game.log].slice(0, LOG_MAX) }
}

export const logItem = (label: string, points: number, by: By, at: number): LogItem => ({ label, points, by, at })

// The title ladder: the meme's own places and names, then the crown.
const TITLES: ReadonlyArray<{ min: number; max: number; title: string }> = [
  { min: 16, max: 20, title: '下北沢の新入り' },
  { min: 11, max: 15, title: '24歳、学生' },
  { min: 6, max: 10, title: '水泳部の先輩' },
  { min: 3, max: 5, title: '野獣' },
  { min: 2, max: 2, title: '野獣先輩' },
  { min: 1, max: 1, title: '淫夢の王 INMU KING' },
]

export const titleFor = (rank: number): string =>
  TITLES.find(t => rank >= t.min && rank <= t.max)?.title ?? TITLES[0]!.title

const at = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]!

// What a burst shouts, in turn: five classics and one of the mod's own.
export const CHANTS = ['いいよ！こいよ！', 'やりますねぇ！', 'ンアッー！', 'イキスギィ！', 'ファッ!?', '淫夢ゲージ全開！'] as const
export const chantFor = (n: number): string => at(CHANTS, n)

export const CROWN_CHANT = '👑 INMU KING 降臨 👑'
export const CROWN_TOAST = '新たな淫夢の王が誕生した'

// What the clock says: at 11:45:14, and on August 10.
export const TIME_LINE = '11:45:14 淫夢時間'
export const YAJUU_DAY_LINE = '8月10日 野獣の日：今日は最初から王'

// What a tool error earns: the mod's own lines.
export const SIN_LINES = ['罪がまた一つ増えた', '先輩は全部見ている', 'その罪、背負っていけ'] as const
export const sinLine = (sins: number): string => at(SIN_LINES, sins - 1)

// A toast for every first sin, then every fifth.
export const sinSpeaks = (sins: number): boolean => sins === 1 || sins % 5 === 0

// Spinner words once the chart is half climbed.
export const SPIN_WORDS = ['ンアッー', 'やりますねぇ', 'イキスギ', 'ファッ', '114514'] as const
export const spinWord = (n: number): string => at(SPIN_WORDS, n)

export const LONG_TURN_MS = 120_000
export const LONG_TURN_WORD = 'アイスティー準備中'

// The pictures a burst shows, in turn; the coronation has its crowd.
export const ARTS: readonly Art[] = ['beast', 'tea', 'digits']
export const artFor = (n: number): Art => at(ARTS, n)

const clamp = (n: number) => Math.max(0, Math.min(FULL, Math.floor(n)))

export type LetterState = 'lit' | 'fresh' | 'dark'

// Each letter's state: lit before this hit, lit by it, or still dark.
export function letterStates(energy: number, from = energy): LetterState[] {
  const to = clamp(energy)
  const start = Math.min(clamp(from), to)
  return LETTERS.map((_, i) => (i < start ? 'lit' : i < to ? 'fresh' : 'dark'))
}

// One line where color is not available: lit letters upper case, the rest lower.
export const lettersLine = (energy: number): string => {
  const n = clamp(energy)
  return LETTERS.map((letter, i) => (i < n ? letter : letter.toLowerCase())).join(' ')
}

type PopHit = { id?: string; label: string; points: number }

// The "+3 田所浩二" beside the letters after a hit; `name` writes each of the
// top two, with its meaning when the language gives one.
export function popText<H extends PopHit>(hits: readonly H[], by: By, isNew: boolean, name: (hit: H) => string = hit => hit.label): string {
  const total = Math.min(16, hits.reduce((sum, hit) => sum + hit.points, 0))
  const top = [...hits].sort((a, b) => b.points - a.points)
  const shown = top.slice(0, 2).map(name).join('・') + (top.length > 2 ? '…' : '')
  return `${by === 'claude' ? 'Claude ' : ''}+${total} ${shown}${isNew ? ' NEW!' : ''}`
}

// What 0.3.0's store kept across sessions, in one key (`epoch` counted its
// resets). ledger.ts carries it over into its own keys.
export type Stats = {
  rank: number
  bestRank: number
  totalPoints: number
  coronations: number
  sins: number
  bursts: number
  found: Record<string, number>
  epoch: number
}

export const initialStats = (epoch = 0): Stats => ({
  rank: RANK_START,
  bestRank: RANK_START,
  totalPoints: 0,
  coronations: 0,
  sins: 0,
  bursts: 0,
  found: {},
  epoch,
})

const whole = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : fallback

// Reads what the store holds into Stats, filling what is missing. Takes the
// 0.1.0 layout too (one key per number), which has no `found`.
export function toStats(raw: unknown): Stats {
  const base = initialStats()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>
  const found: Record<string, number> = {}
  if (typeof r.found === 'object' && r.found !== null) {
    for (const [id, count] of Object.entries(r.found as Record<string, unknown>)) {
      const n = whole(count, 0)
      if (n > 0) found[id] = n
    }
  }
  const rank = whole(r.rank, base.rank, RANK_TOP, RANK_START)
  return {
    rank,
    bestRank: Math.min(rank, whole(r.bestRank, base.bestRank, RANK_TOP, RANK_START)),
    totalPoints: whole(r.totalPoints, 0),
    coronations: whole(r.coronations, 0),
    sins: whole(r.sins, 0),
    bursts: whole(r.bursts, 0),
    found,
    epoch: whole(r.epoch, 0),
  }
}
