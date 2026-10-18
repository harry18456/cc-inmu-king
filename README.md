English | [繁體中文](README.zh-TW.md)

# inmu-king

A joke mod for Claude Code. Every 淫夢 (Inmu) meme you type, or Claude types back, lights letters of **T A D O K O R O** in the band above the prompt, each lit letter its own rainbow color, with a "+3 田所浩二 (the internet's name for the Beast Senpai)" beside them for two seconds. The memes stay Japanese and their meanings come along in English or 繁體中文, so you can play without knowing the memes. Eight letters is a *burst*: a classic catchphrase, a moving pixel picture, an 8-bit jingle, and one rank up a chart that starts at #20. Reaching #1 is the *coronation*: a pixel crowd dances, a fanfare plays, and Claude's next reply ends with やりますねぇ！. Every meme you find goes into a collection (梗圖鑑), and the line that closes a turn has its seconds rewritten as arithmetic made of 114514.

Inspired by *INMU KING*, an AI-generated song released on August 10, 2026, and twenty years of Inmu culture. The mod borrows the song's title only: its chants and titles are catchphrases that predate the song, or lines of the mod's own. The pictures and the sounds are original.

## What it looks like

```
T A D O K O R O  #17 下北沢の新入り Shimokitazawa rookie  i: panel    ← the band, most of the time
T A D O K O R O  +3 田所浩二 (the internet's name for the Beast…) NEW!  ← a hit, two seconds
T A D O K O R O  +8 114514 (pun on iiyo koiyo: sure, come on) NEW!     ← a burst, three seconds:
いいよ！こいよ！ Sure! Come on!                                           the hit, the chant and
(a pixel picture, three in turn: a crowned beast whose eyes flash,        a picture
 a glass of iced tea that drains, 114514 in rainbow digits)
👑 INMU KING 降臨 👑 the INMU KING descends                              ← the coronation, six seconds
(three crowned pixel dancers, arms up and down)
```

Lit letters wear a rainbow, dark ones are gray, and the letters a hit just lit are drawn inverse for two seconds. A burst lights all eight for its show; when the show ends the letters come back as the bar stands, the points past eight already lit. With the band off, the status line under the prompt keeps the standing instead: `Inmu #17 下北沢の新入り (Shimokitazawa rookie) · T A D O K o r o`, upper case lit and lower case dark.

## Scoring

| You type | Letters |
|---|---|
| `114514`, `1919810` | 8, a burst at once |
| `INMU KING`, `淫夢の王` | 5 |
| `田所浩二`, `野獣先輩`, `24歳、学生です`, `屋上あんだけど`, `野獣の眼光`, `11:45:14` | 3 |
| `いいよ！こいよ！`, `やりますねぇ`, `イキスギ`, `ンアッー`, `昏睡紅茶`, `暴れんなよ`, `見ろよ見ろよ`, `ぬわああああん`, `それ一番言われてるから`, `ホモビ`, `BB先輩`, `野獣の日` | 2 |
| `淫夢`, `惡臭`, `迫真`, `下北沢`, `1919`, `810`, `MUR`, `KMR`, `TDN` | 1 |

- Numbers and Latin words count as whole tokens only, with no letter, digit or underscore right beside them: `port 8100` is not 810, `build114514x` is not 114514, `INMU KINGDOM` is not INMU KING. Laughter right after a number, a run of lowercase w, still counts: `114514www`. Right beside Chinese or Japanese they count: `MUR大先輩`, `tadokoroさん`.
- A number after a `$`, inside a decimal or in a `file:line` reference does not count: `$1,810`, `1.1919`, `foo.ts:810`. `1145141919810` is both jackpots at once.
- Full-width digits and half-width kana count the same: `１１４５１４`, `ｲｷｽｷﾞ`. A meme in parts may have spaces or punctuation between the parts: `いいよ、来いよ`, `いいよ・こいよ`, `見ろよ 見ろよ`. Everyday Japanese does not count: `サインアップ`, `ファッション`, a plain やりますね without the ぇ.
- Each meme counts once per text; one text lights at most two bars, 16 points.
- Claude's own replies count at half points, rounded up; an interrupted reply and a subagent's do not. A setting turns that off.
- A tool call that errors or is refused is a *sin*: the first one and every fifth toast a line and play a sigh.
- Every session plays a game of its own. It starts at #20 (crowned on August 10), its points, coronations and collection last as long as the session (a hot reload or a settings change keeps them), and the next session starts over.

## The title ladder

| Rank | Title |
|---|---|
| 20–16 | 下北沢の新入り |
| 15–11 | 24歳、学生 |
| 10–6 | 水泳部の先輩 |
| 5–3 | 野獣 |
| 2 | 野獣先輩 |
| 1 | 淫夢の王 INMU KING |

From #10 the spinner's word becomes ンアッー, やりますねぇ and friends; at #1 it is INMU KING 👑. A turn past two minutes spins as アイスティー準備中.

## The collection

A meme goes into the collection the first time it is typed, and its popup says `NEW!`. The panel lists all 33 in five rows by points, each found one with its meaning, the ones not found yet as `???`. The collection lasts as long as the session; `/inmu reset` keeps it and `/inmu reset all` clears it.

## Language

*Language* in `/config` picks the language of the band, the panel, `/inmu`'s replies and the meanings beside the memes:

- `auto` (the default) follows Claude Code's own language setting (`zh-tw`, `Traditional Chinese`, `繁體中文` and the like all read), then the system locale, else English.
- `zh-TW`: Traditional Chinese, as in やりますねぇ（挺行的嘛）.
- `en`: English, as in やりますねぇ (not bad at all).

The memes themselves always stay Japanese.

## Sound

Four original 8-bit jingles ship in `sounds/`: a hit, a burst, the coronation, a sin. `tools/make_sounds.py` makes them with Python's standard library alone.

**Your own clips** replace them from this folder:

```
Windows: C:\Users\<you>\.claude\inmu-king\sounds\
macOS:   ~/.claude/inmu-king/sounds/
```

or the folder *Your sound folder* names in `/config`.

| File name | Plays on |
|---|---|
| `hit`, `burst`, `crown`, `sin` | a hit, a burst, the coronation, a sin |
| a meme's id: `iiyo`, `yarimasu`, `114514` | that meme |
| a meme's text: `やりますねぇ`, `いいよこいよ`, `田所浩二` | the same; punctuation and spaces may be left out |

- Formats: wav, mp3, m4a, wma, aac.
- A `-2`, `-3` suffix adds variants that take turns: `burst.wav`, `burst-2.mp3`.
- On a hit a meme's own clip plays in place of the hit sound; on a burst or the coronation it plays first, then the event's sound.
- `/inmu sounds` scans the folder again and lists what it placed, what it could not, and every name it takes.
- The folder lives outside the repository, so your clips are never committed.

## Clock memes

- **11:45:14** every day: three points and a 淫夢時間 toast, once a day in each session that is open then.
- **August 10**, 野獣の日: every session that day starts crowned.

## Commands

```
/inmu              standing, letters, tallies, collection; opens the panel
/inmu burst        a demo burst: the show and the sound, no points, no rank
/inmu king         a demo coronation: the show and the sound, no rank, no infection
/inmu sounds       scan your sound folder again and list it
/inmu mute|unmute  silence this session / sound back on
/inmu reset        back to #20, letters dark, tallies cleared; the collection stays
/inmu reset all    the collection too
/inmu band on|off  show / hide the band (hidden, the standing goes to the status line)
/inmu homo 1919    write a number as 114514 arithmetic
```

The panel opens with `/inmu`, or with the band's `i: panel` button: click it in fullscreen, or press `ctrl+x` then `tab` to give the band the keys, then `i`. Typing `i` in the prompt does not press it. The panel has three buttons: mute (1), reset (2), close (0). A reset keeps the mute. Esc closes it.

## Settings (`/config`)

| Setting | Default | What it does |
|---|---|---|
| Sound effects | on | Every sound. Windows plays through PowerShell, macOS through Claude Code; other platforms stay silent. |
| Your sound folder | empty | Where your clips live; empty is `~/.claude/inmu-king/sounds`. |
| Infect Claude at #1 | on | The reply after a coronation ends with やりますねぇ！: one extra system-prompt section for that turn, which rebuilds the prompt cache once. Never in `-p` or SDK sessions. The section asks Claude to skip the line when you asked for an exact output such as JSON only; that is a request to the model, not a guarantee. |
| Claude's replies count too | on | Memes in Claude's reply light letters at half points. |
| Show the band | on | Off draws no band, and the standing goes to the status line under the prompt; everything else goes on. |
| Language | auto | See *Language* above. |

## Install

```
/plugin marketplace add harry18456/cc
/plugin install inmu-king@harry18456
```

Or load it from a folder:

```
claude --plugin-dir <path to this repo>
```

## Development

```
claude plugin test .           # 111 tests, no network
claude plugin validate .
```

`tsc` needs the types Claude Code writes into `.claude-plugin/types/` when it loads the mod (git ignores them): run `claude --plugin-dir .` once and exit, then `npx -p typescript tsc --noEmit -p .`.

A session that loads the mod twice runs two copies, each with a game of its own, and two bands. That happens when a hot reload adds the mod to a session that loaded it at its start: restart the session instead.

## What it does and does not do

- It matches strings in the prompts you submit and in Claude's replies. It never rewrites a prompt, calls the network or calls a model.
- The one thing that reaches the model is the coronation section, and it can be turned off.
- It saves nothing: the game lives in the session, and Claude Code's plugin store is never read or written. A save an earlier version left there (`~/.claude/plugins/store/inmu-king*.json`) stays as it is, unread; delete it if you like.
- A band another mod draws stays under this one. While Claude Code shows its own feedback survey, the band steps aside.
- On Windows a clip starts about a second after its event, played by PowerShell in the background, never holding a turn.
- The pixel pictures draw in the terminal; Desktop shows the text alone.

## Content

The chants and titles are short public catchphrases or lines of the mod's own; the song lends its title only. The pictures and the sounds are original. The person behind the meme is real, so the mod draws no face of his and ships no audio from the source video; `TDN` counts as the naming style, and the real surname behind it is not matched. The clips you add are your own responsibility.

## Credits

- The title *INMU KING*: やじゅまんぼう (YAJU-MC).
- The 114514 arithmetic follows the idea of [itorr/homo](https://github.com/itorr/homo) (恶臭数字论证器, MIT). The table here is generated, not copied.

MIT License.
