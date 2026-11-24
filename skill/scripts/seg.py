"""Person masks for cutout.py and heads.py: Apple Vision first, u2net as the fallback.

Apple Vision (macOS 12+, built in, on-device) cuts the speaker out much more cleanly than u2net on busy backgrounds
(in a car, u2net grabs the sun visor and headrest, leaving smears above the hair). vision_seg.swift is compiled once
with swiftc and cached in the tool home's bin/ (~/.reel-editor/bin/, or REEL_EDITOR_HOME). When that isn't possible (not a Mac, no Xcode command line tools, an old
macOS, a sandbox that blocks the compiler or Vision), the scripts use `npx hyperframes remove-background` (u2net) as
before. Force one with --seg vision|u2net on the scripts, or REEL_SEG=vision|u2net (default auto).
"""
import hashlib
import os
import platform
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SWIFT = os.path.join(HERE, "vision_seg.swift")
BIN_DIR = os.path.join(os.environ.get("REEL_EDITOR_HOME", os.path.expanduser("~/.reel-editor")), "bin")


def choice(argv):
    """the requested backend: --seg X on the command line, else REEL_SEG, else auto"""
    if "--seg" in argv:
        i = argv.index("--seg")
        val = argv[i + 1]
        del argv[i:i + 2]
        return val
    return os.environ.get("REEL_SEG", "auto")


def vision_bin():
    """path to the compiled Vision tool (built on first use), or None when it can't be built here"""
    if platform.system() != "Darwin" or not shutil.which("swiftc"):
        return None
    tag = hashlib.sha1(open(SWIFT, "rb").read()).hexdigest()[:10]
    exe = os.path.join(BIN_DIR, f"vision_seg-{tag}")
    if os.path.exists(exe):
        return exe
    os.makedirs(BIN_DIR, exist_ok=True)
    r = subprocess.run(["swiftc", "-O", SWIFT, "-o", exe], capture_output=True, text=True)
    if r.returncode or not os.path.exists(exe):
        print(f"Apple Vision unavailable (swiftc: {(r.stderr or '').strip().splitlines()[-1:] or 'failed'}); using u2net")
        return None
    return exe


def backend(argv):
    """'vision' or 'u2net', resolving auto to Vision when it can be built"""
    want = choice(argv)
    if want == "u2net":
        return "u2net"
    if vision_bin():
        return "vision"
    if want == "vision":
        sys.exit("--seg vision: Apple Vision isn't available here (needs macOS 12+ and the Xcode command line tools)")
    return "u2net"


def vision_masks(frame_paths, out_dir):
    """write <out_dir>/<frame name>.png masks; True if every frame got one"""
    exe = vision_bin()
    if not exe:
        return False
    os.makedirs(out_dir, exist_ok=True)
    lst = os.path.join(out_dir, "frames.txt")
    open(lst, "w").write("\n".join(frame_paths))
    r = subprocess.run([exe, out_dir, "@" + lst], capture_output=True, text=True)
    ok = r.returncode == 0 and all(
        os.path.exists(os.path.join(out_dir, os.path.splitext(os.path.basename(p))[0] + ".png")) for p in frame_paths)
    if not ok:
        print(f"Apple Vision failed ({(r.stderr or '').strip() or 'no masks'}); using u2net")
    return ok
