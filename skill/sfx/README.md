# Sound effect library

The skill ships one sound: the chalk below (public domain), so drawings have a sound before a kit exists. Every other
sound is the creator's own **sound kit** in their Reels folder, `03_Library/sfx/kit/` (kept across skill updates):
real recordings from Mixkit (free), picked by ear with `scripts/sound_kit.py` (search → fetch → sheet or listen →
pick). `scripts/sound_design.py` places them on every edit. The originals they downloaded stay untouched in
`03_Library/sfx/mixkit/`. A single file by name still works with `mix_audio.py --sfx name@SEC` (looked up in
`03_Library/sfx/` first, then here).

Only use sounds the creator has the right to post. Real recorded sounds beat synthesised pops and whooshes, which sound
"arcade-y". `scripts/make_sfx.py` makes stand-ins only.

## Real recordings in the library

| File | What | Source / licence |
|---|---|---|
| `chalk-writing.wav` | Chalk writing on a blackboard: ten short strokes, low noise. `scripts/chalk.py` cuts it into strokes that follow an `EDT.doodle` drawing. | "Chalk writing on board" by mrrap4food, freesound.org/s/619018, CC0 (public domain, no credit required) |
