import { test, expect, mock } from 'claude-code/testing'
import { BEAST_FRAMES, CROWD_FRAMES, DIGITS_BIG, TEA_FRAMES } from './pixels.ts'
import { evaluateInt } from './homo.ts'

// The whole game through the engine: prompts light rainbow letters with a
// popup and the memes' meanings, a full bar bursts with a moving picture and a
// jingle, #1 crowns, the coronation reply gets its section once, Claude's own
// memes count at half, tool errors are sins, the person's own clips play in
// place of the jingles, the collection fills, /inmu drives it all, and the
// demos change nothing. Host state is the kit's own, so a write draws the
// mounted band again. Claude Code's own language is zh-tw unless a test says
// otherwise.

type Blit = { key: string; cells: string }
type Options = {
  env?: Record<string, string>
  files?: string[] | null
  store?: Record<string, unknown>
  brokenStore?: boolean
  settings?: Record<string, unknown>
}

function world(on: any, options: Options = {}) {
  const w = {
    // What the status line shows, call by call; undefined clears it.
    statuses: [] as Array<string | undefined>,
    toasts: [] as string[],
    opened: [] as string[],
    ran: [] as string[],
    blits: [] as Blit[],
    played: [] as string[],
    listed: [] as string[],
    // The plugin store, as the file every session writes: a test reads it, and
    // writes another session's keys into it between hits.
    store: new Map<string, unknown>(Object.entries(options.store ?? {})),
    // Every key this session set, in order.
    sets: [] as string[],
    storeWrites: 0,
    // Faults a test switches on: every call fails while `broken`, every
    // reading of the keys while `keysDown`; the next `failSets` sets and the
    // next `failKeys` readings fail.
    broken: options.brokenStore === true,
    keysDown: false,
    failSets: 0,
    failKeys: 0,
    // Keys the store refuses to set while this says so.
    refuse: null as null | ((key: string) => boolean),
    // Runs once, right after the next reading of the keys: what another
    // session does while this one works from what it read.
    afterKeys: null as null | (() => void),
    clock: mock.clock(on, { now: 1_000 }),
  }
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\me', ...(options.env ?? {}) })
  const copy = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
  const fault = () => new Error('EBUSY: store locked')
  on('store.get', ($: any, e: any) => {
    if (w.broken) throw fault()
    return { value: copy(w.store.get(e.key)) }
  })
  on('store.set', ($: any, e: any) => {
    if (w.broken || w.refuse?.(e.key)) throw fault()
    if (w.failSets > 0) {
      w.failSets -= 1
      throw fault()
    }
    w.storeWrites += 1
    w.sets.push(e.key)
    w.store.set(e.key, copy(e.value))
    return { value: undefined }
  })
  on('store.delete', ($: any, e: any) => {
    if (w.broken) throw fault()
    w.storeWrites += 1
    w.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => {
    if (w.broken || w.keysDown) throw fault()
    if (w.failKeys > 0) {
      w.failKeys -= 1
      throw fault()
    }
    const keys = [...w.store.keys()]
    const then = w.afterKeys
    w.afterKeys = null
    then?.()
    return { value: keys }
  })
  on('settings.read', () => ({ value: options.settings ?? { language: 'zh-tw' } }))
  on('fs.list', ($: any, e: any) => {
    w.listed.push(String(e.path))
    if (options.files === null) throw new Error('ENOENT: no such directory')
    return { value: (options.files ?? []).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', () => ({ value: { base64: 'UklGRg==' } }))
  on('audio.play', ($: any, e: any) => {
    w.played.push(e.clip.asset ?? `bytes:${e.clip.mime}`)
    return { value: undefined }
  })
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('ui.status', ($: any, e: any) => { w.statuses.push(e.text === undefined ? undefined : String(e.text)); return { value: undefined } })
  on('ui.toast', ($: any, e: any) => { w.toasts.push(String(e.text ?? e.message ?? JSON.stringify(e))); return { value: undefined } })
  on('ui.open', ($: any, e: any) => { w.opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.blit', ($: any, e: any) => { w.blits.push({ key: e.key, cells: e.cells }); return { value: {} } })
  on('ui.invalidate', () => ({ value: undefined }))
  on('process.run', ($: any, e: any) => {
    w.ran.push(e.argv.join(' '))
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' }] }))
  // A refusal stands in for an errored call: the kit's bottom answers
  // { result } or { deny } only, and the plugin counts both as a sin.
  on('tool.call', ($: any, e: any) => (e.command === 'boom' ? { deny: 'boom' } : { result: { text: 'ok' } }))
  // What another mod draws under the band, and the turn line.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', props: {}, children: ['under the band'] }) as any)
  on('ui.render', { component: 'TurnDuration' }, () => ({ type: 'Text', props: {}, children: ['Baked for 3s'] }) as any)
  return w
}

const BAND = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80 } as any
const PANE = { title: '淫夢の王', isFocused: true, bodyColumns: 64, placement: 'inline' } as any
const SOUNDS = 'C:\\Users\\me\\.claude\\inmu-king\\sounds'
const AT_TWO = { stats: { rank: 2, bestRank: 2, totalPoints: 0, coronations: 0, sins: 0, bursts: 0, found: {} } }
const start = ($: any, isInteractive = true) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive })
const submit = ($: any, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
const inmu = ($: any, args = '') => $.command.run({ command: 'inmu', args })
const mountBand = ($: any, props: any = BAND, surface = 'terminal') => $.ui.mount({ plugin: 'inmu-king', surface, component: 'AbovePrompt', props })
const mountPane = ($: any) => $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'Pane', props: PANE, requestId: 'inmu' })
const compose = ($: any) => $.prompt.compose({ model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
const sectionIds = async ($: any) => (await compose($)).sections.map((x: any) => x.id)
const turnStart = ($: any, turnId = 't1') => $.turn.start({ text: 'hi', turnId })
const reply = ($: any, answer: string, turnId = 't1', reason = 'answer', extra: Record<string, unknown> = {}) =>
  $.turn.complete({ turnId, answer, durationMs: 1500, isAborted: reason === 'aborted', reason, ...extra })
// The store as 0.3.0 left it: one key.
const STATS = (fields: Record<string, unknown>) => ({ stats: { rank: 20, bestRank: 20, totalPoints: 0, coronations: 0, sins: 0, bursts: 0, found: {}, epoch: 0, ...fields } })
// The progress records in the store, and this session's own: every other
// session in a test has a name of letters.
const records = (w: any): string[] => [...w.store.keys()].filter((k: string) => k.startsWith('r:'))
const ownRecords = (w: any): string[] => records(w).filter(k => !/^r:\d+:(legacy|other|old):/.test(k))
const finds = (w: any): string[] => [...w.store.keys()].filter((k: string) => k.startsWith('f:')).sort()
// Noon on August 10, 2027, on this machine's clock.
const AUG10 = new Date(2027, 7, 10, 12, 0, 0).getTime()
// Every key of the ledger's: progress, finds and resets (not `stats` or `migrated`).
const ledgerKeys = (w: any): string[] => [...w.store.keys()].filter((k: string) => /^(r|f|reset|resetall):/.test(k))
// One turn as the engine runs it: the system prompt, the start, the answer.
const turn = async ($: any, answer: string, turnId = 't1', reason = 'answer') => {
  const ids = await sectionIds($)
  await turnStart($, turnId)
  await reply($, answer, turnId, reason)
  return ids
}
const textOf = async (ui: any, re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
// The band's first eight texts are its letters, in order.
const letters = async (band: any) => (await band.findAll({ type: 'Text' })).slice(0, 8)
// The eight letters as one word: L lit, F lit by the last hit, . dark.
const lettersOf = async (band: any) =>
  (await letters(band)).map((t: any) => (t.props.inverse ? 'F' : t.props.dimColor ? '.' : t.props.bold ? 'L' : '?')).join('')

test('a fresh session starts at #20 with every letter dark, and looks for your sound folder', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
  expect(await textOf(band, /^下北澤新人$/)).toBe('下北澤新人')
  expect(await lettersOf(band)).toBe('........')
  expect(w.listed).toEqual([SOUNDS])
})

test("the band's button says what it opens, the panel, and its hotkey is i", async ($, on) => {
  world(on)
  await start($)
  const button = await (await mountBand($)).find({ key: 'pane' })
  expect(button?.type).toBe('Button')
  expect(button?.props.label).toBe('面板')
  expect(button?.props.hotkey).toBe('i')
})

test('the status line stays empty while the band shows the standing; with the band off it keeps the standing', async ($, on) => {
  const w = world(on, { store: AT_TWO })
  await start($)
  expect(w.statuses.at(-1)).toBe(undefined)
  await inmu($, 'band off')
  expect(w.statuses.at(-1)).toBe('淫夢 #2 野獣先輩（野獸學長） · t a d o k o r o')
  await submit($, '114514')
  expect(w.statuses.at(-1)).toBe('👑 淫夢の王 INMU KING（淫夢之王）')
  await inmu($, 'band on')
  expect(w.statuses.at(-1)).toBe(undefined)
})

test('a hit lights rainbow letters and shows "+5 …" with the memes\' meanings for two seconds', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  const out = await submit($, 'やりますねぇ 田所')
  expect(out.text).toBe('やりますねぇ 田所')
  expect(await textOf(band, /^\+5 /)).toBe('+5 田所浩二（網路上對野獸學長的通稱）・やりますねぇ（挺行的嘛） NEW!')
  expect(await lettersOf(band)).toBe('FFFFF...')
  const lit = await letters(band)
  expect(lit.map((t: any) => t.text).join(' ')).toBe('T A D O K O R O')
  expect(lit[0].props.color).toBe('#e5484d')
  expect(lit[4].props.color).toBe('#12a594')
  expect(lit[5].props.color).toBe(undefined)
  expect(await textOf(band, /^下北澤新人$/)).toBe(undefined) // the popup takes the title's meaning's room
  await w.clock.advance(5)
  expect(w.ran.length).toBe(1)
  expect(w.ran[0]).toContain('sounds\\hit.wav')

  await w.clock.advance(2000)
  expect(await textOf(band, /^\+5 /)).toBe(undefined)
  expect(await lettersOf(band)).toBe('LLLLL...')
  expect(await textOf(band, /^下北澤新人$/)).toBe('下北澤新人')

  await submit($, 'やりますねぇ')
  expect(await textOf(band, /^\+2 /)).toBe('+2 やりますねぇ（挺行的嘛）')
  expect(await lettersOf(band)).toBe('LLLLLFF.')
})

test('a full bar bursts: the chant and its meaning, the crowned beast, a toast, the burst jingle, then #19', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  expect(await textOf(band, /いいよ！こいよ！/)).toBe('いいよ！こいよ！')
  expect(await textOf(band, /^好啊！來吧！$/)).toBe('好啊！來吧！')
  const art = await band.find({ key: 'art' })
  expect(art?.type).toBe('Raster')
  expect(art?.props.cells).toBe(BEAST_FRAMES[0]!.cells)
  expect(w.toasts).toContain('いいよ！こいよ！（好啊！來吧！）')

  await w.clock.advance(5)
  expect(w.ran.length).toBe(1)
  expect(w.ran[0]).toContain('powershell.exe')
  expect(w.ran[0]).toContain('SoundPlayer')
  expect(w.ran[0]).toContain('sounds\\burst.wav')

  await w.clock.advance(300)
  expect(w.blits.at(-1)).toEqual({ key: 'art', cells: BEAST_FRAMES[1]!.cells })

  await w.clock.advance(3000)
  expect(await textOf(band, /#19/)).toBe('#19 下北沢の新入り')
  expect(await band.find({ key: 'art' })).toBe(undefined)
})

test('a burst shows the hit that set it off: the eight letters lit, the meme, its meaning and NEW!', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  expect(await lettersOf(band)).toBe('FFFFFFFF')
  expect(await textOf(band, /^\+8 /)).toBe('+8 114514（諧音いいよこいよ＝好啊，來吧） NEW!')
  expect(await textOf(band, /いいよ！こいよ！/)).toBe('いいよ！こいよ！')
  await w.clock.advance(3100)
  expect(await lettersOf(band)).toBe('........')
})

test('a burst ends its show, not the letters: 7 and 3 leave 2, and one more during the show makes 3', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  await submit($, '田所浩二 やりますねぇ イキスギ')
  await w.clock.advance(2100)
  expect(await lettersOf(band)).toBe('LLLLLLL.')
  await submit($, '野獣先輩')
  expect(await lettersOf(band)).toBe('LLLLLLLF')
  await submit($, '810')
  await w.clock.advance(3100)
  expect(await lettersOf(band)).toBe('LLL.....')
})

test('bursts take turns: the beast, the iced tea, the rainbow digits', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  expect((await band.find({ key: 'art' }))?.props.cells).toBe(BEAST_FRAMES[0]!.cells)
  await w.clock.advance(3100)

  await submit($, '114514')
  expect((await band.find({ key: 'art' }))?.props.cells).toBe(TEA_FRAMES[0]!.cells)
  expect(w.toasts.at(-1)).toBe('やりますねぇ！（挺行的嘛！）')
  await w.clock.advance(3100)

  await submit($, '114514')
  const digits = await band.find({ key: 'art' })
  expect(digits?.props.columns).toBe(46)
  expect(digits?.props.cells).toBe(DIGITS_BIG[0]!.cells)
})

test('the iced tea drains frame by frame and stops on the empty glass', async ($, on) => {
  const w = world(on)
  await start($)
  await mountBand($)
  await submit($, '114514')
  await w.clock.advance(3100)
  const before = w.blits.length
  await submit($, '114514')
  await w.clock.advance(2950)
  const tea = w.blits.slice(before)
  expect(tea.length).toBe(9)
  expect(tea[0]).toEqual({ key: 'art', cells: TEA_FRAMES[1]!.cells })
  expect(tea.at(-1)).toEqual({ key: 'art', cells: TEA_FRAMES[9]!.cells })
})

test('a narrow band keeps the chant and drops a picture that does not fit', async ($, on) => {
  world(on)
  await start($)
  const band = await mountBand($, { ...BAND, bodyColumns: 20 })
  await submit($, '114514')
  expect(await textOf(band, /いいよ！こいよ！/)).toBeDefined()
  expect(await band.find({ key: 'art' })).toBe(undefined)
})

test('whatever draws under the band keeps its place there', async ($, on) => {
  world(on)
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#20/)).toBeDefined()
  expect(await textOf(band, /under the band/)).toBe('under the band')
  await submit($, '114514')
  expect(await textOf(band, /under the band/)).toBe('under the band')
})

test('two shows that start together leave one animation timer', async ($, on) => {
  const w = world(on)
  await start($)
  await mountBand($)
  // The beast steps every 300 ms, the crowd every 250: one timer means one blit by 300.
  await Promise.all([inmu($, 'burst'), inmu($, 'king')])
  const before = w.blits.length
  await w.clock.advance(300)
  expect(w.blits.length - before).toBe(1)
})

test("your own clips: a meme's clip replaces the hit sound", async ($, on) => {
  const w = world(on, { files: ['yarimasu.mp3'] })
  await start($)
  await submit($, 'やりますねぇ')
  await w.clock.advance(5)
  expect(w.ran.length).toBe(1)
  expect(w.ran[0]).toContain(`${SOUNDS}\\yarimasu.mp3`)
  expect(w.ran[0]).toContain('MediaPlayer')
  expect(w.ran[0]).not.toContain('hit.wav')
})

test("on a burst the meme's clip plays first, then your burst clips take turns", async ($, on) => {
  const w = world(on, { files: ['114514.mp3', 'burst-1.wav', 'burst-2.wav'] })
  await start($)
  await submit($, '114514')
  await w.clock.advance(5)
  expect(w.ran[0]).toMatch(/114514\.mp3.*burst-1\.wav/)
  await w.clock.advance(3100)
  await submit($, '114514')
  await w.clock.advance(5)
  expect(w.ran[1]).toMatch(/114514\.mp3.*burst-2\.wav/)
})

test("a clip named with the meme's own text is found", async ($, on) => {
  const w = world(on, { files: ['いいよこいよ.mp3'] })
  await start($)
  await submit($, 'いいよ！こいよ！')
  await w.clock.advance(5)
  expect(w.ran[0]).toContain('いいよこいよ.mp3')
})

test('/inmu sounds lists the folder: what it placed, what it could not', async ($, on) => {
  world(on, { files: ['burst.wav', 'iiyo.mp3', 'oops.mp3', 'notes.txt'] })
  await start($)
  const text = (await inmu($, 'sounds')).text
  expect(text).toContain(`音檔資料夾：${SOUNDS}`)
  expect(text).toContain('burst ← burst.wav')
  expect(text).toContain('iiyo ← iiyo.mp3')
  expect(text).toContain('認不得的檔名：oops.mp3')
  expect(text).not.toContain('notes.txt')
  expect(text).toContain('yarimasu＝やりますねぇ')
})

test('/inmu sounds says when the folder is missing, and the jingles still play', async ($, on) => {
  const w = world(on, { files: null })
  await start($)
  expect((await inmu($, 'sounds')).text).toContain('這個資料夾還不存在')
  await submit($, '810')
  await w.clock.advance(5)
  expect(w.ran[0]).toContain('sounds\\hit.wav')
})

test('the climb to #1 crowns: the crowd dances, the fanfare plays, the next reply gets its section once', async ($, on) => {
  const w = world(on, { store: AT_TWO })
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  expect(await textOf(band, /INMU KING 降臨/)).toBe('👑 INMU KING 降臨 👑')
  const art = await band.find({ key: 'art' })
  expect(art?.props.columns).toBe(38)
  expect(art?.props.cells).toBe(CROWD_FRAMES[0]!.cells)
  expect(w.toasts).toContain('新たな淫夢の王が誕生した（新的淫夢之王誕生了）')

  await w.clock.advance(5)
  expect(w.ran[0]).toContain('sounds\\crown.wav')
  await w.clock.advance(600)
  expect(w.blits.filter(b => b.key === 'art').length).toBe(2)

  expect(await turn($, 'done. やりますねぇ！')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await sectionIds($)).toEqual(['intro'])
  expect((await inmu($)).text).toContain('(0/8)') // the coronation reply's own やりますねぇ did not count

  await w.clock.advance(6000)
  expect(await textOf(band, /#1 淫夢の王/)).toBe('#1 淫夢の王 INMU KING')
  expect(await band.find({ key: 'art' })).toBe(undefined)
})

test('a coronation reply cut short keeps the section for the next turn', async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  await submit($, '114514')
  expect(await turn($, '', 't1', 'aborted')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await sectionIds($)).toEqual(['intro'])
})

test("a subagent's end neither spends the coronation nor scores", async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  await submit($, '114514')
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  await turnStart($, 't1')
  await $.turn.complete({ turnId: 'a1', agentId: 'agent-1', answer: '田所浩二 810', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  const text = (await inmu($)).text
  expect(text).toContain('(0/8)')
  expect(text).toContain('累計 8 分')
})

test('/context and a teammate compose without the section, and leave the next turn its section', async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  await submit($, '114514')
  const analysis = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: ['analysis'] })
  expect(analysis.sections.map((x: any) => x.id)).toEqual(['intro'])
  expect(await turn($, 'やりますねぇ！')).toEqual(['intro', 'inmu-king:coronation'])
})

test('a prompt composed again mid-turn keeps the turn as it began', async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  expect(await sectionIds($)).toEqual(['intro'])
  await turnStart($, 't1')
  await submit($, '114514') // crowned while the turn runs
  expect(await sectionIds($)).toEqual(['intro']) // a later request of the same turn
  await reply($, 'ok', 't1')
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
})

test('a coronation that lands mid-turn waits for the next turn', async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  expect(await sectionIds($)).toEqual(['intro'])
  await turnStart($, 't1')
  await submit($, '114514') // a prompt queued while Claude works
  await reply($, 'ok', 't1')
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await sectionIds($)).toEqual(['intro'])
})

test('infect off: no section at the coronation', { options: { infect: false } }, async ($, on) => {
  world(on, { store: AT_TWO })
  await start($)
  await submit($, '114514')
  expect(await sectionIds($)).toEqual(['intro'])
})

test('a session nobody reads (-p, the SDK) never gets the section', async ($, on) => {
  world(on, { store: AT_TWO })
  await start($, false)
  await submit($, '114514')
  expect(await sectionIds($)).toEqual(['intro'])
})

test('/inmu burst is a demo: the chant, the picture and the jingle, and no points, no rank, no log', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  expect((await inmu($, 'burst')).text).toBe('示範爆發：不加分、不改排名。')
  expect(await textOf(band, /いいよ！こいよ！/)).toBeDefined()
  expect((await band.find({ key: 'art' }))?.props.cells).toBe(BEAST_FRAMES[0]!.cells)
  await w.clock.advance(5)
  expect(w.ran[0]).toContain('sounds\\burst.wav')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('累計 0 分')
  expect(text).toContain('還沒有梗')
  await w.clock.advance(3100)
  await inmu($, 'burst')
  expect((await band.find({ key: 'art' }))?.props.cells).toBe(TEA_FRAMES[0]!.cells)
})

test('/inmu king is a demo: the crowd and the fanfare, and no rank, no tally, no section', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  expect((await inmu($, 'king')).text).toBe('示範加冕：不改排名，下一則回覆也照常。')
  expect((await band.find({ key: 'art' }))?.props.cells).toBe(CROWD_FRAMES[0]!.cells)
  await w.clock.advance(5)
  expect(w.ran[0]).toContain('sounds\\crown.wav')
  expect(await sectionIds($)).toEqual(['intro'])
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('加冕 0 次')
})

test("Claude's own memes count at half points, with its name on the popup; a subagent's and a cut-short reply's do not", async ($, on) => {
  world(on)
  await start($)
  const band = await mountBand($)
  await reply($, '田所浩二 says 810')
  expect(await textOf(band, /^Claude \+3/)).toBe('Claude +3 田所浩二（網路上對野獸學長的通稱）・810（諧音野獣：8=や、10=じゅう） NEW!')
  expect(await lettersOf(band)).toBe('FFF.....')
  await $.turn.complete({ turnId: 'a1', agentId: 'agent-1', answer: '114514', durationMs: 1, isAborted: false, reason: 'answer' })
  await reply($, '114514', 't2', 'aborted')
  const text = (await inmu($)).text
  expect(text).toContain('(3/8)')
  expect(text).toContain('累計 3 分')
})

test('hits that land together all count', async ($, on) => {
  world(on)
  await start($)
  await Promise.all([submit($, '114514'), reply($, '田所浩二')])
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #19')
  expect(text).toContain('(2/8)')
  expect(text).toContain('累計 10 分')
})

test('a refused or errored tool call is a sin: the first one speaks and plays the sin jingle', async ($, on) => {
  const w = world(on)
  await start($)
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  expect(w.toasts.at(-1)).toBe('罪がまた一つ増えた（又多了一條罪） · 罪 1')
  await w.clock.advance(5)
  expect(w.ran[0]).toContain('sounds\\sin.wav')
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  await w.clock.advance(5)
  expect(w.toasts.length).toBe(1)
  expect(w.ran.length).toBe(1)
  expect((await inmu($)).text).toContain('罪 2')
})

test('the band yields to the survey, and to /inmu band off', async ($, on) => {
  world(on)
  await start($)
  expect(await textOf(await mountBand($, { ...BAND, hasSurvey: true }), /#20/)).toBe(undefined)
  const band = await mountBand($)
  expect(await textOf(band, /#20/)).toBeDefined()
  await inmu($, 'band off')
  expect(await textOf(band, /#20/)).toBe(undefined)
  expect(await textOf(band, /under the band/)).toBe('under the band')
  await inmu($, 'band on')
  expect(await textOf(band, /#20/)).toBeDefined()
})

test('band:false hides the band from the start, and the status line keeps the standing', { options: { band: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  expect(await textOf(await mountBand($), /#20/)).toBe(undefined)
  expect(w.statuses.at(-1)).toBe('淫夢 #20 下北沢の新入り（下北澤新人） · t a d o k o r o')
})

test('the panel: the collection by points with meanings, mute, reset; no cheat buttons', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '810')
  await w.clock.advance(5)
  const pane = await mountPane($)
  expect(await textOf(pane, /^梗圖鑑/)).toBe('梗圖鑑 1/33')
  expect(await textOf(pane, /^8分 /)).toBe('8分 ???  ???')
  expect(await textOf(pane, /^1分 /)).toContain('810（諧音野獣：8=や、10=じゅう）')
  expect(await textOf(pane, /你 810\+1/)).toBeDefined()
  expect(await pane.find({ key: 'burst' })).toBe(undefined)
  expect(await pane.find({ key: 'king' })).toBe(undefined)
  expect((await pane.find({ key: 'mute' }))?.props.hotkey).toBe('1')
  expect((await pane.find({ key: 'reset' }))?.props.hotkey).toBe('2')
  expect((await pane.find({ key: 'close' }))?.props.hotkey).toBe('0')

  await pane.press({ key: 'mute' })
  expect((await pane.find({ key: 'mute' }))?.props.label).toBe('開聲音')
  const ran = w.ran.length
  await inmu($, 'burst')
  await w.clock.advance(5)
  expect(w.ran.length).toBe(ran)

  await pane.press({ key: 'reset' })
  expect(await textOf(pane, /#20/)).toBeDefined()
  expect(await textOf(pane, /^梗圖鑑/)).toBe('梗圖鑑 1/33')
  expect((await pane.find({ key: 'mute' }))?.props.label).toBe('開聲音') // the reset keeps the mute
  expect((await inmu($, 'reset all')).text).toContain('全部歸零')
  expect(await textOf(pane, /^梗圖鑑/)).toBe('梗圖鑑 0/33')
})

test('/inmu reset keeps the session muted', async ($, on) => {
  const w = world(on)
  await start($)
  await inmu($, 'mute')
  await inmu($, 'reset')
  await submit($, '810')
  await w.clock.advance(5)
  expect(w.ran.length).toBe(0)
  expect((await inmu($)).text).toContain('聲音 靜音')
})

test('/inmu status opens the panel and reports; /inmu homo writes a number as 114514', async ($, on) => {
  const w = world(on)
  await start($)
  const status = await inmu($, 'status')
  expect(w.opened).toEqual(['inmu'])
  expect(status.text).toContain('淫夢 #20 下北沢の新入り（下北澤新人）')
  expect(status.text).toContain('梗圖鑑 0/33')
  expect((await inmu($, 'homo 1000')).text).toMatch(/^1000 = [-+*/()1451]+$/)
  expect((await inmu($, 'homo')).text).toContain('用法')
  expect((await inmu($, 'nope')).text).toContain('不認識')
})

test('the progress and the collection live in the store as key names: one record for this session, a key per find', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '114514')
  await w.clock.advance(3100)
  await submit($, '810')
  const mine = ownRecords(w)
  expect(mine.length).toBe(1)
  expect(mine[0]).toMatch(/^r:0:[a-z0-9]+:9:1:0:0$/)
  expect(finds(w)).toEqual(['f:0:114514', 'f:0:810'])
  const text = (await inmu($)).text
  expect(text).toContain('累計 9 分')
  expect(text).toContain('加冕 0 次')
  expect(text).toContain('梗圖鑑 2/33')
})

test("another session's progress and finds add up, and this session writes no key of theirs", async ($, on) => {
  const w = world(on, { store: { 'r:0:other:100:15:0:0': true, 'f:0:iiyo': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  // The other session scores meanwhile and finds a meme: its next key replaces its last.
  w.store.delete('r:0:other:100:15:0:0')
  w.store.set('r:0:other:150:16:0:0', true)
  w.store.set('f:0:yarimasu', true)
  await submit($, '810')
  expect(w.store.has('r:0:other:150:16:0:0')).toBe(true)
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #4')
  expect(text).toContain('累計 151 分')
  expect(text).toContain('梗圖鑑 3/33')
  expect(w.sets.filter(key => /^[rf]:/.test(key))).toEqual([...ownRecords(w), 'f:0:810'])
})

test('a reset in another session: this one follows it back to #20, and its next hit counts after the reset', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:100:15:0:0': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  w.store.set('reset:5000', true)
  await submit($, '810')
  expect(ownRecords(w).filter(k => k.startsWith('r:5000:'))).toEqual([expect.stringMatching(/^r:5000:[a-z0-9]+:1:0:0:0$/)])
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
  expect((await inmu($)).text).toContain('累計 1 分')
})

test('a hit under way while another session resets lands before the reset, and the reset stands', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:18:0:0': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#2/)).toBe('#2 野獣先輩')
  // Another session resets right after this one reads the store for its hit.
  w.afterKeys = () => { w.store.set('reset:5000', true) }
  await submit($, '810')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('累計 0 分')
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
})

test("the status line follows the other sessions: their bursts, and their reset", { options: { band: false } }, async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:15:0:0': true } })
  await start($)
  expect(w.statuses.at(-1)).toContain('淫夢 #5')
  w.store.delete('r:0:other:0:15:0:0')
  w.store.set('r:0:other:0:16:0:0', true)
  await reply($, 'ok')
  expect(w.statuses.at(-1)).toContain('淫夢 #4')
  w.store.set('reset:5000', true)
  await reply($, 'ok', 't2')
  expect(w.statuses.at(-1)).toContain('淫夢 #20')
})

test('a store that cannot be read at the start: a hit waits unsaved, then lands where the store stands', async ($, on) => {
  const w = world(on, { store: { 'reset:500': true, 'r:500:other:0:15:0:0': true } })
  w.keysDown = true
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  expect(ownRecords(w)).toEqual([])
  expect(finds(w)).toEqual([])
  await w.clock.advance(3100)
  expect(await textOf(band, /^未存$/)).toBe('未存')
  w.keysDown = false
  await reply($, 'ok')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:500:[a-z0-9]+:8:1:0:0$/)])
  expect(finds(w)).toEqual(['f:0:114514'])
  expect(await textOf(band, /#4/)).toBe('#4 野獣')
  expect(await textOf(band, /^未存$/)).toBe(undefined)
})

test('a reset made while this session could not read the store takes what it made meanwhile', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:15:0:0': true } })
  w.keysDown = true
  await start($)
  await submit($, '114514')
  w.store.set('reset:5000', true)
  w.keysDown = false
  await reply($, 'ok')
  expect(ownRecords(w)).toEqual([])
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('累計 0 分')
})

test('an old store the first reading missed is carried over once the store can be read', async ($, on) => {
  const w = world(on, { store: STATS({ rank: 5, bestRank: 5, totalPoints: 100, coronations: 1, bursts: 10, found: { iiyo: 1 } }) })
  w.failKeys = 1
  await start($)
  await submit($, '810')
  expect(records(w)).toContain('r:0:legacy:100:10:1:5')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #5')
  expect(text).toContain('累計 101 分')
  expect(text).toContain('梗圖鑑 2/33')
})

test('an old store the store will not take yet: the band says 未存, and the 15-second retry carries it over', async ($, on) => {
  const w = world(on, { store: { ...STATS({ rank: 5, bestRank: 5, totalPoints: 100, bursts: 15 }), migrated: true } })
  w.failSets = 3
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /^未存$/)).toBe('未存')
  await w.clock.advance(15_000)
  expect(await textOf(band, /^未存$/)).toBe(undefined)
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #5')
  expect(text).toContain('累計 100 分')
})

test('two sessions reaching #1 together: the one whose burst may have done it plays the coronation', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:17:0:0': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#3/)).toBe('#3 野獣')
  // The other session bursts too, right after this one reads the store for its hit.
  w.afterKeys = () => {
    w.store.delete('r:0:other:0:17:0:0')
    w.store.set('r:0:other:8:18:0:0', true)
  }
  await submit($, '114514')
  expect(await textOf(band, /INMU KING 降臨/)).toBe('👑 INMU KING 降臨 👑')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:0:[a-z0-9]+:8:1:1:0$/)])
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  expect((await inmu($)).text).toContain('加冕 1 次')
})

test('a coronation still owed is played by the next session that bursts, not by one that only reads', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:18:0:0': true } })
  await start($)
  const band = await mountBand($)
  // Another session reached #1, and its play of the coronation never landed.
  w.store.delete('r:0:other:0:18:0:0')
  w.store.set('r:0:other:8:19:0:0', true)
  await reply($, 'ok')
  expect(await textOf(band, /#1 淫夢の王/)).toBe('#1 淫夢の王 INMU KING')
  expect(await band.find({ key: 'art' })).toBe(undefined)
  expect(await sectionIds($)).toEqual(['intro'])
  expect((await inmu($)).text).toContain('加冕 1 次')
  await submit($, '114514')
  expect(await textOf(band, /INMU KING 降臨/)).toBe('👑 INMU KING 降臨 👑')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:0:[a-z0-9]+:8:1:2:0$/)])
  expect((await inmu($)).text).toContain('加冕 2 次')
})

test('August 10 crowns the chart once: #1 for every session, one coronation', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:15:0:0': true } })
  await w.clock.set(AUG10)
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /INMU KING 降臨/)).toBe('👑 INMU KING 降臨 👑')
  expect(records(w)).toContain('r:0:day2027:0:0:0:4')
  expect(w.store.get('yajuuYear')).toBe(2027)
  expect((await inmu($)).text).toContain('加冕 1 次')
  await w.clock.advance(6100)
  await submit($, '114514')
  expect((await inmu($)).text).toContain('加冕 2 次')
})

test('two sessions on August 10 lift the chart once: of two lifts, the reading takes the smaller', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:15:0:0': true, 'r:0:day2027:0:0:0:6': true } })
  await w.clock.set(AUG10)
  await start($)
  expect(records(w)).toContain('r:0:day2027:0:0:0:4')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #1')
  expect(text).toContain('加冕 1 次')
})

test('August 10 while the store cannot be read: no crown yet, and the year is not spent', async ($, on) => {
  const w = world(on, { store: { 'r:0:other:0:15:0:0': true } })
  w.keysDown = true
  await w.clock.set(AUG10)
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /INMU KING 降臨/)).toBe(undefined)
  expect(w.store.has('yajuuYear')).toBe(false)
  expect(records(w).filter(k => k.includes(':day'))).toEqual([])
})

test('a store that cannot be read at the start: the band says 未存, and a retry carries the old store over', async ($, on) => {
  const w = world(on, { store: STATS({ rank: 5, bestRank: 5, totalPoints: 100, bursts: 15 }) })
  w.keysDown = true
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /^未存$/)).toBe('未存')
  w.keysDown = false
  await w.clock.advance(15_000)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  expect(await textOf(band, /^未存$/)).toBe(undefined)
})

test('an old store carried over in part: the reading counts what the store took, and the rest waits', async ($, on) => {
  const w = world(on, { store: STATS({ rank: 5, bestRank: 5, totalPoints: 100, coronations: 1, bursts: 10, found: { iiyo: 1 } }) })
  w.refuse = key => key.startsWith('f:')
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  expect(await textOf(band, /^未存$/)).toBe('未存')
  w.refuse = null
  await w.clock.advance(15_000)
  expect(finds(w)).toEqual(['f:0:iiyo'])
  expect(await textOf(band, /^未存$/)).toBe(undefined)
})

test('a reset while the old store waits to be carried over ends the wait', async ($, on) => {
  const w = world(on, { store: { ...STATS({ rank: 5, bestRank: 5, totalPoints: 100, bursts: 15 }), migrated: true } })
  w.refuse = key => key.startsWith('r:0:legacy')
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /^未存$/)).toBe('未存')
  await inmu($, 'reset')
  expect(await textOf(band, /^未存$/)).toBe(undefined)
  expect((await inmu($)).text).toContain('淫夢 #20')
})

test('a fresh store that refuses the first write once: it is tried again at once, and nothing waits', async ($, on) => {
  const w = world(on)
  w.failSets = 1
  await start($)
  const band = await mountBand($)
  expect(w.store.get('migrated')).toBe(true)
  expect(await textOf(band, /^未存$/)).toBe(undefined)
  expect(w.toasts).toEqual([])
})

test('the legacy record is written once: what an old copy writes to stats later adds no second one', async ($, on) => {
  const w = world(on, { store: { ...STATS({ rank: 13, totalPoints: 12, bursts: 4, found: { iiyo: 1 } }), 'r:0:legacy:10:2:0:5': true } })
  await start($)
  expect(records(w)).toEqual(['r:0:legacy:10:2:0:5'])
  expect(finds(w)).toEqual(['f:0:iiyo'])
  const band = await mountBand($)
  expect(await textOf(band, /#13/)).toBe('#13 24歳、学生')
})

test("the panel's reset that the store does not take says so", async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '810')
  const pane = await mountPane($)
  w.failSets = 3
  await pane.press({ key: 'reset' })
  expect(w.toasts.at(-1)).toContain('沒寫進存檔')
  expect((await inmu($)).text).toContain('累計 1 分')
})

test('a store cleared under a running session: it follows the store back, and its next hit counts there', async ($, on) => {
  const w = world(on, { store: { 'reset:5000': true, 'r:5000:other:100:15:0:0': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  w.store.clear()
  await submit($, '810')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:0:[a-z0-9]+:1:0:0:0$/)])
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
})

test('/inmu reset: a reset key newer than any seen, the old keys swept, the collection kept', async ($, on) => {
  const w = world(on, { store: { 'resetall:3000': true, 'r:3000:other:100:15:1:0': true, 'f:3000:iiyo': true, 'r:0:old:5:0:0:0': true } })
  await start($)
  await submit($, '810')
  expect((await inmu($, 'reset')).text).toContain('歸零')
  await w.clock.settle()
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('累計 0 分')
  expect(text).toContain('梗圖鑑 2/33')
  expect(ledgerKeys(w).sort()).toEqual(['f:3000:810', 'f:3000:iiyo', 'reset:3001', 'resetall:3000'])
})

test('/inmu reset all: the collection starts over too', async ($, on) => {
  const w = world(on, { store: { 'f:0:iiyo': true } })
  await start($)
  await submit($, '810')
  expect((await inmu($, 'reset all')).text).toContain('全部歸零')
  await w.clock.settle()
  expect((await inmu($)).text).toContain('梗圖鑑 0/33')
  expect(ledgerKeys(w)).toEqual(['resetall:1000'])
})

test('a reset the store does not take changes nothing, and says so', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '810')
  w.failSets = 3
  expect((await inmu($, 'reset')).text).toContain('沒寫進存檔')
  expect((await inmu($)).text).toContain('累計 1 分')
})

test('a write refused once, as while another session holds the store, is tried again at once', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  w.failSets = 1
  await submit($, '810')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:0:[a-z0-9]+:1:0:0:0$/)])
  expect(await textOf(band, /^未存$/)).toBe(undefined)
  expect(w.toasts).toEqual([])
})

test('a save the store refuses: the band says 未存, one toast, and the timer saves it 15 s later', async ($, on) => {
  const w = world(on)
  await start($)
  const band = await mountBand($)
  w.failSets = 3
  await submit($, '810')
  expect(await textOf(band, /^未存$/)).toBe('未存')
  expect(w.toasts.filter(t => t.includes('15 秒')).length).toBe(1)
  expect(ownRecords(w)).toEqual([])
  await w.clock.advance(15_000)
  expect(ownRecords(w)).toEqual([expect.stringMatching(/^r:0:[a-z0-9]+:1:0:0:0$/)])
  expect(await textOf(band, /^未存$/)).toBe(undefined)
})

test('a save that failed is carried by the next one, and a reading that fails leaves the hit counted', async ($, on) => {
  const w = world(on)
  await start($)
  w.failSets = 3
  await submit($, '114514')
  await w.clock.advance(3100)
  await submit($, '810')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/:9:1:0:0$/)])
  w.failKeys = 1
  await submit($, '1919')
  expect(ownRecords(w)).toEqual([expect.stringMatching(/:10:1:0:0$/)])
  expect((await inmu($)).text).toContain('累計 10 分')
})

test('a store that cannot be read or written: the hits still show, nothing is written, and the band says 未存', async ($, on) => {
  const w = world(on, { store: STATS({ totalPoints: 500 }), brokenStore: true })
  await start($)
  const band = await mountBand($)
  await submit($, '114514')
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  expect(w.storeWrites).toBe(0)
  expect(w.store.get('stats')).toMatchObject({ totalPoints: 500 })
  await w.clock.advance(3100)
  expect(await textOf(band, /#19/)).toBe('#19 下北沢の新入り')
  expect(await textOf(band, /^未存$/)).toBe('未存')
})

test("0.3.0's store becomes the legacy record: the rank, the tallies and the collection carry on", async ($, on) => {
  const w = world(on, { store: STATS({ rank: 5, bestRank: 5, totalPoints: 100, coronations: 1, bursts: 10, found: { iiyo: 1 } }) })
  await start($)
  expect(records(w)).toEqual(['r:0:legacy:100:10:1:5'])
  expect(finds(w)).toEqual(['f:0:iiyo'])
  expect(w.store.has('stats')).toBe(true)
  const band = await mountBand($)
  expect(await textOf(band, /#5/)).toBe('#5 野獣')
  const text = (await inmu($)).text
  expect(text).toContain('加冕 1 次')
  expect(text).toContain('累計 100 分')
  expect(text).toContain('梗圖鑑 1/33')
})

test('after a reset the old store is history: nothing is folded again', async ($, on) => {
  const w = world(on, { store: { ...STATS({ rank: 5, totalPoints: 100, bursts: 15 }), 'reset:2000': true } })
  await start($)
  expect(records(w)).toEqual([])
  expect((await inmu($)).text).toContain('累計 0 分')
})

test('the 0.1.0 store layout is folded the same way', async ($, on) => {
  const w = world(on, { store: { rank: 14, bestRank: 14, totalPoints: 51, bursts: 6 } })
  await start($)
  expect(records(w)).toEqual(['r:0:legacy:51:6:0:0'])
  expect(w.store.get('migrated')).toBe(true)
  expect(w.store.has('totalPoints')).toBe(false)
  const band = await mountBand($)
  expect(await textOf(band, /#14/)).toBe('#14 24歳、学生')
  expect((await inmu($)).text).toContain('累計 51 分')
})

test('a store that was folded once ignores the old keys a 0.1.0 copy still writes', async ($, on) => {
  world(on, { store: { migrated: true, rank: 3, bestRank: 3, totalPoints: 999, bursts: 40 } })
  await start($)
  expect((await inmu($)).text).toContain('累計 0 分')
})

test('sound off: nothing plays', { options: { sound: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '114514')
  await w.clock.advance(5)
  expect(w.ran.length).toBe(0)
})

test('away from Windows the engine plays the jingles, and your clips go to it as bytes', async ($, on) => {
  const w = world(on, { env: { OS: '' }, files: ['yarimasu.mp3'] })
  await start($)
  await submit($, '810')
  await w.clock.advance(5)
  expect(w.played).toEqual(['sounds/hit.wav'])
  await submit($, 'やりますねぇ')
  await w.clock.advance(5)
  expect(w.played.at(-1)).toBe('bytes:audio/mpeg')
  expect(w.ran.length).toBe(0)
})

test('the spinner and the turn line change once the game is on', async ($, on) => {
  world(on)
  await start($)
  const quiet = await $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 3000 } })
  expect(await textOf(quiet, /Baked/)).toBe('Baked for 3s')
  await submit($, '810')
  const line = await $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 20_000 } })
  expect(await textOf(line, /Baked/)).toMatch(/^Baked [-+*/()1451]+ 秒$/)
})

test("each turn line shows its own turn's tokens", async ($, on) => {
  world(on)
  await start($)
  await submit($, '810')
  const usage = (output: number) => ({ usage: { input_tokens: 10, output_tokens: output, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' } })
  await $.turn.complete({ turnId: 't1', answer: 'a', durationMs: 20_000, isAborted: false, reason: 'answer', ...usage(810) })
  await $.turn.complete({ turnId: 't2', answer: 'b', durationMs: 7_000, isAborted: false, reason: 'answer', ...usage(1919) })
  const first = await $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 20_000 } })
  const second = await $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 7_000 } })
  const tokensOf = (text: string) => evaluateInt(text.replace(/^.*輸出 /, '').replace(/ tokens$/, ''))
  expect(tokensOf(await textOf(first, /Baked/))).toBe(810)
  expect(tokensOf(await textOf(second, /Baked/))).toBe(1919)
})

test('English: the band, the popup and the replies speak English, and the memes keep their Japanese', async ($, on) => {
  const w = world(on, { settings: {} })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
  expect(await textOf(band, /^Shimokitazawa rookie$/)).toBe('Shimokitazawa rookie')
  expect((await band.find({ key: 'pane' }))?.props.label).toBe('panel')
  await submit($, 'やりますねぇ')
  expect(await textOf(band, /^\+2 /)).toBe('+2 やりますねぇ (not bad at all) NEW!')
  const text = (await inmu($)).text
  expect(text).toContain('Inmu #20 下北沢の新入り (Shimokitazawa rookie) · T A d o k o r o (2/8)')
  expect(text).toContain('Crowned 0×')
  expect((await inmu($, 'burst')).text).toBe('A demo burst: no points, no rank change.')
  await inmu($, 'band off')
  expect(w.statuses.at(-1)).toBe('Inmu #20 下北沢の新入り (Shimokitazawa rookie) · T A d o k o r o')
})

test("the language setting outranks Claude Code's own", { options: { language: 'en' } }, async ($, on) => {
  world(on, { settings: { language: 'zh-tw' } })
  await start($)
  expect((await inmu($, 'nope')).text).toContain('Unknown "nope"')
})

test('the locale decides when neither the setting nor Claude Code names a language', async ($, on) => {
  world(on, { settings: {}, env: { LANG: 'zh_TW.UTF-8' } })
  await start($)
  expect((await inmu($, 'nope')).text).toContain('不認識')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band and the panel draw on ${surface}`, async ($, on) => {
    world(on)
    await start($)
    const band = await mountBand($, BAND, surface)
    expect(await textOf(band, /#20/)).toBeDefined()
    await submit($, '114514')
    expect(await textOf(band, /いいよ！こいよ！/)).toBeDefined()
    const pane = await $.ui.mount({ plugin: 'inmu-king', surface, component: 'Pane', props: PANE, requestId: 'inmu' })
    expect(await textOf(pane, /淫夢の王 INMU KING/)).toBeDefined()
  })
}
