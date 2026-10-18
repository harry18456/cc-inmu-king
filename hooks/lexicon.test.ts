import { test, expect } from 'claude-code/testing'
import { detect, JACKPOT, KNOWN_IDS, LEXICON, MAX_POINTS_PER_TEXT } from './lexicon.ts'

const ids = (text: string) => detect(text).hits.map(h => h.id).sort()

test('114514 is a jackpot: every letter at once', async () => {
  const d = detect('114514')
  expect(d.points).toBe(JACKPOT)
  expect(d.hits.map(h => h.id)).toEqual(['114514'])
})

test('numbers count only as whole tokens', async () => {
  expect(detect('port 8100, line 11914, build 1145140').points).toBe(0)
  expect(detect('810').points).toBe(1)
  expect(detect('see 1919 and 810').points).toBe(2)
  expect(ids('1919810')).toEqual(['1919810'])
  expect(ids('at 11:45:14 today')).toEqual(['time'])
})

test('japanese and chinese phrases count as substrings, once each', async () => {
  const d = detect('やりますねぇ！やりますねぇ！田所浩二')
  expect(d.hits.map(h => h.id).sort()).toEqual(['tadokoro', 'yarimasu'])
  expect(d.points).toBe(5)
  expect(ids('野獸先輩 和 野兽先辈')).toEqual(['yajuu'])
  expect(ids('いいよ！こいよ！')).toEqual(['iiyo'])
})

test('the classic lines count', async () => {
  expect(ids('まずうちさぁ、屋上あんだけど')).toEqual(['okujou'])
  expect(ids('ぬわああああん疲れたもおおおおん')).toEqual(['nuwaa'])
  expect(ids('それ一番言われてるから')).toEqual(['ichiban'])
  expect(ids('暴れんなよ')).toEqual(['abarenna'])
  expect(ids('ホラ見ろよ見ろよ')).toEqual(['miroyo'])
  expect(ids('野獣の眼光')).toEqual(['gankou'])
  expect(ids('迫真の演技')).toEqual(['hakushin'])
  expect(ids('24歳、学生です')).toEqual(['24sai'])
})

test('latin words need boundaries', async () => {
  expect(detect('inmutable data').points).toBe(0)
  expect(detect('inmu').points).toBe(1)
  expect(ids('tadokoro')).toEqual(['tadokoro'])
  expect(ids('INMU KING')).toContain('inmu-king')
  expect(ids('yajuu senpai')).toEqual(['yajuu'])
  expect(detect('a murmur').points).toBe(0)
  expect(detect('MUR').points).toBe(1)
})

test('the title scores once, not again as 淫夢', async () => {
  expect(ids('INMU KING')).toEqual(['inmu-king'])
  expect(ids('淫夢の王')).toEqual(['inmu-king'])
  expect(ids('淫夢 and INMU KING')).toEqual(['inmu', 'inmu-king'])
})

test('one text lights at most two bars', async () => {
  expect(detect('114514 1919810 INMU KING').points).toBe(MAX_POINTS_PER_TEXT)
})

test('half points round up and never reach zero', async () => {
  expect(detect('810', 0.5).points).toBe(1)
  expect(detect('田所', 0.5).points).toBe(2)
  expect(detect('INMU KING', 0.5).points).toBe(3)
})

test('plain work text is quiet', async () => {
  expect(detect('refactor the login form, run the tests and commit').points).toBe(0)
  expect(detect('幫我看一下這個 PR 的 diff，順便跑 lint').points).toBe(0)
  expect(detect('他的眼光很好，畫面很逼真').points).toBe(0)
  expect(detect('').points).toBe(0)
})

test('full-width digits, half-width kana and the punctuation people use all count', async () => {
  expect(ids('１１４５１４')).toEqual(['114514'])
  expect(ids('ｲｷｽｷﾞ')).toEqual(['ikisugi'])
  expect(ids('いいよ、来いよ')).toEqual(['iiyo'])
  expect(ids('いいよ こいよ')).toEqual(['iiyo'])
  expect(ids('いいよ！！こいよ')).toEqual(['iiyo'])
  expect(ids('11：45：14')).toEqual(['time'])
  expect(ids('yarimasunee')).toEqual(['yarimasu'])
})

test('a latin meme inside a longer word is not the meme', async () => {
  expect(ids('INMU KINGDOM')).toEqual(['inmu'])
  expect(ids('tadokoroFactory')).toEqual([])
  expect(ids('tadokoro_bot')).toEqual([])
  expect(ids('INMUKING')).toEqual(['inmu-king'])
})

test('a number beside a letter or an underscore is part of a word; laughter right after it is not', async () => {
  expect(ids('114514w')).toEqual(['114514'])
  expect(ids('114514www')).toEqual(['114514'])
  expect(ids('810www')).toEqual(['810'])
  expect(detect('build114514x').points).toBe(0)
  expect(detect('114514world').points).toBe(0)
  expect(detect('id114514').points).toBe(0)
  expect(detect('v1919, 810_bonus, foo_810').points).toBe(0)
})

test('a meme in parts may have punctuation or spaces between the parts', async () => {
  expect(ids('見ろよ、見ろよ')).toEqual(['miroyo'])
  expect(ids('見ろよ 見ろよ')).toEqual(['miroyo'])
  expect(ids('いいよ・こいよ')).toEqual(['iiyo'])
  expect(ids('それ、一番言われてるから')).toEqual(['ichiban'])
  expect(ids('お前のことが、好きだったんだよ')).toEqual(['suki'])
  expect(ids('屋上、あんだけど')).toEqual(['okujou'])
})

test('a latin meme right beside Chinese or Japanese still counts', async () => {
  expect(ids('MUR大先輩')).toEqual(['mur'])
  expect(ids('TDN表記')).toEqual(['tdn'])
  expect(ids('tadokoroさん')).toEqual(['tadokoro'])
  expect(ids('我在聽INMU KING')).toEqual(['inmu-king'])
  expect(ids('INMU KINGの歌')).toEqual(['inmu-king'])
  expect(ids('淫夢INMU')).toEqual(['inmu'])
})

test('1145141919810 is both jackpots at once', async () => {
  expect(ids('1145141919810')).toEqual(['114514', '1919810'])
  expect(detect('1145141919810').points).toBe(MAX_POINTS_PER_TEXT)
})

test('everyday Japanese is not the meme', async () => {
  expect(ids('サインアップしてください')).toEqual([])
  expect(ids('ラインアップ')).toEqual([])
  expect(ids('ファッションとファックス')).toEqual([])
  expect(ids('じゃあ修正やりますね')).toEqual([])
  expect(ids('ンアッー！')).toEqual(['nna'])
  expect(ids('ファッ!?')).toEqual(['fa'])
  expect(ids('やりますねえ')).toEqual(['yarimasu'])
})

test('a number inside a price, a decimal or a file:line reference is not the meme', async () => {
  expect(detect('see register.tsx:810 and foo.ts:1919').points).toBe(0)
  expect(detect('$1,810 or 1.1919 or 810.5 or 810:12').points).toBe(0)
  expect(ids('答案：114514')).toEqual(['114514'])
  expect(ids('#114514')).toEqual(['114514'])
  expect(ids('line 810.')).toEqual(['810'])
  expect(ids('時間：11:45:14')).toEqual(['time'])
})

test('MUR, KMR and TDN are three members of the cast, not one', async () => {
  expect(ids('MUR KMR TDN')).toEqual(['kmr', 'mur', 'tdn'])
  expect(detect('MUR KMR TDN').points).toBe(3)
  expect(ids('多田野')).toEqual([])
})

test('every entry has a label, points and an id of its own', async () => {
  expect(KNOWN_IDS.size).toBe(LEXICON.length)
  for (const entry of LEXICON) {
    expect(entry.label.length).toBeGreaterThan(0)
    expect([8, 5, 3, 2, 1]).toContain(entry.points)
  }
})
