import { test, expect, describe } from 'claude-code/testing'
import {
  LEGACY_COPY, NO_PROGRESS, add, coronations, crownsFrom, crownsOwed, dayCopy, foundKey, legacyKeys, liftToTop, nextResetMs, parseKey, progressKey,
  rankOf, readLedger, resetKey, staleKeys, sum,
} from './ledger.ts'
import { initialStats } from './game.ts'

const p = (points: number, bursts: number, crowns = 0, lift = 0) => ({ points, bursts, crowns, lift })

describe('keys', () => {
  test('a key carries its data and reads back the same', async () => {
    expect(progressKey(1760000000000, 'k3f9q2ab', p(1234, 150, 12, 0))).toBe('r:1760000000000:k3f9q2ab:1234:150:12:0')
    expect(parseKey('r:1760000000000:k3f9q2ab:1234:150:12:0')).toEqual({ kind: 'progress', gen: 1760000000000, copy: 'k3f9q2ab', progress: p(1234, 150, 12, 0) })
    expect(parseKey(foundKey(0, 'inmu-king'))).toEqual({ kind: 'found', gen: 0, meme: 'inmu-king' })
    expect(parseKey(resetKey(false, 5000))).toEqual({ kind: 'reset', all: false, ms: 5000 })
    expect(parseKey(resetKey(true, 5000))).toEqual({ kind: 'reset', all: true, ms: 5000 })
    // A lift below zero is the legacy record's alone: it keeps a rank worse than its bursts.
    expect(parseKey(progressKey(0, LEGACY_COPY, p(51, 6, 0, -5)))?.kind).toBe('progress')
  })
  test("keys that are not the ledger's, or are malformed, read as nothing", async () => {
    for (const key of ['stats', 'clockDay', 'r:0:a:1:2:3', 'r:x:a:1:2:3:4', 'r:0:a-b:1:2:3:4', 'r:0:a:-1:2:3:4', 'r:0:a:1:2:3:-4', 'f:0:', 'reset:', 'reset:1.5', 'r:0:a:1:2:3:4:5', `r:0:a:${'9'.repeat(40)}:0:0:0`]) {
      expect(parseKey(key)).toBe(null)
    }
  })
})

describe('readLedger', () => {
  test('before any reset everything counts in generation 0', async () => {
    const ledger = readLedger(['stats', 'r:0:a:10:1:0:0', 'f:0:iiyo'])
    expect(ledger.gen).toBe(0)
    expect(ledger.foundGen).toBe(0)
    expect(ledger.copies.get('a')).toEqual(p(10, 1))
    expect([...ledger.found]).toEqual(['iiyo'])
  })
  test('the newest reset of either kind starts the generation; only a reset all starts the collection over', async () => {
    const ledger = readLedger(['resetall:3000', 'reset:5000', 'reset:4000', 'r:3000:a:9:1:0:0', 'r:5000:b:2:0:0:0', 'f:3000:iiyo', 'f:0:810'])
    expect(ledger.gen).toBe(5000)
    expect(ledger.foundGen).toBe(3000)
    expect([...ledger.copies.keys()]).toEqual(['b'])
    expect([...ledger.found]).toEqual(['iiyo'])
  })
  test("a copy's keys merge to its highest numbers, so a key left behind counts nothing twice", async () => {
    const ledger = readLedger(['r:0:a:10:1:0:0', 'r:0:a:12:1:0:0', 'r:0:b:5:0:0:0'])
    expect(ledger.copies.get('a')).toEqual(p(12, 1))
    expect(sum(ledger.copies.values())).toEqual(p(17, 1))
  })
  test('two legacy snapshots are not merged: a reading takes the one with the most points, whole', async () => {
    const ledger = readLedger(['r:0:legacy:10:2:0:5', 'r:0:legacy:12:4:0:3'])
    expect(ledger.copies.get(LEGACY_COPY)).toEqual(p(12, 4, 0, 3))
    expect(rankOf(sum(ledger.copies.values()))).toBe(13)
  })
})

describe('the rank', () => {
  test('every burst of every session is one rank, and a lift adds rank; #1 and #20 are the ends', async () => {
    expect(rankOf(NO_PROGRESS)).toBe(20)
    expect(rankOf(p(0, 3))).toBe(17)
    expect(rankOf(p(0, 3, 0, 4))).toBe(13)
    expect(rankOf(p(0, 40))).toBe(1)
    expect(rankOf(p(0, 0, 0, -5))).toBe(20)
  })
  test('August 10 lifts the rank to #1 without a burst', async () => {
    const before = p(30, 3)
    expect(rankOf(add(before, { crowns: 1, lift: rankOf(before) - 1 }))).toBe(1)
  })
})

describe('resets', () => {
  test('a reset is newer than the generation it follows, even on a clock that went back', async () => {
    expect(nextResetMs(9000, 5000)).toBe(9000)
    expect(nextResetMs(4000, 5000)).toBe(5001)
    expect(nextResetMs(5000.7, 0)).toBe(5000)
  })
})

describe('staleKeys', () => {
  test('older generations, older resets of each kind, and keys a newer one of the same copy replaced', async () => {
    const keys = [
      'stats', 'resetall:3000', 'reset:5000', 'reset:4000', 'resetall:2000',
      'r:3000:a:9:1:0:0', 'r:5000:b:2:0:0:0', 'r:5000:b:3:0:0:0', 'r:5000:c:7:0:0:0',
      'f:3000:iiyo', 'f:0:810',
    ]
    expect(staleKeys(keys).sort()).toEqual(['f:0:810', 'r:3000:a:9:1:0:0', 'r:5000:b:2:0:0:0', 'reset:4000', 'resetall:2000'])
  })
  test('the newest reset and the newest reset all stay, so neither generation moves back', async () => {
    expect(staleKeys(['resetall:3000', 'reset:5000'])).toEqual([])
  })
  test("two keys of one copy where neither holds every number of the other both stay", async () => {
    expect(staleKeys(['r:0:a:10:2:0:5', 'r:0:a:12:2:0:3'])).toEqual([])
  })
  test('of two legacy snapshots the one a reading takes stays, and the other goes', async () => {
    expect(staleKeys(['r:0:legacy:10:2:0:5', 'r:0:legacy:12:4:0:3'])).toEqual(['r:0:legacy:10:2:0:5'])
  })
})

describe('August 10', () => {
  test("its lift is every session's one record: of two, a reading takes the smaller, and a sweep takes the other", async () => {
    const keys = ['r:0:other:0:15:0:0', `r:0:${dayCopy(2027)}:0:0:0:6`, `r:0:${dayCopy(2027)}:0:0:0:4`]
    const ledger = readLedger(keys)
    expect(ledger.copies.get(dayCopy(2027))).toEqual(p(0, 0, 0, 4))
    const total = sum(ledger.copies.values())
    expect(rankOf(total)).toBe(1)
    expect(coronations(total, undefined)).toBe(1)
    expect(staleKeys(keys)).toEqual([`r:0:${dayCopy(2027)}:0:0:0:6`])
  })
  test('the lift reaches #1 from the chart without any August 10 lift, or is one rank past #1', async () => {
    expect(liftToTop(new Map([['other', p(0, 15)]]))).toBe(4)
    expect(liftToTop(new Map([['other', p(0, 15)], [dayCopy(2027), p(0, 0, 0, 6)]]))).toBe(4)
    expect(liftToTop(new Map([['other', p(0, 25)]]))).toBe(1)
  })
})

describe('coronations', () => {
  test('every burst that lands at #1 is one, on the chart every session climbs', async () => {
    expect(coronations(p(0, 18), undefined)).toBe(0)
    expect(coronations(p(0, 19), undefined)).toBe(1)
    expect(coronations(p(0, 21), undefined)).toBe(3)
    expect(coronations(p(0, 3, 0, 16), undefined)).toBe(1)
  })
  test("the legacy record keeps 0.3.0's count and counts on from where it stood", async () => {
    const atEleven = p(76, 9)
    expect(coronations(atEleven, atEleven)).toBe(0)
    expect(coronations(add(atEleven, { bursts: 10 }), atEleven)).toBe(1)
    const atOne = p(500, 25, 3, -6)
    expect(coronations(atOne, atOne)).toBe(3)
    expect(coronations(add(atOne, { bursts: 1 }), atOne)).toBe(4)
  })
  test('read from a rank alone: two bursts from #2 are two coronations, one from #3 none', async () => {
    expect(crownsFrom(2, 2)).toBe(2)
    expect(crownsFrom(1, 1)).toBe(1)
    expect(crownsFrom(3, 1)).toBe(0)
    expect(crownsFrom(3, 2)).toBe(1)
  })
  test('a coronation no copy has played is owed; one a copy played is not, and two plays owe nothing', async () => {
    expect(crownsOwed(new Map([['a', p(0, 10)], ['b', p(0, 9)]]))).toBe(1)
    expect(crownsOwed(new Map([['a', p(0, 10, 1)], ['b', p(0, 9)]]))).toBe(0)
    expect(crownsOwed(new Map([['a', p(0, 10, 1)], ['b', p(0, 9, 1)]]))).toBe(0)
    expect(crownsOwed(new Map([[LEGACY_COPY, p(500, 25, 3, -6)]]))).toBe(0)
  })
})

describe('the legacy store', () => {
  test("0.3.0's one key becomes a record that keeps its rank, and its finds", async () => {
    const stats = { ...initialStats(), rank: 5, bestRank: 5, totalPoints: 100, coronations: 1, bursts: 10, found: { iiyo: 2, '810': 1, gone: 1 } }
    const keys = legacyKeys(stats, new Set(['iiyo', '810']))
    expect(keys).toEqual(['r:0:legacy:100:10:1:5', 'f:0:810', 'f:0:iiyo'])
    expect(rankOf(sum(readLedger(keys).copies.values()))).toBe(5)
    expect(legacyKeys(stats, new Set(['iiyo', '810']))).toEqual(keys)
  })
  test('a rank worse than its bursts make is kept too', async () => {
    const keys = legacyKeys({ ...initialStats(), rank: 15, bursts: 10 }, new Set())
    expect(rankOf(sum(readLedger(keys).copies.values()))).toBe(15)
  })
  test('an empty old store writes nothing', async () => {
    expect(legacyKeys(initialStats(), new Set())).toEqual([])
  })
})
