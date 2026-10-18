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
  // What the plugin store holds, an earlier version's save: a session never reads it.
  store?: Record<string, unknown>
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
    // Calls to the plugin store: a session plays a game of its own, so none.
    storeCalls: 0,
    clock: mock.clock(on, { now: 1_000 }),
  }
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\me', ...(options.env ?? {}) })
  const store = new Map<string, unknown>(Object.entries(options.store ?? {}))
  for (const noun of ['get', 'set', 'delete', 'keys'] as const) {
    on(`store.${noun}`, ($: any, e: any) => {
      w.storeCalls += 1
      return { value: noun === 'keys' ? [...store.keys()] : noun === 'get' ? store.get(e.key) : undefined }
    })
  }
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
// Noon on August 10, 2027, on this machine's clock.
const AUG10 = new Date(2027, 7, 10, 12, 0, 0).getTime()
// Nine hits of two bursts each take the session from #20 to #2; the shows
// end, and what they toasted, played and drew is forgotten.
const climbToTwo = async ($: any, w: any) => {
  for (let i = 0; i < 9; i++) await submit($, '1145141919810')
  await w.clock.advance(3100)
  for (const list of [w.statuses, w.toasts, w.ran, w.blits, w.played]) list.length = 0
}
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
  const w = world(on)
  await start($)
  expect(w.statuses.at(-1)).toBe(undefined)
  await climbToTwo($, w)
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
  const w = world(on)
  await start($)
  const band = await mountBand($)
  await climbToTwo($, w)
  expect(await textOf(band, /#2/)).toBe('#2 野獣先輩')
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
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  await submit($, '114514')
  expect(await turn($, '', 't1', 'aborted')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await sectionIds($)).toEqual(['intro'])
})

test("a subagent's end neither spends the coronation nor scores", async ($, on) => {
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  await submit($, '114514')
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  await turnStart($, 't1')
  await $.turn.complete({ turnId: 'a1', agentId: 'agent-1', answer: '田所浩二 810', durationMs: 1, isAborted: false, reason: 'answer' })
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  const text = (await inmu($)).text
  expect(text).toContain('(0/8)')
  expect(text).toContain('累計 152 分')
})

test('/context and a teammate compose without the section, and leave the next turn its section', async ($, on) => {
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  await submit($, '114514')
  const analysis = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: ['analysis'] })
  expect(analysis.sections.map((x: any) => x.id)).toEqual(['intro'])
  expect(await turn($, 'やりますねぇ！')).toEqual(['intro', 'inmu-king:coronation'])
})

test('a prompt composed again mid-turn keeps the turn as it began', async ($, on) => {
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  expect(await sectionIds($)).toEqual(['intro'])
  await turnStart($, 't1')
  await submit($, '114514') // crowned while the turn runs
  expect(await sectionIds($)).toEqual(['intro']) // a later request of the same turn
  await reply($, 'ok', 't1')
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
})

test('a coronation that lands mid-turn waits for the next turn', async ($, on) => {
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  expect(await sectionIds($)).toEqual(['intro'])
  await turnStart($, 't1')
  await submit($, '114514') // a prompt queued while Claude works
  await reply($, 'ok', 't1')
  expect(await turn($, 'やりますねぇ！', 't2')).toEqual(['intro', 'inmu-king:coronation'])
  expect(await sectionIds($)).toEqual(['intro'])
})

test('infect off: no section at the coronation', { options: { infect: false } }, async ($, on) => {
  const w = world(on)
  await start($)
  await climbToTwo($, w)
  await submit($, '114514')
  expect(await sectionIds($)).toEqual(['intro'])
})

test('a session nobody reads (-p, the SDK) never gets the section', async ($, on) => {
  const w = world(on)
  await start($, false)
  await climbToTwo($, w)
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

test('a session plays a game of its own: an earlier save is left alone, and the store is never read or written', async ($, on) => {
  const w = world(on, { store: { stats: { rank: 5, totalPoints: 100, bursts: 15 }, 'r:0:legacy:100:15:0:0': true } })
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /#20/)).toBe('#20 下北沢の新入り')
  await submit($, '114514')
  await w.clock.advance(3100)
  await inmu($, 'reset')
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  expect(w.storeCalls).toBe(0)
})

test('the tallies and the collection are the session\'s own', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, '114514')
  await w.clock.advance(3100)
  await submit($, '810')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #19')
  expect(text).toContain('加冕 0 次')
  expect(text).toContain('累計 9 分')
  expect(text).toContain('梗圖鑑 2/33')
})

test('August 10: a session starts crowned, and every full bar at #1 crowns again', async ($, on) => {
  const w = world(on)
  await w.clock.set(AUG10)
  await start($)
  const band = await mountBand($)
  expect(await textOf(band, /INMU KING 降臨/)).toBe('👑 INMU KING 降臨 👑')
  expect(await sectionIds($)).toEqual(['intro', 'inmu-king:coronation'])
  let text = (await inmu($)).text
  expect(text).toContain('淫夢 #1')
  expect(text).toContain('加冕 1 次')
  await w.clock.advance(6100)
  await submit($, '114514')
  text = (await inmu($)).text
  expect(text).toContain('加冕 2 次')
})

test('August 10 crowns a session once: a second start (a hot reload) and a reset do not crown it again', async ($, on) => {
  const w = world(on)
  await w.clock.set(AUG10)
  await start($)
  await start($)
  expect(w.toasts.filter(t => t.startsWith('8月10日')).length).toBe(1)
  expect((await inmu($)).text).toContain('加冕 1 次')
  await inmu($, 'reset')
  await start($)
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #20')
  expect(text).toContain('加冕 0 次')
})

test('11:45:14 pays three points once a day, and a reset does not pay it again', async ($, on) => {
  const w = world(on)
  await w.clock.set(new Date(2027, 2, 3, 11, 45, 13).getTime())
  await start($)
  await w.clock.advance(1000)
  expect(w.toasts).toContain('11:45:14 淫夢時間')
  expect((await inmu($)).text).toContain('累計 3 分')
  await inmu($, 'reset')
  await w.clock.advance(2000)
  expect(w.toasts.filter(t => t === '11:45:14 淫夢時間').length).toBe(1)
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

test('Japanese: the memes and the titles stand alone, and the band, the panel and the replies speak Japanese', async ($, on) => {
  const w = world(on, { settings: { language: '日本語' } })
  await start($)
  const band = await mountBand($)
  // What the band says past its eight letters.
  const words = async () => (await band.findAll({ type: 'Text' })).slice(8).map((t: any) => t.text)
  expect(await words()).toEqual(['#20 下北沢の新入り', 'under the band'])
  expect((await band.find({ key: 'pane' }))?.props.label).toBe('パネル')
  await submit($, 'やりますねぇ')
  expect(await textOf(band, /^\+2 /)).toBe('+2 やりますねぇ NEW!')
  await submit($, '114514')
  expect(await words()).toEqual(['+8 114514 NEW!', 'いいよ！こいよ！', 'under the band'])
  expect(w.toasts.at(-1)).toBe('いいよ！こいよ！')
  const text = (await inmu($)).text
  expect(text).toContain('淫夢 #19 下北沢の新入り · T A d o k o r o (2/8)')
  expect(text).toContain('戴冠 0 回')
  expect(text).toContain('図鑑 2/33')
  const pane = await mountPane($)
  expect(await textOf(pane, /^語録図鑑/)).toBe('語録図鑑 2/33')
  expect(await textOf(pane, /^8点 /)).toBe('8点 114514  ???')
  expect(await textOf(pane, /^最近：/)).toBe('最近：あなた 114514+8、あなた やりますねぇ+2')
  expect((await inmu($, 'burst')).text).toBe('バーストのデモです。得点も順位も変わりません。')
  await inmu($, 'band off')
  expect(w.statuses.at(-1)).toBe('淫夢 #19 下北沢の新入り · T A d o k o r o')
})

test('Japanese: the coronation, a sin and the turn line come without a meaning beside them', async ($, on) => {
  const w = world(on, { settings: { language: 'ja' } })
  await start($)
  await climbToTwo($, w)
  await submit($, '114514')
  expect(w.toasts).toContain('新たな淫夢の王が誕生した')
  await inmu($, 'band off')
  expect(w.statuses.at(-1)).toBe('👑 淫夢の王 INMU KING')
  await $.tool.call({ tool: 'Bash', command: 'boom' })
  expect(w.toasts.at(-1)).toBe('罪がまた一つ増えた · 罪 1')
  const usage = { input_tokens: 10, output_tokens: 810, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm' }
  await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 20_000, isAborted: false, reason: 'answer', usage })
  const line = await $.ui.mount({ plugin: 'inmu-king', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: 20_000 } })
  expect(await textOf(line, /Baked/)).toMatch(/^Baked [-+*/()1451]+ 秒 · 出力 [-+*/()1451]+ トークン$/)
})

test("the language setting outranks Claude Code's own", { options: { language: 'en' } }, async ($, on) => {
  world(on, { settings: { language: 'zh-tw' } })
  await start($)
  expect((await inmu($, 'nope')).text).toContain('Unknown "nope"')
})

test('the ja setting speaks Japanese where Claude Code speaks Chinese', { options: { language: 'ja' } }, async ($, on) => {
  world(on, { settings: { language: 'zh-tw' } })
  await start($)
  expect((await inmu($, 'nope')).text).toContain('「nope」というコマンドはありません')
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
