"""The creator's sound kit: real recorded sound effects from Mixkit (free), picked by ear, one folder per role.

Usage: python sound_kit.py <command>
  search [--roles a,b] [--per-role 3]   read Mixkit's category pages, measure each sound's shape from its waveform data
                                        (no audio downloaded) and short-list the best few per role -> kit/candidates.json
  fetch [--picks picks.json] [--yes]    list the files (name, source, size) for the creator's OK; --yes downloads them
                                        into 03_Library/sfx/mixkit/ (originals, untouched)
  pick "pop B, long whoosh A C, no hits" | pick --picks picks.json
                                        the creator's picks -> kit/<role>/*.wav (trimmed, measured) + kit/kit.json
  add FILE --role R --source URL --licence L
                                        a sound they downloaded themselves (Epidemic; the Freesound backup: CC0 only)
  status                                what the kit has, and what the style uses but the kit lacks
  listen [--no-open]                    a page on this Mac to hear every candidate and click the keepers (saves
                                        kit/picks.json for fetch --picks / pick --picks)
  sheet <project>                       the sound sheet: every candidate on the creator's footage, labelled, to pick by
                                        ear (needs render.mjs <project> all and cues) -> <project>/out/sound-sheet.mp4

Roles: whoosh-short whoosh-long pop click tap hit type swipe send notify riser scribble.
Mixkit's terms: never bundle their files and never bulk-download. This only reads the pages it needs, fetches only the
sounds the creator approves, and each download is licensed to the creator who downloads it.
"""
import argparse
import html as htmlmod
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reel_paths  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0"}
CAT_URL = "https://mixkit.co/free-sound-effects/{}/"
ASSET = "https://assets.mixkit.co/active_storage/sfx/{id}/{id}-{kind}"
BAN = re.compile(r"arcade|cartoon|game|magic|sparkle|laser|sci-?fi|comic|funny|fart|horror|scary|gun|sword|punch|kick|"
                 r"wrong|error|coin|robot|monster|alien|spell|fairy|toy|kid|child|bomb|explosion|cash|casino|slot|space|"
                 r"zombie|ghost|evil", re.I)
# shape: transient = instant attack (pops, clicks, hits) | swell = builds then fades, peak in the middle (whooshes)
#        rise = peak near the end (risers) | span = long and steady (typing, writing) | any = only the length counts
ROLES = {
    "whoosh-short": {"cats": ["whoosh", "swoosh", "swish", "woosh", "transition"], "title": r"whoosh|swoosh|swish|woosh",
                     "ban": r"impact|hit|stutter|electric|metal|rocket|storm|pop|fire|insect|vacuum", "min_len": 0.15,
                     "max_len": 1.2, "shape": "swell", "prefer": r"fast|short|quick|air|wind|transition"},
    "whoosh-long": {"cats": ["whoosh", "swoosh", "woosh", "transition"], "title": r"whoosh|swoosh|woosh|transition",
                    "ban": r"impact|hit|stutter|electric|metal|rocket|jet|landing|helicopter|storm|fire|insect|tape",
                    "min_len": 0.6, "max_len": 3.0, "shape": "swell", "prefer": r"transition|wind|air|cinematic"},
    "pop": {"cats": ["pop"], "title": r"\bpops?\b", "ban": r"silly|electric|blood|cluster", "min_len": 0.0,
            "max_len": 0.6, "shape": "transient", "prefer": r"dry|light|long|explainer"},
    "click": {"cats": ["click", "interface"], "title": r"click|select|check|button",
              "ban": r"camera|sci|typewriter|pop|negative|double|mechanical|pen|hard", "min_len": 0.0, "max_len": 0.3,
              "shape": "transient", "prefer": r"interface|select|modern|classic"},
    "tap": {"cats": ["tap", "click", "interface", "phone"], "title": r"\btap|touch|select|option",
            "ban": r"tape|tribal|negative|gear|magnet", "min_len": 0.0, "max_len": 0.3, "shape": "transient",
            "prefer": r"tap|touch|select"},
    "hit": {"cats": ["hit", "impact", "boom", "thud", "bass"], "title": r"\bhit\b|impact|boom|thud|bass",
            "ban": r"karate|whoosh|swoosh|metal|air in|blow|stomp|glass|body|cutting|knocking|epic|sand|wood|exciting",
            "min_len": 0.3, "max_len": 3.0, "shape": "transient", "prefer": r"bass|deep|drum|cinematic"},
    "type": {"cats": ["keyboard", "type", "typewriter"], "title": r"typing|keyboard", "ban": r"typewriter|bell",
             "min_len": 4.0, "max_len": 60.0, "shape": "span", "prefer": r"laptop|phone|smartphone"},
    "swipe": {"cats": ["slide", "swish", "interface", "transition"], "title": r"swipe|slide",
              "ban": r"cabinet|door|warp|stone|blood|glass plate", "min_len": 0.1, "max_len": 0.8, "shape": "swell",
              "prefer": r"swipe|paper|fast"},
    "send": {"cats": ["notification", "interface", "correct", "pop"], "title": r"message|pop up|positive|sent|send|start",
             "ban": r"beep|negative", "min_len": 0.0, "max_len": 1.0, "shape": "any", "prefer": r"message|pop up|sent"},
    "notify": {"cats": ["notification", "ding", "alerts"], "title": r"notification|\bding|alert|chime",
               "ban": r"whoosh|swoosh|transition|typewriter|alarm|harp|guitar|happy", "min_len": 0.2, "max_len": 1.6,
               "shape": "any", "prefer": r"single|bell|positive|page"},
    "riser": {"cats": ["swell", "transition", "cinematic"], "title": r"riser|swell|\brise|sweep",
              "ban": r"helicopter|heavenly|choir|glitch|angelic|static", "min_len": 1.0, "max_len": 8.0,
              "shape": "rise", "prefer": r"riser|trailer|electronic"},
    "scribble": {"cats": ["write", "paper", "page"], "title": r"writ|pencil|\bpen\b|marker|scribble",
                 "ban": r"clicking|stone|blackboard|chalk|signing|typewriter|keyboard|laptop", "min_len": 0.2,
                 "max_len": 3.0, "shape": "any", "prefer": r"marker|scribble|pen\b"},
}


def fetch_url(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def parse_category(page):
    """Each sound card on a Mixkit category page: {id, title, dur (whole seconds as shown, or None)}."""
    items = []
    for blk in page.split('class="item-grid__item"')[1:]:
        m = re.search(r'item-id-value="(\d+)"', blk)
        t = re.search(r'item-grid-card__title">\s*([^<]+?)\s*<', blk)
        if not (m and t):
            continue
        d = re.search(r">\s*(\d+):(\d\d)\s*<", blk)
        items.append({"id": m.group(1), "title": htmlmod.unescape(t.group(1)),
                      "dur": int(d.group(1)) * 60 + int(d.group(2)) if d else None})
    return items


def wave_metrics(w):
    """Shape of a sound from Mixkit's waveform JSON (audiowaveform: min/max pairs per pixel)."""
    d, px = w["data"], w["samples_per_pixel"] / w["sample_rate"]
    env = [max(abs(d[2 * k]), abs(d[2 * k + 1])) / 127 for k in range(len(d) // 2)]
    if not env or max(env) <= 0:
        return {"len_s": len(env) * px, "onset_s": 0.0, "peak_s": 0.0, "attack_s": 0.0, "body_s": 0.0, "level": 0.0}
    top = max(env)
    sm = [sum(env[max(0, k - 2):k + 3]) / len(env[max(0, k - 2):k + 3]) for k in range(len(env))]
    on = next(k for k, v in enumerate(env) if v > 0.1 * top)
    p = sm.index(max(sm))
    end = max(k for k, v in enumerate(env) if v > 0.05 * top)
    r = lambda x: round(x, 3)
    return {"len_s": r(len(env) * px), "onset_s": r(on * px), "peak_s": r(p * px), "attack_s": r((p - on) * px),
            "body_s": r((end - on) * px), "level": r(top)}


def wave_env(w, n=60):
    """A small envelope (n points, 0-1) to draw the waveform on the listen page."""
    d = w["data"]
    env = [max(abs(d[2 * k]), abs(d[2 * k + 1])) / 127 for k in range(len(d) // 2)] or [0.0]
    L = len(env)
    return [round(max(env[int(i * L / n):max(int(i * L / n) + 1, int((i + 1) * L / n))]), 3) for i in range(n)]


def score(role, item, m):
    """How well a sound fits a role (higher is better), or None when it doesn't fit at all."""
    R = ROLES[role]
    title = item.get("title", "")
    if BAN.search(title) or (R.get("ban") and re.search(R["ban"], title, re.I)):
        return None
    body = m.get("body_s", 0)
    if not R["min_len"] <= body <= R["max_len"]:
        return None
    rel = (m["peak_s"] - m["onset_s"]) / body if body > 0 else 0.0
    shape = R["shape"]
    if shape == "transient":
        if m["attack_s"] > 0.04:
            return None
        fit = 1 - m["attack_s"] / 0.04
    elif shape == "swell":
        if not 0.2 <= rel <= 0.8:
            return None
        fit = 1 - abs(rel - 0.5) / 0.3
    elif shape == "rise":
        if rel < 0.65:
            return None
        fit = rel
    else:
        fit = 0.5
    return round(1.0 + fit + (0.5 if R.get("prefer") and re.search(R["prefer"], title, re.I) else 0), 3)


def search(roles, per_role=3, get=fetch_url, kit=None, pause=0.5, more=False):
    """Short-list per_role Mixkit sounds for each role. Reads only the category pages those roles need, plus each
    candidate's small waveform file; no audio is downloaded. Updates <kit>/candidates.json for those roles only (other
    roles keep their letters). more=True keeps a role's current candidates and adds the next per_role (new letters)."""
    kit = kit or reel_paths.kit_dir(create=True)
    if not kit:
        sys.exit("No Reels workspace yet: run workspace.py first.")
    existing = load_candidates(kit)
    pages, waves, out = {}, {}, {}

    def page(cat):
        if cat not in pages:
            try:
                pages[cat] = parse_category(get(CAT_URL.format(cat)))
                if not pages[cat]:
                    print(f"couldn't read Mixkit's {cat} page: no sounds found on it (the page may have changed)")
            except Exception as e:  # noqa: BLE001 (network, HTTP, anything: carry on with the other pages)
                print(f"couldn't read Mixkit's {cat} page: {e}")
                pages[cat] = []
            time.sleep(pause)
        return pages[cat]

    def wave(i):
        if i not in waves:
            try:
                w = json.loads(get(ASSET.format(id=i, kind="waveform.json")))
                waves[i] = {**wave_metrics(w), "wave": wave_env(w)}
            except Exception as e:  # noqa: BLE001
                print(f"couldn't read the waveform of Mixkit sound {i}: {e}")
                waves[i] = None
            time.sleep(pause * 0.6)
        return waves[i]

    for role in roles:
        R, found = ROLES[role], []
        have = existing.get(role, []) if more else []
        seen = {c["id"] for c in have}
        for cat in R["cats"]:
            for it in page(cat):
                if it["id"] in seen or not re.search(R["title"], it["title"], re.I):
                    continue
                seen.add(it["id"])
                if it["dur"] is not None and it["dur"] > R["max_len"] + 2:
                    continue
                if BAN.search(it["title"]) or (R.get("ban") and re.search(R["ban"], it["title"], re.I)):
                    continue
                if len(seen) > 40 + len(have):
                    break
                m = wave(it["id"])
                s = score(role, it, m) if m else None
                if s is not None:
                    m = dict(m)
                    found.append({**it, "role": role, "wave": m.pop("wave", None), "metrics": m, "score": s, "page_url": CAT_URL.format(cat),
                                  "preview": ASSET.format(id=it["id"], kind="preview.mp3")})
        found.sort(key=lambda c: -c["score"])
        out[role] = have + [{**c, "letter": chr(65 + len(have) + k)} for k, c in enumerate(found[:per_role])]
        if len(out[role]) == len(have):
            print(f"no {'more ' if have else ''}Mixkit sound fits {role}: try the Freesound backup (CC0 only) or a file of your own")
    json.dump({**existing, **out}, open(os.path.join(kit, "candidates.json"), "w"), indent=1)
    return out


SR = 48000
MIXKIT_LICENCE = "Mixkit Sound Effects Free License"
EPIDEMIC_LICENCE = "Epidemic Sound (needs an active subscription on the day you post)"


def decode(path):
    """Any audio file -> mono float32 at 48 kHz."""
    import numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32)


def measure_file(path):
    """Where a sound starts (10 % of its peak level), where its loudest moment is, its length, and its level (RMS of
    the body: from the onset to the last moment above -40 dB of the peak). 5 ms level blocks."""
    import numpy as np
    x = decode(path)
    blk = int(SR * 0.005)
    n = max(1, len(x) // blk)
    env = np.sqrt(np.mean(np.square(x[:n * blk].reshape(n, blk)), axis=1)) if len(x) >= blk else np.array([0.0])
    top = float(env.max())
    if top <= 0:
        return {"onset_s": 0.0, "peak_s": 0.0, "length_s": round(len(x) / SR, 3), "body_db": -120.0}
    on = int(np.argmax(env > 0.1 * top))
    pk = int(np.argmax(env))
    end = int(np.nonzero(env > top * 0.01)[0][-1]) + 1
    body = x[on * blk:end * blk]
    import sound_design
    return {"st_db": round(sound_design.st_db(x), 2), "onset_s": round(on * blk / SR, 4), "peak_s": round((pk + 0.5) * blk / SR, 4), "length_s": round(len(x) / SR, 3),
            "body_db": round(float(20 * np.log10(np.sqrt(np.mean(np.square(body))) + 1e-12)), 2)}


def slug(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "sound"


def head_size(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA, method="HEAD"), timeout=20) as r:
        return int(r.headers.get("Content-Length") or 0)


def get_bytes(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def load_candidates(kit=None):
    kit = kit or reel_paths.kit_dir()
    p = os.path.join(kit, "candidates.json") if kit else None
    return json.load(open(p)) if p and os.path.exists(p) else {}


def is_sound_id(i):
    """A Mixkit sound id is a number; anything else would end up in a file path, so it is never used."""
    return isinstance(i, str) and re.fullmatch(r"[0-9]{1,9}", i) is not None


def valid_picks(picks):
    """Picks from the listen page: {role: [sound id, ...]} with known roles and numeric ids, or None."""
    if not isinstance(picks, dict):
        return None
    for role, ids in picks.items():
        if role not in ROLES or not isinstance(ids, list) or not all(is_sound_id(i) for i in ids):
            return None
    return picks


def fetch(ids, yes, head=head_size, dest=None, get=get_bytes, candidates=None):
    """Without yes: list each file (name, source, size) for the creator's OK and download nothing. With yes: download the
    full-quality WAV (the file Mixkit's Download button gives), or the preview MP3 when the WAV isn't reachable, into
    <workspace>/03_Library/sfx/mixkit/ (the creator's originals). Returns the paths."""
    if dest is None:
        lib = reel_paths.library("sfx") or sys.exit("No 03_Library/sfx in the workspace: run workspace.py first.")
        dest = os.path.join(lib, "mixkit")
    titles = {c["id"]: c["title"] for cs in (candidates if candidates is not None else load_candidates()).values() for c in cs}
    plan, total = [], 0
    for i in dict.fromkeys(ids):
        if not is_sound_id(i):
            print(f"  {i!r}: not a Mixkit sound id, skipped")
            continue
        name = f"{i}-{slug(titles.get(i, 'sound'))}"
        url, ext, size = ASSET.format(id=i, kind="").rstrip("-") + ".wav", "wav", 0
        try:
            size = head(url)
        except Exception:  # noqa: BLE001 (no WAV: take the preview)
            url, ext = ASSET.format(id=i, kind="preview.mp3"), "mp3"
            try:
                size = head(url)
            except Exception as e:  # noqa: BLE001
                print(f"  {i}: not reachable ({e}), skipped")
                continue
        plan.append((i, url, os.path.join(dest, f"{name}.{ext}"), size))
        total += size
    if not yes:
        for i, url, path, size in plan:
            print(f"  {os.path.basename(path)}  {size / 1e6:.2f} MB  from {url}")
        print(f"{len(plan)} files, {total / 1e6:.1f} MB from Mixkit (free licence; nothing downloaded yet: OK to download?)")
        return [p for _, _, p, _ in plan]
    os.makedirs(dest, exist_ok=True)
    for i, url, path, size in plan:
        if os.path.exists(path):
            continue
        data = get(url)
        open(path + ".part", "wb").write(data)
        os.replace(path + ".part", path)
        print(f"  downloaded {os.path.basename(path)} ({len(data) / 1e6:.2f} MB)")
        time.sleep(0.3)
    return [p for _, _, p, _ in plan]


ALIASES = {"whoosh-short": [r"short whoosh(?:es)?", r"whoosh[- ]short"], "whoosh-long": [r"long whoosh(?:es)?", r"whoosh[- ]long"],
           "type": [r"typing", r"types?"], "notify": [r"notifications?", r"notif(?:y|ies)"], "pop": [r"pops?"],
           "click": [r"clicks?"], "tap": [r"taps?"], "hit": [r"hits?"], "swipe": [r"swipes?"], "send": [r"sends?"],
           "riser": [r"risers?"], "scribble": [r"scribbles?", r"drawing"]}


def _role_of(c):
    return next((r for r, pats in ALIASES.items() for p in pats if re.search(rf"\b{p}\b", c)), None)


def parse_picks(text, candidates):
    """"pop B, long whoosh A C and no hits" -> {"pop": [id], "whoosh-long": [id, id], "hit": []}. "all the pops" keeps
    every pop. A role named with no letter, or a plain "whoosh" when both whooshes are on the sheet, asks instead."""
    parts = []
    for clause in re.split(r"[,;\n]+", text):
        bits = re.split(r"\band\b", clause)
        cur = bits[0]
        for nxt in bits[1:]:   # "pop B and hit A" is two answers; "pop A and C" is one
            if _role_of(nxt.lower()) or re.search(r"\bwhoosh", nxt.lower()):
                parts.append(cur)
                cur = nxt
            else:
                cur += " and " + nxt
        parts.append(cur)
    out = {}
    for part in parts:
        c = part.strip().lower()
        if not c:
            continue
        role = _role_of(c)
        if role is None and re.search(r"\bwhoosh", c):
            sys.exit(f'"{part.strip()}": say short whoosh or long whoosh')
        if role is None:
            sys.exit(f'"{part.strip()}": which sound is that? ({", ".join(ROLES)})')
        ids = [x["id"] for x in candidates.get(role, [])]
        if re.search(r"\b(no|none)\b", c):
            out[role] = []
            continue
        if re.search(r"\ball\b", c):
            out[role] = ids
            continue
        rest = c
        for p in ALIASES[role]:
            rest = re.sub(rf"\b{p}\b", " ", rest)
        letters = [m.upper() for m in re.findall(r"\b([a-z])\b", rest)]
        by_letter = {x["letter"]: x["id"] for x in candidates.get(role, [])}
        if not letters:
            sys.exit(f'"{part.strip()}": which {role} (say the letters, e.g. "{role} A C"), "all", or "no {role}"?')
        bad = [L for L in letters if L not in by_letter]
        if bad:
            sys.exit(f'"{part.strip()}": {role} has no option {", ".join(bad)} (it has {", ".join(by_letter) or "none"})')
        out[role] = [by_letter[L] for L in letters]
    return out


def _kit_file(src, out_path):
    """A kit copy: from 5 ms before the onset, 5 ms fade-in, mono 48 kHz 24-bit. The original stays untouched."""
    on = measure_file(src)["onset_s"]
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0.0, on - 0.005):.4f}", "-i", src, "-ac", "1", "-ar", str(SR),
                    "-af", "afade=t=in:d=0.005", "-c:a", "pcm_s24le", out_path], check=True)
    return {"file": out_path, **measure_file(out_path)}


def _save_kit(kit, k):
    os.makedirs(kit, exist_ok=True)
    json.dump(k, open(os.path.join(kit, "kit.json"), "w"), indent=1)
    return k


def _load_kit_json(kit):
    p = os.path.join(kit, "kit.json")
    return json.load(open(p)) if os.path.exists(p) else {"roles": {}}


def build_kit(picks, kit=None, originals=None, candidates=None):
    """The creator's picks -> kit/<role>/<id>-<slug>.wav + kit.json (a picked role replaces that role's sounds)."""
    kit = kit or reel_paths.kit_dir(create=True)
    candidates = candidates if candidates is not None else load_candidates(kit)
    if originals is None:
        lib = reel_paths.library("sfx")
        d = os.path.join(lib, "mixkit") if lib else None
        originals = {f.split("-")[0]: os.path.join(d, f) for f in sorted(os.listdir(d))} if d and os.path.isdir(d) else {}
    info = {c["id"]: c for cs in candidates.values() for c in cs}
    k = _load_kit_json(kit)
    for role, ids in picks.items():
        if role not in ROLES:
            sys.exit(f"{role!r} isn't a sound kit role ({', '.join(ROLES)})")
        entries = []
        for i in ids:
            if not is_sound_id(i):
                sys.exit(f"{role}: {i!r} isn't a Mixkit sound id")
            if i not in originals:
                sys.exit(f"{role}: sound {i} isn't downloaded yet (run fetch first)")
            c = info.get(i, {})
            e = _kit_file(originals[i], os.path.join(kit, role, f"{i}-{slug(c.get('title', 'sound'))}.wav"))
            entries.append({**e, "id": i, "title": c.get("title", ""), "source_url": c.get("page_url", ""),
                            "licence": MIXKIT_LICENCE, "downloaded": time.strftime("%Y-%m-%d")})
        k["roles"][role] = entries
    return _save_kit(kit, k)


def add(file, role, source_url, licence, kit=None):
    """A sound the creator downloaded themselves (Epidemic, or the Freesound backup: CC0 only) -> the kit."""
    if role not in ROLES:
        sys.exit(f"unknown role {role} (roles: {' '.join(ROLES)})")
    if "freesound.org" in source_url and licence.strip().upper().replace(" ", "") not in ("CC0", "CC01.0"):
        sys.exit(f"Freesound sounds must be CC0 (no credit, no limits); this one is {licence}")
    if "epidemicsound" in source_url or "epidemic" in licence.lower():
        licence = EPIDEMIC_LICENCE
    kit = kit or reel_paths.kit_dir(create=True)
    name = slug(os.path.splitext(os.path.basename(file))[0])
    e = {**_kit_file(file, os.path.join(kit, role, f"{name}.wav")), "id": name, "title": os.path.basename(file),
         "source_url": source_url, "licence": licence, "downloaded": time.strftime("%Y-%m-%d")}
    k = _load_kit_json(kit)
    k["roles"].setdefault(role, []).append(e)
    _save_kit(kit, k)
    return e


def thin_roles(k, roles):
    """Roles that are on but have a single sound: it would play every time (keep 2-4 per role)."""
    return [r for r in roles if len(k["roles"].get(r, [])) == 1]


def roles_on():
    """The roles the creator's style turns on (my-style style.json audio.sfx_roles), else every role."""
    ws = reel_paths.workspace()
    try:
        return json.load(open(os.path.join(ws, "01_Styles", "my-style", "style.json")))["audio"]["sfx_roles"]
    except (OSError, ValueError, KeyError, TypeError):
        return list(ROLES)


def status(kit=None):
    kit = kit or reel_paths.kit_dir()
    k = _load_kit_json(kit) if kit else {"roles": {}}
    for role in ROLES:
        n = len(k["roles"].get(role, []))
        print(f"  {role:13} {n} sound{'s' * (n != 1)}")
    missing = [r for r in roles_on() if not k["roles"].get(r)]
    if missing:
        print(f"your style uses these but the kit has none yet: {', '.join(missing)} (sound_kit.py search --roles {','.join(missing)})")
    thin = thin_roles(k, roles_on())
    if thin:
        print(f"only one sound for {', '.join(thin)}: it will play every time; keep a second (e.g. pick \"{thin[0]} A C\")")
    if any(e["licence"] == EPIDEMIC_LICENCE for es in k["roles"].values() for e in es):
        print("reminder: Epidemic sounds need an active subscription on the day you post")


ROLE_NAMES = {"whoosh-short": "Short whoosh", "whoosh-long": "Long whoosh", "pop": "Pop", "click": "Click", "tap": "Tap",
              "hit": "Hit", "type": "Typing", "swipe": "Swipe", "send": "Send", "notify": "Notification", "riser": "Riser",
              "scribble": "Scribble"}


def sheet_plan(cues, candidates, end, before=0.6, after=0.9):
    """One clip per candidate, role by role: the role's first moment in the edit (from 0.6 s before to 0.9 s after),
    or a 1.5 s clip from the middle when the edit has no such moment. A sound that builds to its peak (whooshes,
    swipes, risers) starts its clip early enough to hear the build (up to its last 4 s). Tightens to +-0.5 s past
    about a minute."""
    import sound_design
    first = {}
    for c in sorted(cues, key=lambda c: c["t"]):
        first.setdefault(c["role"], c)
    n = sum(len(candidates.get(r, [])) for r in ROLES)
    if n * (before + after) > 60:
        before = after = 0.5
    out = []
    for role in ROLES:
        c = first.get(role)
        if c:
            t, dur = c["t"], c.get("dur")
        else:
            t, dur = max(0.0, end / 2 - (before + after) / 2) + before, None
        for cand in candidates.get(role, []):
            lead = before
            m = cand.get("metrics") or {}
            if role in sound_design.PEAK_ALIGNED and "peak_s" in m:
                lead = min(4.0, max(before, m["peak_s"] - m.get("onset_s", 0.0) + 0.1))
            a, b = max(0.0, t - lead), min(end, t + after)
            out.append({"role": role, "letter": cand["letter"], "id": cand["id"], "title": cand.get("title", ""),
                        "clip_start": round(a, 3), "clip_end": round(b, 3), "cue_t": round(t, 3), "dur": dur})
    return out


def fade_edges(x, ms=8):
    """A short fade at both ends of a clip's sound, so the sheet never clicks between clips."""
    import numpy as np
    x = np.array(x, dtype=np.float32, copy=True)
    n = min(len(x) // 2, int(SR * ms / 1000))
    if n:
        ramp = np.linspace(0, 1, n, dtype=np.float32)
        x[:n] *= ramp
        x[-n:] *= ramp[::-1]
    return x


def _label(path, role, letter, title):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72, index=1)
    small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 34)
    d.rounded_rectangle((40, 40, 1040, 230), radius=36, fill=(0, 0, 0, 200))
    d.text((80, 62), f"{ROLE_NAMES[role]} · {letter}", font=big, fill=(255, 255, 255, 255))
    d.text((82, 165), title[:52], font=small, fill=(200, 200, 200, 255))
    im.save(path)


def sheet(project, candidates=None, originals=None, out=None):
    """The sound sheet: every candidate played on the creator's own footage at a moment that fits its role, labelled
    "<Role> · <letter>", so they pick by ear in context. Needs the edit rendered (render.mjs all) and its cues
    (render.mjs cues). Writes <project>/out/sound-sheet.mp4 (light: 1080 wide, crf 26)."""
    import shutil
    import numpy as np
    from scipy.io import wavfile
    import sound_design
    P = os.path.abspath(project)
    meta = json.load(open(os.path.join(P, "project.json")))
    fps, end = meta["fps"], meta["nframes"] / meta["fps"]
    cues = json.load(open(os.path.join(P, "out", "cues.json")))["cues"]
    candidates = candidates if candidates is not None else load_candidates()
    if originals is None:
        lib = reel_paths.library("sfx")
        d = os.path.join(lib, "mixkit") if lib else None
        originals = {f.split("-")[0]: os.path.join(d, f) for f in sorted(os.listdir(d))} if d and os.path.isdir(d) else {}
    A = json.load(open(os.path.join(P, "style.json"))).get("audio", {})
    gain = A.get("voice_gain", 2.0)
    voice = decode(meta["link"])
    words = json.load(open(os.path.join(P, "data", "words.json")))
    speech_ref = sound_design.speech_ref_db(voice, [(w["s"], w["e"]) for w in words])
    inten = A.get("sfx_intensity", "balanced")   # the same level the track will use
    tmp = os.path.join(P, "out", "sheet")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    segs, prev_role, missing = [], None, []
    for k, s in enumerate(sheet_plan(cues, candidates, end)):
        f = originals.get(s["id"])
        if not f:
            missing.append(f"{s['role']} {s['letter']}")
            continue
        if prev_role and s["role"] != prev_role:   # 0.15 s of black between roles
            gap = os.path.join(tmp, f"{k:03d}gap.mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=black:s=1080x1920:r={fps}:d=0.15",
                            "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", "0.15", "-c:v", "libx264", "-crf", "26",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", gap], check=True)
            segs.append(gap)
        prev_role = s["role"]
        a, b = s["clip_start"], s["clip_end"]
        x = voice[int(a * SR):int(b * SR)].astype(np.float32) * gain
        m = measure_file(f)
        snd = decode(f)
        hit = m["peak_s"] if s["role"] in sound_design.PEAK_ALIGNED else m["onset_s"]
        if s["role"] in sound_design.SPAN:
            snd = snd[:int((hit + (s["dur"] or 1.0)) * SR)].copy()
            fl = min(len(snd), int(0.03 * SR))
            if fl:
                snd[-fl:] *= np.linspace(1, 0, fl, dtype=np.float32)
        g = 10 ** (sound_design.gain_db(s["role"], m["st_db"], speech_ref, inten) / 20) * gain
        st = int(round((s["cue_t"] - hit - a) * SR))
        lo, hi = max(0, st), min(len(x), st + len(snd))
        if hi > lo:
            x[lo:hi] += snd[lo - st:hi - st] * np.float32(g)
        x = fade_edges(x)
        pk = float(np.abs(x).max()) if len(x) else 0.0
        if pk > 0.89:
            x *= np.float32(0.89 / pk)
        wav, png, mp4 = (os.path.join(tmp, f"{k:03d}.{e}") for e in ("wav", "png", "mp4"))
        wavfile.write(wav, SR, x)
        _label(png, s["role"], s["letter"], s["title"])
        f0, nf = int(round(a * fps)), max(1, int(round((b - a) * fps)))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-start_number", str(f0), "-i",
                        os.path.join(P, "render", "%05d.jpg"), "-i", png, "-i", wav, "-filter_complex",
                        "[0:v]scale=1080:1920[b];[b][1:v]overlay=0:0,format=yuv420p[v]", "-map", "[v]", "-map", "2:a",
                        "-frames:v", str(nf), "-t", f"{nf / fps:.3f}", "-c:v", "libx264", "-crf", "26", "-preset", "fast",
                        "-c:a", "aac", "-b:a", "160k", "-ar", str(SR), mp4], check=True)
        segs.append(mp4)
    if not segs:
        sys.exit("Nothing to play: no candidate is downloaded yet (fetch --yes first).")
    lst = os.path.join(tmp, "list.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
    out = out or os.path.join(P, "out", "sound-sheet.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart",
                    out], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
                               capture_output=True, text=True).stdout or 0)
    if missing:
        print(f"not on the sheet (not downloaded): {', '.join(missing)}")
    print(f"sound sheet: {len([s for s in segs if not s.endswith('gap.mp4')])} sounds, {dur:.0f} s, "
          f"{os.path.getsize(out) / 1e6:.1f} MB -> {out}")
    return out


def listen_html(candidates, accent="#d9fd0d"):
    """The listen page: one section per role, a card per sound (name, length, waveform, play), click to keep, save."""
    esc = htmlmod.escape
    secs = []
    for role in ROLES:
        cs = candidates.get(role) or []
        if not cs:
            continue
        cards = []
        for c in cs:
            w = c.get("wave") or [0.05] * 60
            bars = "".join(f'<rect x="{k * 3.6:.1f}" y="{20 - v * 19:.1f}" width="2.2" height="{max(0.8, v * 38):.1f}" rx="1"/>'
                           for k, v in enumerate(w))
            body = (c.get("metrics") or {}).get("body_s", 0)
            cards.append(f'<div class="card" data-role="{role}" data-id="{esc(c["id"])}" onclick="keep(this)">'
                         f'<button class="pb" onclick="play(event,\'{esc(c["preview"])}\')">&#9654;</button>'
                         f'<svg viewBox="0 0 216 40" preserveAspectRatio="none">{bars}</svg>'
                         f'<b>{esc(c["letter"])}. {esc(c["title"])}</b><small>{body:.1f} s</small></div>')
        secs.append(f'<h2>{ROLE_NAMES[role]}</h2><div class="grid">{"".join(cards)}</div>')
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your sound kit</title><style>
body{{margin:0;padding:24px 16px 120px;background:#141414;color:#eee;font:15px -apple-system,Helvetica,sans-serif}}
h1{{font-size:24px;margin:0 0 6px}} p{{margin:0 0 18px;opacity:.75}} h2{{font-size:17px;margin:26px 0 10px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}}
.card{{display:grid;grid-template-columns:40px 1fr;gap:6px 10px;align-items:center;padding:12px;border-radius:14px;
background:#222;border:2px solid transparent;cursor:pointer}} .card.kept{{border-color:{accent};background:#2a2a1c}}
.card svg{{width:100%;height:40px;fill:#bbb}} .card b{{grid-column:1/3;font-size:14px}} .card small{{grid-column:1/3;opacity:.6}}
.pb{{width:38px;height:38px;border-radius:50%;border:0;background:{accent};color:#111;font-size:14px;cursor:pointer}}
.pb.on{{background:#111;color:{accent}}}
#save{{position:fixed;left:16px;right:16px;bottom:16px;padding:16px;border:0;border-radius:14px;background:{accent};color:#111;
font-size:17px;font-weight:700;cursor:pointer}}
</style></head><body><h1>Your sound kit</h1><p>Press &#9654; to listen. Click a card to keep it (2-4 per sound). Then save.</p>
{"".join(secs)}<button id="save" onclick="save()">Save my picks</button><script>
let A=null,B=null;
function play(e,u){{e.stopPropagation();const b=e.currentTarget;if(A&&B===b){{A.pause();b.classList.remove('on');A=B=null;return}}
if(A){{A.pause();B.classList.remove('on')}}A=new Audio(u);B=b;b.classList.add('on');A.play();A.onended=()=>{{if(B)B.classList.remove('on');A=B=null}}}}
function ping(){{fetch('/ping'+location.search).catch(()=>{{}})}}
setInterval(ping,60000);
function keep(el){{el.classList.toggle('kept');ping()}}
async function save(){{const p={{}};document.querySelectorAll('.card.kept').forEach(c=>{{(p[c.dataset.role]=p[c.dataset.role]||[]).push(c.dataset.id)}});
const btn=document.getElementById('save');
try{{const r=await fetch('/picks'+location.search,{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(p)}});
btn.textContent=r.ok?'Saved. Tell Claude you are done.':'Could not save: try again'}}
catch(e){{btn.textContent='Could not save (the page closed): ask Claude to open it again'}}}}
</script></body></html>"""


class _ListenServer:
    def __init__(self, httpd, url, thread):
        self.httpd, self.url, self.thread, self.last = httpd, url, thread, time.time()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def start_listen_server(candidates, kit=None, port=0, open_browser=True, accent="#d9fd0d"):
    """Serve the listen page on this Mac only (127.0.0.1, a random key in the URL); POST /picks saves kit/picks.json."""
    import secrets
    import threading
    import webbrowser
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import parse_qs, urlparse
    kit = kit or reel_paths.kit_dir(create=True)
    key, page = secrets.token_hex(16), listen_html(candidates, accent).encode()
    holder = {}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _ok(self):
            u = urlparse(self.path)
            holder["srv"].last = time.time()
            return u, parse_qs(u.query).get("key", [""])[0] == key

        def _send(self, code, body=b"", ctype="text/plain"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            u, ok = self._ok()
            if not ok:
                return self._send(403, b"missing key")
            if u.path == "/ping":
                return self._send(200, b"ok")
            self._send(200, page, "text/html; charset=utf-8") if u.path == "/" else self._send(404)

        def do_POST(self):
            u, ok = self._ok()
            if not ok:
                return self._send(403, b"missing key")
            if u.path != "/picks":
                return self._send(404)
            n = int(self.headers.get("Content-Length") or 0)
            try:
                picks = valid_picks(json.loads(self.rfile.read(n) or b"{}")) if n <= 100_000 else None
            except ValueError:
                picks = None
            if picks is None:
                return self._send(400, b"picks must be {role: [sound id, ...]}")
            json.dump(picks, open(os.path.join(kit, "picks.json"), "w"), indent=1)
            self._send(200, b'{"saved": true}', "application/json")

    httpd = ThreadingHTTPServer(("127.0.0.1", port), H)
    url = f"http://127.0.0.1:{httpd.server_address[1]}/?key={key}"
    th = threading.Thread(target=httpd.serve_forever, daemon=True)
    th.start()
    holder["srv"] = srv = _ListenServer(httpd, url, th)
    if open_browser:
        webbrowser.open(url)
    return srv


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("--roles", default=",".join(ROLES))
    s.add_argument("--per-role", type=int, default=3)
    s.add_argument("--more", action="store_true", help="keep the current candidates and add the next ones (new letters)")
    f = sub.add_parser("fetch")
    f.add_argument("--picks", help="picks.json from the listen page (default: every candidate)")
    f.add_argument("--yes", action="store_true", help="download (only after the creator said OK to the list)")
    pk = sub.add_parser("pick")
    pk.add_argument("text", nargs="?", help='e.g. "pop B, long whoosh A C, no hits"')
    pk.add_argument("--picks", help="picks.json from the listen page instead of text")
    ad = sub.add_parser("add")
    ad.add_argument("file")
    ad.add_argument("--role", required=True)
    ad.add_argument("--source", required=True)
    ad.add_argument("--licence", required=True)
    sub.add_parser("status")
    sh = sub.add_parser("sheet")
    sh.add_argument("project")
    ls = sub.add_parser("listen")
    ls.add_argument("--port", type=int, default=0)
    ls.add_argument("--no-open", action="store_true")
    a = ap.parse_args()
    if a.cmd == "fetch":
        cands = load_candidates()
        picked = json.load(open(a.picks)) if a.picks else {r: [c["id"] for c in cs] for r, cs in cands.items()}
        fetch([i for ids in picked.values() for i in ids], a.yes, candidates=cands)
        return
    if a.cmd == "pick":
        picks = json.load(open(a.picks)) if a.picks else parse_picks(a.text or "", load_candidates())
        k = build_kit(picks)
        for role, es in k["roles"].items():
            print(f"  {role:13} " + ", ".join(e["title"] for e in es))
        thin = thin_roles(k, [r for r in picks if picks[r]])
        if thin:
            print(f"only one sound for {', '.join(thin)}: it will play every time; keep a second (e.g. pick \"{thin[0]} A C\")")
        print(f"kit -> {os.path.join(reel_paths.kit_dir(), 'kit.json')}")
        return
    if a.cmd == "add":
        e = add(a.file, a.role, a.source, a.licence)
        print(f"added {e['title']} as {a.role} ({e['licence']})")
        return
    if a.cmd == "status":
        status()
        return
    if a.cmd == "sheet":
        sheet(a.project)
        return
    if a.cmd == "listen":
        cands = load_candidates()
        if not cands:
            sys.exit("No candidates yet: run sound_kit.py search first.")
        srv = start_listen_server(cands, port=a.port, open_browser=not a.no_open)
        print(f"listen page: {srv.url}\npicks are saved to {os.path.join(reel_paths.kit_dir(), 'picks.json')}; "
              "it closes 10 minutes after the last click (Ctrl-C to close now)", flush=True)
        try:
            while time.time() - srv.last < 600:
                time.sleep(2)
        except KeyboardInterrupt:
            pass
        srv.stop()
        return
    if a.cmd == "search":
        roles = [r.strip() for r in a.roles.split(",") if r.strip()]
        bad = [r for r in roles if r not in ROLES]
        if bad:
            sys.exit(f"unknown role(s): {', '.join(bad)} (roles: {' '.join(ROLES)})")
        out = search(roles, a.per_role, more=a.more)
        for role, cands in out.items():
            print(f"\n{role}")
            for c in cands:
                print(f"  {c['letter']}. {c['title']} ({c['metrics']['body_s']:.1f} s)  {c['preview']}")
        print(f"\n{sum(len(c) for c in out.values())} candidates -> {os.path.join(reel_paths.kit_dir(), 'candidates.json')}")


if __name__ == "__main__":
    main()
