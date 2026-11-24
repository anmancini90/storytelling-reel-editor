"""The creator's Reels workspace: where raw videos go in, where editing styles live, where finished reels come out.

Usage:
  python workspace.py where                              print the saved workspace path
                                                         (exit 1 with NO WORKSPACE / WORKSPACE MISSING when there isn't one)
  python workspace.py init [PATH] [--adopt]              create it (default ~/Reels), or add any missing folders; remembers it
  python workspace.py move NEW_PATH                      move the whole workspace (e.g. into or out of iCloud Drive)
  python workspace.py video "topic" [--date YYYY-MM-DD]  make 02_Videos/<date>_<topic>/ (raw, screens, work, exports,
                                                         final, notes.md) and print its path
  python workspace.py intake FILE... [--topic T] [--together]   put raw files into their own video folder's raw/ (one
                                                         folder per file unless --together): moved from 00_Inbox,
                                                         copied from anywhere else (the original stays put)
  python workspace.py rename VIDEO_DIR "topic"           name a video folder by what it's about (keeps the date)
  python workspace.py split VIDEO_DIR SEC=topic...       one long recording with several ideas -> one folder per idea
  python workspace.py archive VIDEO_DIR                  move a video folder into 99_Archive

Layout:
  README.md                       what this folder is, and why it lives outside iCloud by default
  00_Inbox/                       raw videos dropped here
  01_Styles/my-style/             the saved editing style
  01_Styles/references/           one folder per reference video
  02_Videos/<date>_<topic>/       raw/ screens/ work/ exports/ final/ notes.md
  03_Library/music/  sfx/         music and sound effects the creator may use
  99_Archive/

Safe by design: init and video only create folders and notes that are missing; they never move, rename, overwrite or
delete a file. intake moves a raw file from the workspace (00_Inbox) into its video folder (a rename on the same
drive; across drives it copies, checks the size, then removes the original); a file from anywhere else (Downloads,
Desktop) is copied and checked, and the original is left where the creator put it. split copies pieces out and leaves the source alone. Nothing deletes footage. move renames the workspace in place when it can; across drives it copies everything, checks every file's
size, and only then removes the old folder (if the check fails, nothing is removed). The location is saved in
$REEL_EDITOR_HOME/workspace.json (default ~/.reel-editor/), and the workspace root holds a .reel-workspace marker, so a
workspace that was moved or deleted outside this script is noticed instead of silently recreated.
"""
import argparse
import datetime
import errno
import json
import os
import re
import shutil
import subprocess
import sys

RE_HOME = os.environ.get("REEL_EDITOR_HOME") or os.path.expanduser("~/.reel-editor")
POINTER = os.path.join(RE_HOME, "workspace.json")
MARKER = ".reel-workspace"
DEFAULT = os.path.expanduser("~/Reels")
IGNORED = {".DS_Store", ".localized"}

ROOT_README = """# Reels

This is your video workspace. Everything for your reels lives here, in order:

- **00_Inbox**: drop your raw videos here
- **01_Styles**: your editing style, and the videos it was learned from
- **02_Videos**: one folder per video, from raw footage to the file you post
- **03_Library**: your music and sound effects
- **99_Archive**: videos you're done with

## Why it lives on your Mac, not in iCloud

Raw videos are huge. To save space, iCloud sometimes keeps a big file only online and removes the copy on your Mac.
If that happens to a video in the middle of an edit, the edit has to wait while it downloads again. Keeping this
folder outside iCloud means your footage is always right here, ready to go.

If you keep it in iCloud anyway: in Finder, right-click this Reels folder and choose **Keep Downloaded** (macOS 14 or
later) so your videos stay on this Mac too.

## Moving it

Ask Claude: "move my Reels folder to ..." (into iCloud, out of it, or onto an external drive). Claude moves it safely
and remembers the new spot. If you move it yourself in Finder, Claude will ask where it went next time.
"""

FOLDERS = {
    "00_Inbox": "Drop your raw videos here: one file per idea, mistakes and retakes included. When an edit starts, "
                "each video gets its own folder in 02_Videos. Originals stay here until you clear them.",
    "01_Styles": "Your editing styles. my-style/ is the one used unless you name another. references/ holds what was "
                 "learned from each video you showed as a reference.",
    "01_Styles/my-style": "Your saved editing style: captions, pacing, graphics, music and sound. It is built from 3-5 "
                          "videos you love the first time you ask to build your style. Change it by asking, not by hand.",
    "01_Styles/references": "One folder per reference video: a few frames, notes on what it does, and your line on why "
                            "you stayed and watched.",
    "02_Videos": "One folder per video, named by date and topic (for example 2026-11-23_morning-routine). Inside:\n\n"
                 "- raw/: your footage for this video\n"
                 "- screens/: screen recordings and screenshots (for example from Cap)\n"
                 "- work/: the editor's working files (safe to delete once the video is posted)\n"
                 "- exports/: the A cut and every version (v1, v2...)\n"
                 "- final/: the one you post\n"
                 "- notes.md: the idea, what the video should do, the caption and where it was posted",
    "03_Library": "Music and sound effects you're allowed to use, saved once and reused in every video.",
    "03_Library/music": "Songs and music beds (for example from Mixkit or Epidemic Sound). Keep the licence or the "
                        "download page link next to each file.",
    "03_Library/sfx": "Sound effects (for example from Mixkit). Name each file by what it's for: whoosh, pop, boom, tap.",
    "99_Archive": "Videos you're done with or dropped. Move whole video folders here to keep 02_Videos short.",
}
VIDEO_FOLDERS = ("raw", "screens", "work", "exports", "final")
NOTES = """# {topic}

Date: {date}
Status: raw footage

## The idea
(one or two sentences on what the video is about)

## What it should do
(get DMs / send people to my app / land followers / something else)

## Footage
(which raw files, anything to leave out)

## Exports
(A cut, v1, v2... with one line on what changed)

## Caption

## Posted
(platform, date, link)
"""


def load_pointer():
    try:
        return json.load(open(POINTER)).get("workspace")
    except (OSError, ValueError):
        return None


def save_pointer(path):
    os.makedirs(RE_HOME, exist_ok=True)
    json.dump({"workspace": path, "saved": datetime.datetime.now().isoformat(timespec="seconds")},
              open(POINTER, "w"), indent=1)


def current():
    """(path, problem): problem is None when the saved workspace is there and marked."""
    path = load_pointer()
    if not path:
        return None, "NO WORKSPACE: none saved yet. Run: workspace.py init [PATH]"
    if not os.path.isfile(os.path.join(path, MARKER)):
        return path, f"WORKSPACE MISSING: {path} (moved, renamed or deleted?). Run: workspace.py init <its new path>"
    return path, None


def in_icloud(path):
    home = os.path.expanduser("~")
    if path.startswith(os.path.join(home, "Library/Mobile Documents")):
        return True
    synced = os.path.isdir(os.path.join(home, "Library/Mobile Documents/com~apple~CloudDocs/Documents"))
    return synced and any(path == os.path.join(home, d) or path.startswith(os.path.join(home, d) + os.sep)
                          for d in ("Documents", "Desktop"))


def icloud_note(path):
    if in_icloud(path):
        return ("ICLOUD: iCloud Drive syncs this location. To stop iCloud offloading big videos mid-edit, right-click the "
                "folder in Finder and choose Keep Downloaded (macOS 14+). A folder iCloud doesn't sync, like ~/Reels, "
                "avoids this.")
    return None


def init(path, adopt):
    path = os.path.abspath(os.path.expanduser(path or DEFAULT))
    if os.path.exists(path) and not os.path.isdir(path):
        sys.exit(f"NOT A FOLDER: {path} is a file. Pick another path.")
    marked = os.path.isfile(os.path.join(path, MARKER))
    if os.path.isdir(path) and not marked and not adopt:
        existing = [f for f in os.listdir(path) if f not in IGNORED]
        if existing:
            print(f"FOLDER NOT EMPTY: {path} already holds {len(existing)} item(s), e.g. {', '.join(sorted(existing)[:3])}.")
            print("Run again with --adopt to add the workspace folders inside it (nothing in it is moved or changed),")
            print("or pick a new or empty folder.")
            sys.exit(2)
    made, kept = [], []
    for rel, about in FOLDERS.items():
        d = os.path.join(path, rel)
        (kept if os.path.isdir(d) else made).append(rel)
        os.makedirs(d, exist_ok=True)
        readme = os.path.join(d, "README.md")
        if not os.path.exists(readme):
            open(readme, "w").write(f"# {os.path.basename(rel)}\n\n{about}\n")
    if not os.path.exists(os.path.join(path, "README.md")):
        open(os.path.join(path, "README.md"), "w").write(ROOT_README)
    if not marked:
        json.dump({"version": 1, "created": datetime.date.today().isoformat()},
                  open(os.path.join(path, MARKER), "w"), indent=1)
    save_pointer(path)
    print(f"WORKSPACE READY: {path}")
    print(f"  created {len(made)} folder(s), {len(kept)} already there")
    for rel in FOLDERS:
        print(f"  {'new ' if rel in made else 'kept'}  {rel}/")
    note = icloud_note(path)
    if note:
        print(note)


def inventory(root):
    """{relative file path: size} for every file under root."""
    out = {}
    for d, _, files in os.walk(root):
        for f in files:
            p = os.path.join(d, f)
            if not os.path.islink(p):
                out[os.path.relpath(p, root)] = os.path.getsize(p)
    return out


def move(dest):
    src, problem = current()
    if problem:
        sys.exit(problem)
    dest = os.path.abspath(os.path.expanduser(dest))
    if dest == src:
        sys.exit(f"SAME PLACE: the workspace is already at {src}")
    if dest.startswith(src + os.sep):
        sys.exit(f"INSIDE ITSELF: {dest} is inside the workspace. Pick a spot outside {src}.")
    if os.path.exists(dest):
        if not os.path.isdir(dest) or [f for f in os.listdir(dest) if f not in IGNORED]:
            sys.exit(f"DESTINATION NOT EMPTY: {dest} already exists with something in it. Nothing was moved.")
        shutil.rmtree(dest)                      # an empty folder (or one with only .DS_Store) at the target
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        os.rename(src, dest)                     # same drive: instant, nothing copied
        how = "renamed in place"
    except OSError as e:
        if e.errno != errno.EXDEV:
            sys.exit(f"MOVE FAILED: {e}. Nothing was moved.")
        before = inventory(src)                  # another drive: copy, check, then remove the original
        try:
            shutil.copytree(src, dest, symlinks=True)
        except OSError as e2:
            sys.exit(f"COPY FAILED: {e2}. The original at {src} is untouched; a partial copy may be at {dest}.")
        after = inventory(dest)
        missing = [p for p, n in before.items() if after.get(p) != n]
        if missing:
            sys.exit(f"COPY CHECK FAILED: {len(missing)} file(s) differ (e.g. {missing[0]}). Nothing was removed: the "
                     f"original is still at {src} and the copy at {dest}.")
        shutil.rmtree(src)
        how = f"copied {len(before)} file(s), checked every size, then removed the original"
    save_pointer(dest)
    print(f"MOVED: {src} -> {dest} ({how})")
    note = icloud_note(dest)
    if note:
        print(note)


def slug(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:50].rstrip("-") or "video"


VIDEO_EXTS = {".mov", ".mp4", ".m4v", ".mkv", ".avi", ".mts", ".hevc", ".webm"}


def workspace_or_exit():
    path, problem = current()
    if problem:
        sys.exit(problem)
    return path


def check_date(date):
    date = date or datetime.date.today().isoformat()
    try:
        datetime.date.fromisoformat(date)
    except ValueError:
        sys.exit(f"BAD DATE: {date} (use YYYY-MM-DD)")
    return date


def make_video(topic, date, footage=""):
    """Create 02_Videos/<date>_<topic>/ (never reusing a folder) and return its path."""
    path, date = workspace_or_exit(), check_date(date)
    base = os.path.join(path, "02_Videos", f"{date}_{slug(topic)}")
    d, n = base, 2
    while os.path.exists(d):
        d, n = f"{base}-{n}", n + 1
    for sub in VIDEO_FOLDERS:
        os.makedirs(os.path.join(d, sub))
    notes = NOTES.format(topic=topic.strip() or "Untitled video", date=date)
    if footage:
        notes = notes.replace("(which raw files, anything to leave out)", footage)
    open(os.path.join(d, "notes.md"), "w").write(notes)
    return d


def video(topic, date):
    print(make_video(topic, date))


def free_name(folder, name):
    stem, ext = os.path.splitext(name)
    dst, n = os.path.join(folder, name), 2
    while os.path.exists(dst):
        dst, n = os.path.join(folder, f"{stem}-{n}{ext}"), n + 1
    return dst


def move_file(src, folder):
    """Move one file into folder: a rename on the same drive; across drives copy, check the size, then remove."""
    dst = free_name(folder, os.path.basename(src))
    try:
        os.rename(src, dst)
    except OSError as e:
        if e.errno != errno.EXDEV:
            sys.exit(f"MOVE FAILED: {src}: {e}. Nothing was moved.")
        shutil.copy2(src, dst)
        if os.path.getsize(dst) != os.path.getsize(src):
            os.remove(dst)
            sys.exit(f"COPY CHECK FAILED: {src} (sizes differ). The original is untouched.")
        os.remove(src)
    return dst


def copy_file(src, folder):
    """Copy one file into folder and check the size; the original is never touched."""
    dst = free_name(folder, os.path.basename(src))
    shutil.copy2(src, dst)
    if os.path.getsize(dst) != os.path.getsize(src):
        os.remove(dst)
        sys.exit(f"COPY CHECK FAILED: {src} (sizes differ). The original is untouched.")
    return dst


def video_dir_of(arg):
    root = workspace_or_exit()
    d = os.path.abspath(os.path.expanduser(arg))
    if os.path.dirname(d) != os.path.join(root, "02_Videos") or not os.path.isdir(d):
        sys.exit(f"NOT A VIDEO FOLDER: {d} (expected a folder inside {os.path.join(root, '02_Videos')})")
    return d


def intake(files, topic, date, together):
    """Raw files -> their own video folder's raw/. One folder per file unless --together. Files inside the workspace
    (00_Inbox) are moved; files from anywhere else are copied, so a creator's Downloads or Desktop keeps its original."""
    root = os.path.realpath(workspace_or_exit())
    paths = [os.path.abspath(os.path.expanduser(f)) for f in files]
    for f in paths:
        if not os.path.isfile(f):
            sys.exit(f"NOT A FILE: {f}. Nothing was moved.")
        if os.path.splitext(f)[1].lower() not in VIDEO_EXTS:
            print(f"(not a usual video type, taking it anyway: {os.path.basename(f)})")
    groups = [paths] if together or len(paths) == 1 else [[f] for f in paths]
    for g in groups:
        name = topic if topic and (together or len(paths) == 1) else os.path.splitext(os.path.basename(g[0]))[0]
        d = make_video(name, date, footage="raw/: " + ", ".join(os.path.basename(f) for f in g))
        print(f"VIDEO {d}")
        for f in g:
            inside = os.path.commonpath([os.path.realpath(f), root]) == root
            put = (move_file if inside else copy_file)(f, os.path.join(d, "raw"))
            how = "" if inside else f"  (copied; the original stays in {os.path.dirname(f)})"
            print(f"  raw/{os.path.basename(put)}{how}")


def rename(arg, topic):
    """Give a video folder its real topic once you know what it's about (keeps the date)."""
    d = video_dir_of(arg)
    date = os.path.basename(d)[:10]
    base = os.path.join(os.path.dirname(d), f"{date}_{slug(topic)}")
    new, n = base, 2
    while os.path.exists(new) and new != d:
        new, n = f"{base}-{n}", n + 1
    if new != d:
        os.rename(d, new)
    notes = os.path.join(new, "notes.md")
    if os.path.isfile(notes):
        lines = open(notes).read().split("\n")
        if lines and lines[0].startswith("# "):
            lines[0] = f"# {topic.strip()}"
            open(notes, "w").write("\n".join(lines))
    print(f"VIDEO {new}")


def hms(sec):
    return f"{int(sec // 60)}:{sec % 60:05.2f}"


def split(arg, parts, source):
    """One long recording holding several ideas -> one new video folder per idea, each with its own piece of the
    raw file (cut without re-encoding; it starts on the keyframe just before the start, a little early on purpose).
    The source folder is left as it was: archive it once the creator has checked the pieces."""
    d = video_dir_of(arg)
    raws = sorted(f for f in os.listdir(os.path.join(d, "raw")) if not f.startswith("."))
    src = os.path.join(d, "raw", source) if source else (os.path.join(d, "raw", raws[0]) if len(raws) == 1 else None)
    if not src or not os.path.isfile(src):
        sys.exit(f"WHICH FILE? raw/ holds {len(raws)} file(s): {', '.join(raws)}. Pass --source <name>.")
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                               capture_output=True, text=True).stdout.strip() or 0)
    cuts = []
    for p in parts:
        t, _, topic = p.partition("=")
        try:
            cuts.append((float(t), topic.strip()))
        except ValueError:
            sys.exit(f"BAD PART: {p} (use SECONDS=topic, e.g. 192.5=morning routine)")
    cuts.sort()
    if not cuts or any(not t for _, t in cuts) or cuts[0][0] < 0 or cuts[-1][0] >= dur:
        sys.exit(f"BAD PARTS: each needs SECONDS=topic, inside the {hms(dur)} file")
    date = os.path.basename(d)[:10]
    for k, (a, topic) in enumerate(cuts):
        b = min(dur, cuts[k + 1][0] + 1.0) if k + 1 < len(cuts) else dur      # 1 s overlap: never lose a last word
        stem, ext = os.path.splitext(os.path.basename(src))
        nd = make_video(topic, date, footage=f"raw/: part of {os.path.basename(src)} from {hms(a)} to {hms(b)} "
                                              f"(source folder: {os.path.basename(d)})")
        out = os.path.join(nd, "raw", f"{stem}-part{k + 1}{ext}")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-i", src, "-t", f"{b - a:.3f}", "-map", "0",
                            "-c", "copy", "-avoid_negative_ts", "make_zero", out], capture_output=True, text=True)
        if r.returncode or not os.path.isfile(out):
            sys.exit(f"SPLIT FAILED on part {k + 1}: {r.stderr.strip()[:300]}")
        got = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                                   capture_output=True, text=True).stdout.strip() or (b - a))
        real = max(0.0, b - got)                 # where the piece really starts (the keyframe at or before a)
        if real < a - 0.05:
            nn = os.path.join(nd, "notes.md")
            text = open(nn).read()
            open(nn, "w").write(text.replace(f"from {hms(a)} to", f"from {hms(real)} (asked {hms(a)}) to"))
        print(f"VIDEO {nd}")
        print(f"  raw/{os.path.basename(out)}  ({hms(real)} - {hms(b)}" + (f", starts {a - real:.1f} s early on a keyframe)" if real < a - 0.05 else ")"))
    print(f"The source folder is unchanged: {d}. Once the parts are checked: workspace.py archive \"{d}\"")


def archive(arg):
    d = video_dir_of(arg)
    root = workspace_or_exit()
    dst = os.path.join(root, "99_Archive", os.path.basename(d))
    n = 2
    while os.path.exists(dst):
        dst, n = os.path.join(root, "99_Archive", f"{os.path.basename(d)}-{n}"), n + 1
    os.rename(d, dst)
    print(f"ARCHIVED {dst}")


def main():
    ap = argparse.ArgumentParser(description="The creator's Reels workspace.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("where")
    p = sub.add_parser("init")
    p.add_argument("path", nargs="?")
    p.add_argument("--adopt", action="store_true", help="add the workspace folders inside a folder that already has files")
    p = sub.add_parser("move")
    p.add_argument("dest", help="the workspace's new full path, e.g. ~/Library/Mobile Documents/com~apple~CloudDocs/Reels")
    p = sub.add_parser("video")
    p.add_argument("topic")
    p.add_argument("--date")
    p = sub.add_parser("intake")
    p.add_argument("files", nargs="+")
    p.add_argument("--topic", default="")
    p.add_argument("--date")
    p.add_argument("--together", action="store_true", help="several files that belong to one video")
    p = sub.add_parser("rename")
    p.add_argument("video_dir")
    p.add_argument("topic")
    p = sub.add_parser("split")
    p.add_argument("video_dir")
    p.add_argument("parts", nargs="+", help="SECONDS=topic for where each idea starts, e.g. 0=hook idea 192.5=morning")
    p.add_argument("--source", help="which file in raw/ (when there are several)")
    p = sub.add_parser("archive")
    p.add_argument("video_dir")
    args = ap.parse_args()
    if args.cmd == "where":
        path, problem = current()
        if problem:
            print(problem)
            sys.exit(1)
        print(path)                              # stdout stays the bare path, for other scripts
        if icloud_note(path):
            print("(in iCloud Drive)", file=sys.stderr)
    elif args.cmd == "init":
        init(args.path, args.adopt)
    elif args.cmd == "move":
        move(args.dest)
    elif args.cmd == "intake":
        intake(args.files, args.topic, args.date, args.together)
    elif args.cmd == "rename":
        rename(args.video_dir, args.topic)
    elif args.cmd == "split":
        split(args.video_dir, args.parts, args.source)
    elif args.cmd == "archive":
        archive(args.video_dir)
    else:
        video(args.topic, args.date)


if __name__ == "__main__":
    main()
