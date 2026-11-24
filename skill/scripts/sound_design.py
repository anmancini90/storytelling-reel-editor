"""The sound designer: turns the edit's sound cues (render.mjs <project> cues -> out/cues.json) and the creator's sound
kit (03_Library/sfx/kit) into a sound-effects track that sits under the voice.

The craft rules (tune by ear; the numbers live in the tables below):
- timing: pops, taps, clicks and hits land on the frame (their onset on the cue); whooshes, swipes and risers put their
  loudest point on the cue; typing and scribble start on the cue and last as long as the typing or the stroke
- variety: never the same file twice in a row for a role; a seeded touch of pitch (+-2.5 %) and level (+-1.5 dB)
- hierarchy: point cues closer than 0.25 s collapse to the most important one; at most one big sound (hit, long
  whoosh, riser) per few seconds (a long whoosh too close becomes a short one)
- levels: by short-term loudness (the loudest 50 ms), against the voice's syllable peaks (the median word's loudest
  50 ms), never above them. An average level would bury a 3 ms click under the voice while a whoosh stays loud. A sound
  on a word is not turned down: under a word, quieter means masked.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PRIORITY = {"hit": 6, "whoosh-long": 5, "riser": 5, "whoosh-short": 4, "swipe": 4, "send": 3, "notify": 3, "pop": 3,
            "tap": 2, "click": 2, "type": 1, "scribble": 1}
BIG = {"hit", "whoosh-long", "riser"}
SPAN = {"type", "scribble"}
PEAK_ALIGNED = {"whoosh-short", "whoosh-long", "swipe", "riser"}
ROLE_DB = {"pop": -5, "whoosh-short": -7, "whoosh-long": -3, "swipe": -7, "send": -6, "notify": -5, "riser": -5,
           "click": -6, "tap": -6, "hit": -1, "type": -11, "scribble": -8}   # loudest 50 ms vs the voice's syllable peaks
ST_WINDOW_S = 0.05
COLLAPSE_S = 0.25
INTENSITY = {"subtle": {"gap": 4.0, "db": -3.0}, "balanced": {"gap": 3.0, "db": -1.5}, "punchy": {"gap": 3.0, "db": 0.0}}


def st_db(x, sr=48000):
    """Short-term level: the loudest 50 ms of a sound (RMS, dBFS). A sound shorter than the window counts as that much
    of a window, the way the ear hears a very short click as quieter."""
    import numpy as np
    n = int(ST_WINDOW_S * sr)
    x = np.asarray(x, np.float64)
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    c = np.cumsum(np.concatenate([[0.0], x * x]))
    return float(10 * np.log10(max(float(((c[n:] - c[:-n]) / n).max()), 1e-12)))


def speech_ref_db(voice, spans, sr=48000):
    """The voice's syllable peaks: the median of each word's short-term level (words of 60 ms or more)."""
    import numpy as np
    lv = [st_db(voice[int(s * sr):int(e * sr)], sr) for s, e in spans if e - s >= 0.06]
    return float(np.median(lv)) if lv else st_db(voice, sr)


def gain_db(role, sound_st_db, speech_ref, intensity="balanced"):
    """The one level rule (the sound sheet and the track both use it): dB to apply to a sound file."""
    return speech_ref + ROLE_DB[role] + INTENSITY[intensity]["db"] - sound_st_db


def plan(cues, kit, speech, speech_db, roles_on, intensity="balanced", seed=0, end=None):
    """speech_db: the voice's syllable peaks (speech_ref_db). -> (placements, notes). A placement: {role, file, cue_t, start (where the file's first sample goes), dur (span
    roles: how long to play), gain_db, rate}. Notes explain anything skipped."""
    notes = []
    if not any(kit.get(r) for r in kit):
        return [], ["no sound kit yet: voice only. Build one: sound_kit.py search, then fetch, sheet and pick."]
    I = INTENSITY[intensity]
    cs = [c for c in cues if c["role"] in roles_on and c["role"] in PRIORITY]
    for r in sorted({c["role"] for c in cs if not kit.get(c["role"])}):
        notes.append(f"no kit sound for {r}: skipped; `sound_kit.py search --roles {r}` finds some")
    cs = [c for c in cs if kit.get(c["role"])]

    # hierarchy: first the big-sound gap (a big sound too soon after another is dropped, a long whoosh becomes a short
    # one), then collapse close point cues to the most important one, so a dropped big sound never silences what it
    # would have covered (spans don't block point sounds)
    spans = [c for c in cs if c["role"] in SPAN]
    gapped, last_big = [], None
    for c in sorted((c for c in cs if c["role"] not in SPAN), key=lambda c: c["t"]):
        if c["role"] in BIG:
            if last_big is not None and c["t"] - last_big < I["gap"]:
                if c["role"] == "whoosh-long" and kit.get("whoosh-short") and "whoosh-short" in roles_on:
                    c = {**c, "role": "whoosh-short"}
                else:
                    continue
            else:
                last_big = c["t"]
        gapped.append(c)
    points = []
    for c in sorted(gapped, key=lambda c: (-PRIORITY[c["role"]], c["t"])):
        if all(abs(c["t"] - k["t"]) >= COLLAPSE_S for k in points):
            points.append(c)

    rng, last, out = random.Random(seed), {}, []
    for c in sorted(points + spans, key=lambda c: (c["t"], c["role"])):
        role = c["role"]
        files = kit[role]
        choices = [k for k in files if k["file"] != last.get(role)] or files
        k = choices[rng.randrange(len(choices))]
        last[role] = k["file"]
        jitter, rate = rng.uniform(-1.5, 1.5), round(1 + rng.uniform(-0.025, 0.025), 5)
        if role in SPAN:
            rate = 1.0
        gain = gain_db(role, k["st_db"], speech_db, intensity) + jitter
        hit = k["peak_s"] if role in PEAK_ALIGNED else k["onset_s"]
        out.append({"role": role, "file": k["file"], "cue_t": c["t"], "start": c["t"] - hit / rate,
                    "dur": c.get("dur") if role in SPAN else None, "gain_db": gain, "rate": rate})
    return out, notes


def roles_from_style(audio):
    """The roles the style turns on: audio.sfx_roles (an empty list = sound effects off); every role when unset."""
    r = audio.get("sfx_roles")
    return list(PRIORITY) if r is None else list(r)


CHALK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx", "chalk-writing.wav")


def load_kit(kit_dir):
    """kit.json -> {role: [entry + role]}. With no scribble in the kit, the skill's own chalk recording (CC0) draws."""
    import json
    import sound_kit
    k = {}
    p = os.path.join(kit_dir, "kit.json") if kit_dir else None
    if p and os.path.exists(p):
        for role, es in json.load(open(p)).get("roles", {}).items():
            k[role] = [{**e, "role": role} for e in es if os.path.exists(e["file"])]
            for e in k[role]:
                if "st_db" not in e:   # a kit built before short-term levels
                    e["st_db"] = sound_kit.measure_file(e["file"])["st_db"]
    if not k.get("scribble") and os.path.exists(CHALK):
        k["scribble"] = [{"role": "scribble", "file": CHALK, "title": "Chalk writing (CC0)", **sound_kit.measure_file(CHALK)}]
    return k


def render_track(placements, end, out_wav, sr=48000):
    """Place every sound on a silent track as long as the video (sounds before 0 s or after the end are cut off).
    Returns the track's peak in dBFS."""
    import numpy as np
    from scipy.io import wavfile
    import sound_kit
    n, cache = int(round(end * sr)), {}
    track = np.zeros(n, np.float32)
    for p in placements:
        if p["file"] not in cache:
            cache[p["file"]] = sound_kit.decode(p["file"])
        x = cache[p["file"]]
        if p["rate"] != 1.0:   # a touch faster = a touch higher (and shorter)
            x = np.interp(np.arange(0, len(x) - 1, p["rate"]), np.arange(len(x)), x).astype(np.float32)
        if p["role"] in SPAN:  # play from the start of the sound until the typing / stroke ends, then a 30 ms fade
            m = int(round((p["cue_t"] + (p["dur"] or 1.0) - p["start"]) * sr))
            x = x[:max(0, m)].copy()
            f = min(len(x), int(0.03 * sr))
            if f:
                x[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
        x = x * np.float32(10 ** (p["gain_db"] / 20))
        s = int(round(p["start"] * sr))
        a, b = max(0, s), min(n, s + len(x))
        if b > a:
            track[a:b] += x[a - s:b - s]
    wavfile.write(out_wav, sr, track)
    peak = float(np.abs(track).max()) if n else 0.0
    return 20 * np.log10(peak) if peak > 0 else -120.0


def main():
    import argparse
    import json
    import numpy as np
    import reel_paths
    import sound_kit
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    meta = json.load(open(os.path.join(P, "project.json")))
    end = meta["nframes"] / meta["fps"]
    cp = os.path.join(P, "out", "cues.json")
    if not os.path.exists(cp):
        sys.exit(f"No sound cues yet: run node render.mjs {P} cues first.")
    cues = json.load(open(cp))["cues"]
    A = json.load(open(os.path.join(P, "style.json"))).get("audio", {})
    roles, inten = roles_from_style(A), A.get("sfx_intensity", "balanced")
    if not roles:
        print("sound effects are off in this style (audio.sfx_roles is empty): voice only")
    kd = reel_paths.kit_dir()
    if not kd or not os.path.exists(os.path.join(kd, "kit.json")):
        print("no sound kit yet: only drawings get a sound (the chalk). Build a kit: sound_kit.py search, fetch, sheet, pick.")
    kit = load_kit(kd)
    spans = [(w["s"], w["e"]) for w in json.load(open(os.path.join(P, "data", "words.json")))]
    x = sound_kit.decode(meta["link"])
    speech_db = speech_ref_db(x, spans)
    pl, notes = plan(cues, kit, spans, speech_db, roles, inten, a.seed, end)
    out = os.path.join(P, "out", "sfx.wav")
    peak = render_track(pl, end, out)
    titles = {e["file"]: e.get("title") or os.path.basename(e["file"]) for es in kit.values() for e in es}
    r = lambda v: None if v is None else round(v, 4)
    json.dump({"speech_db": round(speech_db, 2), "intensity": inten, "seed": a.seed, "notes": notes,
               "placements": [{**p, "title": titles.get(p["file"], ""), "start": r(p["start"]), "gain_db": round(p["gain_db"], 2),
                               "dur": r(p["dur"])} for p in pl]},
              open(os.path.join(P, "out", "sfx-plan.json"), "w"), indent=1)
    for p in pl:
        print(f"  {p['cue_t']:6.2f}s  {p['role']:12} {titles.get(p['file'], '')[:38]:38} {p['gain_db']:+6.1f} dB"
              + (f"  for {p['dur']:.2f}s" if p["dur"] else ""))
    for nline in notes:
        print("  note:", nline)
    print(f"{len(pl)} sounds of {len(cues)} cues (intensity {inten}, voice peaks {speech_db:.1f} dBFS, peak {peak:.1f} dBFS) -> {out}")


if __name__ == "__main__":
    main()
