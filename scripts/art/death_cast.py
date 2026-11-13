"""Who Death is, for BibleGame's figure engine (Blender + MakeHuman): his
casting, his resting mood, his colouring and his build, added at run time.
Imported by death_scene.py; nothing in BibleGame changes.

Fan art of Julian Richings's Death (Supernatural), cast by type rather than
traced from a photograph: a tall, spare man with a long, narrow skull, high
cheekbones over hollow cheeks, deep-set pale eyes under a low brow, a long
nose, a wide thin mouth, ears that stand out a little, a long neck, and
black hair slicked straight back from a high, receding hairline. No sun on
him in a thousand years; a still, unimpressed calm.
"""
import os
import sys

BIBLE = os.environ.get("BIBLEGAME", os.path.expanduser("~/Documents/BibleGame"))
ART = os.path.join(BIBLE, "tools", "art")
sys.path.insert(0, os.path.join(ART, "lib"))
sys.path.insert(0, ART)

import makehuman as mh  # noqa: E402
import portrait_hair  # noqa: E402
import portrait_face  # noqa: E402
import portrait_params  # noqa: E402

DEATH = "death"

# A suit and a long overcoat (death_dress.py cuts them), no headwear, and his
# cane in his hand (death_dress.cane, posed by death_motion.py).
APPEARANCE = {
    "skin": "#cdb8a8",
    "hair": "#0b0a0a",
    "robe": "#0c0d10",
    "accent": "#0c0d10",
    "headwear": "none",
    "headwearColor": "#0c0d10",
    "beard": False,
    "build": "adult",
    "carry": "none",
    "suit": True,
}

# Lips pressed shut, brows a shade down, lids a little heavy.
portrait_params.MOODS[DEATH] = dict(press=0.4, brow_inner=-0.24, lid_droop=0.16, mouth_down=0.0)
portrait_params.CASTING[DEATH] = dict(
    age=58,
    sex="m",
    mood=DEATH,
    sun=0.0,
    hair="crop",
    curl=0.0,
    recede=7.0,
    face="long",
    nose="bridge",
    eyes="deep",
    lips="thin",
)

# ── Colouring: pale grey-blue eyes, black hair, pale skin with no colour in it.
_params_for = portrait_params.params_for


def params_for(pid, appearance, player=False, chapter=""):
    p = _params_for(pid, appearance, player=player, chapter=chapter)
    if pid == DEATH:
        p.grey = 0.0
        p.iris, p.iris_kind = "#55636c", "blue"
        p.redness = 0.03
        p.oil = 0.25
        p.stubble = 0.0
        p.freckles = 0.0
        p.moles = []
        p.brow_thickness = 0.42
    return p


portrait_params.params_for = params_for

# ── Build: as thin as a man gets, the face drawn in over the bone.
_identity = portrait_face.identity


def identity(P):
    out = _identity(P)
    if P.id != DEATH:
        return out
    for k in [k for k in out if k.startswith("macrodetails/universal-")]:
        del out[k]
    looks = P.age + max(0.0, P.age - 26.0) * 0.3
    for k, v in mh.macro_weights(P.masc, looks, 0.22, 0.02, portrait_face.ancestry(P)).items():
        if k.startswith("macrodetails/universal-"):
            out[k] = v
    P.body_weight = 0.02

    def add(name, v):
        for k, w in mh.pair(name, v).items():
            out[k] = out.get(k, 0.0) + w

    for s in "lr":
        add(f"cheek/{s}-cheek-volume", -1.0)  # hollow cheeks
        add(f"cheek/{s}-cheek-bones", 0.85)  # the bone standing out above them
        add(f"cheek/{s}-cheek-inner", -0.55)
        add(f"eyes/{s}-eye-bag", 0.15)  # a long night behind the eyes
        add(f"ears/{s}-ear-scale", 0.3)  # ears that stand out a little
        add(f"ears/{s}-ear-wing", 0.45)
        add(f"ears/{s}-ear-lobe", 0.25)
    add("head/head-fat", -0.95)
    add("head/head-scale-horiz", -0.2)  # a narrow skull
    add("head/head-scale-vert", 0.15)  # and a long one
    add("forehead/forehead-scale-vert", 0.5)  # a high forehead
    add("forehead/forehead-temple", -0.85)  # hollow temples
    add("eyebrows/eyebrows-trans", -0.25)  # a low, heavy brow (down)
    add("nose/nose-scale-vert", 0.3)  # a long nose
    add("nose/nose-scale-horiz", -0.2)
    add("nose/nose-point-width", -0.3)
    add("mouth/mouth-scale-horiz", 0.12)  # a wide, thin mouth, shut
    add("mouth/mouth-upperlip-volume", -0.15)
    add("chin/chin-width", -0.25)
    add("chin/chin-prominent", 0.3)
    add("chin/chin-bones", 0.35)  # the jaw's angle shows
    add("neck/neck-scale-vert", 0.2)  # a long neck
    add("neck/neck-scale-horiz", -0.45)
    return out


portrait_face.identity = identity


# ── Hair: slicked back from a high, straight hairline (receded at the
# temples, but no widow's peak at the front).
_hairline = portrait_hair.hairline


def hairline(masc, child, recede=0.0):
    out = _hairline(masc, child, recede)
    if recede >= 7.0:
        out[0] = (0, out[0][1] + 5.0)
        out[1] = (25, out[1][1] + 1.5)
    return out


portrait_hair.hairline = hairline


# ── No nipples: the base mesh models them as small bumps on the chest, and a
# jacket cut from the body's surface inherits them (they showed through the
# cloth as two points on his chest). MakeHuman's data here has no nipple targets,
# so they are flattened on the mesh itself, before any garment is cut from it.
import math  # noqa: E402
import numpy as np  # noqa: E402
import world_body as wb  # noqa: E402

NIPPLE_R = (0.08, 0.12, 0.19)  # flatten inside, blend out to, fit the chest from the ring out to (m)


def nipples(body):
    """Where the two nipples are: the most prominent bumps (a vertex standing furthest
    out of its neighbours) on the front of the chest, one a side."""
    base = mh.Base.get()
    co = body.co
    J = body.J
    v = base.verts_of("body")
    nb = [set() for _ in range(len(co))]
    for q in base.quads[base.faces_of("body")]:
        for k in range(4):
            nb[q[k]].update((q[(k + 1) % 4], q[(k + 3) % 4]))
    out = []
    for sign in (-1, 1):
        best, at = 0.0, None
        for i in v:
            if sign * co[i, 0] < 0.03 or not (J["waist"][2] + 0.03 < co[i, 2] < J["chest"][2] + 0.02) or co[i, 1] > J["chest"][1] - 0.1:
                continue
            r = float(co[list(nb[i]), 1].mean() - co[i, 1])  # how far it stands out toward the front
            if r > best:
                best, at = r, i
        out.append((at, best))
    return out


def flatten_nipples(body):
    """Flatten the nipples where they are: the chest round each is fitted with a quadratic
    surface from the ring outside it, and the bump is brought down onto that surface (full
    inside, blended out), so no ribs or muscle shift. Returns the largest move (metres)."""
    base = mh.Base.get()
    co = body.co
    v = base.verts_of("body")
    r0, r1, r2 = NIPPLE_R
    move = 0.0
    for i, _ in nipples(body):
        c = co[i].copy()
        d = np.hypot(co[v, 0] - c[0], co[v, 2] - c[2])
        front = co[v, 1] < c[1] + 0.03
        ring = v[(d > r1) & (d < r2) & front]
        inner = v[(d < r1) & front]
        x, z = co[ring, 0] - c[0], co[ring, 2] - c[2]
        A = np.stack([np.ones_like(x), x, z, x * x, x * z, z * z], 1)
        coef, *_ = np.linalg.lstsq(A, co[ring, 1], rcond=None)
        for j in inner:
            x, z = co[j, 0] - c[0], co[j, 2] - c[2]
            fit = coef @ np.array([1.0, x, z, x * x, x * z, z * z])
            rr = math.hypot(x, z)
            w = 1.0 if rr < r0 else 0.5 * (1 + math.cos(math.pi * (rr - r0) / (r1 - r0)))
            if co[j, 1] < fit:  # only ever bring a bump back, never raise skin
                move = max(move, (fit - co[j, 1]) * w)
                co[j, 1] += (fit - co[j, 1]) * w
    return move


_body_init = wb.Body.__init__


NIPPLE_MOVE_MM = 0.0


def _body_init_flat(self, ident):
    global NIPPLE_MOVE_MM
    _body_init(self, ident)
    if ident.P.id == DEATH:
        NIPPLE_MOVE_MM = round(flatten_nipples(self) * 1000, 1)
        print("NIPPLES flattened: moved at most", NIPPLE_MOVE_MM, "mm", flush=True)


wb.Body.__init__ = _body_init_flat
