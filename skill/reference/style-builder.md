# Putting the style together (Build my style, steps 4-5)

Turns the breakdowns into one saved style in `<workspace>/01_Styles/my-style/`: `style.md` (what to do, in plain words)
and `style.json` (the settings). Every edit after that starts from it. Tool: `$PY $SKILL/scripts/my_style.py`.

## 1. Gather

- `my_style.py status`: the reference videos, which have a breakdown, each one's why and "only".
- `my_style.py compare`: their measured numbers side by side.
- Read every `breakdown.md`. Use only videos with a breakdown, and at most 5.

## 2. Decide each aspect

For each aspect (`hook story pacing framing captions text broll look music sfx ending`), list what each video does
(only the videos that took that aspect). Then:

| Situation | Do |
|---|---|
| A why marks it **must keep** | Take it from that video. Two must-keeps that clash: a choice (below). |
| One video has it, or they all agree | Take it (agreeing numbers: use the middle value). |
| They disagree and no why settles it | A choice for the creator. Never pick silently. |
| Nobody has it (no captions, a long video's ending) | Use the base look and say so. Captions stay on: most people watch muted. |
| Can't be measured (sound effects under talking; music under nonstop talking) | Ask (below). |

## 3. Ask with pictures, not paragraphs

Most creators decide by looking. For **captions**, **on-screen text / headlines** and **look / colours**, show the
choices on a frame of the creator's own clip:

1. Get a clip of them talking: a raw file in `00_Inbox` or any short clip they send (10-30 s is plenty). Never a
   reference video: those are for study only.
2. Write `my-style/options.json`: one group per open choice, one option per video (letters A, B, C...). Each option is
   a small `style.json` change (`captions`, `palette`, `fonts`, `text` presets) and, for on-screen text or cards, a
   line of page code with the building block that makes it (`beats`, usually `TXT.show` with that preset). Label each option in plain words plus where it's from
   ("One white word at a time (video 1)"). Format: the top of `scripts/my_style.py`.
3. `my_style.py pick <group> --clip <clip> --at <a second where they're talking>` → `my-style/pick-<group>.jpg`. Look
   at it first: the text off the face, readable, nothing in the red zones of a real edit. A `FONT MISSING` line means
   that panel fell back to another font: pick the closest Mac font and render again.
4. Send the sheet(s) and ask one short question each: "Captions: A, B or C? (or mix them, e.g. B's font in A's
   colour)". Mixing is fine: build the mix, render it once more if it's new.

Ask the rest in one message, one line each with 2-4 plain options, the reference's choice first:
- **Pacing:** e.g. "fast: a cut every 2-3 s, no pauses (video 2)" or "calm: long takes (video 4)". Story cut gap:
  fast 0.25-0.30, normal 0.35, calm 0.5 (`story_cut.py --gap`).
- **Music:** level from the breakdowns (dB under the voice → `audio.music_gain`, see below); genre is theirs to say.
- **Sound effects:** always ask: "Sound effects: which moves get a sound (whooshes on moves, pops on text, a hit on the
  punchline, typing, phone sounds), and how strong: subtle, balanced or punchy?" → `audio.sfx_roles` (the roles that
  are on) and `audio.sfx_intensity`.
- **Hook / story / ending:** only when two videos do it differently and both fit a reel.

Music level: the base bed is faint (`music_gain` 0.1); how far under the voice that lands depends on the song. Each
6 dB louder doubles `music_gain` (0.1 → 0.2 → 0.4). To match a reference's "N dB under the voice", mix the test edit,
measure it with `reference.py add <the mp4>` (its analysis reports the bed's dB under the voice), adjust, and delete
that measurement folder afterwards.

## 4. Write the style

**`my-style/style.json`**: only what differs from the base (`$SKILL/style.json` documents every key):

```json
{
  "captions": { "font_family": "Futura", "weight": 700, "size_px": 64, "center_y": 1400, "mode": "word",
                "case": "upper", "shadow": "soft", "keywords": [], "numbers_are_keywords": true, "keyword_color": "accent" },
  "palette":  { "accent": "#d9fd0d", "ink": "#111111", "paper": "#ffffff" },
  "fonts":    { "headline": "Futura", "serif": "Baskerville" },
  "audio":    { "music_gain": 0.2 }
}
```

- Caption size ≈ the measured line height (`line_height_px`); vertical references: their `centre_y`; landscape ones:
  the base y 1440 unless the creator picked something else.
- `palette.accent`: the reference's own accent (a coloured word, a highlight, a bar), measured in `analysis.md`
  (other text colours) or seen on the sheets. Give `accent` alone and the lighter and darker shades are worked out.
  `ink` = dark text, `paper` = light panels.
- Fonts: the closest bundled or Mac font (never download the reference's font).

**`my-style/style.md`**, short and concrete. The edit steps read it before the beat plan:

```markdown
# My style

**In one line:** <the whole style in one sentence>
**Built from:** 1. <creator> (<link>): <what was taken> · 2. ... (folders in 01_Styles/references/)

## Hook
- Do: <one or two plain lines>
- Build: <building block / setting>, <numbers>
- From: video 2 (why: "...") / the creator's pick (A) / base look
## Story · Pacing · Framing · Captions · On-screen text · B-roll and screens · Look · Music · Sound effects · Ending
(the same three lines each)

## Can't build yet
- <technique>: what we use instead
```

Then `my_style.py check`: it must print `STYLE OK` (colours, sizes, the safe area, fonts on this Mac).

## 5. Test stills, then lock

1. A test edit of the creator's clip in `my-style/test/`:
   `$PY $SKILL/scripts/new_project.py <clip> <workspace>/01_Styles/my-style/test` (it prints `Style: my style...`),
   then transcribe, captions, `heads.py`, and a `beats.js` that shows the style: the hook as the style opens, one
   on-screen-text moment, one card or B-roll moment, captions throughout. `cutout.py --auto` if the style puts words
   behind the head.
2. `render.mjs <test> stills <3-4 times>` and `safezone.mjs <test>` (must say `SAFE AREA OK`). Send `out/stills/sheet.jpg`.
3. Ask: "Is this your style? Lock it, or tell me what to change." Change one thing at a time and show it again.
4. On a yes: `my_style.py lock`. Tell them in one line: every new edit starts from this; say "change my style" any time.

## 6. Your sound kit

Real recorded sounds, picked by ear once and used in every edit. Mixkit (free) first; the skill never ships or
bulk-downloads their files, and each download is licensed to the creator.
1. `$PY $SKILL/scripts/sound_kit.py search` (only the roles the style turns on: `--roles a,b`): about 3 Mixkit
   candidates per role, measured from their waveform data (nothing downloaded yet).
2. `$PY $SKILL/scripts/sound_kit.py fetch` prints every file with its size and Mixkit as the source. Show it and ask:
   "OK to download these N free sounds from Mixkit (X MB)?" Only on a yes: `fetch --yes` (full-quality WAVs into
   `03_Library/sfx/mixkit/`, the originals, never changed).
3. Render the test edit fully (`render.mjs <test> all`, then `render.mjs <test> cues`), then
   `$PY $SKILL/scripts/sound_kit.py sheet <test>`: every candidate plays on their own footage at a moment that fits it,
   labelled "Pop · B". Send `out/sound-sheet.mp4` and ask: "Which ones are you? e.g. pop B, long whoosh A and C, no hits."
4. `$PY $SKILL/scripts/sound_kit.py pick "<their words>"` (2-4 keepers per sound, so no sound repeats: "pop A C"; a
   sound named with no letter makes it ask) builds the kit (trimmed, measured, `kit.json` keeps where each
   came from and its licence). `sound_kit.py status` shows what the style uses but the kit lacks.
- "Show me more": `sound_kit.py search --roles <role> --more` adds the next few (new letters, the old ones stay).
- "I'd rather pick from a page": `sound_kit.py listen` (run it in the background) opens a page on their Mac with every candidate
  (waveform, ▶, click to keep, Save); then `fetch --picks <kit>/picks.json` and `pick --picks <kit>/picks.json`.
- Nothing good for a role on Mixkit: look on freesound.org filtered to CC0 (no credit, no limits), show it, download
  on their OK, then `sound_kit.py add FILE --role R --source URL --licence CC0`.
- They have Epidemic Sound: give them exact search terms per role ("short air whoosh", "soft UI pop"), they download
  the files themselves into `00_Inbox`, then `sound_kit.py add` each one (`--licence "Epidemic Sound"`: it notes that
  posting needs an active subscription).

## Later changes

When the creator makes a change permanent ("always", "make that the default", "remember this"): edit
`my-style/style.json` (or `style.md` for a rule), and add a dated line with their exact words to `my-style/changes.md`.
Adding a video to the style later: `reference.py add`, break it down, then redo steps 2-5 for the aspects it brings
(`my_style.py unlock` first, `lock` after).
