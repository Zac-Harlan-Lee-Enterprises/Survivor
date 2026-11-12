"""Motion blur for the fast frames of Death's dance (the frames are posed one
by one, so the renderer cannot blur them): death_scene.py renders, for each
fast frame, a handful of poses spread over a short shutter
(out/blur/NAME__K.png, plus the frame itself, NAME.png, the pose in the middle)
and a mask of his head and hat (out/blur/NAME.json). This averages the poses
(weighted by alpha, so the soft edges stay clean against the dark page),
lays the sharp head and hat back over the blur through the mask (a performer
spotting the house: his face is never smeared) and writes the result over
NAME.png. The sharp frame is kept in out/sharp/.

    python3 scripts/art/death_blur.py path/to/rendered/take
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter


def merge(path, sharp_path, subs, mask):
    base = Image.open(sharp_path).convert("RGBA")
    ims = [base] + [Image.open(p).convert("RGBA") for p in subs]
    box = None
    for im in ims:
        b = im.getchannel("A").point(lambda a: 255 if a > 0 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return
    bands = [[list(im.crop(box).getdata(c)) for c in range(4)] for im in ims]
    n = len(ims)
    w, h = box[2] - box[0], box[3] - box[1]
    r, g, b_, al = [], [], [], []
    for k in range(w * h):
        a = 0
        sr = sg = sb = 0
        for im in bands:
            ak = im[3][k]
            if ak:
                a += ak
                sr += im[0][k] * ak
                sg += im[1][k] * ak
                sb += im[2][k] * ak
        if a == 0:
            r.append(0)
            g.append(0)
            b_.append(0)
            al.append(0)
        else:
            r.append(round(sr / a))
            g.append(round(sg / a))
            b_.append(round(sb / a))
            al.append(round(a / n))
    chans = []
    for data in (r, g, b_, al):
        band = Image.new("L", (w, h))
        band.putdata(data)
        chans.append(band)
    patch = Image.merge("RGBA", chans)
    res = Image.new("RGBA", base.size, (0, 0, 0, 0))
    res.paste(patch, (box[0], box[1]))
    if mask:
        m = Image.new("L", base.size, 0)
        d = ImageDraw.Draw(m)
        for cx, cy, rad in mask:
            d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(4))
        res = Image.composite(base, res, m)
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
        mj = os.path.join(blur, name + ".json")
        mask = json.load(open(mj))["mask"] if os.path.exists(mj) else None
        merge(path, sharp, subs, mask)
    print("blurred", len(names), "frames")


if __name__ == "__main__":
    main(sys.argv[1])
