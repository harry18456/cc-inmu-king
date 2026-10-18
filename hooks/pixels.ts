// Pixel art for the terminal's Raster element, all of it original: a crowned
// beast (野獣, read literally) whose eyes flash, a glass of iced tea that
// drains in three seconds, the number 114514 in cycling rainbow digits, and
// a crowd of crowned dancers for the coronation.
//
// Each cell holds two pixels, top and bottom. Both colored: an upper half
// block ▀, the top pixel its foreground and the bottom one its background.
// One transparent: the half block of the colored one over the terminal's own
// background. Both transparent: a space. So the art sits on the terminal's
// background on any theme, with no stray blocks around it.

export type Palette = Readonly<Record<string, number | null>>
export type Picture = { columns: number; rows: number; cells: string }

// The terminal's own color: bit 24 alone.
export const DEFAULT_COLOR = 0x01000000
export const SPACE = 0x20
export const UPPER_HALF = 0x2580
export const LOWER_HALF = 0x2584

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toB64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

export function fromB64(text: string): Uint8Array {
  const out: number[] = []
  let buf = 0
  let bits = 0
  for (const ch of text.replace(/=+$/, '')) {
    const v = B64.indexOf(ch)
    if (v < 0) throw new Error(`fromB64: "${ch}" is not base64`)
    buf = ((buf << 6) | v) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((buf >> bits) & 0xff)
    }
  }
  return Uint8Array.from(out)
}

// The cells back as [codePoint, foreground, background] triplets (for tests).
export function cellsOf(pic: Picture): number[][] {
  const bytes = fromB64(pic.cells)
  const view = new DataView(bytes.buffer)
  const out: number[][] = []
  for (let i = 0; i + 12 <= bytes.length; i += 12) {
    out.push([view.getUint32(i, true), view.getUint32(i + 4, true), view.getUint32(i + 8, true)])
  }
  return out
}

function colorOf(palette: Palette, key: string): number | null {
  if (!(key in palette)) throw new Error(`picture: no color for "${key}"`)
  const c = palette[key]
  return c === undefined ? null : c
}

// `art` is 2 × rows lines of equal width, one character per pixel, each a key
// of `palette` (null leaves the terminal's background showing).
export function picture(art: readonly string[], palette: Palette): Picture {
  if (art.length === 0 || art.length % 2 !== 0) throw new Error(`picture: ${art.length} pixel rows, need an even count`)
  const columns = art[0]!.length
  const rows = art.length / 2
  const words = new Uint32Array(columns * rows * 3)
  for (let y = 0; y < rows; y++) {
    const topRow = art[y * 2]!
    const bottomRow = art[y * 2 + 1]!
    if (topRow.length !== columns || bottomRow.length !== columns) throw new Error(`picture: row ${y} is not ${columns} wide`)
    for (let x = 0; x < columns; x++) {
      const at = (y * columns + x) * 3
      const top = colorOf(palette, topRow[x]!)
      const bottom = colorOf(palette, bottomRow[x]!)
      if (top === null && bottom === null) {
        words[at] = SPACE
        words[at + 1] = DEFAULT_COLOR
        words[at + 2] = DEFAULT_COLOR
      } else if (top === null) {
        words[at] = LOWER_HALF
        words[at + 1] = bottom!
        words[at + 2] = DEFAULT_COLOR
      } else if (bottom === null) {
        words[at] = UPPER_HALF
        words[at + 1] = top
        words[at + 2] = DEFAULT_COLOR
      } else {
        words[at] = UPPER_HALF
        words[at + 1] = top
        words[at + 2] = bottom
      }
    }
  }
  return { columns, rows, cells: toB64(new Uint8Array(words.buffer)) }
}

// Puts pictures of one height side by side with `gap` blank columns between.
export function beside(pieces: readonly (readonly string[])[], gap = 1): string[] {
  const height = pieces[0]!.length
  const out: string[] = []
  for (let y = 0; y < height; y++) out.push(pieces.map(p => p[y]!).join('.'.repeat(gap)))
  return out
}

// ── The crowned beast: 24 × 12 pixels, two frames (its eyes flash). ──────────
const BEAST_PALETTE: Palette = {
  '.': null,
  c: 0xffd84a, // crown
  j: 0xe0303a, // the crown's jewel
  F: 0x5e3a18, // dark fur
  f: 0x8a5a2b, // fur
  w: 0xf4f1e6, // eye white
  e: 0x111111, // pupil
  g: 0xfff27a, // the flash in its eyes
  s: 0xc98a7a, // snout
  n: 0x3a2020, // nostril
  t: 0xf4f1e6, // tusk
  m: 0x5a1a1a, // mouth
}
const BEAST_CALM: readonly string[] = [
  '.........c..c..c........',
  '.........cccjccc........',
  '....FFffffffffffffFF....',
  '.....FffffffffffffF.....',
  '......ffweffffewff......',
  '......ffffffffffff......',
  '......fffssssssfff......',
  '......fffsnssnsfff......',
  '......ftfssssssftf......',
  '......ftfmmmmmmftf......',
  '.......ffffffffff.......',
  '........FFFFFFFF........',
]
const BEAST_GLARE: readonly string[] = BEAST_CALM.map((row, y) =>
  y === 3 ? '.....FfffgffffgfffF.....' : y === 4 ? '......ffwgffffgwff......' : row,
)
export const BEAST_FRAMES: readonly Picture[] = [picture(BEAST_CALM, BEAST_PALETTE), picture(BEAST_GLARE, BEAST_PALETTE)]

// ── Iced tea: 24 × 12 pixels, ten frames from full to empty. ─────────────────
const TEA_PALETTE: Palette = {
  '.': null,
  g: 0xa8c8d8, // glass
  s: 0xe0303a, // straw
  l: 0xf2d22e, // lemon
  i: 0xe8f6ff, // ice
  u: 0xd88a3a, // the tea's surface
  t: 0xb5651d, // tea
  T: 0x8a4a12, // tea at the bottom
}

// The glass with `level` rows of tea (0 to 9). The ice floats at the surface
// and settles on the bottom as the glass empties.
export function teaArt(level: number): string[] {
  const top = 11 - Math.max(0, Math.min(9, level))
  const iceA = Math.min(top, 9)
  const iceB = Math.min(top + 1, 9)
  const isIce = (r: number, c: number) =>
    (c >= 9 && c <= 10 && r >= iceA && r <= iceA + 1) || (c >= 12 && c <= 13 && r >= iceB && r <= iceB + 1)
  const rows: string[] = []
  for (let r = 0; r < 12; r++) {
    let row = ''
    for (let c = 0; c < 24; c++) {
      let k = '.'
      if (r === 11) k = c >= 8 && c <= 15 ? 'g' : '.'
      else if (c === 7 || c === 16) k = r >= 1 ? 'g' : '.'
      else if (c === 14) k = 's'
      else if (r === 1 && (c === 8 || c === 9)) k = 'l'
      else if (r >= 2 && c >= 8 && c <= 15) {
        if (isIce(r, c)) k = 'i'
        else if (r >= top) k = r === top ? 'u' : r === 10 ? 'T' : 't'
      }
      row += k
    }
    rows.push(row)
  }
  return rows
}
export const TEA_FRAMES: readonly Picture[] = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(level => picture(teaArt(level), TEA_PALETTE))

// ── 114514 in rainbow digits: 6 frames, the colors stepping along. ───────────
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
}
const RAINBOW = [0xff4d4d, 0xffa64d, 0xffe14d, 0x5ee35e, 0x4db8ff, 0xb36bff] as const
const DIGIT_KEYS = 'abcdef'

// The six digits at `scale` (1: 23 × 6 pixels, 2: 46 × 10), digit i drawn with key i.
export function digitsArt(scale: number): string[] {
  const text = '114514'
  const rows: string[] = []
  for (let y = 0; y < 5 * scale; y++) {
    let row = ''
    for (let i = 0; i < text.length; i++) {
      const line = GLYPHS[text[i]!]![Math.floor(y / scale)]!
      for (const ch of line) row += (ch === '#' ? DIGIT_KEYS[i]! : '.').repeat(scale)
      if (i < text.length - 1) row += '.'.repeat(scale)
    }
    rows.push(row)
  }
  if (rows.length % 2 === 1) rows.push('.'.repeat(rows[0]!.length))
  return rows
}

function digitFrames(scale: number): Picture[] {
  const art = digitsArt(scale)
  return RAINBOW.map((_, k) => {
    const palette: Record<string, number | null> = { '.': null }
    for (let i = 0; i < DIGIT_KEYS.length; i++) palette[DIGIT_KEYS[i]!] = RAINBOW[(i + k) % RAINBOW.length]!
    return picture(art, palette)
  })
}
export const DIGITS_BIG: readonly Picture[] = digitFrames(2)
export const DIGITS_SMALL: readonly Picture[] = digitFrames(1)

// ── The coronation's crowd: three crowned dancers, out of step. ──────────────
const DANCER_PALETTE: Palette = {
  '.': null,
  c: 0xffd84a, // crown
  s: 0xd9a066, // skin
  r: 0xc8322b, // robe
  g: 0xffd84a, // trim
  k: 0x2b2b2b, // shoes
}
const DANCER_UP: readonly string[] = [
  '....ccc.....',
  '....sss.....',
  '.s..rrr..s..',
  '..s.rgr.s...',
  '...srrrs....',
  '....rgr.....',
  '....rrr.....',
  '....r.r.....',
  '...r...r....',
  '..r.....r...',
  '.k.......k..',
  '............',
]
const DANCER_DOWN: readonly string[] = [
  '....ccc.....',
  '....sss.....',
  '....rrr.....',
  '...srgrs....',
  '..s.rrr.s...',
  '.s..rgr..s..',
  '....rrr.....',
  '....r.r.....',
  '....r.r.....',
  '....r.r.....',
  '...k...k....',
  '............',
]
export const CROWD_FRAMES: readonly Picture[] = [
  picture(beside([DANCER_UP, DANCER_DOWN, DANCER_UP]), DANCER_PALETTE),
  picture(beside([DANCER_DOWN, DANCER_UP, DANCER_DOWN]), DANCER_PALETTE),
]
