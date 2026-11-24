"""Placeholder sound effects synthesized locally (no downloads, nothing licensed): typing, boom, tick roll, tap.
Usage: python make_sfx.py <out_dir> <typing_seconds> <count_seconds>
Ant's feedback (2026-10-19): synthesized pops and whooshes sounded "arcade-y" and "tin can-y", so they were removed;
prefer real recorded SFX the creator supplies, and use these only as stand-ins.
Each file starts with its hit at t=0 so mix_audio.py lines it up with the word. Relative levels are baked in."""
import sys, wave
import numpy as np

SR = 48000
out, type_s, count_s = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
rng = np.random.default_rng(7)
t_ = lambda d: np.arange(int(d * SR)) / SR
db = lambda x: 10 ** (x / 20)


def save(name, x, peak_db):
    x = x / (np.max(np.abs(x)) + 1e-9) * db(peak_db)
    x = np.concatenate([x, np.zeros(int(0.05 * SR))]).astype(np.float32)
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def lowpass(x, a):  # one-pole
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc); y[i] = acc
    return y




def click(d=0.012, bright=0.55):
    n = rng.standard_normal(int(d * SR))
    n = n - lowpass(n, 0.08)  # high-pass-ish: keep the snap
    n = lowpass(n, bright)
    return n * np.exp(-np.arange(len(n)) / SR * 420)


# typing: key clicks across the bio typing, first key strongest so the hit lands at t=0
x = np.zeros(int((type_s + 0.1) * SR)); pos = 0.0; k = 0
while pos < type_s:
    c = click() * (1.0 if k == 0 else rng.uniform(0.45, 0.8))
    i = int(pos * SR); x[i:i + len(c)] += c[:len(x) - i]
    pos += rng.uniform(0.055, 0.11) + (0.12 if rng.random() < 0.08 else 0); k += 1
save("typing", x, -13)

# boom on "the algorithm knows": low sine drop + saturation + a short transient (vine-boom-like, synthesized)
t = t_(1.3)
f = 48 + 40 * np.exp(-t * 9)
body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
body += 0.35 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.exp(-t * 4)
body = np.tanh(2.2 * body)
trans = np.concatenate([click(0.03, 0.3) * 0.6, np.zeros(len(t) - int(0.03 * SR))])
save("boom", body + trans, -1)

# follower count ticks: one tick each time the count passes another 100 (out-cubic, like the number on screen)
x = np.zeros(int((count_s + 0.1) * SR))
for m in range(0, 11):
    p = m / 10; s = (1 - (1 - p) ** (1 / 3)) * count_s  # inverse of out-cubic
    c = click(0.008, 0.7) * (1.0 if m == 0 else 0.75)
    i = int(s * SR); x[i:i + len(c)] += c[:len(x) - i]
save("ticks", x, -14)

# tap on Follow: a crisp click with a little body
t = t_(0.07)
tap = click(0.01, 0.6)
tap = np.concatenate([tap, np.zeros(len(t) - len(tap))]) + 0.5 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 70)
save("tap", tap, -8)
print("ok")
