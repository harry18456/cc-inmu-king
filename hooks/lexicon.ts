// The meme dictionary: what counts, how many letters it lights, and how the
// log and the collection name it. Every entry is a short catchphrase, a name
// or a number from the meme culture that predates the song INMU KING; the
// song contributes its title alone.
//
// The text is NFKC-normalized first, so full-width １１４５１４ and half-width
// ｲｷｽｷﾞ count. Latin words and numbers are whole tokens: no ASCII letter,
// digit or underscore beside them, so INMU KINGDOM, tadokoroFactory,
// build114514x or a port 8100 light nothing, while MUR大先輩 does; laughter
// right after a number (114514www) still counts. A price $1,810 or a
// reference foo.ts:810 lights nothing either. Japanese and Chinese phrases are
// matched as substrings, never inside an everyday word (サインアップ,
// ファッション, a plain やりますね); a phrase in parts may have punctuation or
// spaces between the parts (いいよ、来いよ, 見ろよ 見ろよ).

export type Entry = { id: string; label: string; points: number; re: RegExp }
export type Hit = { id: string; label: string; points: number }

// Eight points light every letter at once.
export const JACKPOT = 8
// One text (a prompt, a reply) lights at most two bars' worth.
export const MAX_POINTS_PER_TEXT = 16

// What makes a token longer: an ASCII letter, a digit, an underscore (after
// NFKC a full-width one is ASCII too).
const WORD = 'A-Za-z0-9_'
// A Latin word alone, as a token: no word character on either side. Chinese
// or Japanese right beside it is fine: MUR大先輩, tadokoroさん, 我在聽INMU KING.
const LATIN = (pattern: string) => `(?<![${WORD}])(?:${pattern})(?![${WORD}])`
const word = (pattern: string) => new RegExp(LATIN(pattern), 'iu')
// A number alone, the same way, and not part of a decimal, a price or a
// file:line reference (foo.ts:810, $1,810, 1.1919, 810:12). A hashtag counts,
// and so does laughter right after it: a run of w that ends the token (114514www).
const num = (pattern: string) =>
  new RegExp(`(?<![${WORD}]|\\d[.,]|[${WORD}\\])]:|\\$)(?:${pattern})(?![.,:]\\d)(?=w*(?![${WORD}]))`, 'u')
const text = (pattern: string) => new RegExp(pattern, 'u')
// A katakana letter (not the long-vowel mark): what makes サインアップ a word of its own.
const KANA = '[ァ-ヺ]'
// Japanese phrases and their Latin spelling, the Latin as a whole token.
const both = (japanese: string, latin: string) => new RegExp(`${japanese}|${LATIN(latin)}`, 'iu')
// What people put between the parts of a phrase (いいよ and こいよ): nothing,
// a space, a comma, a dot, a bang.
const GAP = '[\\s!?、,。.・…~〜ー]*'

export const LEXICON: readonly Entry[] = [
  // jackpots; 1145141919810 is both at once
  { id: '114514', label: '114514', points: JACKPOT, re: num('114514(?:1919810)?') },
  { id: '1919810', label: '1919810', points: JACKPOT, re: num('(?:114514)?1919810') },
  // the title
  { id: 'inmu-king', label: 'INMU KING', points: 5, re: both('淫夢の王|淫夢之王|淫梦之王|淫夢王|淫梦王', 'INMU\\s*KING') },
  // names and famous lines
  { id: 'tadokoro', label: '田所浩二', points: 3, re: both('田所浩二|田所', 'tadokoro') },
  { id: 'yajuu', label: '野獣先輩', points: 3, re: both('野獣先輩|野獸先輩|野兽先辈', 'yaju+\\s*senpai|yajusenpai|yajuu?') },
  { id: '24sai', label: '24歳、学生です', points: 3, re: text(`24\\s*歳${GAP}学生|24\\s*歲${GAP}學生|24\\s*岁${GAP}学生`) },
  { id: 'suki', label: 'お前のことが好きだったんだよ', points: 3, re: text(`お前のことが${GAP}好きだったんだよ`) },
  { id: 'okujou', label: '屋上あんだけど', points: 3, re: text(`まずうちさぁ|屋上${GAP}あんだけど|焼いてかない`) },
  { id: 'gankou', label: '野獣の眼光', points: 3, re: text('野獣の眼光|野獸的眼光|野兽的眼光') },
  { id: 'time', label: '11:45:14', points: 3, re: text('(?<!\\d)11:45:14(?!\\d)') },
  // the classics
  { id: 'iiyo', label: 'いいよ！こいよ！', points: 2, re: both(`いいよ${GAP}(?:こいよ|来いよ)`, `iiyo${GAP}koiyo`) },
  // The ぇ makes it the meme: a plain やりますね is "I'll do it".
  { id: 'yarimasu', label: 'やりますねぇ', points: 2, re: both('やりますねぇ|やりますねえ', 'yarimasu\\s*ne+e?') },
  { id: 'ikisugi', label: 'イキスギ', points: 2, re: both('イキスギ|イキすぎ', 'ikisugi') },
  { id: 'nna', label: 'ンアッー！', points: 2, re: text(`(?<!${KANA})ンアッ`) },
  { id: 'icetea', label: '昏睡紅茶', points: 2, re: text('昏睡紅茶|昏睡红茶|アイスティー') },
  { id: 'abarenna', label: '暴れんなよ', points: 2, re: text('暴れんな') },
  { id: 'miroyo', label: '見ろよ見ろよ', points: 2, re: text(`見ろよ${GAP}見ろよ`) },
  { id: 'nuwaa', label: 'ぬわああああん', points: 2, re: text('ぬわあ+ん|疲れたもお+ん') },
  { id: 'ichiban', label: 'それ一番言われてるから', points: 2, re: text(`それ${GAP}一番言われてるから`) },
  { id: 'homobi', label: 'ホモビ', points: 2, re: text('ホモビ') },
  { id: 'bb', label: 'BB先輩', points: 2, re: text('BB先輩|BB先辈|BB劇場|BB剧场') },
  { id: 'yajuu-day', label: '野獣の日', points: 2, re: text('野獣の日|野獸之日|野兽之日|8月10日') },
  // small change
  { id: 'fa', label: 'ファッ!?', points: 1, re: text(`ファッ(?!${KANA}|ー)`) },
  { id: 'binjo', label: 'そうだよ（便乗）', points: 1, re: text('便乗|便乘') },
  // Not where the title already counts: 淫夢の王 and INMU KING score once, as the title.
  { id: 'inmu', label: '淫夢', points: 1, re: both('淫夢(?!の王|之王|王)|淫梦(?!之王|王)', `inmu(?!\\s*king(?![${WORD}]))`) },
  { id: 'akushuu', label: '惡臭', points: 1, re: text('惡臭|恶臭|悪臭') },
  { id: 'hakushin', label: '迫真', points: 1, re: text('迫真') },
  { id: 'shimokita', label: '下北沢', points: 1, re: text('下北沢|下北澤|下北泽') },
  // The cast by their consonant names, one entry each. The naming style is
  // the meme; the real surname behind TDN is not matched.
  { id: 'mur', label: 'MUR', points: 1, re: word('MUR') },
  { id: 'kmr', label: 'KMR', points: 1, re: word('KMR') },
  { id: 'tdn', label: 'TDN', points: 1, re: word('TDN') },
  { id: '1919', label: '1919', points: 1, re: num('1919') },
  { id: '810', label: '810', points: 1, re: num('810') },
]

export const KNOWN_IDS: ReadonlySet<string> = new Set(LEXICON.map(entry => entry.id))

export type Detection = { hits: Hit[]; points: number }

// Every entry counts once per text, however often it appears; `factor`
// scales the points (Claude's own replies count at half), rounded up.
export function detect(input: string, factor = 1): Detection {
  if (typeof input !== 'string' || input === '') return { hits: [], points: 0 }
  const normalized = input.normalize('NFKC')
  const hits: Hit[] = []
  for (const entry of LEXICON) {
    if (!entry.re.test(normalized)) continue
    const points = Math.max(1, Math.ceil(entry.points * factor))
    hits.push({ id: entry.id, label: entry.label, points })
  }
  const raw = hits.reduce((sum, hit) => sum + hit.points, 0)
  return { hits, points: Math.min(MAX_POINTS_PER_TEXT, raw) }
}
