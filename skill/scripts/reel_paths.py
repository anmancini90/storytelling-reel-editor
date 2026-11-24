"""Where things live: the skill's home (~/.reel-editor, or REEL_EDITOR_HOME), the creator's Reels workspace, its library
(03_Library/music, 03_Library/sfx) and the sound kit (03_Library/sfx/kit). Shared by mix_audio.py, sound_kit.py and
sound_design.py."""
import json
import os


def home():
    return os.environ.get("REEL_EDITOR_HOME") or os.path.expanduser("~/.reel-editor")


def workspace():
    """The creator's Reels folder (saved by workspace.py), or None when there isn't one yet."""
    try:
        ws = json.load(open(os.path.join(home(), "workspace.json"))).get("workspace")
    except (OSError, ValueError):
        return None
    return ws if ws and os.path.isdir(ws) else None


def library(kind):
    """<workspace>/03_Library/<kind>/ (music or sfx): the creator's own files, kept across skill updates."""
    ws = workspace()
    d = os.path.join(ws, "03_Library", kind) if ws else None
    return d if d and os.path.isdir(d) else None


def kit_dir(create=False):
    """<workspace>/03_Library/sfx/kit/: the creator's sound kit (kit.json + one folder per role)."""
    ws = workspace()
    if not ws:
        return None
    d = os.path.join(ws, "03_Library", "sfx", "kit")
    if create:
        os.makedirs(d, exist_ok=True)
    return d if os.path.isdir(d) else None
