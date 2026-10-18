import { test, expect } from 'claude-code/testing'
import { LEXICON } from './lexicon.ts'
import { buildLibrary, joinPath, keyOf, mimeOf, normalize, playlist, psScript, winPath } from './sounds.ts'

const first = (_target: string, files: readonly string[]) => files[0]!

test('a file name stands for its key: variants and case folded, other files ignored', async () => {
  expect(keyOf('burst.wav')).toBe('burst')
  expect(keyOf('Burst-2.MP3')).toBe('burst')
  expect(keyOf('crown_3.m4a')).toBe('crown')
  expect(keyOf('114514 (1).mp3')).toBe('114514')
  expect(keyOf('1919810.wav')).toBe('1919810')
  expect(keyOf('1919-810.wav')).toBe('1919810')
  expect(keyOf('readme.txt')).toBe(null)
  expect(keyOf('いいよ！こいよ！.mp3')).toBe(normalize('いいよこいよ'))
})

test('the library sorts files into events and memes, by id or by the meme text', async () => {
  const { library, unknown } = buildLibrary(
    ['burst.wav', 'burst-2.mp3', 'iiyo.mp3', 'やりますねぇ.m4a', 'INMU_KING.wav', '野獣先輩.mp3', 'random.mp3', 'notes.txt'],
    LEXICON,
  )
  expect(library.get('burst')).toEqual(['burst-2.mp3', 'burst.wav'])
  expect(library.get('iiyo')).toEqual(['iiyo.mp3'])
  expect(library.get('yarimasu')).toEqual(['やりますねぇ.m4a'])
  expect(library.get('inmu-king')).toEqual(['INMU_KING.wav'])
  expect(library.get('yajuu')).toEqual(['野獣先輩.mp3'])
  expect(unknown).toEqual(['random.mp3'])
})

test("a hit plays the meme's own clip in place of the hit sound; a burst plays both", async () => {
  const lib = new Map([['iiyo', ['iiyo.mp3']], ['burst', ['b1.wav', 'b2.wav']]])
  expect(playlist('hit', ['iiyo'], lib, first)).toEqual([{ kind: 'custom', name: 'iiyo.mp3' }])
  expect(playlist('hit', ['tadokoro'], lib, first)).toEqual([{ kind: 'builtin', name: 'hit.wav' }])
  expect(playlist('burst', ['tadokoro', 'iiyo'], lib, first)).toEqual([
    { kind: 'custom', name: 'iiyo.mp3' },
    { kind: 'custom', name: 'b1.wav' },
  ])
  expect(playlist('crown', [], lib, first)).toEqual([{ kind: 'builtin', name: 'crown.wav' }])
  expect(playlist('sin', [], new Map(), first)).toEqual([{ kind: 'builtin', name: 'sin.wav' }])
})

test('a variant is chosen only for what plays', async () => {
  const lib = new Map([['iiyo', ['a.mp3']], ['yarimasu', ['b.mp3']]])
  const asked: string[] = []
  playlist('hit', ['iiyo', 'yarimasu'], lib, (target, files) => {
    asked.push(target)
    return files[0]!
  })
  expect(asked).toEqual(['iiyo'])
})

test('the PowerShell script plays wav with SoundPlayer and the rest with MediaPlayer, quotes doubled', async () => {
  const script = psScript(['C:\\x\\a.wav', "C:\\it's\\b.mp3"])
  expect(script.startsWith('Add-Type -AssemblyName PresentationCore')).toBe(true)
  expect(script).toContain("System.Media.SoundPlayer 'C:\\x\\a.wav'")
  expect(script).toContain("[uri]'C:\\it''s\\b.mp3'")
  expect(script.indexOf('a.wav')).toBeLessThan(script.indexOf('b.mp3'))
  expect(psScript(['C:\\a.wav'])).not.toContain('PresentationCore')
})

test('paths and mime types', async () => {
  expect(joinPath('C:\\Users\\me\\', '.claude/inmu-king/sounds')).toBe('C:\\Users\\me/.claude/inmu-king/sounds')
  expect(winPath('C:\\Users\\me/.claude/x')).toBe('C:\\Users\\me\\.claude\\x')
  expect(mimeOf('a.mp3')).toBe('audio/mpeg')
  expect(mimeOf('a.WAV')).toBe('audio/wav')
  expect(mimeOf('a.m4a')).toBe('audio/mp4')
})
