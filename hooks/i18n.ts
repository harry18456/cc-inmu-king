// Every sentence the person sees, in English and Traditional Chinese, and the
// meaning shown beside each Japanese line: the memes, the chants, the titles
// and the mod's own lines. The Japanese stays as it is in both languages: it
// is the meme. Ids, verbs and file names stay too. No `$` here.

import type { By } from '../types'

export type Lang = 'en' | 'zh-TW'
export const LANGS: readonly Lang[] = ['en', 'zh-TW']

// A language code or a name, as Claude Code's `language` setting and the OS
// hold it: `zh`, `zh-tw`, `zh_TW.UTF-8`, `Traditional Chinese`, `繁體中文` …
// → zh-TW (the one Chinese here); `en`, `en_US.UTF-8`, `English` → en;
// anything else → null.
export function normalizeLang(raw: unknown): Lang | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  if (v === '') return null
  if (/^zh\b|^zh[-_]|chinese|mandarin|中文|漢語|汉语|繁體|繁体|簡體|简体|國語|国语/.test(v)) return 'zh-TW'
  if (/^en\b|^en[-_]|english|英文|英語|英语/.test(v)) return 'en'
  return null
}

// The language the mod speaks: the setting when it names one, otherwise Claude
// Code's own `language` setting, otherwise the environment's locale, otherwise English.
export function pickLang(setting: unknown, claudeLanguage: unknown, envLocale: unknown): Lang {
  return normalizeLang(setting) ?? normalizeLang(claudeLanguage) ?? normalizeLang(envLocale) ?? 'en'
}

// What each meme means, by its id in lexicon.ts. Short enough for the popup;
// no brackets inside, since the popup puts the meaning in brackets.
const MEME_MEANINGS: Readonly<Record<Lang, Readonly<Record<string, string>>>> = {
  'zh-TW': {
    '114514': '諧音いいよこいよ＝好啊，來吧',
    '1919810': '諧音イクイク野獣＝去了去了・野獸',
    'inmu-king': '淫夢之王，2026 年的歌名',
    tadokoro: '網路上對野獸學長的通稱',
    yajuu: '野獸學長，淫夢的主角',
    '24sai': '自我介紹：24 歲，是學生',
    suki: '告白：我一直喜歡你啊',
    okujou: '我家有屋頂，要不要曬一下？',
    gankou: '經典畫面：野獸的眼神',
    time: '114514 變成時刻',
    iiyo: '好啊！來吧！',
    yarimasu: '挺行的嘛',
    ikisugi: '爽過頭啦',
    nna: '慘叫聲',
    icetea: '下了藥的冰紅茶',
    abarenna: '別亂動',
    miroyo: '看啊看啊',
    nuwaa: '累死了的哀號',
    ichiban: '這句最常被說了啦',
    homobi: 'ホモビデオ的簡稱：同志成人影片',
    bb: 'BB＝ブルーバック：用藍幕素材合成的二創',
    'yajuu-day': '8 月 10 日，8=や、10=じゅう',
    fa: '蛤！？表示驚訝',
    binjo: '對啊，跟風附和',
    inmu: '這整個梗圈，源自 2001 年的影片',
    akushuu: '很有淫夢味',
    hakushin: '超認真，常拿來反諷',
    shimokita: '下北澤，學長家在這裡',
    mur: '片中角色三浦的 TDN 表記',
    kmr: '片中角色木村的 TDN 表記',
    tdn: 'TDN 表記：名字只寫子音，例如 MUR、KMR',
    '1919': '諧音イクイク＝去了去了',
    '810': '諧音野獣：8=や、10=じゅう',
  },
  en: {
    '114514': 'pun on iiyo koiyo: sure, come on',
    '1919810': 'pun on iku iku yajuu',
    'inmu-king': 'King of Inmu, the 2026 song',
    tadokoro: "the internet's name for the Beast Senpai",
    yajuu: 'the Beast Senpai, the star of Inmu',
    '24sai': 'his intro: 24, a student',
    suki: 'the confession: I liked you all along',
    okujou: "there's a rooftop; want to tan?",
    gankou: "a famous frame: the Beast's glare",
    time: '114514 as a time of day',
    iiyo: 'sure! come on!',
    yarimasu: 'not bad at all',
    ikisugi: 'way too much',
    nna: 'a scream',
    icetea: 'the drugged iced tea',
    abarenna: 'stop struggling',
    miroyo: 'look, look',
    nuwaa: 'an exhausted groan',
    ichiban: 'everyone says that one',
    homobi: 'short for homo video: a gay adult video',
    bb: 'BB = blue back: fan edits made from blue-screen footage',
    'yajuu-day': 'August 10: 8 = ya, 10 = juu',
    fa: 'wha!?, in surprise',
    binjo: 'yep, jumping on board',
    inmu: 'the whole meme scene, after a 2001 video',
    akushuu: 'reeks of Inmu',
    hakushin: 'intensely, usually ironic',
    shimokita: "Shimokitazawa, senpai's neighborhood",
    mur: 'Miura, a character in the video, in TDN style',
    kmr: 'Kimura, a character in the video, in TDN style',
    tdn: 'TDN style: a name written as its consonants, like MUR or KMR',
    '1919': 'pun on iku iku',
    '810': 'pun on yajuu: 8 = ya, 10 = juu',
  },
}

// What the mod's own Japanese lines mean, keyed by the line as game.ts writes
// it. An empty meaning: the line reads as it is in that language.
const LINE_MEANINGS: Readonly<Record<Lang, Readonly<Record<string, string>>>> = {
  'zh-TW': {
    // chants
    'いいよ！こいよ！': '好啊！來吧！',
    'やりますねぇ！': '挺行的嘛！',
    'ンアッー！': '慘叫',
    'イキスギィ！': '爽過頭啦！',
    'ファッ!?': '蛤！？',
    '淫夢ゲージ全開！': '淫夢量表全滿！',
    // the coronation
    '👑 INMU KING 降臨 👑': '',
    '新たな淫夢の王が誕生した': '新的淫夢之王誕生了',
    // sins
    '罪がまた一つ増えた': '又多了一條罪',
    '先輩は全部見ている': '學長全都看在眼裡',
    'その罪、背負っていけ': '背著這條罪走下去吧',
    // titles
    '下北沢の新入り': '下北澤新人',
    '24歳、学生': '24 歲學生',
    '水泳部の先輩': '游泳社學長',
    '野獣': '野獸',
    '野獣先輩': '野獸學長',
    '淫夢の王 INMU KING': '淫夢之王',
    // the clock
    '11:45:14 淫夢時間': '',
    '8月10日 野獣の日：今日は最初から王': '野獸之日：今天一開始就是王',
  },
  en: {
    'いいよ！こいよ！': 'Sure! Come on!',
    'やりますねぇ！': 'Not bad!',
    'ンアッー！': 'a scream',
    'イキスギィ！': 'Way too much!',
    'ファッ!?': 'Wha!?',
    '淫夢ゲージ全開！': 'Inmu gauge maxed!',
    '👑 INMU KING 降臨 👑': 'the INMU KING descends',
    '新たな淫夢の王が誕生した': 'a new King of Inmu is born',
    '罪がまた一つ増えた': 'one more sin',
    '先輩は全部見ている': 'Senpai sees everything',
    'その罪、背負っていけ': 'carry that sin with you',
    '下北沢の新入り': 'Shimokitazawa rookie',
    '24歳、学生': '24, a student',
    '水泳部の先輩': 'swim club senpai',
    '野獣': 'the Beast',
    '野獣先輩': 'Beast Senpai',
    '淫夢の王 INMU KING': 'King of Inmu',
    '11:45:14 淫夢時間': "Inmu o'clock",
    '8月10日 野獣の日：今日は最初から王': 'Yajuu Day: king from the start today',
  },
}

export const memeMeaning = (lang: Lang, id: string): string => MEME_MEANINGS[lang][id] ?? ''
export const lineMeaning = (lang: Lang, line: string): string => LINE_MEANINGS[lang][line] ?? ''

// The tables, for the test that every line has a meaning in every language.
export const meaningKeys = (lang: Lang) => ({ memes: Object.keys(MEME_MEANINGS[lang]), lines: Object.keys(LINE_MEANINGS[lang]) })

// "やりますねぇ（挺行的嘛）" in Chinese, "やりますねぇ (not bad at all)" in English;
// the text alone when there is no meaning.
export function glossed(lang: Lang, text: string, meaning: string): string {
  if (meaning === '') return text
  return lang === 'zh-TW' ? `${text}（${meaning}）` : `${text} (${meaning})`
}

export const VERBS = 'status|burst|king|sounds|mute|unmute|reset [all]|band on|off|homo <n>'

export type Strings = {
  // the command's menu entry
  commandDescription: string
  // how a list, a list of groups and an alias read
  list: (items: readonly string[]) => string
  groups: (items: readonly string[]) => string
  alias: (id: string, label: string) => string
  // the status line and /inmu
  status: (rank: number, title: string, letters: string) => string
  standing: (rank: number, title: string, letters: string, energy: number) => string
  tallies: (crowned: number, total: number, sins: number, found: number, all: number, sound: string) => string
  sound: (muted: boolean, on: boolean) => string
  recent: (items: readonly string[]) => string
  noMemesYet: string
  panelOpened: string
  // command replies
  demoBurst: string
  demoCrown: string
  muted: string
  unmuted: string
  reset: string
  resetAll: string
  resetFailed: string
  bandUsage: string
  bandShown: string
  bandHidden: string
  homoUsage: string
  unknownVerb: (verb: string) => string
  // /inmu sounds
  soundFolder: (path: string) => string
  noHome: string
  folderMissing: string
  noClips: string
  placed: (list: string) => string
  unplaced: (list: string) => string
  events: string
  memes: (list: string) => string
  howToName: string
  // the panel
  paneTallies: (crowned: number, total: number, sins: number, muted: boolean) => string
  collection: (found: number, all: number) => string
  tier: (points: number, items: string) => string
  who: (by: By) => string
  muteButton: (muted: boolean) => string
  resetButton: string
  closeButton: string
  // the band and the toasts
  bandButton: string
  sinToast: (line: string, sins: number) => string
  // a save the store has not taken yet: the band's mark, and the toast
  unsaved: string
  saveFailed: string
  // the line that closes a turn, its numbers written as 114514 arithmetic
  turnLine: (word: string, seconds: string, tokens: string | null) => string
}

const en: Strings = {
  commandDescription: 'INMU KING: standing, demo burst and coronation, sounds, mute, reset',
  list: items => items.join(', '),
  groups: items => items.join('; '),
  alias: (id, label) => `${id} = ${label}`,
  status: (rank, title, letters) => `Inmu #${rank} ${title} · ${letters}`,
  standing: (rank, title, letters, energy) => `Inmu #${rank} ${title} · ${letters} (${energy}/8)`,
  tallies: (crowned, total, sins, found, all, sound) =>
    `Crowned ${crowned}× · ${total} points · sins ${sins} · collection ${found}/${all} · sound ${sound}`,
  sound: (muted, on) => (muted ? 'muted' : on ? 'on' : 'off'),
  recent: items => `Recent: ${items.join(', ')}`,
  noMemesYet: 'No memes yet. Try 114514.',
  panelOpened: 'Panel open: digits press the buttons, Esc closes it.',
  demoBurst: 'A demo burst: no points, no rank change.',
  demoCrown: 'A demo coronation: no rank change, and the next reply stays as it is.',
  muted: 'Muted.',
  unmuted: 'Sound on.',
  reset: 'Reset, in every session: #20, letters dark, tallies cleared. The collection stays; /inmu reset all clears it too.',
  resetAll: 'Reset everything, in every session: #20, letters dark, tallies and the collection cleared.',
  resetFailed: 'The plugin store did not take the reset, so nothing changed. Try again.',
  bandUsage: 'Usage: /inmu band on|off',
  bandShown: 'Band shown.',
  bandHidden: 'Band hidden (/inmu band on brings it back).',
  homoUsage: 'Usage: /inmu homo <integer>',
  unknownVerb: verb => `Unknown "${verb}". Try: ${VERBS}`,
  soundFolder: path => `Sound folder: ${path}`,
  noHome: 'no home folder found; set Your sound folder in /config',
  folderMissing: 'The folder does not exist yet. Create it, put clips in, then run /inmu sounds.',
  noClips: 'No clip in the folder has a name it knows yet.',
  placed: list => `Placed: ${list}`,
  unplaced: list => `Names it does not know: ${list}`,
  events: 'Events: hit, burst, crown, sin',
  memes: list => `Memes: ${list}`,
  howToName: 'Name a clip for an event, a meme id or the meme text. Add -2, -3 for variants that take turns. Formats: wav, mp3, m4a, wma, aac.',
  paneTallies: (crowned, total, sins, muted) => `Crowned ${crowned}× · ${total} points · sins ${sins}${muted ? ' · muted' : ''}`,
  collection: (found, all) => `Collection ${found}/${all}`,
  tier: (points, items) => `${points} pt ${items}`,
  who: by => (by === 'you' ? 'you' : by === 'claude' ? 'Claude' : 'clock'),
  muteButton: muted => (muted ? 'Unmute' : 'Mute'),
  resetButton: 'Reset',
  closeButton: 'Close',
  bandButton: 'panel',
  sinToast: (line, sins) => `${line} · sin ${sins}`,
  unsaved: 'unsaved',
  saveFailed: 'Could not save to the plugin store. Trying again every 15 s; the band says unsaved until a save lands.',
  turnLine: (word, seconds, tokens) => `${word} for ${seconds} s${tokens === null ? '' : ` · ${tokens} tokens out`}`,
}

const zhTW: Strings = {
  commandDescription: '淫夢の王：排行、示範爆發與加冕、音檔、靜音、歸零',
  list: items => items.join('、'),
  groups: items => items.join('；'),
  alias: (id, label) => `${id}＝${label}`,
  status: (rank, title, letters) => `淫夢 #${rank} ${title} · ${letters}`,
  standing: (rank, title, letters, energy) => `淫夢 #${rank} ${title} · ${letters} (${energy}/8)`,
  tallies: (crowned, total, sins, found, all, sound) =>
    `加冕 ${crowned} 次 · 累計 ${total} 分 · 罪 ${sins} · 梗圖鑑 ${found}/${all} · 聲音 ${sound}`,
  sound: (muted, on) => (muted ? '靜音' : on ? '開' : '關'),
  recent: items => `最近：${items.join('、')}`,
  noMemesYet: '還沒有梗。打 114514 試試。',
  panelOpened: '面板已開：數字鍵按按鈕，Esc 關閉。',
  demoBurst: '示範爆發：不加分、不改排名。',
  demoCrown: '示範加冕：不改排名，下一則回覆也照常。',
  muted: '靜音。',
  unmuted: '聲音開。',
  reset: '歸零，每個 session 都一起：#20、字母全暗、累計清空。梗圖鑑保留；/inmu reset all 連圖鑑一起清。',
  resetAll: '全部歸零，每個 session 都一起：#20、字母全暗、累計與梗圖鑑清空。',
  resetFailed: '歸零沒寫進存檔，所以什麼都沒改。請再試一次。',
  bandUsage: '用法：/inmu band on|off',
  bandShown: 'band 顯示。',
  bandHidden: 'band 隱藏（/inmu band on 恢復）。',
  homoUsage: '用法：/inmu homo <整數>',
  unknownVerb: verb => `不認識「${verb}」。可用：${VERBS}`,
  soundFolder: path => `音檔資料夾：${path}`,
  noHome: '找不到家目錄，請在 /config 設定 Your sound folder',
  folderMissing: '這個資料夾還不存在。建立它、放進音檔，再打 /inmu sounds。',
  noClips: '資料夾裡還沒有認得的音檔。',
  placed: list => `認得的：${list}`,
  unplaced: list => `認不得的檔名：${list}`,
  events: '事件：hit 得分、burst 爆發、crown 加冕、sin 罪',
  memes: list => `梗：${list}`,
  howToName: '檔名用事件名、梗的 id 或梗的文字都可以。同名加 -2、-3 可以放多個，輪流播。格式：wav、mp3、m4a、wma、aac。',
  paneTallies: (crowned, total, sins, muted) => `加冕 ${crowned} 次 · 累計 ${total} 分 · 罪 ${sins}${muted ? ' · 靜音' : ''}`,
  collection: (found, all) => `梗圖鑑 ${found}/${all}`,
  tier: (points, items) => `${points}分 ${items}`,
  who: by => (by === 'you' ? '你' : by === 'claude' ? 'Claude' : '時鐘'),
  muteButton: muted => (muted ? '開聲音' : '靜音'),
  resetButton: '歸零',
  closeButton: '關閉',
  bandButton: '面板',
  sinToast: (line, sins) => `${line} · 罪 ${sins}`,
  unsaved: '未存',
  saveFailed: '存檔寫不進去，每 15 秒重試一次；寫進去之前，band 會顯示「未存」。',
  turnLine: (word, seconds, tokens) => `${word} ${seconds} 秒${tokens === null ? '' : ` · 輸出 ${tokens} tokens`}`,
}

export const STRINGS: Readonly<Record<Lang, Strings>> = { en, 'zh-TW': zhTW }
