import type { Register } from 'claude-code'

// A helper for tools/store_check.py: two sessions write keys of their own
// into one plugin store at the same time, and a third counts what is there.
// inmu-king's store (hooks/ledger.ts) relies on what this checks: a write to
// one key never takes another session's key with it.

const MAX_KEYS = 5000

// Writes `n` keys, one at a time, and says how many writes the store took,
// when the writing started and ended, and the first refusal's reason.
async function put($: any, prefix: string, n: number): Promise<string> {
  const from = Date.now()
  let refused = 0
  let reason = ''
  for (let i = 0; i < n; i++) {
    try {
      await $.store.set(`${prefix}:${i}`, true)
    } catch (err) {
      refused += 1
      if (reason === '') reason = String(err instanceof Error ? err.message : err).slice(0, 200)
    }
  }
  return `put ${prefix} ${n - refused} ${from} ${Date.now()}${refused > 0 ? ` refused ${refused}: ${reason}` : ''}`
}

async function count($: any, prefix: string): Promise<string> {
  const keys: string[] = await $.store.keys()
  return `count ${prefix} ${keys.filter(key => key.startsWith(`${prefix}:`)).length}`
}

async function clear($: any): Promise<string> {
  const keys: string[] = await $.store.keys()
  for (const key of keys) await $.store.delete(key)
  return `clear ${keys.length}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'storecheck', description: 'inmu-king store check', argumentHint: 'put <prefix> <n>|count <prefix>|clear' })
    return next(e)
  })

  on('command.run', { command: 'storecheck' }, async ($, e) => {
    const [verb = '', prefix = '', n = '0'] = e.args.trim().split(/\s+/)
    if (verb === 'put' && /^[A-Za-z]+$/.test(prefix)) return { text: await put($, prefix, Math.max(0, Math.min(MAX_KEYS, Math.floor(Number(n)) || 0))) }
    if (verb === 'count' && /^[A-Za-z]+$/.test(prefix)) return { text: await count($, prefix) }
    if (verb === 'clear') return { text: await clear($) }
    return { text: 'Usage: /storecheck put <letters> <n> | count <letters> | clear' }
  })
}
