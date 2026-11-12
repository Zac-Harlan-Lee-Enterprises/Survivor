"""Motion blur for the fast frames of Death's dance (the frames are posed one
by one, so the renderer cannot blur them): death_scene.py renders a few
poses a shutter's width apart for each (out/blur/NAME__K.png, plus the frame
itself, NAME.png, the pose in the middle); this averages them (alpha too,
weighted by alpha so the soft edges stay clean against the dark page) and
writes the result over NAME.png. The sharp frame is kept in out/sharp/.

    python3 scripts/art/death_blur.py path/to/rendered/take
"""
import os
import sys

from PIL import Image


def merge(path, subs):
    base = Image.open(path).convert("RGBA")
    ims = [base] + [Image.open(p).convert("RGBA") for p in subs]
    box = None
    for im in ims:
        b = im.getchannel("A").point(lambda a: 255 if a > 0 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return
    crops = [list(im.crop(box).getdata()) for im in ims]
    n = len(ims)
    out = []
    for px in zip(*crops):
        a = sum(p[3] for p in px)
        if a == 0:
            out.append((0, 0, 0, 0))
            continue
        out.append((round(sum(p[0] * p[3] for p in px) / a), round(sum(p[1] * p[3] for p in px) / a), round(sum(p[2] * p[3] for p in px) / a), round(a / n)))
    res = Image.new("RGBA", base.size, (0, 0, 0, 0))
    patch = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]))
    patch.putdata(out)
    res.paste(patch, (box[0], box[1]))
    res.save(path)


def main(src):
    blur = os.path.join(src, "blur")
    if not os.path.isdir(blur):
        return
    names = sorted({f.rsplit("__", 1)[0] for f in os.listdir(blur) if f.endswith(".png")})
    os.makedirs(os.path.join(src, "sharp"), exist_ok=True)
    for name in names:
        subs = sorted(os.path.join(blur, f) for f in os.listdir(blur) if f.startswith(name + "__"))
        path = os.path.join(src, name + ".png")
        sharp = os.path.join(src, "sharp", name + ".png")
        if os.path.exists(sharp):  # (already blurred: start from the sharp frame again)
            os.replace(sharp, path)
        Image.open(path).save(sharp)
        merge(path, subs)
    print("blurred", len(names), "frames")


if __name__ == "__main__":
    main(sys.argv[1])
