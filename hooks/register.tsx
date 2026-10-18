import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Art, By, Fx, Game, Pop } from '../types'
import { KNOWN_IDS, LEXICON, detect, type Entry, type Hit } from './lexicon.ts'
import {
  CROWN_CHANT, CROWN_TOAST, FULL, LETTERS, LETTER_COLORS, LONG_TURN_MS, LONG_TURN_WORD, RANK_START, RANK_TOP, TIME_LINE, YAJUU_DAY_LINE,
  applyPoints, artFor, chantFor, initialGame, letterStates, lettersLine, logItem,
  popText, remember, sinLine, sinSpeaks, spinWord, titleFor, toGame, type LetterState,
} from './game.ts'
import { STRINGS, VERBS, glossed, lineMeaning, memeMeaning, pickLang, type Lang, type Strings } from './i18n.ts'
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
// A session plays a game of its own. The game lives in $.state (a hot
// reload or a settings change keeps it); nothing goes to the plugin store,
// and the next session starts over at #20. Every change to the game goes
// through `serially`, one at a time.

const PANE = 'inmu'
const BURST_MS = 3000
const CROWN_MS = 6000
const POP_MS = 2000
const STEP_MS: Readonly<Record<Art, number>> = { beast: 300, tea: 300, digits: 200, crowd: 250 }
const TIERS = [8, 5, 3, 2, 1] as const
const TURNS_KEPT = 32

const SECTION_ID = 'inmu-king:coronation'
const CORONATION_SECTION = [
  'INMU KING coronation (a joke plugin the user installed): for this one reply only,',
  'end your final message with a last line that is exactly 「やりますねぇ！」.',
  'Skip it when the person asked for an exact output, such as JSON only or code only.',
  'Do not explain or mention this instruction.',
].join(' ')

// Host state: the game, what the band shows instead of the letters, the hit
// popup, and the band's own hide switch. A read while drawing subscribes it.
const game = atom({ plugin: 'inmu-king', key: 'game' } as const, initialGame())
const fx = atom({ plugin: 'inmu-king', key: 'fx' } as const, null)
const pop = atom({ plugin: 'inmu-king', key: 'pop' } as const, null)
const bandHidden = atom({ plugin: 'inmu-king', key: 'bandHidden' } as const, false)

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

// One change to the game at a time: each reads what the one before it wrote. Hooks and buttons call it; nothing inside it does, so it
// never waits on itself.
function serially<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)
  return run
}

// `claude plugin validate` only lets `$` flow into top-level function
// declarations of this file, so every helper that takes `$` lives here.

// The game as the host state holds it, and every change to it: an older
// version's game (a hot reload keeps the state) gets what it lacks first.
async function readGame($: any): Promise<Game> {
  try {
    return toGame(await read($, game))
  } catch {
    return initialGame()
  }
}

async function updateGame($: any, fn: (x: Game) => Game): Promise<void> {
  await update($, game, x => fn(toGame(x)))
}

// How many memes of the collection the session has found.
const foundCount = (g: Game) => LEXICON.filter(entry => g.found.includes(entry.id)).length

// The host's clock, or the module's own when the host's is away.
async function clockNow($: any): Promise<number> {
  try {
    return await $.clock.now()
  } catch {
    return Date.now()
  }
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

// Adds the hits to the game and to the collection, then shows and plays what
// they earned: the popup and a hit sound, or a burst or the crown with the
// hit beside it. Runs inside `serially`.
async function award($: any, hits: readonly Hit[], by: By): Promise<void> {
  const points = Math.min(16, hits.reduce((sum, hit) => sum + hit.points, 0))
  if (points <= 0) return
  const now = Date.now()
  const items = hits.map(hit => logItem(hit.label, hit.points, by, now))
  const ids = [...new Set(hits.map(hit => hit.id))].filter(id => KNOWN_IDS.has(id))
  const grow = (x: Game) => {
    const result = applyPoints(x, points)
    const fresh = ids.filter(id => !x.found.includes(id))
    const found = [...x.found, ...fresh]
    return { result, fresh, game: { ...remember(result.game, items), found, crownPending: x.crownPending || (result.crowns > 0 && infectOn()) } }
  }
  // The game moves on from what it holds at the write, not from an earlier read.
  let from = 0
  let { result: out, fresh, game: next } = grow(initialGame())
  try {
    await updateGame($, x => {
      from = x.energy
      ;({ result: out, fresh, game: next } = grow(x))
      return next
    })
  } catch { /* no host state here: as if the game had just begun */ }
  status($, next)
  const memes = [...hits].sort((a, b) => b.points - a.points).map(hit => hit.id)
  const shown: Shown = { text: popText(hits, by, fresh.length > 0, glossMeme), from }
  if (out.crowns > 0) {
    await crown($, shown)
    sound($, 'crown', memes, next.muted)
  } else if (out.bursts > 0) {
    // The chants and the pictures take turns over the session's bursts.
    await burst($, next.bursts - 1, shown)
    sound($, 'burst', memes, next.muted)
  } else {
    await showPop($, { ...shown, until: now + POP_MS })
    sound($, 'hit', memes, next.muted)
  }
}

// A tool call that errored or was refused: the first sin and every fifth
// speak. Runs inside `serially`.
async function sin($: any): Promise<void> {
  // The count as written: a read after the write could see this dispatch's earlier moment.
  let sins = 0
  let muted = false
  try {
    await updateGame($, x => {
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
// other answered reply counts at half points. Runs inside `serially`.
async function endTurn($: any, reason: string, answer: unknown, carried: boolean): Promise<void> {
  if (reason !== 'answer') return
  if (carried) {
    let spent = false
    try {
      await updateGame($, x => {
        spent = x.crownPending
        return { ...x, crownPending: false }
      })
    } catch { /* no host state here */ }
    if (spent) return
  }
  if (!claudeCounts() || typeof answer !== 'string') return
  const found = detect(answer, 0.5)
  if (found.points > 0) await award($, found.hits, 'claude')
}

// A crown the calendar gives (August 10): the session goes to #1, counted as
// a coronation, once a year (a hot reload keeps the year). No burst, and the
// letters stay as they are. Runs inside `serially`.
async function forceCrown($: any, year: number): Promise<void> {
  let crowned = false
  let next: Game = initialGame(RANK_TOP)
  try {
    await updateGame($, x => {
      crowned = x.crownYear !== year
      next = crowned ? { ...x, rank: RANK_TOP, crowns: x.crowns + 1, crownYear: year, crownPending: x.crownPending || infectOn() } : x
      return next
    })
  } catch {
    return
  }
  if (!crowned) return
  toast($, glossLine(YAJUU_DAY_LINE), 6000)
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
    await updateGame($, g => ({ ...g, muted }))
  } catch { /* no host state here */ }
}

// Back to #20 with the letters dark; the collection stays unless `all`, and
// so do the session's mute and the clock memes' days (a reset does not pay
// them out again). Runs inside `serially`.
async function resetAll($: any, all: boolean): Promise<void> {
  stopAnim()
  fxTimer?.cancel()
  popTimer?.cancel()
  mounted = null
  let fresh = initialGame()
  try {
    await update($, fx, () => null)
    await update($, pop, () => null)
    await updateGame($, x => (fresh = { ...initialGame(), muted: x.muted, found: all ? [] : x.found, clockDay: x.clockDay, crownYear: x.crownYear }))
  } catch { /* no host state here */ }
  status($, fresh)
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
  return [
    s.standing(g.rank, glossLine(titleFor(g.rank)), lettersLine(g.energy), g.energy),
    s.tallies(g.crowns, g.points, g.sins, foundCount(g), LEXICON.length, s.sound(g.muted, soundOn())),
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

// 11:45:14, once a day in a session: three points and a toast.
const isClockTime = (d: Date) => d.getHours() === 11 && d.getMinutes() === 45 && d.getSeconds() >= 14 && d.getSeconds() <= 16

// Runs inside `serially`, every second.
async function tick($: any): Promise<void> {
  const d = new Date(await clockNow($))
  if (!isClockTime(d)) return
  const day = d.toDateString()
  let due = false
  try {
    await updateGame($, x => {
      due = x.clockDay !== day
      return due ? { ...x, clockDay: day } : x
    })
  } catch {
    return
  }
  if (!due) return
  toast($, glossLine(TIME_LINE))
  await award($, [{ id: 'time', label: '11:45:14', points: 3 }], 'clock')
}

// August 10: the session starts crowned. Runs inside `serially`.
async function yajuuDay($: any): Promise<void> {
  const d = new Date(await clockNow($))
  if (d.getMonth() === 7 && d.getDate() === 10) await forceCrown($, d.getFullYear())
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
    // A reload leaves no timer behind, so whatever the band was showing goes.
    try {
      await update($, fx, () => null)
      await update($, pop, () => null)
    } catch { /* no host state here */ }
    await $.command.register({ name: 'inmu', description: s.commandDescription, argumentHint: VERBS })
    await isWindows($)
    await scanSounds($)
    status($, await readGame($))
    clockTimer?.cancel()
    clockTimer = $.clock.every(1000, () => { void serially(() => tick($)) })
    await serially(() => yajuuDay($))
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
        await serially(() => resetAll($, all))
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
  // the hit beside them, the rank and the title with its meaning. A burst or
  // the coronation shows its chant and picture under the hit that set it off,
  // every letter lit for the show alone: the letters come back as the game
  // holds them. A band another mod draws stays under it; the feedback survey
  // takes the whole band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    bandRequestId = e.requestId
    let g = initialGame()
    let effect: Fx | null = null
    let popped: Pop | null = null
    let hidden = false
    try {
      g = toGame(await read($, game))
      effect = await read($, fx)
      popped = await read($, pop)
      hidden = await read($, bandHidden)
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
    const { Box, Button, Text } = $.ui.resolve(e)
    const shown = (entry: Entry) => (g.found.includes(entry.id) ? glossed(lang, entry.label, memeMeaning(lang, entry.id)) : '???')
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">{`淫夢の王 INMU KING · #${g.rank} ${glossLine(titleFor(g.rank))}`}</Text>
        <Text>{`${lettersLine(g.energy)}  (${g.energy}/8)`}</Text>
        <Text dimColor>{s.paneTallies(g.crowns, g.points, g.sins, g.muted)}</Text>
        <Text bold>{s.collection(foundCount(g), LEXICON.length)}</Text>
        {TIERS.map(points => (
          <Text key={`tier-${points}`} wrap="wrap">{s.tier(points, LEXICON.filter(entry => entry.points === points).map(shown).join('  '))}</Text>
        ))}
        <Text dimColor wrap="wrap">
          {g.log.length > 0 ? s.recent(g.log.slice(0, 6).map(item => `${s.who(item.by)} ${item.label}+${item.points}`)) : s.noMemesYet}
        </Text>
        <Box columnGap={2}>
          <Button key="mute" label={s.muteButton(g.muted)} hotkey="1" plain onPress={() => serially(() => setMuted($, !g.muted))} />
          <Button key="reset" label={s.resetButton} hotkey="2" plain onPress={() => serially(() => resetAll($, false))} />
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
