"""Cut a music track down to a scene's length, with fades, for the page.

    python3 scripts/cut-music.py IN.mp3 OUT.m4a --start 12.5 --length 22 [--fade-in 1.5] [--fade-out 3]

Uses only what ships with macOS (`afconvert`) and Python's standard library:
decodes to WAV, keeps [start, start + length), fades the ends, and encodes
AAC (128 kbit/s) in an .m4a, which every current browser plays.

The champion's scene (src/components/useConfetti.ts) plays
public/audio/crowning.m4a from the moment the light comes down. It is from
Pixabay, under the Pixabay Content License (docs/music.md).
"""
import argparse
import array
import os
import subprocess
import sys
import tempfile
import wave


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--length", type=float, required=True)
    ap.add_argument("--fade-in", type=float, default=0.8)
    ap.add_argument("--fade-out", type=float, default=2.5)
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        full = os.path.join(tmp, "full.wav")
        cut = os.path.join(tmp, "cut.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16", a.src, full], check=True)
        with wave.open(full) as w:
            ch, rate = w.getnchannels(), w.getframerate()
            w.setpos(min(w.getnframes(), int(a.start * rate)))
            pcm = array.array("h", w.readframes(int(a.length * rate)))
        if sys.byteorder == "big":
            pcm.byteswap()
        n = len(pcm) // ch
        fi, fo = int(a.fade_in * rate), int(a.fade_out * rate)
        for i in range(n):
            g = 1.0
            if i < fi:
                g = i / fi
            if i >= n - fo:
                g = min(g, (n - i) / fo)
            if g < 1.0:
                for c in range(ch):
                    pcm[i * ch + c] = int(pcm[i * ch + c] * g)
        if sys.byteorder == "big":
            pcm.byteswap()
        with wave.open(cut, "wb") as w:
            w.setnchannels(ch)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(pcm.tobytes())
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", cut, a.out], check=True)
    print("wrote", a.out, round(n / rate, 2), "s,", round(os.path.getsize(a.out) / 1024), "KB")


main()
