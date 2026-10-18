import { test, expect } from 'claude-code/testing'
import {
  FULL, LETTERS, LETTER_COLORS, RANK_START, RANK_TOP, applyPoints, artFor, chantFor, initialGame, initialStats, letterStates,
  lettersLine, logItem, popText, remember, sinLine, sinSpeaks, titleFor, toStats,
} from './game.ts'

test('points light letters; a full bar empties them and climbs one rank', async () => {
  const two = applyPoints(initialGame(), 2)
  expect(two.game.energy).toBe(2)
  expect(two.game.rank).toBe(RANK_START)
  expect(two.bursts).toBe(0)

  const full = applyPoints(two.game, FULL - 2)
  expect(full.game.energy).toBe(0)
  expect(full.game.rank).toBe(RANK_START - 1)
  expect(full.bursts).toBe(1)
  expect(full.crowned).toBe(false)
})

test('sixteen points are two bursts and two ranks; the rest carries over', async () => {
  const out = applyPoints(initialGame(), 17)
  expect(out.bursts).toBe(2)
  expect(out.game.rank).toBe(RANK_START - 2)
  expect(out.game.energy).toBe(1)
})

test('the climb that reaches #1 is the coronation, and a full bar at #1 crowns again', async () => {
  const atTwo = applyPoints(initialGame(2), FULL)
  expect(atTwo.game.rank).toBe(RANK_TOP)
  expect(atTwo.crowned).toBe(true)
  const again = applyPoints(atTwo.game, FULL)
  expect(again.game.rank).toBe(RANK_TOP)
  expect(again.crowned).toBe(true)
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

test('the old stats read whatever the store holds, the 0.1.0 layout included', async () => {
  expect(toStats(undefined)).toEqual({ rank: 20, bestRank: 20, totalPoints: 0, coronations: 0, sins: 0, bursts: 0, found: {}, epoch: 0 })
  expect(toStats({ rank: 14, bestRank: 14, totalPoints: 51, bursts: 6 })).toEqual({ rank: 14, bestRank: 14, totalPoints: 51, coronations: 0, sins: 0, bursts: 6, found: {}, epoch: 0 })
  expect(toStats({ rank: 99, bestRank: 'x', found: { iiyo: 2, bad: -1 } })).toEqual({ rank: 20, bestRank: 20, totalPoints: 0, coronations: 0, sins: 0, bursts: 0, found: { iiyo: 2 }, epoch: 0 })
  expect(toStats({ rank: 5, bestRank: 9 }).bestRank).toBe(5)
  expect(toStats({ epoch: 3 }).epoch).toBe(3)
  expect(initialStats(4).epoch).toBe(4)
})
