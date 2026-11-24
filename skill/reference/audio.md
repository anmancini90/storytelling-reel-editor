# Audio

## Sound design (every edit)

The sounds come from the creator's kit (`03_Library/sfx/kit/`, built with `scripts/sound_kit.py`; see SKILL.md step 8
and `reference/style-builder.md` "6. Your sound kit"). Three commands:

```bash
node $SKILL/scripts/render.mjs $P cues                          # out/cues.json: where each sound goes
$PY $SKILL/scripts/sound_design.py $P [--seed 0]                # out/sfx.wav + out/sfx-plan.json
$PY $SKILL/scripts/mix_audio.py $P --sfx-track $P/out/sfx.wav   # out/mix.wav (sync 0, true peak <= -1 dB)
```

What gets a sound: each building block says so (a title pops, a cutaway whooshes in and out, the big word hits,
typing types, each drawn stroke scribbles, a layout move or punch-in gets a short whoosh, the comment sheet builds,
slides up, types, sends and the like taps). Captions never do. The style's `audio.sfx_roles` turns roles on or off and
`audio.sfx_intensity` (subtle, balanced, punchy) sets how much.

How a pro would place them (the rules in `sound_design.py`; tune by ear):
- **Timing:** pops, taps, clicks and hits land on the frame (their attack on the moment); whooshes, swipes and risers
  put their loudest point on the middle of the move (a window or cutaway that pops in: as it lands, never after the
  picture is there); typing and scribble run exactly as long as the typing or stroke.
- **Variety:** never the same file twice in a row for a role (keep 2-4 per role in the kit); each play gets a seeded
  touch of pitch (+-2.5 %) and level (+-1.5 dB), so re-renders sound the same.
- **Hierarchy:** sounds closer than 0.25 s collapse to the most important one (hit > long whoosh > short whoosh > pop
  > click/typing); at most one big sound (hit, long whoosh, riser) every 3 s (4 s for subtle).
- **Levels:** set by each sound's loudest 50 ms against the voice's syllable peaks, never above them: hits about
  1 dB under, long whooshes 3, pops and risers 5, clicks and taps 6, short whooshes and swipes 7, scribble 8, typing
  11. An average level would bury a 3 ms click under the voice while a whoosh stays loud, so short sounds are judged
  by their loudest moment, and a sound on a word is not turned down (under a word, quieter means masked). The sound
  sheet uses the same rule and the style's intensity, so what the creator hears there is what the reel gets.
- **The voice:** `mix_audio.py` cleans it up by default (`audio.voice_polish`; `--no-polish` to compare): rumble out,
  softer "s", gently evened out, a touch of presence; noise reduction only when the room is noisy. It measures and
  undoes any filter delay and keeps the loudness where it was.
- **Joins:** the story cut crossfades 10 ms of room tone on either side of every cut (`scripts/av_joins.py`), so the
  background never dips at a cut, and each piece's sound starts with its first frame (lip sync).

Not happy with one sound: swap it, naming every keeper for that sound (`sound_kit.py pick "pop B C"`: one keeper would
play every time) or tune the role's level in `ROLE_DB`, then run
`sound_design.py` and `mix_audio.py` again (seconds; no re-render needed).

## The mixer

`mix_audio.py` builds `out/mix.wav` from the clip's own audio, optional music and sound effects, then verifies it.

```bash
$PY $SKILL/scripts/mix_audio.py $P                                   # voice only, 200%
$PY $SKILL/scripts/mix_audio.py $P --music song.m4a                  # + music, drums auto-detected
$PY $SKILL/scripts/mix_audio.py $P --music song.m4a --music-start 31.5 --drums none
$PY $SKILL/scripts/mix_audio.py $P --music song.m4a --sfx vine-boom.mp3@38.34 --cut-music-at-sfx
```

## Levels (from `style.json` → `audio`)

| | Default | Override |
|---|---|---|
| Original audio | 2.0 (200%) | `--voice-gain 3.0` |
| Music, quiet intro (before drums/vocals) | 0.25 | `--intro-gain` |
| Music, after the drums kick in | 0.10 | `--music-gain` |
| Sound effects | -7 dB | `--sfx-db` |
| Music fade-out at the end (when not cut) | 1.2 s | style.json |
| Limiter | -1 dB, latency compensated | style.json |

## Drum detection

`--drums auto` finds the first kick drum: the 40-110 Hz band in 10 ms blocks, the first block within 8 dB of the
song's loud level. It prints the time. Check it: if the song starts with vocals over a quiet intro, the vocals are the
loud moment, so give `--drums <song seconds>` where the vocals start. If the song starts with drums (no intro, the
detected time < 1 s), the whole song plays at the normal level. `--drums none` = no intro step.

## Sound effects

`--sfx FILE@SEC`: SEC is the word's start from `data/words.json`. The script finds the effect's own hit (first sample
at 10% of its peak) and the word's real onset in the audio (the rise after the gap before the word, within
-0.15/+0.25 s), and lines them up. `--cut-music-at-sfx` stops the music on the first effect's hit (30 ms fade).

The creator supplies the sound files. Popular meme sounds (vine boom, bruh...) are easy to find, but their licences
vary: use ones they have the right to post.

## Music

Use a file the creator provides. Songs from major labels baked into an upload can be muted or limit reach on
Instagram/TikTok; the safe route for those is adding the song in the app, with this mix as the voice + SFX track.

## Verify (the script does this)

- sync vs the source = 0 samples (anything else: don't deliver)
- speech gain ≈ +6 dB at 200%
- loudness around -11 LUFS, true peak ≤ -1 dB
