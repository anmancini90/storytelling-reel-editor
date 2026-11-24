"""Clean audio joins for the story cut. Each kept piece borrows xfade seconds of the source on either side of its cut and
crossfades (equal power) with its neighbour, centred on the join. So the room tone runs straight through every cut: no
dip, no click. The total length stays exactly the sum of the pieces, so the picture timing doesn't change.

slots: where each piece's picture actually sits in the cut, [(start, length, source time of its first frame)]. Phone video is frame-quantised
(and often a variable 23.93 fps), so a piece's picture can run a frame longer than its audio; with slots, each piece's
sound fills exactly its picture's slot, starting from the moment its first frame shows, so lip sync holds in every
piece. Without slots, pieces sit back to back."""
import json
import subprocess


def join_audio(pieces, xfade=0.01, sr=48000, inp="0:a", out="a", slots=None):
    """pieces: [{"in": s, "out": s}, ...] in story order -> an ffmpeg filtergraph that ends in [out]."""
    n, parts, labels, t = len(pieces), [], [], 0.0
    for i, p in enumerate(pieces):
        start, d = slots[i][:2] if slots else (t, p["out"] - p["in"])
        a_in = slots[i][2] if slots and len(slots[i]) > 2 else p["in"]   # the source moment the piece's first frame shows
        pre = min(xfade, a_in) if i > 0 else 0.0               # borrowed before the cut (none before the first piece)
        post = xfade if i < n - 1 else 0.0                      # borrowed after the cut (none after the last piece)
        span = d + pre + post
        fin = f"afade=t=in:st=0:d={2 * pre:.4f}:curve=qsin" if pre else "afade=t=in:st=0:d=0.005"
        fout = (f"afade=t=out:st={span - 2 * post:.4f}:d={2 * post:.4f}:curve=qsin" if post
                else f"afade=t=out:st={max(0.0, span - 0.005):.4f}:d=0.005")
        delay = max(0, int(round((start - pre) * sr)))
        parts.append(f"[{inp}]atrim={a_in - pre:.4f}:{a_in + d + post:.4f},asetpts=PTS-STARTPTS,aresample={sr},apad,"
                     f"atrim=0:{span:.4f},{fin},{fout},adelay={delay}S:all=1[j{i}];")
        labels.append(f"[j{i}]")
        t = start + d
    return ("".join(parts) + "".join(labels)
            + f"amix=inputs={n}:normalize=0:duration=longest,atrim=0:{t:.4f},asetpts=PTS-STARTPTS[{out}]")


def video_pts(path):
    """Every video frame's time in a file (seconds, sorted)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "json",
                        path], capture_output=True, text=True, check=True)
    return sorted(float(p["pts_time"]) for p in json.loads(r.stdout)["packets"] if p.get("pts_time") not in (None, "N/A"))


def picture_slots(source, cut, pieces):
    """Where each piece's picture sits in the rendered cut: count the source frames each piece keeps (trim keeps
    start <= t < end), then read those frames' times in the cut. None when the counts don't add up (then keep the
    cut's own audio)."""
    src, outp = video_pts(source), video_pts(cut)
    counts = [sum(1 for t in src if p["in"] <= t < p["out"]) for p in pieces]
    if sum(counts) != len(outp) or not all(counts):
        return None
    starts, firsts, k = [], [], 0
    for p, c in zip(pieces, counts):
        starts.append(outp[k] - outp[0])
        firsts.append(next(t for t in src if t >= p["in"]))
        k += c
    end = outp[-1] - outp[0] + (outp[-1] - outp[-2] if len(outp) > 1 else 1 / 24)
    return [(s, (starts[i + 1] if i + 1 < len(starts) else end) - s, firsts[i]) for i, s in enumerate(starts)]
