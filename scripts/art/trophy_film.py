"""Pack the trophy's turn (trophy_scene.py's PNGs and take.json) for the page:
every frame cropped to the same box, the smallest that holds the trophy at
every angle (so it never shifts as it turns), laid out in one grid sheet
(public/trophy/turn.webp), plus frame 0 alone with the plaque square to the
camera (public/trophy/still.webp) for anywhere it stands still, and
src/components/trophyFrames.json saying how to read the sheet.

    python3 scripts/art/trophy_film.py path/to/rendered/take [--cols 10]

One sheet, not several: the turn is short and loops, so the page wants every
frame at once.
"""
import argparse
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
QUALITY = 80
PAD = 2


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("--cols", type=int, default=10)
    args = p.parse_args()
    take = json.load(open(os.path.join(args.src, "take.json")))
    n = take["frames"]
    ims = [Image.open(os.path.join(args.src, f"turn-{i:03d}.png")).convert("RGBA") for i in range(n)]

    l, t, r, b = ims[0].width, ims[0].height, 0, 0
    for im in ims:
        box = im.getchannel("A").point(lambda a: 255 if a > 2 else 0).getbbox()
        if box:
            l, t, r, b = min(l, box[0]), min(t, box[1]), max(r, box[2]), max(b, box[3])
    l, t = max(0, l - PAD), max(0, t - PAD)
    r, b = min(ims[0].width, r + PAD), min(ims[0].height, b + PAD)
    fw, fh = r - l, b - t

    cols = min(args.cols, n)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.alpha_composite(im.crop((l, t, r, b)), ((i % cols) * fw, (i // cols) * fh))

    out_dir = os.path.join(ROOT, "public", "trophy")
    os.makedirs(out_dir, exist_ok=True)
    turn = os.path.join(out_dir, "turn.webp")
    still = os.path.join(out_dir, "still.webp")
    sheet.save(turn, "WEBP", quality=QUALITY, method=6, alpha_quality=90)
    ims[0].crop((l, t, r, b)).save(still, "WEBP", quality=90, method=6, alpha_quality=95)

    with open(os.path.join(ROOT, "src", "components", "trophyFrames.json"), "w") as f:
        json.dump(
            dict(sheet="trophy/turn.webp", frames=n, cols=cols, frameWidth=fw, frameHeight=fh, fps=take["fps"]),
            f,
            indent=2,
        )
        f.write("\n")
    print(
        f"packed {n} frames of {fw}x{fh} ({cols}x{rows}): turn.webp {round(os.path.getsize(turn) / 1024)} KB,"
        f" still.webp {round(os.path.getsize(still) / 1024)} KB"
    )


if __name__ == "__main__":
    main()
