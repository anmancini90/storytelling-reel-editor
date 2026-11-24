# Storytelling Reel Editor: a Claude skill by Ant Mancini (@ant.mancini)

Film yourself talking, retakes and all. Claude turns it into a finished, ready-to-post vertical reel, edited in the
style you love:

- **A tight story cut.** Your raw takes, mistakes and dead air go in. The best take of each line, in a tight order,
  comes out. You approve this "A cut" before anything else happens.
- **Your style, learned from reels you love.** The first time, send 3 to 5 reels that stop you mid-scroll. Claude
  breaks down their captions, pacing, graphics and sound, then builds *your* style from them. Every edit starts from it.
- **Captions and simple graphics timed to your words:** notifications, app cards, a screenshot of your app or site,
  big words behind your head, a "Comment X" box for your call to action. You see a storyboard before it's rendered.
- **Designed sound.** Whooshes on every move, pops on every graphic, typing on typed text, a hit on the big line, all
  from your own sound kit of free Mixkit sounds that you pick by ear. Your voice gets a gentle clean-up too.
- **Nothing under the TikTok/Reels buttons.** Every frame is checked against the app's button zones.
- **It learns your taste.** Say "make that the default" and it's saved for every future edit.

This is the system I use for my own reels.

## What you need

- **Claude Code** (the "Code" tab in the Claude desktop app, or the `claude` terminal app; needs a paid Claude plan)
  **or Codex**. Have both? One install works in both.
- **A Mac** (Apple Silicon is fastest). Linux and Windows aren't supported yet.
- **Google Chrome**, **ffmpeg**, **Node.js** and **Python 3**. Don't worry if you don't have them: setup tells you
  exactly what's missing and the one-line command to install it.
- About 3 GB of free space (the editing tools and the speech-to-text model download once).

## Install (one prompt)

1. Download the skill and leave it in your Downloads folder (zipped or unzipped, either is fine).
2. Open the Claude desktop app, click the **Code** tab (or open Codex), paste this, then drag your video in right after
   it and press Enter:

   > Install the newest storytelling-reel-editor download from my Downloads folder: unzip it if needed and run
   > `bash <that folder>/scripts/install.sh`. Then read the installed SKILL.md and use it to edit this video:

Click **Allow** when it asks to run something. If it says Homebrew is missing, install it from https://brew.sh and
paste the prompt again.

`install.sh` puts the skill in Claude's skills folder and, if Codex is on your computer, links it there too, so both
apps share one copy. To update, download the new version and paste the same prompt: your styles, videos and sounds
are never touched, and an older download never replaces a newer install.

## Your first edit

It's a conversation, with two stops where you decide:

1. **Your Reels folder.** Claude asks where to keep your videos (outside iCloud, so big files don't fill your iCloud
   or go "offline"). You get an inbox, your style, and one folder per video.
2. **Build my style.** Send 3 to 5 reel links (Instagram, TikTok or YouTube) or video files. A line on what you like
   about each one helps, but isn't needed. You approve a test still before it's saved.
3. **Stop 1, the A cut.** Watch the story cut of your raw footage. Ask for changes or say it's good.
4. **Stop 2, the storyboard.** See where every caption and graphic lands. Change anything.
5. **Your sound kit (first time only).** Claude finds about 3 free Mixkit sounds for each kind of moment (whoosh,
   pop, hit, typing...), asks before downloading them, and plays each one on your own video. You keep the ones you
   like, and every reel after that uses your kit.
6. **Your reel.** A full-quality file to post, a lighter copy for your phone, and every version kept (`-v1`, `-v2`...).

After that, just ask:

> Edit the video in my inbox.

> When I say "my app", show a screenshot of my homepage (~/Desktop/home.png) full screen.

> Add a comment box for my CTA "Comment GUIDE", my handle is @yourhandle.

Then give feedback like you would to an editor: "the captions a touch bigger", "that whoosh comes in late", "make
that the default".

## Tips

- Film vertical (9:16). Retakes and mistakes are fine: the story cut takes care of them.
- iPhone HDR footage: export as SDR first (Photos: Share → Options → Most Compatible).
- Add music inside Instagram or TikTok when you post. It's licensed there, and trending sounds help reach.
- Write any on-screen joke text exactly how you want it shown. Claude uses it word for word.

## Resources

- **Cap** (https://cap.so): a free screen recorder. Record your app or website and Claude can show it in your reel.
- **Mixkit free sound effects** (https://mixkit.co/free-sound-effects/): where your sound kit comes from. Free to use
  in your videos under the Mixkit licence. Claude downloads only the sounds you OK, for you; none ship with the skill.
- **Epidemic Sound** (https://www.epidemicsound.com, optional, paid): already subscribe? Download a sound from your
  account yourself (you sign in, never Claude) and say "add this to my sound kit as a whoosh". You need an active
  subscription on the day you post.
- **Music:** add it in the Instagram or TikTok app when you post (see Tips).
- **Reference reels for Build my style:** your Instagram Saved, TikTok Favorites, or the YouTube Shorts you've liked.
  Pick reels you'd love your own to look and sound like, not just ones that went viral.

## What's inside

- `SKILL.md`: the instructions Claude follows.
- `reference/`: the why behind every rule: story cut, style builder, graphics, audio and sound design.
- `scripts/`: install, setup, story cut, transcription, captions, rendering, safe-area check, sound kit, sound design,
  mix, export.
- `template/`: the animation page your graphics are built in.
- `style.json`: the base look's numbers. Your own style lives in your Reels folder (`01_Styles/my-style/`), so an
  update never loses it.
- `fonts/`: TikTok Sans, Inter and Hanken Grotesk (free, open licence). `LICENSE.md` lists everything third-party.

Made by Ant Mancini · Instagram: @ant.mancini
