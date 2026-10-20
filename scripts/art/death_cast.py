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
