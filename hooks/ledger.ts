// The store as every session shares it. The key names carry the data, so one
// `keys()` call reads every session at once, and no copy of the mod ever
// writes a key another copy writes:
//
//   reset:<ms>       a reset at that time. The newest reset of either kind
//                    starts the generation that progress counts in.
//   resetall:<ms>    a reset that clears the collection too. The newest one
//                    starts the collection's generation.
//   r:<gen>:<copy>:<points>:<bursts>:<crowns>:<lift>
//                    one copy's progress in a generation, what it has made
//                    there in all. A copy writes its next key, then deletes the
//                    one before; a reading takes each copy's highest numbers,
//                    so a key a failed delete left behind counts nothing twice.
//                    Two records belong to no copy, and a reading takes one
//                    whole snapshot of each: `legacy`, the old store's numbers,
//                    and `day<year>`, August 10's lift, which every session
//                    on that day may write.
//   f:<gen>:<meme>   a meme found in the collection's generation.
//
// A copy is one load of the mod: a session, or a hot reload of one; each has
// an id of its own. The values are `true` and nothing reads them. `lift` is
// rank not made of bursts: what August 10 gives, and in the legacy record
// what keeps the rank the old store held. `crowns` is the coronations a copy
// played (the legacy record's: 0.3.0's count); how many there are comes from
// the chart itself (`coronations`), so none is missed or counted twice. No
// `$` here.

import { RANK_START, RANK_TOP, type Stats } from './game.ts'

export type Progress = { points: number; bursts: number; crowns: number; lift: number }
export const NO_PROGRESS: Progress = { points: 0, bursts: 0, crowns: 0, lift: 0 }

// The store as one reading saw it: the generations, each copy's progress in
// the newest one, and the memes found in the collection's.
export type Ledger = {
  gen: number
  foundGen: number
  copies: Map<string, Progress>
  found: Set<string>
}

export const emptyLedger = (): Ledger => ({ gen: 0, foundGen: 0, copies: new Map(), found: new Set() })

// The record the old store's numbers become.
export const LEGACY_COPY = 'legacy'

// The record of August 10's lift in a year.
export const dayCopy = (year: number): string => `day${year}`
const isDay = (copy: string): boolean => /^day\d+$/.test(copy)

export const progressKey = (gen: number, copy: string, p: Progress): string =>
  `r:${gen}:${copy}:${p.points}:${p.bursts}:${p.crowns}:${p.lift}`
export const foundKey = (gen: number, meme: string): string => `f:${gen}:${meme}`
export const resetKey = (all: boolean, ms: number): string => `${all ? 'resetall' : 'reset'}:${ms}`

type Parsed =
  | { kind: 'reset'; all: boolean; ms: number }
  | { kind: 'progress'; gen: number; copy: string; progress: Progress }
  | { kind: 'found'; gen: number; meme: string }

const COPY_ID = /^[a-z0-9]+$/i
const MEME_ID = /^[a-z0-9-]+$/i

const number = (text: string | undefined, signed: boolean): number | null => {
  if (text === undefined || !(signed ? /^-?\d+$/ : /^\d+$/).test(text)) return null
  const n = Number(text)
  return Number.isSafeInteger(n) ? n : null
}

// A key of the ledger's, or null for any other key (`stats`, `clockDay`, …)
// and for a malformed one.
export function parseKey(key: string): Parsed | null {
  const parts = key.split(':')
  const [kind] = parts
  if ((kind === 'reset' || kind === 'resetall') && parts.length === 2) {
    const ms = number(parts[1], false)
    return ms === null ? null : { kind: 'reset', all: kind === 'resetall', ms }
  }
  if (kind === 'r' && parts.length === 7) {
    const gen = number(parts[1], false)
    const copy = parts[2]!
    const [points, bursts, crowns] = [3, 4, 5].map(i => number(parts[i], false))
    // A lift below zero is the legacy record's alone: it keeps a rank worse than its bursts.
    const lift = number(parts[6], copy === LEGACY_COPY)
    if (gen === null || !COPY_ID.test(copy) || points == null || bursts == null || crowns == null || lift === null) return null
    return { kind: 'progress', gen, copy, progress: { points, bursts, crowns, lift } }
  }
  if (kind === 'f' && parts.length === 3) {
    const gen = number(parts[1], false)
    const meme = parts[2]!
    return gen === null || !MEME_ID.test(meme) ? null : { kind: 'found', gen, meme }
  }
  return null
}

export const add = (a: Progress, b: Partial<Progress>): Progress => ({
  points: a.points + (b.points ?? 0),
  bursts: a.bursts + (b.bursts ?? 0),
  crowns: a.crowns + (b.crowns ?? 0),
  lift: a.lift + (b.lift ?? 0),
})

export function sum(list: Iterable<Progress>): Progress {
  let total = NO_PROGRESS
  for (const p of list) total = add(total, p)
  return total
}

const highest = (a: Progress | undefined, b: Progress): Progress =>
  a === undefined
    ? b
    : { points: Math.max(a.points, b.points), bursts: Math.max(a.bursts, b.bursts), crowns: Math.max(a.crowns, b.crowns), lift: Math.max(a.lift, b.lift) }

// Whether snapshot `b` is the one to keep over `a`: the most points, then
// bursts, coronations, lift.
const later = (a: Progress, b: Progress): boolean =>
  b.points !== a.points ? b.points > a.points
    : b.bursts !== a.bursts ? b.bursts > a.bursts
      : b.crowns !== a.crowns ? b.crowns > a.crowns
        : b.lift > a.lift

// A copy's keys merge to its highest numbers: it only ever adds. The legacy
// record's keys are whole snapshots of the old store taken at different
// times; merged, they would make a rank none of them held, so a reading takes
// one of them, the one with the most points. August 10's are lifts that
// sessions worked out from readings of different ages: the smaller one, from
// the newest reading, still reaches #1, and lifts no further.
const merge = (copy: string, a: Progress | undefined, b: Progress): Progress =>
  a === undefined ? b
    : copy === LEGACY_COPY ? (later(a, b) ? b : a)
      : isDay(copy) ? (b.lift < a.lift ? b : a)
        : highest(a, b)

// Whether a copy's keys are whole snapshots, of which a reading takes one.
const isSnapshot = (copy: string): boolean => copy === LEGACY_COPY || isDay(copy)

const same = (a: Progress, b: Progress): boolean =>
  a.points === b.points && a.bursts === b.bursts && a.crowns === b.crowns && a.lift === b.lift

// Whether `b` holds every number of `a`, and is another key.
const covers = (b: Progress, a: Progress): boolean =>
  b.points >= a.points && b.bursts >= a.bursts && b.crowns >= a.crowns && b.lift >= a.lift &&
  (b.points > a.points || b.bursts > a.bursts || b.crowns > a.crowns || b.lift > a.lift)

export function readLedger(keys: readonly string[]): Ledger {
  const parsed = keys.map(parseKey).filter((p): p is Parsed => p !== null)
  let gen = 0
  let foundGen = 0
  for (const p of parsed) {
    if (p.kind !== 'reset') continue
    gen = Math.max(gen, p.ms)
    if (p.all) foundGen = Math.max(foundGen, p.ms)
  }
  const copies = new Map<string, Progress>()
  const found = new Set<string>()
  for (const p of parsed) {
    if (p.kind === 'progress' && p.gen === gen) copies.set(p.copy, merge(p.copy, copies.get(p.copy), p.progress))
    if (p.kind === 'found' && p.gen === foundGen) found.add(p.meme)
  }
  return { gen, foundGen, copies, found }
}

// Every session's bursts climb the one chart, a rank each, from #20 to #1.
export const rankOf = (p: Progress): number => Math.max(RANK_TOP, Math.min(RANK_START, RANK_START - p.bursts - p.lift))

// The total of bursts and lift that stands at #1.
const AT_TOP = RANK_START - RANK_TOP

// The coronations every session's progress makes: one for every burst that
// lands at #1, whichever session made it, and for a lift that reaches it.
// With a legacy record, 0.3.0's count stands, and counting goes on from the
// total the record stood at.
export function coronations(total: Progress, legacy: Progress | undefined): number {
  const from = legacy === undefined ? 0 : legacy.bursts + legacy.lift
  return (legacy?.crowns ?? 0) + Math.max(0, total.bursts + total.lift - Math.max(AT_TOP - 1, from))
}

// The coronations `bursts` make climbing from `rank`, read from the rank
// alone (before a copy has read the store).
export const crownsFrom = (rank: number, bursts: number): number => {
  const from = { ...NO_PROGRESS, bursts: RANK_START - rank }
  return coronations(add(from, { bursts }), undefined) - coronations(from, undefined)
}

// August 10's lift: what takes the chart to #1, worked out without any
// August 10 lift (so two sessions' lifts differ only by their readings' age),
// or one rank past #1 when the chart stands there already, so the day still
// makes one coronation.
export function liftToTop(copies: ReadonlyMap<string, Progress>): number {
  let made = 0
  for (const [copy, p] of copies) {
    if (!isDay(copy)) made += p.bursts + p.lift
  }
  return Math.max(1, AT_TOP - made)
}

// The coronations the progress makes that no copy has played yet. Two copies
// that played the same one owe nothing.
export function crownsOwed(copies: ReadonlyMap<string, Progress>): number {
  const legacy = copies.get(LEGACY_COPY)
  let played = legacy?.crowns ?? 0
  for (const [copy, p] of copies) {
    if (copy !== LEGACY_COPY) played += p.crowns
  }
  return Math.max(0, coronations(sum(copies.values()), legacy) - played)
}

// A reset's time: now, or just past the generation it ends when the clock
// reads earlier, so a reset always starts a newer generation.
export const nextResetMs = (now: number, gen: number): number => Math.max(Math.floor(now), gen + 1)

// What no reading counts any more: progress and finds of older generations,
// resets older than the newest of their kind, a copy's keys that a newer key
// of the same copy replaced, and the legacy snapshots a reading passes over.
// Generations only grow, so a key stale once stays stale, whoever reads it
// and when.
export function staleKeys(keys: readonly string[]): string[] {
  const ledger = readLedger(keys)
  const parsed = keys.map(key => ({ key, p: parseKey(key) }))
  let newestReset = -1
  let newestAll = -1
  const current = new Map<string, Progress[]>()
  for (const { p } of parsed) {
    if (p?.kind === 'reset') {
      if (p.all) newestAll = Math.max(newestAll, p.ms)
      else newestReset = Math.max(newestReset, p.ms)
    }
    if (p?.kind === 'progress' && p.gen === ledger.gen) current.set(p.copy, [...(current.get(p.copy) ?? []), p.progress])
  }
  const stale: string[] = []
  for (const { key, p } of parsed) {
    if (p === null) continue
    const isStale =
      p.kind === 'reset' ? p.ms < (p.all ? newestAll : newestReset)
        : p.kind === 'found' ? p.gen < ledger.foundGen
          : p.gen < ledger.gen ||
            (isSnapshot(p.copy)
              ? !same(p.progress, ledger.copies.get(p.copy) ?? p.progress)
              : (current.get(p.copy) ?? []).some(other => covers(other, p.progress)))
    if (isStale) stale.push(key)
  }
  return stale
}

export const isEmpty = (p: Progress): boolean => p.points === 0 && p.bursts === 0 && p.crowns === 0 && p.lift === 0

// The old store's one key as ledger keys: its totals as the `legacy` record,
// with the lift that keeps the rank it held, and its finds. The same stats
// always make the same keys, so every copy may write them.
export function legacyKeys(stats: Stats, known: ReadonlySet<string>): string[] {
  const progress: Progress = { points: stats.totalPoints, bursts: stats.bursts, crowns: stats.coronations, lift: RANK_START - stats.rank - stats.bursts }
  const keys = isEmpty(progress) ? [] : [progressKey(0, LEGACY_COPY, progress)]
  for (const meme of Object.keys(stats.found).sort()) {
    if (known.has(meme) && (stats.found[meme] ?? 0) > 0) keys.push(foundKey(0, meme))
  }
  return keys
}
