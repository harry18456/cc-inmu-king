import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Art, By, Fx, Game, Pop } from '../types'
import { KNOWN_IDS, LEXICON, detect, type Entry, type Hit } from './lexicon.ts'
import {
  CROWN_CHANT, CROWN_TOAST, FULL, LETTERS, LETTER_COLORS, LONG_TURN_MS, LONG_TURN_WORD, RANK_START, RANK_TOP, TIME_LINE, YAJUU_DAY_LINE,
  applyPoints, artFor, chantFor, initialGame, letterStates, lettersLine, logItem,
  popText, remember, sinLine, sinSpeaks, spinWord, titleFor, toStats, type LetterState,
} from './game.ts'
import { STRINGS, VERBS, glossed, lineMeaning, memeMeaning, pickLang, type Lang, type Strings } from './i18n.ts'
import {
  LEGACY_COPY, NO_PROGRESS, add, coronations, crownsFrom, crownsOwed, dayCopy, emptyLedger, foundKey, isEmpty, legacyKeys, liftToTop,
  nextResetMs, progressKey, rankOf, readLedger, resetKey, staleKeys, type Ledger, type Progress,
} from './ledger.ts'
import { homo } from './homo.ts'
import { BEAST_FRAMES, CROWD_FRAMES, DIGITS_BIG, DIGITS_SMALL, TEA_FRAMES, type Picture } from './pixels.ts'
import { buildLibrary, joinPath, mimeOf, playlist, psScript, winPath, type Clip, type Library, type SoundEvent } from './sounds.ts'

// inmu-king: a joke mod. Every 淫夢 meme in a prompt (or, at half points, in
// Claude's reply) lights letters of T A D O K O R O in the band above the
// prompt, each lit letter its own rainbow color, with a "+3 田所浩二" and the
// meme's meaning beside them for two seconds. Eight letters is a burst: a
// chant and a picture that moves (a crowned beast, a draining glass of iced
// tea, 114514 in rainbow digits, in turn), a jingle, and one rank up a chart
// that starts at #20. Reaching #1 is the coronation: a dancing crowd, a
// fanfare, and the next reply ends with やりますねぇ！ (one system-prompt
// section, that turn only, interactive sessions only). Every meme found goes
// into a collection (梗圖鑑). Turn durations are written as 114514 arithmetic.
//
// The memes stay Japanese; their meanings and every sentence of the mod come
// in the language the `language` setting picks (i18n.ts). /inmu burst and
// /inmu king are demos: they show and play, and change no standing.
//
// Sound is the mod's own jingles (sounds/*.wav) or the person's own clips in
// one folder (sounds.ts says how they are named); Windows plays them through
// PowerShell, macOS through $.audio, other platforms stay silent.
//
// The game lives in $.state (a hot reload keeps it). The progress and the
// collection live in $.store as key names (ledger.ts): every copy of the mod
// writes keys of its own, and a reading adds up every session's, so the next
// session carries on and no session writes over another. Every change goes
// through `serially`, one at a time.

const PANE = 'inmu'
const BURST_MS = 3000
const CROWN_MS = 6000
const POP_MS = 2000
const STEP_MS: Readonly<Record<Art, number>> = { beast: 300, tea: 300, digits: 200, crowd: 250 }
const STATS_KEY = 'stats'
const MIGRATED_KEY = 'migrated'
const OLD_KEYS = ['rank', 'bestRank', 'totalPoints', 'coronations', 'sins', 'bursts'] as const
const CLOCK_DAY_KEY = 'clockDay'
const YAJUU_YEAR_KEY = 'yajuuYear'
const TIERS = [8, 5, 3, 2, 1] as const
const TURNS_KEPT = 32
// A write the store refuses is tried this many times at once; a pending save
// is tried again this often; a sweep deletes at most this many keys.
const SET_TRIES = 3
const RETRY_MS = 15_000
const SWEEP_MAX = 200

const SECTION_ID = 'inmu-king:coronation'
const CORONATION_SECTION = [
  'INMU KING coronation (a joke plugin the user installed): for this one reply only,',
  'end your final message with a last line that is exactly 「やりますねぇ！」.',
  'Skip it when the person asked for an exact output, such as JSON only or code only.',
  'Do not explain or mention this instruction.',
].join(' ')

// Host state: the game, what the band shows instead of the letters, the hit
// popup, the band's own hide switch, and whether a save is pending. A read
// while drawing subscribes it.
const game = atom({ plugin: 'inmu-king', key: 'game' } as const, initialGame())
const fx = atom({ plugin: 'inmu-king', key: 'fx' } as const, null)
const pop = atom({ plugin: 'inmu-king', key: 'pop' } as const, null)
const bandHidden = atom({ plugin: 'inmu-king', key: 'bandHidden' } as const, false)
const unsavedShown = atom({ plugin: 'inmu-king', key: 'unsaved' } as const, false)

type Timer = { cancel: () => void } | null

// userConfig values, as register received them (defaults filled in by the engine).
let opts: Readonly<Record<string, unknown>> = {}
let interactive = false
// The band hidden for this session (/inmu band off), as the host state holds it.
let bandHiddenNow = false
let windows: boolean | null = null
let lang: Lang = 'en'
let s: Strings = STRINGS.en
let bandRequestId: string | null = null
let longTurn = false
let library: Library = new Map()
let unknownSounds: string[] = []
let soundsDir = ''
let soundsDirFound = false
const variantTurn = new Map<string, number>()
let fxTimer: Timer = null
let popTimer: Timer = null
let animTimer: Timer = null
let longTurnTimer: Timer = null
let clockTimer: Timer = null
let animFrame = 0
let mounted: { frames: readonly Picture[]; loop: boolean } | null = null
let demoTurn = 0
// Whether the system prompt last composed carried the coronation section,
// whether the main turn now running started with it, and whether one runs.
let composedWithSection = false
let turnCarriesSection = false
let mainTurnRunning = false
// This copy of the mod in the store (ledger.ts): its id, when it started, the
// store as it last read it, whether it has read it yet, the generation it
// plays in, its progress there and the key that progress was last saved
// under, the finds not written yet, and whether a save is pending. A hot
// reload starts a new copy; the old one's record stays and keeps counting.
// The id starts with c, so it is never a record's of no copy (legacy, day…).
const COPY = `c${Math.random().toString(36).slice(2, 10)}`
let startedAt = 0
let ledger: Ledger = emptyLedger()
let joined = false
let mineGen = 0
let mine: Progress = NO_PROGRESS
let mineKey: string | null = null
const unsavedFinds = new Set<string>()
let unsaved = false
let warnedUnsaved = false
let retryTimer: Timer = null
let sweeping = false
// Whether 0.3.0's store still waits to be carried over, and an August 10
// lift the store has not taken yet.
let legacyPending = true
let unsavedDay: { key: string; gen: number } | null = null
// Each turn's output tokens by its duration: the turn line carries no turn id.
const tokensByDuration = new Map<number, number>()
let queue: Promise<unknown> = Promise.resolve()

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
const soundOn = () => flag(opts.sound, true)
const infectOn = () => flag(opts.infect, true)
const claudeCounts = () => flag(opts.claude_counts, true)
const bandOn = () => flag(opts.band, true)

// The Japanese as it is, its meaning beside it in the session's language.
const glossLine = (line: string) => glossed(lang, line, lineMeaning(lang, line))
const glossMeme = (hit: { id?: string; label: string }) => glossed(lang, hit.label, hit.id === undefined ? '' : memeMeaning(lang, hit.id))

// One change to the game or the tallies at a time: each reads what the one
// before it wrote. Hooks and buttons call it; nothing inside it does, so it
// never waits on itself.
function serially<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)
  return run
}

// `claude plugin validate` only lets `$` flow into top-level function
// declarations of this file, so every helper that takes `$` lives here.

async function readGame($: any): Promise<Game> {
  try {
    return await read($, game)
  } catch {
    return initialGame()
  }
}

// Every session's progress in this generation: the other copies as last
// read, this copy as it stands.
function standing(): Progress {
  let total = mine
  for (const [copy, p] of ledger.copies) {
    if (copy !== COPY) total = add(total, p)
  }
  return total
}

const foundCount = () => LEXICON.filter(entry => ledger.found.has(entry.id)).length

// The coronations every session's progress makes (ledger.ts counts them).
const crownCount = () => coronations(standing(), ledger.copies.get(LEGACY_COPY))

// The host's clock, or the module's own when the host's is away.
async function clockNow($: any): Promise<number> {
  try {
    return await $.clock.now()
  } catch {
    return Date.now()
  }
}

// Reads every key at once and follows what changed: other sessions' progress
// and finds, and a reset made elsewhere (any other generation: a newer one,
// or an older one when the store was cleared), which starts this copy's
// progress over in it (what it had not saved belonged to the old one) and
// takes the game back to the start. The first reading joins: what this copy
// made before it counts in the generation it finds, unless that generation
// began after this copy started (the store could not be read till now, and a
// reset came meanwhile). The game's rank and the status line follow every
// session's progress; a pending save gets its next try. False when the store
// cannot be read: the last reading stands. Runs inside `serially`.
async function refresh($: any): Promise<boolean> {
  let keys: string[]
  try {
    keys = await $.store.keys()
  } catch {
    // The old store waits for a reading: the band says so, and the timer tries again.
    if (legacyPending) await markUnsaved($, true)
    return false
  }
  // The old store comes over first, so this reading counts it (as much of
  // it as the store took), and an August 10 lift the store has not taken yet
  // counts as well.
  if (legacyPending) keys = [...keys, ...(await carryLegacy($, keys, readLedger(keys).gen))]
  if (unsavedDay !== null) keys = [...keys, unsavedDay.key]
  const next = readLedger(keys)
  const isReset = joined ? next.gen !== mineGen : next.gen > startedAt
  const findsReset = joined ? next.foundGen !== ledger.foundGen : next.foundGen > startedAt
  if (findsReset) unsavedFinds.clear()
  for (const meme of unsavedFinds) next.found.add(meme)
  ledger = next
  joined = true
  mineGen = next.gen
  if (isReset) mine = NO_PROGRESS
  const rank = rankOf(standing())
  let moved = null as Game | null
  try {
    await update($, game, x => {
      const g = isReset ? { ...initialGame(rank), muted: x.muted } : x.rank === rank ? x : { ...x, rank }
      moved = g === x ? null : g
      return g
    })
  } catch { /* no host state here */ }
  if (moved !== null) status($, moved)
  if (unsaved || legacyPending) await save($)
  return true
}

// Sets a key (a ledger key's value is `true`). The store refuses a write
// while another session holds its lock ("Lock file is already being held"),
// so a refused one is tried again at once, a few times, before it counts as
// failed.
async function setKey($: any, key: string, value: unknown = true): Promise<void> {
  for (let tries = 1; ; tries++) {
    try {
      await $.store.set(key, value)
      return
    } catch (err) {
      if (tries >= SET_TRIES) throw err
    }
  }
}

// Writes this copy's progress under its next key, then deletes the key before
// it, and every find not written yet. A key holds the whole progress, so the
// next write carries whatever one that failed did not; a failure leaves the
// save pending (`markUnsaved`), and so does an old store not carried over
// yet. Before its first reading this copy does not know the generation, so
// the save waits for that reading. Runs inside `serially`.
async function save($: any): Promise<void> {
  if (!joined) {
    await markUnsaved($, true)
    return
  }
  let failed = false
  const key = isEmpty(mine) ? null : progressKey(mineGen, COPY, mine)
  if (key !== null && key !== mineKey) {
    try {
      await setKey($, key)
      const before = mineKey
      mineKey = key
      if (before !== null) {
        try {
          await $.store.delete(before)
        } catch { /* a key left behind counts nothing twice; a sweep takes it */ }
      }
    } catch {
      failed = true
    }
  }
  for (const meme of [...unsavedFinds]) {
    try {
      await setKey($, foundKey(ledger.foundGen, meme))
      unsavedFinds.delete(meme)
    } catch {
      failed = true
      break
    }
  }
  // August 10's lift, while its generation lasts.
  if (unsavedDay !== null && unsavedDay.gen !== mineGen) unsavedDay = null
  if (unsavedDay !== null) {
    try {
      await setKey($, unsavedDay.key)
      unsavedDay = null
    } catch {
      failed = true
    }
  }
  await markUnsaved($, failed || legacyPending)
}

// A save pending: the band says so, the session's first one toasts, and a
// timer reads the store again every 15 s (which saves) until a save lands.
async function markUnsaved($: any, pending: boolean): Promise<void> {
  if (pending) {
    if (!warnedUnsaved) {
      warnedUnsaved = true
      toast($, s.saveFailed, 6000)
    }
    if (retryTimer === null) retryTimer = $.clock.every(RETRY_MS, () => { void serially(() => refresh($)) })
  } else {
    retryTimer?.cancel()
    retryTimer = null
  }
  if (pending === unsaved) return
  unsaved = pending
  try {
    await update($, unsavedShown, () => pending)
  } catch { /* no host state here */ }
}

// Deletes what no reading counts any more (ledger.ts says which), a few
// hundred keys at a time. It runs beside the queue, not in it, so a prompt
// never waits for it: a key it judges stale stays stale, and no write of
// this copy's needs one. A copy a step behind may write an old key again;
// the next sweep takes it.
async function sweep($: any): Promise<void> {
  if (sweeping) return
  sweeping = true
  try {
    let keys: string[]
    try {
      keys = await $.store.keys()
    } catch {
      return
    }
    for (const key of staleKeys(keys).slice(0, SWEEP_MAX)) {
      try {
        await $.store.delete(key)
      } catch {
        return
      }
    }
  } finally {
    sweeping = false
  }
}

// 0.1.0 kept one key per number: they fold into one key, `stats`, and are
// never read again (a 0.1.0 copy still running somewhere keeps writing them).
// False when the store failed it. Runs inside `serially`.
async function migrate($: any): Promise<boolean> {
  try {
    if ((await $.store.get(STATS_KEY)) !== undefined || (await $.store.get(MIGRATED_KEY)) === true) return true
    const old: Record<string, unknown> = {}
    let isOld = false
    for (const key of OLD_KEYS) {
      const v = await $.store.get(key)
      if (v !== undefined) {
        old[key] = v
        isOld = true
      }
    }
    if (isOld) await setKey($, STATS_KEY, toStats(old))
    await setKey($, MIGRATED_KEY, true)
    if (!isOld) return true
    for (const key of OLD_KEYS) {
      try {
        await $.store.delete(key)
      } catch { /* gone already */ }
    }
    return true
  } catch {
    return false
  }
}

// 0.3.0 kept the rank, the tallies and the collection in one key, `stats`
// (0.1.0's keys fold into it first): they become ledger keys of their own,
// the `legacy` record and its finds. It stays pending until the store takes
// every one of them, and each reading tries again. The same stats make the
// same keys, so every copy may write them; a legacy record already there is
// not written again, and of two a reading takes one whole snapshot. Before
// the first reset only: after it the old store is history. Returns the keys
// it wrote, all of them or as far as the store took them. Runs inside
// `serially`.
async function carryLegacy($: any, keys: readonly string[], gen: number): Promise<string[]> {
  if (gen !== 0) {
    legacyPending = false
    return []
  }
  if (!(await migrate($))) return []
  let raw: unknown
  try {
    raw = await $.store.get(STATS_KEY)
  } catch {
    return []
  }
  const have = new Set(keys)
  const written = keys.some(key => key.startsWith(`r:0:${LEGACY_COPY}:`))
  const missing = raw === undefined ? [] : legacyKeys(toStats(raw), KNOWN_IDS).filter(key => !have.has(key) && !(written && key.startsWith('r:')))
  const took: string[] = []
  for (const key of missing) {
    try {
      await setKey($, key)
      took.push(key)
    } catch {
      return took
    }
  }
  legacyPending = false
  return took
}

// The language: the setting, else Claude Code's own `language`, else the locale.
async function pickLanguage($: any): Promise<void> {
  let claude: any = {}
  try {
    claude = (await $.settings.read()) ?? {}
  } catch { /* no settings here */ }
  let locale: unknown = null
  try {
    locale = (await $.env.get('LC_ALL')) || (await $.env.get('LANG')) || (await $.env.get('LANGUAGE')) || null
  } catch { /* no environment here */ }
  lang = pickLang(opts.language, claude.language, locale)
  s = STRINGS[lang]
}

function toast($: any, text: string, timeoutMs = 4000): void {
  try {
    $.ui.toast(text, { timeoutMs })
  } catch { /* headless */ }
}

// The status line under the prompt keeps the standing only while the band is
// off: with the band on, the line would say the same thing twice.
function status($: any, g: Game): void {
  const text = bandOn() && !bandHiddenNow
    ? undefined
    : g.rank === RANK_TOP ? `👑 ${glossLine(titleFor(RANK_TOP))}` : s.status(g.rank, glossLine(titleFor(g.rank)), lettersLine(g.energy))
  try {
    $.ui.status(text)
  } catch { /* headless */ }
}

async function isWindows($: any): Promise<boolean> {
  if (windows !== null) return windows
  try {
    const os = await $.env.get('OS')
    windows = typeof os === 'string' && os.toLowerCase().includes('windows')
  } catch {
    windows = false
  }
  return windows
}

async function resolveSoundsDir($: any): Promise<string> {
  const set = typeof opts.sounds_dir === 'string' ? opts.sounds_dir.trim() : ''
  if (set !== '') return set
  let home = ''
  try {
    home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME')) || ''
  } catch { /* no environment here */ }
  return home ? joinPath(home, '.claude/inmu-king/sounds') : ''
}

async function scanSounds($: any): Promise<void> {
  soundsDir = await resolveSoundsDir($)
  library = new Map()
  unknownSounds = []
  soundsDirFound = false
  if (soundsDir === '') return
  try {
    const entries: Array<{ name: string; kind: string }> = await $.fs.list(soundsDir)
    soundsDirFound = true
    const built = buildLibrary(entries.filter(entry => entry.kind === 'file').map(entry => entry.name), LEXICON)
    library = built.library
    unknownSounds = built.unknown
  } catch { /* no folder yet */ }
}

// Variants take turns, each target on its own count.
function chooseVariant(target: string, files: readonly string[]): string {
  const n = variantTurn.get(target) ?? 0
  variantTurn.set(target, n + 1)
  return files[n % files.length]!
}

async function play($: any, clips: readonly Clip[]): Promise<void> {
  if (clips.length === 0) return
  const root = String($.plugin.root)
  const pathOf = (clip: Clip) => (clip.kind === 'builtin' ? joinPath(root, `sounds/${clip.name}`) : joinPath(soundsDir, clip.name))
  try {
    if (await isWindows($)) {
      const script = psScript(clips.map(clip => winPath(pathOf(clip))))
      await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 40_000 })
      return
    }
    for (const clip of clips) {
      if (clip.kind === 'builtin') {
        await $.audio.play({ asset: `sounds/${clip.name}` })
      } else {
        const bytes = await $.fs.read(pathOf(clip), { as: 'bytes' })
        await $.audio.play({ base64: bytes.base64, mime: mimeOf(clip.name) })
      }
    }
  } catch { /* a silent machine */ }
}

// Plays in the background: a clip never holds a prompt or a turn.
function sound($: any, event: SoundEvent, memeIds: readonly string[], muted: boolean): void {
  if (!soundOn() || muted) return
  const clips = playlist(event, memeIds, library, chooseVariant)
  $.clock.after(1, () => { void play($, clips) })
}

async function showFx($: any, effect: Fx, ms: number): Promise<void> {
  stopAnim()
  animFrame = 0
  try {
    await update($, fx, () => effect)
  } catch { /* no host state here */ }
  // Another show may have started while this one waited: one timer of each, always.
  stopAnim()
  animFrame = 0
  fxTimer?.cancel()
  fxTimer = $.clock.after(ms, () => { void endFx($) })
  animTimer = $.clock.every(STEP_MS[effect.art], () => { void stepAnim($) })
}

async function endFx($: any): Promise<void> {
  stopAnim()
  mounted = null
  try {
    await update($, fx, () => null)
  } catch { /* no host state here */ }
}

function stopAnim(): void {
  animTimer?.cancel()
  animTimer = null
}

async function stepAnim($: any): Promise<void> {
  const m = mounted
  if (bandRequestId === null || m === null) return
  if (!m.loop && animFrame >= m.frames.length - 1) return
  animFrame += 1
  const pic = m.frames[m.loop ? animFrame % m.frames.length : animFrame]!
  try {
    await $.ui.blit({ requestId: bandRequestId, key: 'art', cells: pic.cells })
  } catch { /* not mounted */ }
}

async function showPop($: any, p: Pop): Promise<void> {
  try {
    await update($, pop, () => p)
  } catch { /* no host state here */ }
  popTimer?.cancel()
  popTimer = $.clock.after(POP_MS, () => { void clearPop($) })
}

async function clearPop($: any): Promise<void> {
  popTimer?.cancel()
  popTimer = null
  try {
    await update($, pop, () => null)
  } catch { /* no host state here */ }
}

// What a hit shows beside a burst or the crown: the popup's text, and the
// energy before it (the letters it lit are drawn inverse).
type Shown = { text: string; from: number }

const shownFx = (hit: Shown | undefined) => (hit === undefined ? {} : { hit: hit.text, from: hit.from })

// The burst's show: the chant at `index` and its picture, in turn, under the
// hit that set it off when a hit did.
async function burst($: any, index: number, hit?: Shown): Promise<void> {
  const text = chantFor(index)
  await clearPop($)
  await showFx($, { kind: 'burst', text, art: artFor(index), until: Date.now() + BURST_MS, ...shownFx(hit) }, BURST_MS)
  toast($, glossLine(text), BURST_MS)
}

async function crown($: any, hit?: Shown): Promise<void> {
  await clearPop($)
  await showFx($, { kind: 'crown', text: CROWN_CHANT, art: 'crowd', until: Date.now() + CROWN_MS, ...shownFx(hit) }, CROWN_MS)
  toast($, glossLine(CROWN_TOAST), CROWN_MS)
}

// Adds the hits to the game, to this copy's progress and to the collection,
// then shows and plays what they earned: the popup and a hit sound, or a
// burst or the crown with the hit beside it. The rank it climbs from, and the
// coronations its bursts make, are every session's, as the store holds it now
// (the game's own, while the store cannot be read yet). Runs inside `serially`.
async function award($: any, hits: readonly Hit[], by: By): Promise<void> {
  const points = Math.min(16, hits.reduce((sum, hit) => sum + hit.points, 0))
  if (points <= 0) return
  await refresh($)
  const now = Date.now()
  const items = hits.map(hit => logItem(hit.label, hit.points, by, now))
  const before = standing()
  const legacy = ledger.copies.get(LEGACY_COPY)
  const crownsBefore = coronations(before, legacy)
  const grow = (x: Game) => {
    const result = applyPoints({ ...x, rank: joined ? rankOf(before) : x.rank }, points)
    const made = joined ? coronations(add(before, { bursts: result.bursts }), legacy) - crownsBefore : crownsFrom(x.rank, result.bursts)
    return { result, made, game: { ...remember(result.game, items), crownPending: x.crownPending || (made > 0 && infectOn()) } }
  }
  // The game moves on from what it holds at the write, not from an earlier read.
  let from = 0
  let { result: out, made, game: next } = grow(initialGame())
  try {
    await update($, game, x => {
      from = x.energy
      ;({ result: out, made, game: next } = grow(x))
      return next
    })
  } catch { /* no host state here: as if the game had just begun */ }
  mine = add(mine, { points, bursts: out.bursts, crowns: made })
  const fresh = [...new Set(hits.map(hit => hit.id))].filter(id => KNOWN_IDS.has(id) && !ledger.found.has(id))
  for (const id of fresh) {
    ledger.found.add(id)
    unsavedFinds.add(id)
  }
  await save($)
  // A burst here may be the one that reached #1 together with another
  // session's, each counted from a reading before the other's: a fresh reading
  // says whether a coronation is owed, and this copy plays it. A session that
  // did not burst never plays one. When the reading fails, the next burst
  // (here or in any session, at #1 by then) plays what is owed.
  if (out.bursts > 0) {
    const read = await refresh($)
    const owed = read ? crownsOwed(new Map(ledger.copies).set(COPY, mine)) : 0
    if (owed > 0) {
      mine = add(mine, { crowns: owed })
      made += owed
      try {
        await update($, game, x => ({ ...x, crownPending: x.crownPending || infectOn() }))
      } catch { /* no host state here */ }
      await save($)
    }
    next = await readGame($)
  }
  // The game's write drew before the tallies changed: draw again with them.
  try { $.ui.invalidate('ui.render') } catch { /* headless */ }
  status($, next)
  const memes = [...hits].sort((a, b) => b.points - a.points).map(hit => hit.id)
  const shown: Shown = { text: popText(hits, by, fresh.length > 0, glossMeme), from }
  if (made > 0) {
    await crown($, shown)
    sound($, 'crown', memes, next.muted)
  } else if (out.bursts > 0) {
    await burst($, before.bursts + out.bursts - 1, shown)
    sound($, 'burst', memes, next.muted)
  } else {
    await showPop($, { ...shown, until: now + POP_MS })
    sound($, 'hit', memes, next.muted)
  }
}

// A sin is the session's own: the panel and /inmu count this session's.
// Runs inside `serially`.
async function sin($: any): Promise<void> {
  // The count as written: a read after the write could see this dispatch's earlier moment.
  let sins = 0
  let muted = false
  try {
    await update($, game, x => {
      sins = x.sins + 1
      muted = x.muted
      return { ...x, sins }
    })
  } catch {
    return
  }
  if (sinSpeaks(sins)) {
    toast($, s.sinToast(glossLine(sinLine(sins)), sins))
    sound($, 'sin', [], muted)
  }
}

// The main loop's turn ended. The reply that started with the coronation
// section spends it once answered; one cut short leaves it for the next. Any
// other answered reply counts at half points. Every answered turn reads the
// store, so the band keeps up with the other sessions. Runs inside `serially`.
async function endTurn($: any, reason: string, answer: unknown, carried: boolean): Promise<void> {
  if (reason !== 'answer') return
  if (carried) {
    let spent = false
    try {
      await update($, game, x => {
        spent = x.crownPending
        return { ...x, crownPending: false }
      })
    } catch { /* no host state here */ }
    if (spent) {
      await refresh($)
      return
    }
  }
  const found = claudeCounts() && typeof answer === 'string' ? detect(answer, 0.5) : null
  if (found !== null && found.points > 0) await award($, found.hits, 'claude')
  else await refresh($)
}

// A crown the calendar gives (August 10): every session's chart goes to #1,
// through the day's one record (`day<year>`), which any session that day may
// write; a reading takes the smallest lift of them (ledger.ts). The lift
// reaches #1 from the chart without any day's lift, or goes one rank past #1
// when the chart is there already, so the day makes one coronation. No burst,
// and the letters stay as they are. Runs inside `serially`, after a reading.
async function forceCrown($: any, year: number): Promise<void> {
  const legacy = ledger.copies.get(LEGACY_COPY)
  const before = coronations(standing(), legacy)
  const lift = liftToTop(new Map(ledger.copies).set(COPY, mine))
  unsavedDay = { key: progressKey(mineGen, dayCopy(year), { ...NO_PROGRESS, lift }), gen: mineGen }
  // The save writes the day's record, or keeps it pending; the reading counts it either way.
  await save($)
  if (!(await refresh($))) ledger.copies.set(dayCopy(year), { ...NO_PROGRESS, lift })
  mine = add(mine, { crowns: Math.max(0, coronations(standing(), legacy) - before) })
  const rank = rankOf(standing())
  let next: Game = { ...initialGame(rank), crownPending: infectOn() }
  try {
    await update($, game, x => (next = { ...x, rank, crownPending: x.crownPending || infectOn() }))
  } catch { /* no host state here */ }
  await save($)
  try { $.ui.invalidate('ui.render') } catch { /* headless */ }
  status($, next)
  await crown($)
  sound($, 'crown', [], next.muted)
}

// The demos show and play, and change nothing else: no points, no rank, no
// log, no tallies, no coronation section. Bursts take their pictures in turn.
async function demoBurst($: any): Promise<void> {
  const index = demoTurn
  demoTurn += 1
  await burst($, index)
  sound($, 'burst', [], (await readGame($)).muted)
}

async function demoCrown($: any): Promise<void> {
  await crown($)
  sound($, 'crown', [], (await readGame($)).muted)
}

// Runs inside `serially`.
async function setMuted($: any, muted: boolean): Promise<void> {
  try {
    await update($, game, g => ({ ...g, muted }))
  } catch { /* no host state here */ }
}

// Back to #20 with the letters dark, for every session: a reset key starts a
// generation newer than any this copy has seen, and every other copy follows
// it at its next reading. The collection stays unless `all`; the session's
// mute stays as it is. False when the store did not take the reset: nothing
// changes then. Runs inside `serially`; `reset` sweeps the old keys after.
async function resetAll($: any, all: boolean): Promise<boolean> {
  await refresh($)
  const gen = nextResetMs(await clockNow($), Math.max(ledger.gen, mineGen))
  try {
    await setKey($, resetKey(all, gen))
  } catch {
    return false
  }
  stopAnim()
  fxTimer?.cancel()
  popTimer?.cancel()
  mounted = null
  if (all) unsavedFinds.clear()
  // The old store and August 10's lift belong to the generation that ended.
  legacyPending = false
  unsavedDay = null
  ledger = { gen, foundGen: all ? gen : ledger.foundGen, copies: new Map(), found: all ? new Set() : ledger.found }
  mineGen = gen
  mine = NO_PROGRESS
  let fresh = initialGame()
  try {
    await update($, fx, () => null)
    await update($, pop, () => null)
    await update($, game, x => (fresh = { ...initialGame(), muted: x.muted }))
  } catch { /* no host state here */ }
  // Nothing of the old generation is left to save; the finds not written yet are.
  await save($)
  status($, fresh)
  return true
}

// A reset the person asked for, then a sweep of the keys it left stale.
async function reset($: any, all: boolean): Promise<boolean> {
  const done = await serially(() => resetAll($, all))
  if (done) void sweep($)
  return done
}

// The panel's reset button: the same reset, and a toast when the store did not take it.
async function resetFromPane($: any): Promise<void> {
  if (!(await reset($, false))) toast($, s.resetFailed)
}

async function openPane($: any): Promise<boolean> {
  if (!interactive) return false
  try {
    const opened = await $.ui.open({ id: PANE, title: '淫夢の王', focus: true, closeOnEscape: true, rows: 24 })
    return opened.isPlaced === true
  } catch {
    return false
  }
}

async function statusText($: any): Promise<string> {
  const g = await readGame($)
  const t = standing()
  return [
    s.standing(g.rank, glossLine(titleFor(g.rank)), lettersLine(g.energy), g.energy),
    s.tallies(crownCount(), t.points, g.sins, foundCount(), LEXICON.length, s.sound(g.muted, soundOn())),
    g.log.length > 0 ? s.recent(g.log.slice(0, 5).map(item => `${item.label}+${item.points}`)) : s.noMemesYet,
  ].join('\n')
}

function soundsReport(): string {
  const shown = windows ? winPath(soundsDir) : soundsDir
  const lines: string[] = [s.soundFolder(shown || s.noHome)]
  if (!soundsDirFound) lines.push(s.folderMissing)
  else if (library.size === 0) lines.push(s.noClips)
  else lines.push(s.placed(s.groups([...library].map(([to, files]) => `${to} ← ${s.list(files)}`))))
  if (unknownSounds.length > 0) lines.push(s.unplaced(s.list(unknownSounds)))
  lines.push(s.events)
  lines.push(s.memes(s.list(LEXICON.map(entry => (entry.id === entry.label ? entry.id : s.alias(entry.id, entry.label))))))
  lines.push(s.howToName)
  return lines.join('\n')
}

// 11:45:14, once a day: three points and a toast.
const isClockTime = (d: Date) => d.getHours() === 11 && d.getMinutes() === 45 && d.getSeconds() >= 14 && d.getSeconds() <= 16

// Runs inside `serially`.
async function tick($: any): Promise<void> {
  const d = new Date()
  if (!isClockTime(d)) return
  const day = d.toDateString()
  try {
    if ((await $.store.get(CLOCK_DAY_KEY)) === day) return
    await $.store.set(CLOCK_DAY_KEY, day)
  } catch { /* no store here */ }
  toast($, glossLine(TIME_LINE))
  await award($, [{ id: 'time', label: '11:45:14', points: 3 }], 'clock')
}

// August 10, once a year: the chart goes to #1 for every session. It takes a
// reading of the store and the year's mark in it; without them the day waits
// for the next session's start. Runs inside `serially`.
async function yajuuDay($: any): Promise<void> {
  const d = new Date(await clockNow($))
  if (d.getMonth() !== 7 || d.getDate() !== 10 || !joined) return
  const year = d.getFullYear()
  try {
    if ((await $.store.get(YAJUU_YEAR_KEY)) === year) return
    await setKey($, YAJUU_YEAR_KEY, year)
  } catch {
    return
  }
  toast($, glossLine(YAJUU_DAY_LINE), 6000)
  await forceCrown($, year)
}

// The burst's or the coronation's picture where the surface draws cells and
// the band has the room beside its `textRows` lines; nothing elsewhere. The
// frame shown is the one the animation stands at, so a redraw mid-way does
// not jump back.
function drawArt($: any, e: any, kind: Art, textRows: number): any {
  if (e.surface !== 'terminal') return null
  const fits = (p: Picture) => e.props.bodyColumns >= p.columns && e.props.maxRows >= p.rows + textRows
  const frames: readonly Picture[] =
    kind === 'beast' ? BEAST_FRAMES
      : kind === 'tea' ? TEA_FRAMES
        : kind === 'digits' ? (fits(DIGITS_BIG[0]!) ? DIGITS_BIG : DIGITS_SMALL)
          : CROWD_FRAMES
  if (!fits(frames[0]!)) {
    mounted = null
    return null
  }
  const loop = kind !== 'tea'
  mounted = { frames, loop }
  const pic = frames[loop ? animFrame % frames.length : Math.min(animFrame, frames.length - 1)]!
  const { Raster } = $.ui.resolve(e)
  return <Raster key="art" columns={pic.columns} rows={pic.rows} cells={pic.cells} />
}

// A lit letter wears its rainbow color, one just lit is drawn inverse, a dark one is dim.
const letterLook = (state: LetterState, i: number) =>
  state === 'dark' ? { dimColor: true } : state === 'fresh' ? { bold: true, inverse: true, color: LETTER_COLORS[i] } : { bold: true, color: LETTER_COLORS[i] }

const countsAsTyped = (origin: unknown): boolean => {
  const kind = typeof origin === 'object' && origin !== null ? (origin as { kind?: unknown }).kind : undefined
  return kind === undefined || kind === 'composer' || kind === 'bridge' || kind === 'sdk' || kind === 'unclassified'
}

export const register: Register = (on, options) => {
  opts = options ?? {}

  on('session.start', async ($, e, next) => {
    interactive = e.isInteractive === true
    await pickLanguage($)
    // A reload keeps the session's band switch.
    try {
      bandHiddenNow = await read($, bandHidden)
    } catch { /* no host state here */ }
    // A reload leaves no timer behind, so whatever the band was showing goes;
    // a save the copy before it left pending is that copy's, and its record
    // in the store is as far as it got.
    try {
      await update($, fx, () => null)
      await update($, pop, () => null)
      await update($, unsavedShown, () => false)
    } catch { /* no host state here */ }
    startedAt = await clockNow($)
    // The first reading: it carries the old store over and joins the generation.
    await serially(() => refresh($))
    await $.command.register({ name: 'inmu', description: s.commandDescription, argumentHint: VERBS })
    await isWindows($)
    await scanSounds($)
    status($, await readGame($))
    clockTimer?.cancel()
    clockTimer = $.clock.every(1000, () => {
      if (isClockTime(new Date())) void serially(() => tick($))
    })
    await serially(() => yajuuDay($))
    void sweep($)
    return next(e)
  })

  // The session ends: a save still pending gets one more try.
  on('session.end', async ($, e, next) => {
    if (unsaved) {
      try {
        await serially(() => refresh($))
      } catch { /* the session ends as it would */ }
    }
    retryTimer?.cancel()
    retryTimer = null
    return next(e)
  })

  // What you type: every meme lights letters. Observe only; the prompt goes on as typed.
  on('prompt.submit', async ($, e, next) => {
    try {
      if (e.command === undefined && e.isMeta !== true && countsAsTyped(e.origin)) {
        const found = detect(e.text)
        if (found.points > 0) await serially(() => award($, found.hits, 'you'))
      }
    } catch { /* the prompt goes on untouched */ }
    return next(e)
  })

  // The main loop's turn: the system prompt composed for it says whether it
  // carries the coronation; a subagent's run changes nothing here.
  on('turn.start', ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    mainTurnRunning = true
    turnCarriesSection = composedWithSection
    longTurn = false
    longTurnTimer?.cancel()
    longTurnTimer = $.clock.after(LONG_TURN_MS, () => {
      longTurn = true
      try { $.ui.invalidate('ui.render') } catch { /* headless */ }
    })
    return next(e)
  })

  // What Claude says counts at half points, except the coronation reply itself.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    longTurnTimer?.cancel()
    longTurn = false
    if (e.usage) {
      tokensByDuration.set(e.durationMs, e.usage.output_tokens)
      for (const old of tokensByDuration.keys()) {
        if (tokensByDuration.size <= TURNS_KEPT) break
        tokensByDuration.delete(old)
      }
    }
    const carried = turnCarriesSection
    turnCarriesSection = false
    mainTurnRunning = false
    try {
      await serially(() => endTurn($, e.reason, e.answer, carried))
    } catch { /* the turn ends as it would */ }
    return next(e)
  })

  // A tool that errors, or is refused, is a sin.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const r = ran as { isError?: boolean; deny?: unknown }
      if (r.isError === true || r.deny !== undefined) await serially(() => sin($))
    } catch { /* the result stands */ }
    return ran
  })

  // The coronation reply: one extra section, the next main turn only, and only
  // where a person reads the reply (never `-p` or the SDK). /context's
  // analysis and a teammate's prompt are not the reply's; a prompt composed
  // mid-turn keeps what the turn began with, so a crown that lands mid-turn
  // waits for the next turn.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const traits: readonly string[] = e.traits ?? []
    if (traits.includes('analysis') || traits.includes('teammate')) return composed
    const g = await readGame($)
    const wanted = g.crownPending && infectOn() && interactive
    const add = mainTurnRunning ? wanted && turnCarriesSection : wanted
    if (!mainTurnRunning) composedWithSection = add
    if (!add) return composed
    return { sections: [...composed.sections, { id: SECTION_ID, text: CORONATION_SECTION, scope: 'session' as const }] }
  })

  on('command.run', { command: 'inmu' }, async ($, e) => {
    const [first = '', ...rest] = e.args.trim().split(/\s+/)
    const verb = first.toLowerCase()
    const tail = rest.join(' ').trim()
    switch (verb) {
      case '':
      case 'status':
      case 'panel': {
        await serially(() => refresh($))
        const opened = await openPane($)
        return { text: `${await statusText($)}${opened ? `\n${s.panelOpened}` : ''}` }
      }
      case 'burst':
        await demoBurst($)
        return { text: s.demoBurst }
      case 'king':
        await demoCrown($)
        return { text: s.demoCrown }
      case 'sounds':
        await scanSounds($)
        return { text: soundsReport() }
      case 'mute':
      case 'unmute':
        await serially(() => setMuted($, verb === 'mute'))
        return { text: verb === 'mute' ? s.muted : s.unmuted }
      case 'reset': {
        const all = tail.toLowerCase() === 'all'
        if (!(await reset($, all))) return { text: s.resetFailed }
        return { text: all ? s.resetAll : s.reset }
      }
      case 'band': {
        const want = tail.toLowerCase()
        if (want !== 'on' && want !== 'off') return { text: s.bandUsage }
        const hide = want === 'off'
        bandHiddenNow = hide
        try {
          await update($, bandHidden, () => hide)
        } catch { /* no host state here */ }
        // The standing moves to the status line while the band is off, and back.
        status($, await readGame($))
        return { text: hide ? s.bandHidden : s.bandShown }
      }
      case 'homo': {
        const n = Number(tail)
        if (tail === '' || !Number.isFinite(n)) return { text: s.homoUsage }
        return { text: `${Math.round(n)} = ${homo(n)}` }
      }
      default:
        return { text: s.unknownVerb(first) }
    }
  })

  // The band: the letters in rainbow (the ones a hit just lit drawn inverse),
  // the hit beside them, the rank and the title with its meaning, and 未存
  // while a save is pending. A burst or the coronation shows its chant and
  // picture under the hit that set it off, every letter lit for the show
  // alone: the letters come back as the game holds them. A band another mod
  // draws stays under it; the feedback survey takes the whole band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    bandRequestId = e.requestId
    let g = initialGame()
    let effect: Fx | null = null
    let popped: Pop | null = null
    let hidden = false
    let pending = false
    try {
      g = await read($, game)
      effect = await read($, fx)
      popped = await read($, pop)
      hidden = await read($, bandHidden)
      pending = await read($, unsavedShown)
    } catch { /* no host state: draw what the module knows */ }
    if (e.props.hasSurvey || !bandOn() || hidden) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    let ours: any
    if (effect !== null) {
      const meaning = lineMeaning(lang, effect.text)
      const art = drawArt($, e, effect.art, effect.hit === undefined ? 1 : 2)
      const states = letterStates(FULL, effect.from ?? 0)
      ours = (
        <Box flexDirection="column">
          {effect.hit !== undefined && (
            <Box columnGap={1}>
              <Box columnGap={1}>
                {LETTERS.map((letter, i) => <Text key={`letter-${i}`} {...letterLook(states[i]!, i)}>{letter}</Text>)}
              </Box>
              <Text bold color="green" wrap="truncate-end">{effect.hit}</Text>
            </Box>
          )}
          <Box columnGap={1}>
            <Text bold color={effect.kind === 'crown' ? 'yellow' : 'magenta'}>{effect.text}</Text>
            {meaning !== '' && <Text dimColor>{meaning}</Text>}
          </Box>
          {art}
        </Box>
      )
    } else {
      const states = letterStates(g.energy, popped !== null ? popped.from : g.energy)
      const title = titleFor(g.rank)
      // While the popup shows, the title's meaning gives it the room.
      const titleMeaning = popped === null ? lineMeaning(lang, title) : ''
      ours = (
        <Box columnGap={1}>
          <Box columnGap={1}>
            {LETTERS.map((letter, i) => <Text key={`letter-${i}`} {...letterLook(states[i]!, i)}>{letter}</Text>)}
          </Box>
          {popped !== null && <Text bold color="green" wrap="truncate-end">{popped.text}</Text>}
          <Text dimColor wrap="truncate-end">{`#${g.rank} ${title}`}</Text>
          {titleMeaning !== '' && <Text dimColor wrap="truncate-end">{titleMeaning}</Text>}
          {g.rank === RANK_TOP && <Text color="yellow">👑</Text>}
          {pending && <Text dimColor>{s.unsaved}</Text>}
          <Button key="pane" label={s.bandButton} hotkey="i" plain dimColor onPress={() => openPane($)} />
        </Box>
      )
    }
    // `maxRows` is read-only: the band passes `e` as it came, and a stack taller
    // than the room scrolls, as the engine lets a band do.
    const below = await next(e)
    return below ? <Box flexDirection="column">{ours}{below}</Box> : ours
  })

  // The panel (/inmu): the standing, the tallies, the collection by points
  // with each found meme's meaning, the last hits, and buttons.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const g = await readGame($)
    const t = standing()
    const { Box, Button, Text } = $.ui.resolve(e)
    const shown = (entry: Entry) => (ledger.found.has(entry.id) ? glossed(lang, entry.label, memeMeaning(lang, entry.id)) : '???')
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">{`淫夢の王 INMU KING · #${g.rank} ${glossLine(titleFor(g.rank))}`}</Text>
        <Text>{`${lettersLine(g.energy)}  (${g.energy}/8)`}</Text>
        <Text dimColor>{s.paneTallies(crownCount(), t.points, g.sins, g.muted)}</Text>
        <Text bold>{s.collection(foundCount(), LEXICON.length)}</Text>
        {TIERS.map(points => (
          <Text key={`tier-${points}`} wrap="wrap">{s.tier(points, LEXICON.filter(entry => entry.points === points).map(shown).join('  '))}</Text>
        ))}
        <Text dimColor wrap="wrap">
          {g.log.length > 0 ? s.recent(g.log.slice(0, 6).map(item => `${s.who(item.by)} ${item.label}+${item.points}`)) : s.noMemesYet}
        </Text>
        <Box columnGap={2}>
          <Button key="mute" label={s.muteButton(g.muted)} hotkey="1" plain onPress={() => serially(() => setMuted($, !g.muted))} />
          <Button key="reset" label={s.resetButton} hotkey="2" plain onPress={() => resetFromPane($)} />
          <Button key="close" label={s.closeButton} hotkey="0" plain dimColor onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })

  // The spinner's word: the long-turn tea, the king, or the chart's own words.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const g = await readGame($)
    if (longTurn) return next({ ...e, props: { ...e.props, word: LONG_TURN_WORD } })
    if (g.rank === RANK_TOP) return next({ ...e, props: { ...e.props, word: 'INMU KING', suffix: ' 👑' } })
    if (g.rank <= 10) return next({ ...e, props: { ...e.props, word: spinWord(g.rank + g.energy) } })
    return next(e)
  })

  // The line that closes a turn: its seconds (and the reply's tokens) as 114514 arithmetic.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const g = await readGame($)
    if (g.rank === RANK_START && g.energy === 0) return next(e)
    const { Text } = $.ui.resolve(e)
    const seconds = Math.max(1, Math.round(e.props.durationMs / 1000))
    const tokens = tokensByDuration.get(e.props.durationMs)
    return <Text dimColor>{s.turnLine(e.props.word, homo(seconds), tokens ? homo(tokens) : null)}</Text>
  })
}
