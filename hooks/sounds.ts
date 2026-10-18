// Sound: the mod's own jingles (sounds/*.wav, made by tools/make_sounds.py)
// and the person's own clips, as pure functions.
//
// The person's clips live in one folder (the `sounds_dir` setting, else
// ~/.claude/inmu-king/sounds). A clip is named for what it plays on:
//   hit, burst, crown, sin      the four events
//   <meme id> or <meme text>    one meme: iiyo.mp3, やりますねぇ.mp3, 114514.wav
// and a -2, -3 … suffix adds variants that take turns (burst-2.wav).
//
// On a hit the meme's own clip plays in place of the hit sound; on a burst or
// the coronation it plays first, then the event's sound.

export const EVENTS = ['hit', 'burst', 'crown', 'sin'] as const
export type SoundEvent = (typeof EVENTS)[number]
export type Clip = { kind: 'builtin' | 'custom'; name: string }
export type Library = ReadonlyMap<string, readonly string[]>

export const AUDIO_EXT = /\.(wav|mp3|m4a|aac|wma)$/i
const VARIANT = /(?:[-_ ]\d{1,2}|\s*\(\d{1,2}\))$/u

// Folds width, case and punctuation so a file name finds its meme:
// いいよこいよ.mp3 finds いいよ！こいよ！, INMU_KING.wav finds INMU KING.
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s!?、。,.・…~〜ー\-_()（）「」『』【】'"]/gu, '')
}

// The key a file name stands for, or null when it is no audio file.
export function keyOf(fileName: string): string | null {
  if (!AUDIO_EXT.test(fileName)) return null
  const base = fileName.replace(AUDIO_EXT, '')
  const stripped = base.replace(VARIANT, '')
  const key = normalize(stripped === '' ? base : stripped)
  return key === '' ? null : key
}

// Sorts the folder's file names into what each one plays on: an event's name
// or a meme's id. Audio files that name nothing come back as `unknown`; files
// that are not audio are left out.
export function buildLibrary(
  names: readonly string[],
  entries: ReadonlyArray<{ id: string; label: string }>,
): { library: Map<string, string[]>; unknown: string[] } {
  const target = new Map<string, string>()
  for (const event of EVENTS) target.set(event, event)
  for (const entry of entries) {
    target.set(normalize(entry.id), entry.id)
    target.set(normalize(entry.label), entry.id)
  }
  const library = new Map<string, string[]>()
  const unknown: string[] = []
  for (const name of [...names].sort()) {
    const key = keyOf(name)
    if (key === null) continue
    const to = target.get(key)
    if (to === undefined) {
      unknown.push(name)
      continue
    }
    library.set(to, [...(library.get(to) ?? []), name])
  }
  return { library, unknown }
}

// What plays for one event: the first meme (in the order given) that has a
// clip, and the event's own clip or the built-in jingle. `choose` picks a
// variant and is asked only for what plays.
export function playlist(
  event: SoundEvent,
  memeIds: readonly string[],
  library: Library,
  choose: (target: string, files: readonly string[]) => string,
): Clip[] {
  let meme: Clip | null = null
  for (const id of memeIds) {
    const files = library.get(id)
    if (files && files.length > 0) {
      meme = { kind: 'custom', name: choose(id, files) }
      break
    }
  }
  const own = library.get(event)
  const sound: Clip = own && own.length > 0 ? { kind: 'custom', name: choose(event, own) } : { kind: 'builtin', name: `${event}.wav` }
  if (meme === null) return [sound]
  return event === 'hit' ? [meme] : [meme, sound]
}

// A PowerShell script that plays `paths` one after another and returns when
// they are done: a .wav through System.Media.SoundPlayer, anything else
// through PresentationCore's MediaPlayer (its length known after it opens;
// each clip is cut at 15 seconds).
export function psScript(paths: readonly string[]): string {
  const quote = (p: string) => "'" + p.replace(/'/g, "''") + "'"
  const isWav = (p: string) => /\.wav$/i.test(p)
  const parts: string[] = []
  if (paths.some(p => !isWav(p))) parts.push('Add-Type -AssemblyName PresentationCore')
  for (const p of paths) {
    if (isWav(p)) {
      parts.push('try { (New-Object System.Media.SoundPlayer ' + quote(p) + ').PlaySync() } catch {}')
    } else {
      parts.push(
        'try { $m = New-Object System.Windows.Media.MediaPlayer; $m.Open([uri]' + quote(p) + '); $i = 0; ' +
          'while (-not $m.NaturalDuration.HasTimeSpan -and $i -lt 40) { Start-Sleep -Milliseconds 50; $i++ }; ' +
          '$m.Play(); $d = 3000; ' +
          'if ($m.NaturalDuration.HasTimeSpan) { $d = [int][Math]::Min($m.NaturalDuration.TimeSpan.TotalMilliseconds, 15000) }; ' +
          'Start-Sleep -Milliseconds ($d + 150); $m.Close() } catch {}',
      )
    }
  }
  return parts.join('; ')
}

export function mimeOf(name: string): string {
  const ext = (name.match(AUDIO_EXT)?.[1] ?? '').toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a') return 'audio/mp4'
  if (ext === 'aac') return 'audio/aac'
  if (ext === 'wma') return 'audio/x-ms-wma'
  return 'audio/wav'
}

export const joinPath = (a: string, b: string): string => a.replace(/[\\/]+$/, '') + '/' + b.replace(/^[\\/]+/, '')
export const winPath = (p: string): string => p.replace(/\//g, '\\')
