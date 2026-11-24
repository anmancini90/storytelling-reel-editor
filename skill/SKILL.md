---
name: storytelling-reel-editor
description: Edit a talking-head vertical video (Instagram Reel, TikTok, YouTube Short) in the creator's own style. Cuts raw footage with retakes and mistakes into a tight story (an A cut they approve), builds their style from 3-5 reference reels they love, adds TikTok Sans auto-captions and simple iOS-style UI moments timed to their words (notifications, cards, screenshots of their app, an AI or app "talking back", a comment-CTA sheet), big impact words behind the head, keeps everything out of the TikTok/Reels button zones, and designs the sound from their own kit of free Mixkit sound effects (whooshes, pops, hits, typing) with a voice clean-up. Use whenever someone asks to caption, edit, cut or "make this a reel" from a talking video file, or to build their editing style.
---

# Storytelling reel editor

Turns a raw talking-to-camera clip into a finished 1080x1920 reel: a story cut, captions, a few simple animated UI
moments, music and sound effects. Built by Ant Mancini (@ant.mancini) from the edits Ant actually posts. The look is
deliberately simple: the person talking stays the star, and every graphic earns its place by showing exactly what they
are saying.

Paths below: `$SKILL` = this skill's folder, `$PY` = `"${REEL_EDITOR_HOME:-$HOME/.reel-editor}/venv/bin/python" -I`, `$V` = the video's
folder in the workspace (`02_Videos/<date>_<topic>/`), `$P` = its edit project (`$V/work/edit/`).

## The style (follow it unless the creator says otherwise)

1. **Captions**: TikTok Sans, weight 600, 56 px on a 1080-wide frame, letter spacing -0.035em, pure white. No
   shadow, no outline, no box, no animation: each 2-3 word chunk hard-cuts on and off. Sentence case exactly as
   spoken; swears starred ("f*cking"). One line, centred, vertical centre at y 1440: on the chest, never over the face.
   For impact, one or two spoken words can go big behind or beside the head instead (cut the speaker out for just
   those frames with `scripts/cutout.py` and layer the word under the cutout); hide the small caption while the impact
   word is up. Never duplicate on-screen text in the captions: whenever a headline, impact word or label says the
   spoken words, `hide` those caption chunks.
2. **Safe area**: nothing (no caption, card or sticker) in the top 10% (y < 192), the bottom 20% (y > 1536) or the
   bottom-right button column (x > 900 below y 960). That is where TikTok and Reels draw their own UI.
3. **Keep it simple**: no zooms, B-roll, emojis or effects unless asked. Add a graphic only where the creator asks
   for one, or (when they want suggestions) where a line names something concrete you can show. One idea per graphic.
4. **Graphics look like real apps** (familiarity beats decoration): iOS notification banners, dark glass cards,
   real app logos, an Instagram comment sheet for "Comment X" calls to action. They sit **above the person's head**,
   never on the face.
5. **Timed to the words**: a graphic pops in on the first word of the phrase that names it (Apple-style spring:
   fade 0.12 s, scale .92 → 1, 22 px rise) and leaves when the next idea starts. Hold anything with text ≥ 2 s.
6. **Humour lands in the UI**: the app or AI can "talk back" in a bubble (`-clanker 5.5` style sign-off), and
   notifications can undercut the brag ("getting views..." → "Your video is in 300 view jail..."). Use the
   creator's exact words for jokes.
7. **Audio**: the clip's own audio at 200% (2x, the creator can ask for up to 300%). Background music at 25% while the
   song is still in its quiet intro, then 10% from the moment the drums or vocals kick in (songs get distractingly
   loud there). A sound effect lands on the exact word; the music can stop on it. Limit at -1 dB.
8. **Prove what you claim**: report exact numbers (font weight, sizes, levels, times) and back visual claims with
   evidence (stills, the safe-area audit, measured loudness). If the creator doubts something, measure it and show it.

All of these numbers live in `$SKILL/style.json`. Details and the reasons behind them: `reference/style.md`.
**The creator's saved style wins wherever it differs** (`<workspace>/01_Styles/my-style/`, from Build my style below):
its `style.json` is merged over this base for every new edit, and its `style.md` says which of the moves above it
keeps, drops or replaces (B-roll, zooms, emoji stickers, music level...).

**Building blocks.** The base graphics are the `BEAT.*` helpers (`reference/components.md`). `template/` also holds
richer pieces, each documented in its file's comments: `components.js` (`ANT.*`: kinetic hook, impact words, profile
card, timeline, label chips), `layouts.js` (`KAL.*`: grid canvas, news split, picture-in-picture, full frame, close/wide
framing on cuts), `editorial.js` (`EDT.*`: cream canvas, chapter cards, graphs, checklists, doodles, end card),
`signature.js` (`SIG.*`: two-tier punchline, app window, DM mock), `antstyles.js` (`MIN.*` / `VIS.*`: proof cards,
follow card, smooth push into a split) `claudeui.js` (`CLD.*`: Claude desktop chat and dictation mock-ups) and `type.js` (`TXT.show`: titles, labels,
big numbers, text cards and code lines in the looks saved in the creator's style). Use them
only when the creator asks for that kind of moment.

## Build my style

The creator's own look, learned from videos they love. It runs **on the first run, before the first edit** (right
after the workspace exists, when `<workspace>/01_Styles/my-style/style.md` doesn't exist yet), and any time they ask to
build, rebuild or add to their style.

**1. Ask for the videos**, in these words or close to them:
> Before your first edit, I'll learn the style you want. Send me 3 to 5 videos that stop you mid-scroll: Instagram,
> TikTok or YouTube links, or the video files. I need at least 2 to start, and I'll use up to 5. They can all be
> from one creator, or from different creators you'd like to mix.
> It helps a lot if you add a line on what you like about each one: the captions, the pacing, the music, how the
> story's told, anything. If you don't, I'll break down the whole style myself.
> Only want part of a video? Say so ("just the captions from this one") and I'll only take that part.

- **Fewer than 2 videos: don't start.** Say "I need at least 2 videos to build your style. Send me one more." and
  wait. Never build a style from one video, and don't start editing until the style exists. Only if the creator
  explicitly says to skip it for now, edit with the base look and offer to build the style next time.
- **More than 5:** ask which 5 to use.
- **One creator or several: both are fine.** From several creators, the whys decide what comes from which video.
  Where two videos disagree (two different caption looks, say) and no why settles it, ask which one to keep when the
  style is put together.
- **A reason ("why") is optional.** With one, the parts it points at are must-keeps. Without one, break down the
  whole video.
- **Only some aspects** ("just the captions", "the pacing and the music"): take only those from that video. Map their
  words to the aspect names: `hook story pacing framing captions text broll look music sfx ending`.

**2. Fetch and measure each video:** `$PY $SKILL/scripts/reference.py add "<link or file>" [--why "<their words>"]
[--only captions,pacing]`. It downloads the video into `01_Styles/references/<date>_<creator>_<id>/` and measures it:
cuts and shot lengths, speaking pace, on-screen text (captions vs other text: size, position, words at a time, case,
colour), loudness, a music bed, likely sound-effect hits, plus contact sheets of the hook and every shot.
- `DOWNLOAD BLOCKED` / `DOWNLOAD FAILED`: ask for the file instead (TikTok: Share → Save video; Instagram: screen-record
  the reel and save it to the Mac; YouTube: any saved copy), then `reference.py add <file> --link <url>`. If it says to
  update the downloader, run the command it gives once and retry. If a video can't be had, drop it; there must still
  be at least 2.
- `LONG VIDEO` (a YouTube video, a podcast): only the first 5 minutes are downloaded and measured. Tell the creator in
  one line, e.g. "That's a 35-minute YouTube video, so I'll learn from its first 5 minutes and turn its look into a
  vertical reel." The breakdown translates landscape styles for a reel.
- The reference video stays in its folder, on this Mac, for study only. Never place its footage, audio, images or fonts
  in an edit.

**3. Break each one down** with `reference/style-breakdown.md`: read `analysis.md`, look at `hook.jpg` and every
`shots-NN.jpg`, then write `breakdown.md` in the reference folder (only the chosen aspects when `--only` was given).
Then show the creator 3-5 plain bullets per video: what you saw, and the parts you'd keep. Ask them to correct anything
you got wrong before the style is put together. Many creators won't read long text: lead with the bullets, and offer
the contact sheets (`hook.jpg`) as the proof.

**4. Put it together** with `reference/style-builder.md` and `scripts/my_style.py`: decide each aspect from the
breakdowns (a why's must-keeps win; agreeing videos are taken as is). Where the videos disagree, **show, don't
describe**: render the options on a frame of the creator's own clip (`my_style.py pick`) and ask "A, B or C?". Ask
about sound effects every time (they can't be measured under talking). Write `my-style/style.md` + `style.json`; run
`my_style.py check`.

**5. Test stills, then lock.** A short test edit of their clip in `my-style/test/`, 3-4 stills in the new style, then
"Is this your style?" On a yes: `my_style.py lock`. From then on every edit starts from it.

## Workflow

**0. Setup (once per computer).** Run `bash $SKILL/scripts/setup.sh`. It checks ffmpeg, Node, Python and Chrome
(printing install commands for anything missing) and installs Whisper and puppeteer-core into the tool home (`~/.reel-editor/`, or `REEL_EDITOR_HOME`).
The first transcription downloads the Whisper model (~1.5 GB).

**0b. Workspace (first run, then checked every time).** Run `$PY $SKILL/scripts/workspace.py where`.
- `NO WORKSPACE`: explain it simply and ask one yes/no question, in these words or close to them:
  > Your videos need a home folder. I recommend one called **Reels** in your home folder (`~/Reels`), kept on this Mac.
  > Why not iCloud? Raw videos are huge, and iCloud sometimes saves space by keeping a big file only online and
  > removing it from your Mac. If that happens in the middle of an edit, the edit has to wait while the video downloads
  > again. Kept on your Mac, your footage is always ready.
  > Do you want it in iCloud anyway? (yes / no)

  **No:** `workspace.py init ~/Reels` (or a non-iCloud folder they name). **Yes:** ask which folder, suggesting
  iCloud Drive › Reels (`~/Library/Mobile Documents/com~apple~CloudDocs/Reels`), run `init` on it, and tell them to
  right-click that folder in Finder and choose **Keep Downloaded** (macOS 14+) so the videos stay on the Mac too.
  `init` only creates what's missing and never moves or changes a file. If it answers `FOLDER NOT EMPTY`, tell the
  creator what's in there and run `--adopt` only after they say yes. If it prints `ICLOUD:` for a folder they didn't
  mean to put in iCloud (Desktop and Documents sync when iCloud's Desktop & Documents option is on), pass it on and
  offer `~/Reels` instead.
- `WORKSPACE MISSING`: ask whether they moved or renamed it, then run `init` on the new path (or on a new spot).
- A path: carry on.

**Moving it later** ("put my Reels folder in iCloud", "move it off iCloud", "move it to my external drive"): confirm
the new spot in one line, make sure no edit is running, then `workspace.py move <new full path>`. On the same drive it
renames in place; onto another drive it copies, checks every file's size, and only then removes the old folder. If it
answers `COPY CHECK FAILED` or `COPY FAILED`, nothing was removed: say where both copies are. Moving into iCloud: give
the Keep Downloaded tip.

After `init`, tell the creator in two lines what goes where: raw videos into `00_Inbox`, and each video gets its own
dated folder in `02_Videos` (raw, screens, work, exports, final, notes). Layout and what each folder is for: the
docstring at the top of `scripts/workspace.py` and a `README.md` in each folder.

Every edit runs inside one video folder, `$V` = `<workspace>/02_Videos/<date>_<topic>/`: the footage in `raw/`, the
working files in `work/` (`work/cut/` for the story cut, `work/edit/` = `$P` for the edit), every version the creator
sees in `exports/`, the one they post in `final/`, and `notes.md` kept up to date (status, goal, versions, caption).
The edit stops twice for the creator: after the **A cut** and after the **storyboard**. Never go past a stop without
their OK.

**1. Intake.** Raw videos are in `00_Inbox` (or wherever the creator says). Put each into its own video folder:
`$PY $SKILL/scripts/workspace.py intake <file>` prints `VIDEO <path>` (= `$V`). It moves files out of `00_Inbox` and
copies files from anywhere else (Downloads, Desktop, a video dragged into the chat), so the creator's original stays
where they left it; say which happened. One folder per file: creators often
record 3-5 separate videos in one sitting. `--together` when several files make one video (a take + a pickup line).
Never edit a file inside `00_Inbox`. Footage stays local: never upload the creator's media anywhere.
**Source check:** look at 3-4 stills of the clip before anything else. If it is an exported first cut with captions or
text already burned in, don't caption on top: ask for a clean export, or rebuild the same cut from the clean source
with the editor's cut list (EDL/OTIO/edit-plan) using ffmpeg trim + concat (30 ms audio fades).
Then ask, in one message, only what you can't infer:
- **The goal**: "What should this video do? Get DMs, send people to something (what?), win followers, or just tell
  the story?" It decides the hook and the ending (a comment CTA, a follow card, a link line). Write the answer under
  "What it should do" in `notes.md`.
- Which moments should get a graphic, or "suggest some".
- Music: a file from `03_Library/music/`, another file, or none (no music = voice only). Sound effects follow their
  style (`my-style/style.md`).
- Their name and @handle whenever the ending shows them (a comment CTA, a follow card). Never guess them: the name in
  this skill's credits is its author's, not the creator's. Write them in `my-style/style.md` (`Me: Name, @handle`) so
  later edits don't ask again, and use a still from their own clip for a profile photo.
- **Screens**: if they name their own app, site, product or account, ask for a screenshot or a short screen recording
  of it (into `$V/screens/`). Viewers expect to see the thing they just heard named.

**2. Story cut, then the A cut (stop 1).** For raw footage (retakes, false starts, dead air), follow
`reference/story-cut.md` in `$V/work/cut/`. While reading the transcript:
- **Several ideas in one recording** (a new topic after a pause, "okay, next one", a second hook): list the ideas
  with their start times and ask which to make. `workspace.py split $V 0=<topic> 192.5=<topic> ...` copies each idea
  into its own new folder (the source stays as it was); continue in each idea's folder, one at a time. After the
  creator has checked the pieces, `workspace.py archive <the source folder>`.
- **Name the folder** once you know what it's about: `workspace.py rename $V "<topic>"` (it prints the new `$V`).
Export the A cut for the creator to watch:
`ffmpeg -v error -i $V/work/cut/out/acut.mov -vf scale=1080:-2 -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p
-c:a aac -b:a 160k $V/exports/<topic>-acut.mp4` (a light review copy, about 15 MB a minute, small enough to send to a
phone; the story cut from 4K footage renders at about 3x real time). Give it with: its length against the raw, which take you kept where a line was
repeated, and anything worth a listen (a tight join, a guessed word). **Stop:** wait until they say it's good or what to
change. Update `notes.md` (Status: A cut sent; one line under Exports).
A clip that is already clean (no retakes) skips the story cut and the A cut stop: go to step 3 with it.

**3. Project.** `$PY $SKILL/scripts/new_project.py <the A cut's acut.mov, or the clean clip>`: inside a video
folder it creates `$V/work/edit/` (= `$P`): 1080x1920 frames at the source's own rate when it is 24 or 25 fps (no
24→30 judder; `style.json` `fps_mode`), otherwise 30 fps, 16 kHz audio, the page template, and the style (base +
the creator's saved style; it prints which). Read its warnings (not 9:16, HDR, no audio) and tell the creator about
any.

**4. Transcribe.** `$PY $SKILL/scripts/transcribe.py $P --prompt "names, brands, slang in the video"`. Read the
transcript carefully: Whisper mishears names, drops/invents words at the end ("...skill hole"), and writes numbers
inconsistently. Fix in step 5, never by editing words.json timing.

**5. Captions.** Write `$P/captions.json` if needed (`replace`, `phrase_replace`, `remove`, `overrides`,
`breaks_before`, `hide`; documented at the top of `scripts/captions.py`), then `$PY $SKILL/scripts/captions.py $P`.
Read every chunk it prints: no chunk should split a phrase awkwardly ("I should wake | up with six") or end on a
weak word; fix with `overrides` (anchored on the words, so they survive edits). Flag any word you guessed.

**6. Storyboard (stop 2).**
- **Plan.** Read `<workspace>/01_Styles/my-style/style.md` first: its hook, on-screen text, B-roll and sound choices
  decide which building blocks to use, and the goal in `notes.md` decides the ending. Write a short table: time →
  spoken line → what appears → why. Run `$PY $SKILL/scripts/heads.py $P` (tracks the head top through the whole video,
  ~25 s per minute) and look at stills of those moments so you know where the head is.
- **Build.** Write `$P/page/beats.js` with the `BEAT` helpers (`reference/components.md`): `notify`, `pill`,
  `bubble`, `grid`, `comment`, `card`, `custom`, plus `TXT.show` and the other building blocks the style names. Time
  everything with `W('phrase')` (start of a spoken phrase) and `WE('phrase')` (its end). Put images in
  `$P/page/assets/`, screen recordings from `$V/screens/`. Use real logos/screens/frames whenever the creator has
  them; make example numbers obviously illustrative. **Whenever the creator names their own app, site, product or
  account, show it** with `BEAT.screen` (`reference/components.md`), from `$V/screens/`; if nothing is there, ask for
  a screenshot before building. Not sure which way to show it? Render the three modes (split, card, full) at that
  moment and let them pick from one sheet. After placing any `ANT.impact` words (or `KAL` canvas segments),
  run `$PY $SKILL/scripts/cutout.py $P --auto`: it cuts the speaker out of exactly those windows (skipping frames
  already done) and measures the background behind each impact word, so the word comes out white over a dark
  background and dark over a light one. Cutouts and `heads.py` use Apple Vision person segmentation when the Mac has
  it (built in, on-device; `scripts/seg.py` compiles `vision_seg.swift` once into the tool home's `bin/`) and fall back
  to u2net (`npx hyperframes remove-background`) when it doesn't. On a computer without Vision (not a Mac, or `swiftc
  --version` fails: no Xcode command line tools), that fallback downloads the hyperframes package and its model the
  first time: tell the creator and ask before the first cutout or storyboard. Vision is much cleaner on busy backgrounds. Force one with `--seg vision|u2net`.
- **Check.** `node $SKILL/scripts/render.mjs $P stills <t1> <t2> ...` (one still per beat + a couple of captions-only
  moments). Open `$P/out/stills/sheet.jpg`: graphics above the head, text readable at phone size, nothing in the red
  zones. `node $SKILL/scripts/safezone.mjs $P` must print `SAFE AREA OK` (it measures every element on every frame;
  with `data/heads.json` it also fails on HEADROOM, a card coming down onto the head, and CUTOUT, an impact word
  missing its cutout frames, which would put the word in front of the face).
- **Show it.** Give the creator the stills sheet as the storyboard, with the plan in plain words (one line per
  moment: when, what appears). Say the red areas only mark where the app buttons sit. **Stop:** wait for their OK. A
  change: change that one thing, re-render just those stills, show them again. Update `notes.md` (Status:
  storyboard sent / approved).

**7. Render.** `node $SKILL/scripts/render.mjs $P all` (≈20 s per 40 s of video on a laptop).

**8. Sound.** Every reel gets sound design from the creator's own **sound kit** (real recorded sounds from Mixkit, picked
by ear; `03_Library/sfx/kit/`). No kit yet: build one first (`reference/style-builder.md`, "6. Your sound kit"). Then:
```bash
node $SKILL/scripts/render.mjs $P cues          # where each sound goes (every graphic, move, typed letter, stroke)
$PY $SKILL/scripts/sound_design.py $P           # places and levels the kit's sounds under the voice -> out/sfx.wav
$PY $SKILL/scripts/mix_audio.py $P --sfx-track $P/out/sfx.wav     # + the voice, cleaned up; must report sync 0
```
`render.mjs cues` lists anything that appears without a sound of its own ("automatic pop"): fine for a one-off; for a
building block you use often, give it a cue. `sound_design.py` prints every sound it placed and why one was skipped
(a role the kit lacks: `sound_kit.py search --roles <role>`, then fetch / pick a few; Epidemic or Freesound files the
creator downloads themselves: `sound_kit.py add FILE --role R --source URL --licence L`, Freesound CC0 only). How the
sounds are chosen, placed and levelled: `reference/audio.md`. Music: added in the app (Instagram/TikTok) unless they give
you a file (`--music`, same reference). "Rebuild my sound kit": `sound_kit.py search`. "Show me more whooshes":
`sound_kit.py search --roles whoosh-short --more` (keeps the current letters, adds the next ones), then the sound sheet
or the listen page (run `listen` in the background; it closes 10 minutes after the page goes quiet).

**9. Export + QA.** `bash $SKILL/scripts/encode.sh $P $V/exports/<topic>-v1.mp4`, then
`$PY $SKILL/scripts/check.py $P $V/exports/<topic>-v1.mp4 <beat times>` and look at `$P/out/check.jpg`.

**10. Deliver.** Give the file and a short summary: what's on screen and when, the caption look (from their style),
audio levels, anything you guessed (a misheard word, an illustrative number), and that nothing touches the
TikTok/Reels UI. The export is about 110 MB a minute, too big for a phone chat: send a light copy
(`ffmpeg -v error -i <export> -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k
$P/out/<topic>-v1-light.mp4`, about 15 MB a minute) and keep the full file in `exports/` for posting. Keep every version (`-v1`, `-v2`...) in `exports/`: never overwrite a file the creator has seen. Add
one line per version under Exports in `notes.md` (with the sounds used and where each came from: `out/sfx-plan.json`), and the post caption under Caption if you wrote one. When they say
it's the one: copy it into `$V/final/`, set Status to final, and fill in Posted once it's up. `work/` can be deleted
after posting (everything in it can be rebuilt from `raw/`).

## Revisions

Creators iterate by feel ("slightly smaller", "it doesn't look bolder"). Change one thing at a time, by a small
step, and show a before/after crop for type changes. When a change is a preference ("always", "remember this",
"make that the default"), save it in their style: edit `<workspace>/01_Styles/my-style/style.json` (or `style.md`
for a rule) and add a dated line with their exact words to `my-style/changes.md`, so every future edit starts from
it. Never save a creator's preference into `$SKILL/style.json`: that's the base look, replaced on every update.

## Troubleshooting

- Smears above or beside the head in a behind-the-head cutout: check the script printed "Apple Vision". If it says
  u2net, install the Xcode command line tools (`xcode-select --install`) and delete that window's
  `page/assets/fg/*.png` before re-running cutout.py (it skips frames that already exist).
- `MISSING:` from setup: install what it names, rerun.
- HDR clip error: export SDR from the editor app (CapCut: HDR off; iPhone: share → Options → Most Compatible).
- Fonts look wrong in stills: the page must load `page/fonts/TikTokSans-latin.woff2` (new_project copies it).
- `W(): "..." not found`: the phrase must match the transcript words (check `data/words.json`; contractions and
  numbers are written the way Whisper wrote them). `W()` reads the words after the `captions.json` fixes, so a fix can
  move a phrase: turning "so that I can" into "so that I could" makes `W('so that I could')` find the earlier line.
  Check the time each one lands on in the stills.
- Render hangs: close other Chrome-heavy apps or pass fewer workers (`render.mjs $P all 4`).
- Sync error from mix_audio: never deliver; rerun (it compensates the limiter's delay with `latency=1`).
- Captions doubled under on-screen text: add `hide` ranges (a chunk is dropped when its midpoint is in a range).
- Serif accents use macOS Baskerville; on other systems they fall back to another serif. Check stills.

## Running in Codex (or another agent)

`bash scripts/install.sh` (from the unzipped folder) installs the skill for Claude Code and links it for Codex at
`$CODEX_HOME/skills/storytelling-reel-editor` (`~/.codex` by default) when Codex is on the computer: one copy of the
skill for both. Preferences and styles live in the Reels workspace, which both agents read, so either agent sees what
the other saved. Running it again with a newer download updates the skill (an older one is refused; `--force` goes
back). Setup lives in `~/.reel-editor/` (override with `REEL_EDITOR_HOME`). Sandboxed agents need permission for: MLX/Metal (Whisper transcription fails inside a sandbox
without Metal; run it on the host), launching Chrome (render, stills, safezone, impact_windows), `swiftc` + Apple
Vision (cutout.py, heads.py; compiled once into the tool home's `bin/`; without them the scripts fall back to
`npx hyperframes`, whose first run may fetch the package), and writing next to the video.
