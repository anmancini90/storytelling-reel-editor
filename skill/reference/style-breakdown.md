# Breaking down a reference video (Build my style, step 3)

One `breakdown.md` per reference folder, written from what `reference.py` measured and what the contact sheets show.
Step 4 (putting the style together) reads these files, so be specific and use numbers.

## Read, then look

1. `source.md`: the link, the creator's **why** and the aspects to take (**Take only**).
2. `analysis.md`: the measurements and the transcript.
3. `hook.jpg` (the first 3 s, 4 frames a second), then every `shots-NN.jpg` (each cell is labelled with its shot
   number and time).
4. Check the numbers against the sheets. Where they disagree, trust your eyes and say so: a whip pan or a flash can
   count as a cut, a busy background can hide the speaker from the person masks, very stylised or outlined text can
   be missed by the text reader, and text the camera filmed (handwriting on a whiteboard, a sign) can match the speech
   and be counted as captions.

## What to write

Full breakdown unless **Take only** lists aspects: then write only those sections and one line
`Not taken (creator's choice): ...`. Mark every number as **measured** (from analysis.md), **seen** (from the sheets),
**guessed**, or **translated** (from a landscape video, below). You can't hear the audio: music and sound effects come from the levels and from what happens on screen at
those moments, so say what you couldn't tell.

If there is a **why**, quote it, decide which sections it points at, and mark those `(must keep)`. A why like "the
energy" usually means pacing + music + sfx; "it's so clean" usually means captions + text + look. Say how you read it.

```markdown
# Breakdown: <creator> (<link>)

**Creator's why:** "<their words>" → must keep: <sections>   (or: not given, full breakdown)
**Taken:** everything   (or: only captions, pacing)
**In one line:** <the whole style in one plain sentence>

## Hook (must keep)
- What it does: <one or two plain lines>
- Numbers: <values> (measured / seen / guessed)
- Build it here: <the setting or building block below, or "can't build yet">
- Confidence: high / medium / low

## ...one section per aspect, in the order below...

## Can't build yet
- <technique>: <why not, and the closest thing we have>
```

## Long and landscape references (YouTube videos, podcasts)

`analysis.md` says so in its Notes. Only the first 5 minutes were downloaded and measured, and the frame is 1920x1080,
not a reel. The creator still wants a vertical reel, so translate the style and mark those values **translated**:

- **Carries over as is:** look, music, sound effects, speaking pace, and the type style of captions and titles
  (font, weight, colour, case, words at a time, box or shadow, how they appear).
- **Translate:** caption and title *positions and sizes* don't carry over: use the reel's caption position (base y
  1440) and start from the base size, bigger or smaller by eye. Framing: name the shot (close-up, mid shot, wide)
  and the punch-in pattern (size changes on cuts), not the 16:9 percentages. Full-screen B-roll becomes a crop, a card
  or a split (`KAL.layout`). Long-form usually moves slower than a reel: give its cuts per 10 s, then say what the
  tighter reel version is.
- **Hook and story:** a long video's hook is its first 30-60 s (a cold open, the promise, a preview), so read the
  transcript and the first shots, not only `hook.jpg`. Say how that opening shrinks into a reel's first 3 s.
- **Ending:** it isn't in the first 5 minutes. Write "not measured (long video)".

## The aspects

| Aspect (`--only` name) | Look for |
|---|---|
| **Hook** (`hook`) | Frame 0 (text already on screen?), the first spoken words, what changes in the first second, the first cut, a question / bold claim / story opener, kinetic text |
| **Story** (`story`) | The shape from the transcript: hook → setup → turn → payoff → call to action. Length, sentence length, signposts ("here's the thing", numbered points), point of view |
| **Pacing** (`pacing`) | Cuts per 10 s, shot lengths, jump cuts inside one take vs new scenes, dead air removed or kept, words a minute, where it speeds up or slows down |
| **Framing** (`framing`) | How much of the frame the speaker fills, head height, close/wide changes between cuts (punch-ins), splits with the speaker in half the frame, camera moves |
| **Captions** (`captions`) | Font (closest match below), weight, size (font size ≈ the measured line height: 56 px TikTok Sans measures 58), position, colour, outline / shadow / box, words at a time, all caps or sentence case, highlighted words, how they appear (hard cut, pop, word-by-word) across consecutive frames in `hook.jpg` |
| **On-screen text** (`text`) | Headlines, labels, titles: where, how big, how long, how they come in, font, colour, how often |
| **B-roll and screens** (`broll`) | Share of time without the speaker (Framing measures it), what it is (screen recordings, own footage, stock, memes, app UI), full screen or in a card, how long each, which words trigger it |
| **Look** (`look`) | Brightness, saturation, palette, warm/cool, contrast, setting and light, an accent colour for the creator's graphics |
| **Music** (`music`) | Is there a bed, how far under the voice (dB), does it change at the hook or the end, any lyrics in the transcript. Genre only if it's obvious; otherwise "ask the creator" |
| **Sound effects** (`sfx`) | The likely hits against what's on screen at those times (a pop on text, a whoosh on a transition, a hit on the punchline), how often |
| **Ending** (`ending`) | The last 3-5 s: the call to action (comment a word, follow, link in bio, loop back to the start), text on screen, how it ends |

## Build it here (the settings and building blocks we have)

| Technique | Use |
|---|---|
| Caption font, weight, size, spacing, position, colour, words at a time | `style.json` → `captions` (`font_family`, `weight`, `size_px`, `tracking_em`, `center_y`, `color`, `max_words`, `max_chars`) |
| Caption mode, case, italic, outline, shadow, box, pop-in, highlighted keywords / numbers | `captions` → `mode` (chunk, word, bold, small, off), `case`, `italic`, `outline_px`, `shadow`, `box`, `animation`, `keywords`, `numbers_are_keywords`, `keyword_color` |
| The graphics' colours and fonts (accent, dark text, light panels; headline, body, serif, mono) | `style.json` → `palette` (`accent`, `ink`, `paper`, `canvas`), `fonts` (`headline`, `body`, `serif`, `mono`) |
| Fonts available | TikTok Sans, Inter, Hanken Grotesk (bundled); Mac system fonts (SF Pro, Helvetica Neue, Avenir, Futura, Baskerville...). Name the closest one; never download the reference's font |
| One word at a time / big bold word / small word under the chin | `KAL.layout` caption modes `word`, `bold`, `small` (`layouts.js`, `antstyles.js`) |
| Titles, labels, big numbers, text cards, code / terminal lines (font, size, case, colour, outline, box, how they come in) | `TXT.show` with a `style.json` → `text` preset (`template/type.js`) |
| Kinetic hook headline, words popping in | `ANT.hook`, `SIG` kinetic hook |
| One or two big words behind the head | `ANT.impact` + `cutout.py` |
| Notifications, cards, chat bubbles, comment sheet, media grid | `BEAT.notify`, `card`, `bubble`, `comment`, `grid`, `pill` (`reference/components.md`) |
| Split screen, grid canvas, picture-in-picture, smooth push into a split | `KAL.layout` (`news`, `canvas`, `pip`, `full`), `MIN.PUSH` |
| Close/wide framing on cuts (punch-ins) | `KAL.framing` + `scripts/cuts.py` |
| Real screens and proof (screenshots, recordings) | `BEAT.screen` (split / card / full), `MIN.proof`, `KAL.phone`, `KAL.float` |
| Chapter cards, graphs, checklists, doodles, end card | `EDT.chapter`, `EDT.graph`, `EDT.checklist`, `EDT.doodle`, `EDT` end card |
| Label chips, timeline, profile card, follow card | `ANT.chips`, `ANT.timeline`, `ANT.profile`, `MIN` follow card |
| Two-tier punchline, app window, DM mock | `SIG.*` (`signature.js`) |
| Claude chat or dictation on screen | `CLD.chat`, `CLD.dictate` |
| Music level, intro level, sound-effect level | `style.json` → `audio`; sound effects on words with `mix_audio.py --sfx name@T` |
| Pacing of the cut | The story cut (`reference/story-cut.md`): block choices and `story_cut.py --gap` |

Anything else goes under **Can't build yet**, with the closest thing we have (for example karaoke word highlighting,
3D moves, hand-drawn animation).

## Rules

- Borrow the technique, never the media: no footage, audio, images or fonts from the reference go into an edit.
- Describe what the video does, not who made it: the saved style belongs to the creator using this skill.
- Short and concrete beats long and vague: "3 words, white, 60 px, y 1450, hard cut" beats "clean captions".
