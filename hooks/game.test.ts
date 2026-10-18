import { test, expect } from 'claude-code/testing'
import {
  FULL, LETTERS, LETTER_COLORS, RANK_START, RANK_TOP, applyPoints, artFor, chantFor, initialGame, letterStates,
  lettersLine, logItem, popText, remember, sinLine, sinSpeaks, titleFor, toGame,
} from './game.ts'

test("a game an older version left in the host state starts over, keeping only the mute", async () => {
  // 0.4.0's game: its rank came from every session, and it kept no points of its own.
  expect(toGame({ energy: 3, rank: 5, sins: 2, muted: true, crownPending: false, log: [] })).toEqual({ ...initialGame(), muted: true })
  expect(toGame(undefined)).toEqual(initialGame())
  const mangled = toGame({ ...initialGame(7), found: 'iiyo', log: null })
  expect(mangled.rank).toBe(7)
  expect(mangled.found).toEqual([])
  expect(mangled.log).toEqual([])
})

test('points light letters; a full bar empties them and climbs one rank', async () => {
  const two = applyPoints(initialGame(), 2)
  expect(two.game.energy).toBe(2)
  expect(two.game.rank).toBe(RANK_START)
  expect(two.bursts).toBe(0)

  const full = applyPoints(two.game, FULL - 2)
  expect(full.game.energy).toBe(0)
  expect(full.game.rank).toBe(RANK_START - 1)
  expect(full.bursts).toBe(1)
  expect(full.crowns).toBe(0)
  expect(full.game.points).toBe(FULL)
})

test('sixteen points are two bursts and two ranks; the rest carries over', async () => {
  const out = applyPoints(initialGame(), 17)
  expect(out.bursts).toBe(2)
  expect(out.game.rank).toBe(RANK_START - 2)
  expect(out.game.energy).toBe(1)
})

test('the climb that reaches #1 is a coronation, and so is every full bar at #1; the game counts them', async () => {
  const atTwo = applyPoints(initialGame(2), FULL)
  expect(atTwo.game.rank).toBe(RANK_TOP)
  expect(atTwo.crowns).toBe(1)
  const again = applyPoints(atTwo.game, FULL)
  expect(again.game.rank).toBe(RANK_TOP)
  expect(again.crowns).toBe(1)
  expect(again.game.crowns).toBe(2)
  expect(applyPoints(initialGame(2), 2 * FULL).crowns).toBe(2)
  expect(applyPoints(initialGame(3), 2 * FULL).crowns).toBe(1)
})

test('zero or negative points change nothing', async () => {
  const g = initialGame()
  expect(applyPoints(g, 0).game).toBe(g)
  expect(applyPoints(g, -3).game).toBe(g)
})

test('the title ladder covers every rank', async () => {
  for (let rank = RANK_TOP; rank <= RANK_START; rank++) expect(titleFor(rank).length).toBeGreaterThan(0)
  expect(titleFor(20)).toBe('下北沢の新入り')
  expect(titleFor(14)).toBe('24歳、学生')
  expect(titleFor(10)).toBe('水泳部の先輩')
  expect(titleFor(4)).toBe('野獣')
  expect(titleFor(2)).toBe('野獣先輩')
  expect(titleFor(1)).toBe('淫夢の王 INMU KING')
})

test('each letter is lit before this hit, lit by it, or still dark', async () => {
  const short = (energy: number, from?: number) => letterStates(energy, from).map(s => (s === 'lit' ? 'L' : s === 'fresh' ? 'F' : '.')).join('')
  expect(short(0)).toBe('........')
  expect(short(3)).toBe('LLL.....')
  expect(short(5, 3)).toBe('LLLFF...')
  expect(short(8, 0)).toBe('FFFFFFFF')
  expect(short(2, 6)).toBe('LL......')
})

test('every letter has a rainbow color of its own', async () => {
  expect(LETTER_COLORS.length).toBe(LETTERS.length)
  expect(new Set(LETTER_COLORS).size).toBe(LETTERS.length)
})

test('one line without color: lit letters upper case, the rest lower', async () => {
  expect(lettersLine(0)).toBe('t a d o k o r o')
  expect(lettersLine(3)).toBe('T A D o k o r o')
  expect(lettersLine(8)).toBe('T A D O K O R O')
})

test('the popup sums the hit, names the top two, and marks a first find', async () => {
  const hits = [{ label: 'やりますねぇ', points: 2 }, { label: '田所浩二', points: 3 }]
  expect(popText(hits, 'you', true)).toBe('+5 田所浩二・やりますねぇ NEW!')
  expect(popText(hits, 'claude', false)).toBe('Claude +5 田所浩二・やりますねぇ')
  expect(popText([...hits, { label: '810', points: 1 }], 'you', false)).toBe('+6 田所浩二・やりますねぇ…')
  expect(popText(hits, 'you', false, hit => `${hit.label}（${hit.points}）`)).toBe('+5 田所浩二（3）・やりますねぇ（2）')
})

test('the log keeps the newest twelve', async () => {
  let g = initialGame()
  for (let i = 0; i < 15; i++) g = remember(g, [logItem(`hit ${i}`, 1, 'you', i)])
  expect(g.log.length).toBe(12)
  expect(g.log[0]!.label).toBe('hit 14')
})

test('chants, pictures and sin lines rotate; sins speak first, then every fifth', async () => {
  expect(chantFor(0)).toBe('いいよ！こいよ！')
  expect(chantFor(6)).toBe(chantFor(0))
  expect(chantFor(-1)).toBe(chantFor(5))
  expect([artFor(0), artFor(1), artFor(2), artFor(3)]).toEqual(['beast', 'tea', 'digits', 'beast'])
  expect(sinLine(1)).toBe('罪がまた一つ増えた')
  expect(sinLine(4)).toBe(sinLine(1))
  expect(sinSpeaks(1)).toBe(true)
  expect(sinSpeaks(2)).toBe(false)
  expect(sinSpeaks(5)).toBe(true)
})
