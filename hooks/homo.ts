// homo.ts: writes any whole number as arithmetic that reads as 114514.
//
// The idea is itorr/homo's (恶臭数字论证器, MIT). The table here is generated,
// not copied: every way of cutting the digits 1 1 4 5 1 4 into numbers and
// joining them with + - * / and parentheses is evaluated once, and the
// shortest expression of each whole value is kept (about 120,000 trees, well
// under 100 ms). A value the table lacks is split as d * q + r, d the largest
// table value at most n, and q and r are written the same way.
//
//   homo(1000)  → 1*14*5*14+(-11+45-14)   (one of the shortest the search finds)
//   homo(0)     → 1-1*4514 … or whichever is shortest

type E = { v: number; s: string; p: number; k: number } // p: 0 sum, 1 product, 2 atom; k: operators

const DIGITS = [1, 1, 4, 5, 1, 4] as const
const MAX_VALUE = 114514

let TABLE: Map<number, E> | null = null
let KEYS: number[] = []

const better = (prev: E | undefined, next: E): boolean => {
  if (prev === undefined) return true
  if (next.s.length !== prev.s.length) return next.s.length < prev.s.length
  return next.k < prev.k
}

const wrapSum = (e: E): string => (e.p === 0 ? `(${e.s})` : e.s)

function combine(L: E, R: E): E[] {
  const k = L.k + R.k + 1
  const out: E[] = [
    { v: L.v + R.v, s: `${L.s}+${R.p === 0 ? `(${R.s})` : R.s}`, p: 0, k },
    { v: L.v - R.v, s: `${L.s}-${R.p === 0 ? `(${R.s})` : R.s}`, p: 0, k },
    { v: L.v * R.v, s: `${wrapSum(L)}*${R.p === 0 || (R.p === 1 && R.s.includes('/')) ? `(${R.s})` : R.s}`, p: 1, k },
  ]
  if (R.v !== 0) out.push({ v: L.v / R.v, s: `${wrapSum(L)}/${R.p <= 1 ? `(${R.s})` : R.s}`, p: 1, k })
  return out
}

function exprsOf(nums: readonly number[]): E[] {
  const memo = new Map<string, E[]>()
  const go = (i: number, j: number): E[] => {
    const key = `${i},${j}`
    const hit = memo.get(key)
    if (hit) return hit
    const out: E[] = []
    if (i === j) {
      out.push({ v: nums[i]!, s: String(nums[i]), p: 2, k: 0 })
      if (i === 0) out.push({ v: -nums[i]!, s: `-${nums[i]}`, p: 0, k: 0 })
    } else {
      for (let m = i; m < j; m++) {
        for (const L of go(i, m)) for (const R of go(m + 1, j)) out.push(...combine(L, R))
      }
    }
    memo.set(key, out)
    return out
  }
  return go(0, nums.length - 1)
}

function build(): void {
  const table = new Map<number, E>()
  for (let mask = 0; mask < 32; mask++) {
    const nums: number[] = []
    let cur: number = DIGITS[0]
    for (let g = 0; g < 5; g++) {
      if (mask & (1 << g)) {
        nums.push(cur)
        cur = DIGITS[g + 1]!
      } else {
        cur = cur * 10 + DIGITS[g + 1]!
      }
    }
    nums.push(cur)
    for (const e of exprsOf(nums)) {
      if (!Number.isFinite(e.v)) continue
      const r = Math.round(e.v)
      if (Math.abs(e.v - r) > 1e-6) continue
      if (r < -1 || r > MAX_VALUE) continue
      const prev = table.get(r)
      if (!better(prev, e)) continue
      // Floats only screen; the exact rational value decides.
      if (evaluateInt(e.s) !== r) continue
      table.set(r, { ...e, v: r })
    }
  }
  TABLE = table
  KEYS = [...table.keys()].filter(k => k > 0).sort((a, b) => a - b)
}

function table(): Map<number, E> {
  if (TABLE === null) build()
  return TABLE!
}

// The largest table value at most n (n ≥ 1; 1 is always in the table).
function largestAtMost(n: number): number {
  let lo = 0
  let hi = KEYS.length - 1
  let best = KEYS[0]!
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const k = KEYS[mid]!
    if (k <= n) {
      best = k
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

// True when `s` has a + or - at parenthesis depth 0 past its first character.
function hasTopLevelSum(s: string): boolean {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && i > 0 && (c === '+' || c === '-')) return true
  }
  return false
}

const asFactor = (s: string): string => (hasTopLevelSum(s) || s.startsWith('-') ? `(${s})` : s)
const asTerm = (s: string): string => (s.startsWith('-') ? `(${s})` : s)

export function homo(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const whole = Math.round(n)
  if (whole < 0) return `(${table().get(-1)!.s})*(${homo(-whole)})`
  const hit = table().get(whole)
  if (hit) return hit.s
  const d = largestAtMost(whole)
  const q = Math.floor(whole / d)
  const r = whole - d * q
  const dS = table().get(d)!
  let s = q === 1 ? dS.s : `${wrapSum(dS)}*${asFactor(homo(q))}`
  if (r > 0) s += `+${asTerm(homo(r))}`
  return s
}

// How many whole values the search found directly (for tests and curiosity).
export function tableSize(): number {
  return table().size
}

// An exact evaluator for + - * / and parentheses over rationals (BigInt), so
// that 11/(45-1)*4 is exactly 1 and never 0.9999999999999999. Used to confirm
// every table entry, and by the tests.
type Q = { n: bigint; d: bigint }

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) [x, y] = [y, x % y]
  return x
}

const q = (n: bigint, d: bigint): Q => {
  if (d === 0n) throw new Error('division by zero')
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = gcd(n, d) || 1n
  return { n: n / g, d: d / g }
}

export function evaluateExact(src: string): Q {
  let i = 0
  const peek = () => src[i]
  const expr = (): Q => {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = src[i++]
      const r = term()
      v = op === '+' ? q(v.n * r.d + r.n * v.d, v.d * r.d) : q(v.n * r.d - r.n * v.d, v.d * r.d)
    }
    return v
  }
  const term = (): Q => {
    let v = unary()
    while (peek() === '*' || peek() === '/') {
      const op = src[i++]
      const r = unary()
      v = op === '*' ? q(v.n * r.n, v.d * r.d) : q(v.n * r.d, v.d * r.n)
    }
    return v
  }
  const unary = (): Q => {
    if (peek() === '-') {
      i++
      const v = unary()
      return { n: -v.n, d: v.d }
    }
    return atom()
  }
  const atom = (): Q => {
    if (peek() === '(') {
      i++
      const v = expr()
      if (src[i] !== ')') throw new Error(`expected ) at ${i} in ${src}`)
      i++
      return v
    }
    const start = i
    while (i < src.length && src[i]! >= '0' && src[i]! <= '9') i++
    if (start === i) throw new Error(`expected a number at ${i} in ${src}`)
    return { n: BigInt(src.slice(start, i)), d: 1n }
  }
  const v = expr()
  if (i !== src.length) throw new Error(`trailing input at ${i} in ${src}`)
  return v
}

// The whole number an expression is exactly equal to, or null when it is not
// a whole number (or does not parse).
export function evaluateInt(src: string): number | null {
  try {
    const v = evaluateExact(src)
    if (v.d !== 1n) return null
    if (v.n > BigInt(Number.MAX_SAFE_INTEGER) || v.n < -BigInt(Number.MAX_SAFE_INTEGER)) return null
    return Number(v.n)
  } catch {
    return null
  }
}

// The float value of an expression, for a quick look.
export function evaluate(src: string): number {
  const v = evaluateExact(src)
  return Number(v.n) / Number(v.d)
}
