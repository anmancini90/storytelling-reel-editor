# The story cut (raw footage → A cut)

Use this when the clip is raw: retakes, false starts, "wait, let me start over", dead air. Claude reads the transcript,
picks the best version of every line in story order, and `story_cut.py` cuts it with ffmpeg. The result
(`out/acut.mov`) is the A cut: the creator watches it (SKILL.md step 2, stop 1), then steps 3-10 run on it.

## 1. Transcribe the raw clip

Work in the video folder's `work/cut/` (`$C` = `$V/work/cut` below; the raw file is in `$V/raw/`). Footage stays
local.

```bash
mkdir -p "$C/src" "$C/data"
ffmpeg -v error -y -i <raw> -vn -ac 1 -ar 16000 "$C/src/audio16k.wav"
$PY $SKILL/scripts/transcribe.py "$C" --prompt "names, brands"
```

## 2. Choose the blocks

Read `data/words.json` and the printed transcript, then write `$C/keep.json` in story order. Each block holds the
**start times of its first and last kept word**:

```json
[{"label": "Hook: nobody tells you this about...", "from": 6.82, "to": 9.78}, ...]
```

How to choose the blocks:
- **Hook first.** Start on the sharpest version of the opening line and drop the warm-up ("okay so, um, let me just
  ask you something").
- **Retakes:** keep the best take of a repeated line and drop the rest (the same line said three times → keep the one
  that finishes the thought cleanly).
- **Restarts:** cut the false start and keep the full version ("but then on the same | but then on the same day").
- **Fillers:** drop "um", "uh", "you know" between thoughts and tail-offs ("but um"). Keep swears as said.
- **Stammers:** begin the block on the last repeat ("I I I really" → from the third "I").
- **Ending:** end on a line that lands. Drop a trailing "yeah" or "okay".
- **Seams:** start every block on the content word and end it on the last content word. No leading "But / it / it's /
  uh" and no trailing "but" across a cut. When a block opens on a filler, set its `"start"` just before the content
  word.

## 3. Cut it

```bash
$PY $SKILL/scripts/story_cut.py "$C" --check --prompt "names, brands"  # plans the cut, then listens to it (below)
$PY $SKILL/scripts/story_cut.py "$C" --render --source <raw>           # builds out/acut.mov
```

**Dead air goes.** `story_cut.py` measures the audio itself and cuts every quiet stretch of 0.15 s or more inside the
kept lines, between blocks and at their edges. Each piece starts 20 ms before its first sound and ends 40 ms after the
last word fades; an edge that lands mid-word moves out to the nearest pause so the word finishes. Creators notice
pauses as short as 0.3 s, so never leave one. (Whisper's word times drift by up to 0.3 s, so they only pick the lines;
the audio sets the edges.) A Whisper gap over `--gap` (default 0.30 s) also splits a block: that's usually an "um"
Whisper left out.

**Check before rendering** (`--check`, about 10 s): it builds the cut's audio, transcribes it, and compares it with the
kept lines:
- `MISSING` with a cut near it: the word was clipped. Widen that block: `"start"` (or `"end"`) in keep.json, a source
  time a little before (after) the word.
- `EXTRA`: a filler came back in at an edge ("And", "You know"). Drop it with an exact `"start"`/`"end"` on that block
  if it matters.
- `DIFFERENT` is usually spelling ("waitlist" / "wait list"). "No cut near it" means the transcriber missed it.
- `longest pause left` should be about 0.15 s.
Fix, re-run `--check`, then `--render`.

## 4. Hand-off

Tell the creator how long the cut is against the raw, which take you kept wherever a line was repeated, and anything
worth a listen (a tight join, a filler that stayed, a guessed word): that goes with the A cut in SKILL.md step 2 (export it to
`$V/exports/`, then wait for their OK). After the OK, SKILL.md step 3 runs on `$C/out/acut.mov`.
