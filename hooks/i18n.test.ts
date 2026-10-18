import { test, expect, describe } from 'claude-code/testing'
import { LANGS, STRINGS, glossed, lineMeaning, meaningKeys, memeMeaning, normalizeLang, pickLang } from './i18n.ts'
import { LEXICON } from './lexicon.ts'
import { CHANTS, CROWN_CHANT, CROWN_TOAST, RANK_START, RANK_TOP, SIN_LINES, TIME_LINE, YAJUU_DAY_LINE, titleFor } from './game.ts'

describe('normalizeLang', () => {
  test('reads the spellings Claude Code, the OS and people use', async () => {
    expect(normalizeLang('zh-tw')).toBe('zh-TW')
    expect(normalizeLang('zh-Hant')).toBe('zh-TW')
    expect(normalizeLang('zh_TW.UTF-8')).toBe('zh-TW')
    expect(normalizeLang('en-US')).toBe('en')
    expect(normalizeLang('en_US.UTF-8')).toBe('en')
  })
  test('reads a language written as a name, the way the setting often holds it', async () => {
    expect(normalizeLang('Traditional Chinese')).toBe('zh-TW')
    expect(normalizeLang('繁體中文')).toBe('zh-TW')
    expect(normalizeLang('简体中文')).toBe('zh-TW')
    expect(normalizeLang('English')).toBe('en')
    expect(normalizeLang('英文')).toBe('en')
    expect(normalizeLang('中国語')).toBe('zh-TW')
    expect(normalizeLang('簡体字中国語')).toBe('zh-TW')
  })
  test('reads Japanese as a code, a locale or a name', async () => {
    expect(normalizeLang('ja')).toBe('ja')
    expect(normalizeLang('JA')).toBe('ja')
    expect(normalizeLang('ja-JP')).toBe('ja')
    expect(normalizeLang('ja_JP.UTF-8')).toBe('ja')
    expect(normalizeLang('ja:en_US:en')).toBe('ja')
    expect(normalizeLang('Japanese_Japan.932')).toBe('ja')
    expect(normalizeLang('Japanese')).toBe('ja')
    expect(normalizeLang('日本語')).toBe('ja')
  })
  test('a value that names two languages goes by the one named first', async () => {
    expect(normalizeLang('日本語と英語')).toBe('ja')
    expect(normalizeLang('日本語（技術用語は英語）')).toBe('ja')
    expect(normalizeLang('Japanese, code comments in English')).toBe('ja')
    expect(normalizeLang('回覆用繁體中文，程式碼用英文')).toBe('zh-TW')
    expect(normalizeLang('English; 中文 in comments')).toBe('en')
  })
  test('leaves everything else alone', async () => {
    expect(normalizeLang('ko')).toBe(null)
    expect(normalizeLang('Korean')).toBe(null)
    expect(normalizeLang('한국어')).toBe(null)
    expect(normalizeLang('fr_FR.UTF-8')).toBe(null)
    expect(normalizeLang('auto')).toBe(null)
    expect(normalizeLang('')).toBe(null)
    expect(normalizeLang(undefined)).toBe(null)
  })
})

describe('pickLang', () => {
  test('the setting first, then Claude Code, then the locale, then English', async () => {
    expect(pickLang('en', 'zh-tw', 'zh_TW.UTF-8')).toBe('en')
    expect(pickLang('auto', 'zh-tw', 'en_US.UTF-8')).toBe('zh-TW')
    expect(pickLang('auto', undefined, 'zh_TW.UTF-8')).toBe('zh-TW')
    expect(pickLang('auto', 'ja', 'en_US.UTF-8')).toBe('ja')
    expect(pickLang('auto', undefined, 'ja_JP.UTF-8')).toBe('ja')
    expect(pickLang('ja', 'zh-tw', 'zh_TW.UTF-8')).toBe('ja')
    expect(pickLang('auto', 'ko', 'ko_KR.UTF-8')).toBe('en')
    expect(pickLang(undefined, undefined, undefined)).toBe('en')
  })
})

const titles = [...new Set(Array.from({ length: RANK_START - RANK_TOP + 1 }, (_, i) => titleFor(RANK_TOP + i)))]
const lines = [...CHANTS, CROWN_CHANT, CROWN_TOAST, ...SIN_LINES, TIME_LINE, YAJUU_DAY_LINE, ...titles]
// The languages that put a meaning beside the Japanese. In Japanese the memes
// and the lines read as they are.
const GLOSSED = LANGS.filter(lang => lang !== 'ja')

describe('meanings', () => {
  test('every meme has a meaning in every glossed language, and no stale ones', async () => {
    const ids = LEXICON.map(entry => entry.id)
    expect(GLOSSED).toEqual(['en', 'zh-TW'])
    for (const lang of GLOSSED) {
      for (const id of ids) expect(memeMeaning(lang, id).length).toBeGreaterThan(0)
      for (const id of meaningKeys(lang).memes) expect(ids).toContain(id)
    }
  })
  test('in Japanese the memes and the lines stand alone, with no meaning beside them', async () => {
    expect(meaningKeys('ja')).toEqual({ memes: [], lines: [] })
    for (const entry of LEXICON) expect(memeMeaning('ja', entry.id)).toBe('')
    for (const line of lines) expect(lineMeaning('ja', line)).toBe('')
  })
  test('a meaning holds no brackets, since the popup puts it in brackets', async () => {
    for (const lang of LANGS) {
      for (const entry of LEXICON) expect(memeMeaning(lang, entry.id)).not.toMatch(/[()（）]/)
      for (const line of lines) expect(lineMeaning(lang, line)).not.toMatch(/[()（）]/)
    }
  })
  test('every line the mod shouts has a meaning in every glossed language, empty where it reads as it is', async () => {
    for (const lang of GLOSSED) {
      for (const line of lines) expect(meaningKeys(lang).lines).toContain(line)
      for (const line of meaningKeys(lang).lines) expect(lines).toContain(line)
    }
    expect(lineMeaning('en', CROWN_CHANT).length).toBeGreaterThan(0)
    expect(lineMeaning('zh-TW', CROWN_CHANT)).toBe('')
  })
  test("a name says whose it is, ホモビ says adult video, BB says blue back, MUR and KMR are TDN-style names", async () => {
    expect(memeMeaning('zh-TW', 'tadokoro')).toContain('通稱')
    expect(memeMeaning('en', 'tadokoro')).toContain("internet's name")
    expect(memeMeaning('zh-TW', 'homobi')).toContain('成人')
    expect(memeMeaning('en', 'homobi')).toContain('adult')
    expect(memeMeaning('zh-TW', 'bb')).toContain('ブルーバック')
    expect(memeMeaning('en', 'bb')).toContain('blue back')
    for (const lang of GLOSSED) {
      expect(memeMeaning(lang, 'mur')).toContain('TDN')
      expect(memeMeaning(lang, 'kmr')).toContain('TDN')
      expect(memeMeaning(lang, 'tdn')).toContain('MUR')
    }
  })
  test('glossed: brackets in Chinese, parentheses in English, the text alone without a meaning', async () => {
    expect(glossed('zh-TW', 'やりますねぇ', '挺行的嘛')).toBe('やりますねぇ（挺行的嘛）')
    expect(glossed('en', 'やりますねぇ', 'not bad at all')).toBe('やりますねぇ (not bad at all)')
    expect(glossed('zh-TW', '👑 INMU KING 降臨 👑', '')).toBe('👑 INMU KING 降臨 👑')
    expect(glossed('ja', 'やりますねぇ', memeMeaning('ja', 'yarimasu'))).toBe('やりますねぇ')
    expect(glossed('ja', 'X', 'Y')).toBe('X（Y）')
  })
})

describe('the string tables', () => {
  test('every language answers every key with the same shape', async () => {
    const keys = Object.keys(STRINGS.en).sort()
    for (const lang of LANGS) {
      expect(Object.keys(STRINGS[lang]).sort()).toEqual(keys)
      for (const k of keys) expect(typeof (STRINGS[lang] as any)[k]).toBe(typeof (STRINGS.en as any)[k])
    }
  })
  test('verbs, paths and numbers survive translation', async () => {
    for (const lang of LANGS) {
      const s = STRINGS[lang]
      expect(s.unknownVerb('nope')).toContain('status|burst|king|sounds')
      expect(s.reset).toContain('/inmu reset all')
      expect(s.soundFolder('C:\\x\\sounds')).toContain('C:\\x\\sounds')
      expect(s.standing(7, 'T', 'T A D o k o r o', 3)).toContain('#7')
      expect(s.standing(7, 'T', 'T A D o k o r o', 3)).toContain('(3/8)')
    }
  })
  test('every sentence keeps what it is given', async () => {
    const has = (text: string, ...parts: string[]) => { for (const part of parts) expect(text).toContain(part) }
    for (const lang of LANGS) {
      const s = STRINGS[lang]
      has(s.status(101, 'TITLE', 'LETTERS'), '#101', 'TITLE', 'LETTERS')
      has(s.tallies(101, 202, 303, 404, 505, 'SOUND'), '101', '202', '303', '404/505', 'SOUND')
      has(s.paneTallies(101, 202, 303, true), '101', '202', '303')
      has(s.collection(101, 202), '101/202')
      has(s.tier(101, 'ITEMS'), '101', 'ITEMS')
      has(s.recent(['ITEM-A', 'ITEM-B']), 'ITEM-A', 'ITEM-B')
      has(s.list(['ITEM-A', 'ITEM-B']), 'ITEM-A', 'ITEM-B')
      has(s.groups(['ITEM-A', 'ITEM-B']), 'ITEM-A', 'ITEM-B')
      has(s.alias('ID', 'LABEL'), 'ID', 'LABEL')
      has(s.placed('PLACED'), 'PLACED')
      has(s.unplaced('UNPLACED'), 'UNPLACED')
      has(s.memes('MEMES'), 'MEMES')
      has(s.sinToast('LINE', 101), 'LINE', '101')
      has(s.turnLine('WORD', 'SECONDS', 'TOKENS'), 'WORD', 'SECONDS', 'TOKENS')
      expect(s.turnLine('WORD', 'SECONDS', null)).not.toContain('null')
    }
  })
})
