"""Pack the trophy (trophy_scene.py's frame 0 and take.json) for the page:
the still, plaque square to the camera, cropped to the trophy and saved as
public/trophy/still.webp, and src/components/trophy.json saying its size and
where on it the plaque's blank name line is.

    python3 scripts/art/trophy_film.py path/to/rendered/take
"""
import argparse
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PAD = 2


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    args = p.parse_args()
    take = json.load(open(os.path.join(args.src, "take.json")))
    im = Image.open(os.path.join(args.src, "turn-000.png")).convert("RGBA")

    l, t, r, b = im.getchannel("A").point(lambda a: 255 if a > 2 else 0).getbbox()
    l, t = max(0, l - PAD), max(0, t - PAD)
    r, b = min(im.width, r + PAD), min(im.height, b + PAD)
    w, h = r - l, b - t

    out_dir = os.path.join(ROOT, "public", "trophy")
    os.makedirs(out_dir, exist_ok=True)
    still = os.path.join(out_dir, "still.webp")
    im.crop((l, t, r, b)).save(still, "WEBP", quality=90, method=6, alpha_quality=95)

    trophy = dict(src="trophy/still.webp", width=w, height=h)
    box = take.get("nameBox")
    if box:
        # The blank name line on the plaque, as fractions of the still.
        trophy["nameBox"] = dict(
            x=round((box["x"] - l) / w, 4),
            y=round((box["y"] - t) / h, 4),
            w=round(box["w"] / w, 4),
            h=round(box["h"] / h, 4),
        )
    with open(os.path.join(ROOT, "src", "components", "trophy.json"), "w") as f:
        json.dump(trophy, f, indent=2)
        f.write("\n")
    print(f"packed the still, {w}x{h}: still.webp {round(os.path.getsize(still) / 1024)} KB")


if __name__ == "__main__":
    main()
