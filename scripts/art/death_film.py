"""Pack Death's rendered take (death_scene.py's PNGs and take.json) for the
page: each frame cropped to what is in it, sixteen to a sheet
(public/death/death-NN.webp), and src/components/deathFrames.json saying
where each frame is, where it sits in the full frame and how far he has come
(src/lib/deathFilm.ts reads it).

    python3 scripts/art/death_film.py path/to/rendered/take

Sixteen to a sheet keeps every image small: the page draws from one sheet at
a time and the browser can let the others go.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PER_SHEET = 16
COLS = 8
QUALITY = 80


def main(src):
    take = json.load(open(os.path.join(src, "take.json")))
    frames = take["frames"]
    out_dir = os.path.join(ROOT, "public", "death")
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.startswith("death") and f.endswith(".webp"):
            os.remove(os.path.join(out_dir, f))
    walk = [i for i, f in enumerate(frames) if f["name"].startswith("walk")]
    scene = [i for i, f in enumerate(frames) if f["name"].startswith("scene")]
    x_walk0 = frames[walk[0]]["x"]
    x_scene0 = frames[scene[0]]["x"]
    index = []
    sheets = []
    total = 0
    for s0 in range(0, len(frames), PER_SHEET):
        group = frames[s0 : s0 + PER_SHEET]
        crops = []
        for f in group:
            im = Image.open(os.path.join(src, f["name"] + ".png")).convert("RGBA")
            box = im.getchannel("A").point(lambda a: 255 if a > 2 else 0).getbbox() or (0, 0, 1, 1)
            l, t, r, b = max(0, box[0] - 1), max(0, box[1] - 1), min(im.width, box[2] + 1), min(im.height, box[3] + 1)
            crops.append((f, im.crop((l, t, r, b)), l, t))
        cw = max(c.width for _, c, _, _ in crops)
        ch = max(c.height for _, c, _, _ in crops)
        rows = (len(crops) + COLS - 1) // COLS
        sheet = Image.new("RGBA", (cw * min(COLS, len(crops)), ch * rows), (0, 0, 0, 0))
        n = len(sheets)
        for k, (f, c, l, t) in enumerate(crops):
            sx, sy = (k % COLS) * cw, (k // COLS) * ch
            sheet.alpha_composite(c, (sx, sy))
            x0 = x_walk0 if f["name"].startswith("walk") else x_scene0
            index.append(dict(s=n, sx=sx, sy=sy, w=c.width, h=c.height, dx=l, dy=t, x=round(f["x"] - x0, 2)))
        name = f"death-{n:02d}.webp"
        path = os.path.join(out_dir, name)
        sheet.save(path, "WEBP", quality=QUALITY, method=6, alpha_quality=90)
        total += os.path.getsize(path)
        sheets.append(f"death/{name}")
    json.dump(
        dict(
            fps=take["fps"],
            frameWidth=take["frameWidth"],
            frameHeight=take["frameHeight"],
            originX=take["originX"],
            originY=take["originY"],
            crownY=take["crownY"],
            stride=take["stride"],
            armClearance=take.get("armClearance"),
            sheets=sheets,
            frames=index,
            walk=walk,
            scene=scene,
        ),
        open(os.path.join(ROOT, "src", "components", "deathFrames.json"), "w"),
        separators=(",", ":"),
    )
    print("packed", len(frames), "frames into", len(sheets), "sheets,", round(total / 1024), "KB")


if __name__ == "__main__":
    main(sys.argv[1])
