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
  })
  test('leaves everything else alone', async () => {
    expect(normalizeLang('ja')).toBe(null)
    expect(normalizeLang('Japanese')).toBe(null)
    expect(normalizeLang('日本語')).toBe(null)
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
    expect(pickLang('auto', 'ja', 'ja_JP.UTF-8')).toBe('en')
    expect(pickLang(undefined, undefined, undefined)).toBe('en')
  })
})

const titles = [...new Set(Array.from({ length: RANK_START - RANK_TOP + 1 }, (_, i) => titleFor(RANK_TOP + i)))]
const lines = [...CHANTS, CROWN_CHANT, CROWN_TOAST, ...SIN_LINES, TIME_LINE, YAJUU_DAY_LINE, ...titles]

describe('meanings', () => {
  test('every meme has a meaning in every language, and no stale ones', async () => {
    const ids = LEXICON.map(entry => entry.id)
    for (const lang of LANGS) {
      for (const id of ids) expect(memeMeaning(lang, id).length).toBeGreaterThan(0)
      for (const id of meaningKeys(lang).memes) expect(ids).toContain(id)
    }
  })
  test('a meaning holds no brackets, since the popup puts it in brackets', async () => {
    for (const lang of LANGS) {
      for (const entry of LEXICON) expect(memeMeaning(lang, entry.id)).not.toMatch(/[()（）]/)
      for (const line of lines) expect(lineMeaning(lang, line)).not.toMatch(/[()（）]/)
    }
  })
  test('every line the mod shouts has a meaning in every language, empty where it reads as it is', async () => {
    for (const lang of LANGS) {
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
    for (const lang of LANGS) {
      expect(memeMeaning(lang, 'mur')).toContain('TDN')
      expect(memeMeaning(lang, 'kmr')).toContain('TDN')
      expect(memeMeaning(lang, 'tdn')).toContain('MUR')
    }
  })
  test('glossed: brackets in Chinese, parentheses in English, the text alone without a meaning', async () => {
    expect(glossed('zh-TW', 'やりますねぇ', '挺行的嘛')).toBe('やりますねぇ（挺行的嘛）')
    expect(glossed('en', 'やりますねぇ', 'not bad at all')).toBe('やりますねぇ (not bad at all)')
    expect(glossed('zh-TW', '👑 INMU KING 降臨 👑', '')).toBe('👑 INMU KING 降臨 👑')
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
})
