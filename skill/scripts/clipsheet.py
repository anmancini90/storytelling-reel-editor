"""Contact sheets of a folder of raw clips, for picking montage shots: 4 frames per clip (10/35/60/85%), labelled
with the file name, duration and the frame times.

Usage: python clipsheet.py <folder> [out_dir]   -> out_dir/clips-01.jpg, clips-02.jpg ... (6 clips per sheet)
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

folder = os.path.abspath(sys.argv[1])
out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(folder, "_clipsheets")
os.makedirs(out, exist_ok=True)
clips = sorted(f for f in glob.glob(os.path.join(folder, "*")) if f.lower().endswith((".mp4", ".mov", ".m4v")))
# iCloud placeholders ("dataless") hang ffmpeg until downloaded: skip them and say which
cloud = [c for c in clips if getattr(os.stat(c), "st_flags", 0) & 0x40000000]
if cloud:
    print("Not downloaded (iCloud placeholder), skipped: " + ", ".join(os.path.basename(c) for c in cloud))
    print("  Download them in Finder (right-click > Download Now), then rerun.")
clips = [c for c in clips if c not in cloud]
TW, TH, PCT = 180, 320, (0.10, 0.35, 0.60, 0.85)
tmp = tempfile.mkdtemp()
rows = []
for c in clips:
    d = float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", c],
                                        capture_output=True, text=True).stdout)["format"]["duration"])
    ims = []
    for k, p in enumerate(PCT):
        f = os.path.join(tmp, f"f{k}.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{d * p:.2f}", "-i", c, "-frames:v", "1",
                        "-vf", f"scale={TW}:{TH}:force_original_aspect_ratio=increase,crop={TW}:{TH}", f], check=True)
        ims.append((Image.open(f).copy(), d * p))
    rows.append((os.path.basename(c), d, ims))
for s in range(0, len(rows), 6):
    chunk = rows[s:s + 6]
    sheet = Image.new("RGB", (4 * (TW + 4) + 4, len(chunk) * (TH + 30) + 4), (24, 24, 24))
    dr = ImageDraw.Draw(sheet)
    for r, (name, d, ims) in enumerate(chunk):
        y = 4 + r * (TH + 30)
        dr.text((6, y), f"{name}  ({d:.1f}s)", fill=(255, 230, 0))
        for k, (im, t) in enumerate(ims):
            x = 4 + k * (TW + 4)
            sheet.paste(im, (x, y + 16))
            dr.text((x + 4, y + 20), f"{t:.1f}s", fill=(255, 255, 255))
    p = os.path.join(out, f"clips-{s // 6 + 1:02d}.jpg")
    sheet.save(p, quality=85)
    print(p)
