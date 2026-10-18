import { test, expect } from 'claude-code/testing'
import {
  BEAST_FRAMES, CROWD_FRAMES, DEFAULT_COLOR, DIGITS_BIG, DIGITS_SMALL, LOWER_HALF, SPACE, TEA_FRAMES, UPPER_HALF,
  cellsOf, digitsArt, fromB64, picture, teaArt, toB64, type Picture,
} from './pixels.ts'

const sizeOf = (frames: readonly Picture[]) => frames.map(f => `${f.columns}x${f.rows}`)

test('every animation keeps one size across its frames, and its cells decode to that size', async () => {
  expect(sizeOf(BEAST_FRAMES)).toEqual(['24x6', '24x6'])
  expect(sizeOf(TEA_FRAMES)).toEqual(Array(10).fill('24x6'))
  expect(sizeOf(DIGITS_BIG)).toEqual(Array(6).fill('46x5'))
  expect(sizeOf(DIGITS_SMALL)).toEqual(Array(6).fill('23x3'))
  expect(sizeOf(CROWD_FRAMES)).toEqual(['38x6', '38x6'])
  for (const frames of [BEAST_FRAMES, TEA_FRAMES, DIGITS_BIG, DIGITS_SMALL, CROWD_FRAMES]) {
    for (const f of frames) expect(cellsOf(f).length).toBe(f.columns * f.rows)
  }
})

test('transparent pixels leave the terminal background: a space, or the other half block', async () => {
  const cells = cellsOf(picture(['.ab.', '..ba'], { '.': null, a: 0x111111, b: 0x222222 }))
  expect(cells[0]).toEqual([SPACE, DEFAULT_COLOR, DEFAULT_COLOR])
  expect(cells[1]).toEqual([UPPER_HALF, 0x111111, DEFAULT_COLOR])
  expect(cells[2]).toEqual([UPPER_HALF, 0x222222, 0x222222])
  expect(cells[3]).toEqual([LOWER_HALF, 0x111111, DEFAULT_COLOR])
})

test('no picture draws a foreground in the terminal default color', async () => {
  for (const frames of [BEAST_FRAMES, TEA_FRAMES, DIGITS_BIG, CROWD_FRAMES]) {
    for (const f of frames) {
      for (const [cp, fg] of cellsOf(f)) if (cp !== SPACE) expect(fg).not.toBe(DEFAULT_COLOR)
    }
  }
})

test('the tea drains row by row, and the last glass is empty', async () => {
  const tea = (level: number) => teaArt(level).join('').replace(/[^tuT]/g, '').length
  expect(tea(9)).toBeGreaterThan(0)
  expect(tea(0)).toBe(0)
  for (let level = 9; level > 0; level--) expect(tea(level - 1)).toBeLessThan(tea(level))
  expect(TEA_FRAMES[0]!.cells).not.toBe(TEA_FRAMES[9]!.cells)
})

test('the beast glares on its second frame', async () => {
  expect(BEAST_FRAMES[0]!.cells).not.toBe(BEAST_FRAMES[1]!.cells)
})

test('the digits read 1 1 4 5 1 4, each digit its own color key', async () => {
  const art = digitsArt(1)
  expect(art.length).toBe(6)
  expect(art[0]).toBe('.a...b..c.c.ddd..e..f.f')
  expect(art[4]).toBe('aaa.bbb...c.ddd.eee...f')
  expect(digitsArt(2)[0]!.length).toBe(46)
  expect(DIGITS_BIG[0]!.cells).not.toBe(DIGITS_BIG[1]!.cells)
})

test('base64 round-trips, and a ragged picture is refused', async () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253])
  expect([...fromB64(toB64(bytes))]).toEqual([...bytes])
  let refused = false
  try {
    picture(['ab', 'a'], { a: 1, b: 2 })
  } catch {
    refused = true
  }
  expect(refused).toBe(true)
})
